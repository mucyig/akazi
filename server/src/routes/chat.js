const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// ---- Tiny file-backed message store (works with Postgres or the JSON fallback DB) ----
const DIR = path.join(__dirname, '../../data');
const FILE = path.join(DIR, 'chat.json');
let store = null;

function load() {
  if (store) return store;
  try {
    store = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    store = { seq: 0, messages: [] };
  }
  return store;
}
function save() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store), 'utf8');
}

// ---- Presence: a user is "online" if they hit the chat API in the last 25s ----
const lastSeen = new Map();
const ONLINE_MS = 25000;
const touch = (id) => lastSeen.set(id, Date.now());
const presence = (id) => {
  const t = lastSeen.get(id);
  return { online: !!t && Date.now() - t < ONLINE_MS, last_seen: t ? new Date(t).toISOString() : null };
};

router.use(authenticateToken, requireRole('employee', 'employer'));
router.use((req, res, next) => {
  touch(req.user.id);
  res.set('Cache-Control', 'no-store');
  next();
});

async function allThreads() {
  const r = await query(`
    SELECT a.id, a.status, a.employee_id, a.job_id,
           j.title as job_title,
           e.company_name, e.user_id as employer_user_id,
           u.name as applicant_name
    FROM applications a
    JOIN jobs j ON a.job_id = j.id
    JOIN employers e ON j.employer_id = e.id
    JOIN users u ON a.employee_id = u.id
    ORDER BY a.created_at DESC
  `);
  return r.rows || [];
}

function describe(a, me) {
  const s = load();
  const msgs = s.messages.filter((m) => m.application_id === a.id);
  const isEmployer = Number(a.employer_user_id) === me.id;
  const otherId = isEmployer ? Number(a.employee_id) : Number(a.employer_user_id);
  const employerStarted = msgs.some((m) => m.sender_id === Number(a.employer_user_id));
  const approved = a.status === 'approved';
  const last = msgs[msgs.length - 1] || null;
  return {
    application_id: a.id,
    job_title: a.job_title,
    status: a.status,
    my_role: isEmployer ? 'employer' : 'employee',
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
  const a = (await allThreads()).find(
    (x) => Number(x.id) === appId && (Number(x.employer_user_id) === me.id || Number(x.employee_id) === me.id)
  );
  return a || null;
}

router.get('/conversations', async (req, res) => {
  try {
    const me = req.user;
    const list = (await allThreads())
      .filter((a) => Number(a.employer_user_id) === me.id || Number(a.employee_id) === me.id)
      .map((a) => describe(a, me))
      .filter((c) => c.status === 'approved' || (c.status === 'rejected' && c._count > 0))
      .map(({ _count, ...c }) => c);
    list.sort((x, y) =>
      new Date(y.last_message?.created_at || 0) - new Date(x.last_message?.created_at || 0)
    );
    res.json({ conversations: list, unread_total: list.reduce((n, c) => n + c.unread, 0) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load conversations.' });
  }
});

router.get('/:appId/messages', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const a = await findThread(appId, req.user);
    if (!a) return res.status(404).json({ message: 'Conversation not found.' });
    const s = load();
    let changed = false;
    const now = new Date().toISOString();
    s.messages.forEach((m) => {
      if (m.application_id === appId && m.sender_id !== req.user.id && !m.read_at) {
        m.read_at = now;
        changed = true;
      }
    });
    if (changed) save();
    const { _count, ...meta } = describe(a, req.user);
    res.json({ conversation: meta, messages: s.messages.filter((m) => m.application_id === appId) });
  } catch (err) {
    res.status(500).json({ message: 'Could not load messages.' });
  }
});

router.post('/:appId/messages', async (req, res) => {
  try {
    const appId = parseInt(req.params.appId, 10);
    const a = await findThread(appId, req.user);
    if (!a) return res.status(404).json({ message: 'Conversation not found.' });
    const { _count, ...meta } = describe(a, req.user);
    if (meta.locked) {
      return res.status(403).json({ message: 'Messaging is closed because this application was not approved.' });
    }
    if (!meta.can_send) {
      return res.status(403).json({ message: 'Please wait for the employer to start the conversation.' });
    }
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
    if (body.length > 2000) return res.status(400).json({ message: 'Message is too long (2000 characters max).' });

    const s = load();
    const msg = {
      id: ++s.seq,
      application_id: appId,
      sender_id: req.user.id,
      body,
      created_at: new Date().toISOString(),
      read_at: null,
    };
    s.messages.push(msg);
    save();
    res.status(201).json({ message: msg });
  } catch (err) {
    res.status(500).json({ message: 'Could not send message.' });
  }
});

module.exports = router;
