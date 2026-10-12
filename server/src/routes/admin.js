const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { cleanStr } = require('../lib/validate');
const { audit } = require('../lib/audit');
const { sendMailLater } = require('../lib/mailer');
const { CLIENT_URL } = require('../lib/env');

router.use(authenticateToken, requireRole('admin'));

const fail = (res, label, err, msg) => { console.error(label, err.message); res.status(500).json({ message: msg }); };
const notify = (uid, title, message, type, link = null) =>
  query('INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)', [uid, title, message, type, link]);

router.get('/stats', async (req, res) => {
  try {
    const [u, j, a] = await Promise.all([
      query('SELECT role, status, count(*)::int AS count FROM users GROUP BY role, status'),
      query('SELECT status, count(*)::int AS count FROM jobs GROUP BY status'),
      query('SELECT status, count(*)::int AS count FROM applications GROUP BY status'),
    ]);
    const s = { totalUsers: 0, pendingEmployers: 0, approvedEmployers: 0, totalEmployees: 0, totalJobs: 0, activeJobs: 0, totalApplications: 0, approvedApplications: 0, rejectedApplications: 0 };
    u.rows.forEach((r) => {
      s.totalUsers += r.count;
      if (r.role === 'employer' && r.status === 'pending') s.pendingEmployers += r.count;
      if (r.role === 'employer' && r.status === 'approved') s.approvedEmployers += r.count;
      if (r.role === 'employee') s.totalEmployees += r.count;
    });
    j.rows.forEach((r) => { s.totalJobs += r.count; if (r.status === 'active') s.activeJobs += r.count; });
    a.rows.forEach((r) => {
      s.totalApplications += r.count;
      if (r.status === 'approved') s.approvedApplications += r.count;
      if (r.status === 'rejected') s.rejectedApplications += r.count;
    });
    res.json({ stats: s });
  } catch (err) { fail(res, 'Admin stats error:', err, 'Failed to retrieve stats.'); }
});

router.get('/pending-employers', async (req, res) => {
  try {
    const r = await query(
      `SELECT e.*, u.name, u.email, u.phone, u.status AS user_status, u.created_at AS registered_at
       FROM employers e JOIN users u ON e.user_id = u.id WHERE u.status = 'pending' ORDER BY u.created_at ASC`);
    res.json({ employers: r.rows });
  } catch (err) { fail(res, 'Pending employers error:', err, 'Failed to retrieve pending employers.'); }
});

// Approve a pending employer (only from "pending")
router.patch('/employers/:userId/approve', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const r = await query("UPDATE users SET status = 'approved', updated_at = NOW() WHERE id = $1 AND role = 'employer' AND status = 'pending' RETURNING id, email, name", [userId]);
    if (!r.rows.length) return res.status(409).json({ message: 'This employer is not waiting for review.' });
    await notify(userId, 'Business Verified - one last step', 'Your business was verified by our team. Pay the 5,000 RWF verification fee to activate your account and start posting jobs.', 'employer_approval', '/employer/status');
    sendMailLater({ to: r.rows[0].email, subject: 'Your business was verified on Akazi', title: 'Your business is verified', intro: 'One last step: pay the 5,000 RWF verification fee to activate your account and start posting jobs.', ctaLabel: 'Complete payment', ctaUrl: `${CLIENT_URL}/employer/payment` });
    audit(req, 'employer.approved', 'user', userId);
    res.json({ message: 'Employer account approved successfully.' });
  } catch (err) { fail(res, 'Approve employer error:', err, 'Failed to approve employer.'); }
});

router.patch('/employers/:userId/reject', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const reason = cleanStr(req.body?.reason, 500) || 'Business verification documents could not be validated. Please contact support.';
    const r = await query("UPDATE users SET status = 'rejected', updated_at = NOW() WHERE id = $1 AND role = 'employer' AND status = 'pending' RETURNING id, email", [userId]);
    if (!r.rows.length) return res.status(409).json({ message: 'This employer is not waiting for review.' });
    await notify(userId, 'Employer Verification Declined', `Your verification request was not approved: ${reason}`, 'employer_approval', '/profile');
    sendMailLater({ to: r.rows[0].email, subject: 'Update on your Akazi verification', title: 'Verification not approved', intro: `Your verification request was not approved: ${reason}` });
    audit(req, 'employer.rejected', 'user', userId, { reason });
    res.json({ message: 'Employer registration declined.' });
  } catch (err) { fail(res, 'Reject employer error:', err, 'Failed to reject employer.'); }
});

router.get('/employers', async (req, res) => {
  try {
    const r = await query(
      `SELECT e.*, u.name, u.email, u.phone, u.status AS user_status, u.created_at AS registered_at,
              (SELECT COUNT(*)::int FROM jobs WHERE employer_id = e.id) AS job_count
       FROM employers e JOIN users u ON e.user_id = u.id ORDER BY u.created_at DESC`);
    res.json({ employers: r.rows });
  } catch (err) { fail(res, 'Get all employers error:', err, 'Failed to retrieve employers.'); }
});

router.get('/users', async (req, res) => {
  try {
    const r = await query(
      `SELECT u.id, u.role, u.status, u.name, u.email, u.phone, u.created_at, u.updated_at, (u.email_verified_at IS NOT NULL) AS email_verified, js.gender
       FROM users u LEFT JOIN job_seekers js ON js.user_id = u.id ORDER BY u.created_at DESC`);
    res.json({ users: r.rows });
  } catch (err) { fail(res, 'Get all users error:', err, 'Failed to retrieve users.'); }
});

// Suspend or reactivate a user. Verification decisions go through approve/reject, and admins are protected.
router.patch('/users/:id/status', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const status = req.body?.status;
    if (!['approved', 'suspended'].includes(status)) return res.status(400).json({ message: 'Status must be approved (reactivate) or suspended.' });
    if (userId === req.user.id) return res.status(400).json({ message: 'You cannot alter your own admin account status.' });
    const t = (await query('SELECT id, role, status FROM users WHERE id = $1', [userId])).rows[0];
    if (!t) return res.status(404).json({ message: 'User not found.' });
    if (t.role === 'admin') return res.status(403).json({ message: 'Administrator accounts cannot be changed here.' });
    if (status === 'approved' && ['pending', 'rejected'].includes(t.status)) {
      return res.status(400).json({ message: 'Use the employer verification review to approve this account.' });
    }
    await query('UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2', [status, userId]);
    audit(req, `user.${status === 'suspended' ? 'suspended' : 'reactivated'}`, 'user', userId);
    res.json({ message: `User status changed to ${status}.` });
  } catch (err) { fail(res, 'Update user status error:', err, 'Failed to update user status.'); }
});

router.get('/jobs', async (req, res) => {
  try {
    const r = await query(
      `SELECT j.*, e.company_name, e.logo_url, u.email AS employer_email,
              (SELECT COUNT(*)::int FROM applications WHERE job_id = j.id) AS applicant_count
       FROM jobs j JOIN employers e ON j.employer_id = e.id JOIN users u ON e.user_id = u.id ORDER BY j.created_at DESC`);
    res.json({ jobs: r.rows });
  } catch (err) { fail(res, 'Admin get jobs error:', err, 'Failed to retrieve platform jobs.'); }
});

router.delete('/jobs/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const j = (await query('SELECT j.title, e.user_id AS employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [jobId])).rows[0];
    if (!j) return res.status(404).json({ message: 'Job not found.' });
    await query('DELETE FROM jobs WHERE id = $1', [jobId]);
    await notify(j.employer_user_id, 'Job Posting Removed', `Your job posting "${j.title}" was removed by Akazi moderation for violating platform guidelines.`, 'system');
    audit(req, 'job.removed_by_admin', 'job', jobId, { title: j.title });
    res.json({ message: 'Job posting successfully removed by admin.' });
  } catch (err) { fail(res, 'Admin delete job error:', err, 'Failed to delete job.'); }
});

// Recent security-relevant actions
router.get('/audit', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const r = await query(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.meta, l.ip, l.created_at, u.email AS actor_email
       FROM audit_log l LEFT JOIN users u ON u.id = l.actor_id ORDER BY l.id DESC LIMIT $1`, [limit]);
    res.json({ entries: r.rows });
  } catch (err) { fail(res, 'Audit log error:', err, 'Failed to load the audit log.'); }
});

module.exports = router;
