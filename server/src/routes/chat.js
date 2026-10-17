const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ---- Presence: "online" means the user called the chat API in the last 25 seconds (kept in memory) ----
const lastSeen = new Map();
const ONLINE_MS = 25000;
const touch = (id) => { lastSeen.set(id, Date.now()); if (lastSeen.size > 20000) lastSeen.clear(); };
const presence = (id) => {
  const t = lastSeen.get(id);
  return { online: !!t && Date.now() - t < ONLINE_MS, last_seen: t ? new Date(t).toISOString() : null };
};

// ---- Sending limit: 20 messages per minute per person ----
const sendLog = new Map();
function sendAllowed(userId) {
  const now = Date.now();
  const recent = (sendLog.get(userId) || []).filter((t) => now - t < 60000);
  if (recent.length >= 20) { sendLog.set(userId, recent); return false; }
  recent.push(now); sendLog.set(userId, recent);
  return true;
}

router.use(authenticateToken, requireRole('employee', 'employer'));
router.use((req, res, next) => { touch(req.user.id); res.set('Cache-Control', 'no-store'); next(); });

const THREAD_SQL = `
  SELECT a.id, a.status, a.employee_id, a.job_id, j.title AS job_title, e.company_name, e.user_id AS employer_user_id, u.name AS applicant_name
  FROM applications a JOIN jobs j ON a.job_id = j.id JOIN employers e ON j.employer_id = e.id JOIN users u ON a.employee_id = u.id`;

function describe(a, me, msgs) {
  const isEmployer = Number(a.employer_user_id) === me.id;
  const otherId = isEmployer ? Number(a.employee_id) : Number(a.employer_user_id);
  const employerStarted = msgs.some((m) => m.sender_id === Number(a.employer_user_id));
  const approved = a.status === 'approved';
  const last = msgs[msgs.length - 1] || null;
  return {
    application_id: a.id, job_title: a.job_title, status: a.status, my_role: isEmployer ? 'employer' : 'employee',
    other: { id: otherId, name: isEmployer ? a.applicant_name : a.company_name, ...presence(otherId) },
    last_message: last ? { body: last.body, created_at: last.created_at, mine: last.sender_id === me.id } : null,
    unread: msgs.filter((m) => m.sender_id !== me.id && !m.read_at).length,
    locked: !approved,
    can_send: approved && (isEmployer || employerStarted),
    waiting_for_employer: approved && !isEmployer && !employerStarted,
    _count: msgs.length,
  };
}

async function findThread(appId, me) {
  if (!Number.isInteger(appId)) return null;
  const r = await query(`${THREAD_SQL} WHERE a.id = $1 AND (a.employee_id = $2 OR e.user_id = $2)`, [appId, me.id]);
  return r.rows[0] || null;
}

router.get('/conversations', async (req, res) => {
  try {
    const me = req.user;
    const threads = (await query(`${THREAD_SQL} WHERE a.employee_id = $1 OR e.user_id = $1 ORDER BY a.created_at DESC`, [me.id])).rows;
    const ids = threads.map((t) => t.id);
    const msgs = ids.length ? (await query('SELECT id, application_id, sender_id, body, created_at, read_at FROM chat_messages WHERE application_id = ANY($1) ORDER BY id', [ids])).rows : [];
    const byApp = new Map();
    msgs.forEach((m) => { if (!byApp.has(m.application_id)) byApp.set(m.application_id, []); byApp.get(m.application_id).push(m); });

    const list = threads
      .map((a) => describe(a, me, byApp.get(a.id) || []))
      .filter((c) => c.status === 'approved' || (c.status === 'rejected' && c._count > 0))
      .map(({ _count, ...c }) => c);
    list.sort((x, y) => new Date(y.last_message?.created_at || 0) - new Date(x.last_message?.created_at || 0));
    res.json({ conversations: list, unread_total: list.reduce((n, c) => n + c.unread, 0) });
  } catch (err) {
    console.error('Chat conversations error:', err.message);
    res.status(500).json({ message: 'Could not load conversations.' });
  }
});

router.get('/:appId/messages', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const a = await findThread(appId, req.user);
    if (!a) return res.status(404).json({ message: 'Conversation not found.' });
    await query('UPDATE chat_messages SET read_at = NOW() WHERE application_id = $1 AND sender_id <> $2 AND read_at IS NULL', [appId, req.user.id]);
    const msgs = (await query('SELECT id, application_id, sender_id, body, created_at, read_at FROM chat_messages WHERE application_id = $1 ORDER BY id', [appId])).rows;
    const { _count, ...meta } = describe(a, req.user, msgs);
    res.json({ conversation: meta, messages: msgs });
  } catch (err) {
    console.error('Chat messages error:', err.message);
    res.status(500).json({ message: 'Could not load messages.' });
  }
});

router.post('/:appId/messages', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const a = await findThread(appId, req.user);
    if (!a) return res.status(404).json({ message: 'Conversation not found.' });
    const msgs = (await query('SELECT sender_id FROM chat_messages WHERE application_id = $1', [appId])).rows;
    const { _count, ...meta } = describe(a, req.user, msgs);
    if (meta.locked) return res.status(403).json({ message: 'Messaging is closed because this application was not approved.' });
    if (!meta.can_send) return res.status(403).json({ message: 'Please wait for the employer to start the conversation.' });
    const body = String(req.body?.body || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
    if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
    if (body.length > 2000) return res.status(400).json({ message: 'Message is too long (2000 characters max).' });
    if (!sendAllowed(req.user.id)) return res.status(429).json({ message: 'You are sending messages too fast. Please wait a moment.' });

    const ins = await query('INSERT INTO chat_messages (application_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id, application_id, sender_id, body, created_at, read_at', [appId, req.user.id, body]);
    res.status(201).json({ message: ins.rows[0] });
  } catch (err) {
    console.error('Chat send error:', err.message);
    res.status(500).json({ message: 'Could not send message.' });
  }
});

module.exports = router;
