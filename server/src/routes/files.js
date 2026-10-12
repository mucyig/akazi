// Private file access. Files are never served by path: a signed-in user asks for a short-lived link to one file
// and the server first checks that this user is allowed to see it.
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const storage = require('../lib/storage');
const { audit } = require('../lib/audit');

// Who may open which key
async function canAccess(user, key) {
  if (user.role === 'admin') return true;
  const v = storage.keyVariants(key);
  const folder = key.split('/')[0];

  if (folder === 'logos') return true;

  if (folder === 'documents') {
    const r = await query('SELECT 1 FROM employers WHERE user_id = $1 AND registration_doc_url = ANY($2) LIMIT 1', [user.id, v]);
    return r.rows.length > 0;
  }

  if (folder === 'resumes') {
    if (user.role === 'employee') {
      const r = await query(
        `SELECT 1 FROM job_seekers WHERE user_id = $1 AND resume_url = ANY($2)
         UNION SELECT 1 FROM applications WHERE employee_id = $1 AND resume_url = ANY($2) LIMIT 1`, [user.id, v]);
      return r.rows.length > 0;
    }
    if (user.role === 'employer') {
      const r = await query(
        `SELECT 1 FROM applications a JOIN jobs j ON j.id = a.job_id JOIN employers e ON e.id = j.employer_id
         WHERE e.user_id = $1 AND a.resume_url = ANY($2) LIMIT 1`, [user.id, v]);
      return r.rows.length > 0;
    }
    return false;
  }

  if (folder === 'attachments') {
    const filter = `EXISTS (SELECT 1 FROM jsonb_array_elements(a.uploaded_files) f WHERE f->>'key' = $2 OR f->>'url' = ANY($3))`;
    if (user.role === 'employee') {
      const r = await query(`SELECT 1 FROM applications a WHERE a.employee_id = $1 AND ${filter} LIMIT 1`, [user.id, key, v]);
      return r.rows.length > 0;
    }
    if (user.role === 'employer') {
      const r = await query(
        `SELECT 1 FROM applications a JOIN jobs j ON j.id = a.job_id JOIN employers e ON e.id = j.employer_id
         WHERE e.user_id = $1 AND ${filter} LIMIT 1`, [user.id, key, v]);
      return r.rows.length > 0;
    }
  }
  return false;
}

// GET /api/files/url?key=resumes/abc.pdf  ->  { url }  (valid for 5 minutes)
router.get('/url', authenticateToken, async (req, res) => {
  try {
    const key = storage.normalizeKey(req.query.key);
    if (!key) return res.status(400).json({ message: 'Invalid file reference.' });
    if (!(await canAccess(req.user, key))) return res.status(404).json({ message: 'File not found or you do not have access to it.' });
    const url = await storage.getDownloadUrl(key, { expiresIn: 300 });
    if (key.startsWith('documents/') || key.startsWith('resumes/')) audit(req, 'file.opened', 'file', key);
    res.set('Cache-Control', 'no-store');
    res.json({ url, expires_in: 300 });
  } catch (err) {
    console.error('File url error:', err.message);
    res.status(500).json({ message: 'Could not open the file. Please try again.' });
  }
});

// Company logos are public so they can be shown to everyone
router.get('/public/logos/:name', async (req, res) => {
  try {
    const key = storage.normalizeKey(`logos/${req.params.name}`);
    if (!key) return res.status(404).end();
    const f = await storage.getStream(key);
    if (!f) return res.status(404).end();
    res.set({ 'Content-Type': storage.contentTypeFor(key), 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" });
    f.stream.on('error', () => res.destroy());
    f.stream.pipe(res);
  } catch { res.status(404).end(); }
});

// Local development only: serves a file for a link signed by this server
router.get('/local', async (req, res) => {
  try {
    if (storage.mode !== 'local') return res.status(404).end();
    const { key, exp, sig } = req.query;
    if (typeof key !== 'string' || !storage.verifyLocalSignature(key, exp, sig)) return res.status(403).json({ message: 'This link is invalid or has expired.' });
    const f = await storage.getStream(key);
    if (!f) return res.status(404).json({ message: 'File not found.' });
    res.set({
      'Content-Type': storage.contentTypeFor(key),
      'Content-Disposition': `${storage.dispositionFor(key)}; filename="${key.split('/').pop()}"`,
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
    });
    f.stream.on('error', () => res.destroy());
    f.stream.pipe(res);
  } catch { res.status(404).end(); }
});

module.exports = router;
