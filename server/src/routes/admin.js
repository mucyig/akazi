const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All endpoints require admin role
router.use(authenticateToken, requireRole('admin'));

// 1. GET /api/admin/stats - Overall platform statistics
router.get('/stats', async (req, res) => {
  try {
    const usersCountRes = await query('SELECT role, status, count(*) FROM users GROUP BY role, status');
    const jobsCountRes = await query('SELECT status, count(*) FROM jobs GROUP BY status');
    const appsCountRes = await query('SELECT status, count(*) FROM applications GROUP BY status');

    let totalUsers = 0;
    let pendingEmployers = 0;
    let approvedEmployers = 0;
    let totalEmployees = 0;

    (usersCountRes.rows || []).forEach(r => {
      const count = parseInt(r.count, 10);
      totalUsers += count;
      if (r.role === 'employer' && r.status === 'pending') pendingEmployers += count;
      if (r.role === 'employer' && r.status === 'approved') approvedEmployers += count;
      if (r.role === 'employee') totalEmployees += count;
    });

    let totalJobs = 0;
    let activeJobs = 0;
    (jobsCountRes.rows || []).forEach(r => {
      const count = parseInt(r.count, 10);
      totalJobs += count;
      if (r.status === 'active') activeJobs += count;
    });

    let totalApplications = 0;
    let approvedApplications = 0;
    let rejectedApplications = 0;
    (appsCountRes.rows || []).forEach(r => {
      const count = parseInt(r.count, 10);
      totalApplications += count;
      if (r.status === 'approved') approvedApplications += count;
      if (r.status === 'rejected') rejectedApplications += count;
    });

    res.json({
      stats: {
        totalUsers,
        pendingEmployers,
        approvedEmployers,
        totalEmployees,
        totalJobs,
        activeJobs,
        totalApplications,
        approvedApplications,
        rejectedApplications
      }
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: 'Failed to retrieve stats.', error: err.message });
  }
});

// 2. GET /api/admin/pending-employers - Pending employer verification queue
router.get('/pending-employers', async (req, res) => {
  try {
    const sql = `
      SELECT e.*, u.name, u.email, u.phone, u.status as user_status, u.created_at as registered_at
      FROM employers e
      JOIN users u ON e.user_id = u.id
      WHERE u.status = 'pending'
      ORDER BY u.created_at ASC
    `;

    const result = await query(sql);
    res.json({ employers: result.rows || [] });
  } catch (err) {
    console.error('Pending employers error:', err);
    res.status(500).json({ message: 'Failed to retrieve pending employers.' });
  }
});

// 3. PATCH /api/admin/employers/:userId/approve - Approve employer
router.patch('/employers/:userId/approve', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const userRes = await query('SELECT * FROM users WHERE id = $1 AND role = $2', [userId, 'employer']);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer not found.' });
    }

    await query('UPDATE users SET status = $1 WHERE id = $2', ['approved', userId]);

    // Send in-app notification to employer
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
      [
        userId,
        'Business Verified - one last step',
        'Your business was verified by our team. Pay the 5,000 RWF verification fee to activate your account and start posting jobs.',
        'employer_approval',
        '/employer/status'
      ]
    );

    res.json({ message: 'Employer account approved successfully.' });
  } catch (err) {
    console.error('Approve employer error:', err);
    res.status(500).json({ message: 'Failed to approve employer.', error: err.message });
  }
});

// 4. PATCH /api/admin/employers/:userId/reject - Reject employer
router.patch('/employers/:userId/reject', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { reason } = req.body;

    const userRes = await query('SELECT * FROM users WHERE id = $1 AND role = $2', [userId, 'employer']);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer not found.' });
    }

    await query('UPDATE users SET status = $1 WHERE id = $2', ['rejected', userId]);

    const rejectionMsg = reason || 'Business verification documents could not be validated. Please contact support.';
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
      [
        userId,
        'Employer Verification Declined',
        `Your verification request was not approved: ${rejectionMsg}`,
        'employer_approval',
        '/profile'
      ]
    );

    res.json({ message: 'Employer registration declined.' });
  } catch (err) {
    console.error('Reject employer error:', err);
    res.status(500).json({ message: 'Failed to reject employer.', error: err.message });
  }
});

// 5. GET /api/admin/employers - All employers directory
router.get('/employers', async (req, res) => {
  try {
    const sql = `
      SELECT e.*, u.name, u.email, u.phone, u.status as user_status, u.created_at as registered_at,
             (SELECT COUNT(*) FROM jobs WHERE employer_id = e.id) as job_count
      FROM employers e
      JOIN users u ON e.user_id = u.id
      ORDER BY u.created_at DESC
    `;

    const result = await query(sql);
    res.json({ employers: result.rows || [] });
  } catch (err) {
    console.error('Get all employers error:', err);
    res.status(500).json({ message: 'Failed to retrieve employers.' });
  }
});

// 6. GET /api/admin/users - All users directory
router.get('/users', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, role, status, name, email, phone, created_at, updated_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json({ users: result.rows || [] });
  } catch (err) {
    console.error('Get all users error:', err);
    res.status(500).json({ message: 'Failed to retrieve users.' });
  }
});

// 7. PATCH /api/admin/users/:id/status - Deactivate / Suspend / Reactivate account
router.patch('/users/:id/status', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['approved', 'suspended', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'You cannot alter your own admin account status.' });
    }

    await query('UPDATE users SET status = $1 WHERE id = $2', [status, userId]);

    res.json({ message: `User status changed to ${status}.` });
  } catch (err) {
    console.error('Update user status error:', err);
    res.status(500).json({ message: 'Failed to update user status.', error: err.message });
  }
});

// 8. GET /api/admin/jobs - View all platform jobs
router.get('/jobs', async (req, res) => {
  try {
    const sql = `
      SELECT j.*, e.company_name, e.logo_url, u.email as employer_email,
             (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      JOIN users u ON e.user_id = u.id
      ORDER BY j.created_at DESC
    `;

    const result = await query(sql);
    res.json({ jobs: result.rows || [] });
  } catch (err) {
    console.error('Admin get jobs error:', err);
    res.status(500).json({ message: 'Failed to retrieve platform jobs.' });
  }
});

// 9. DELETE /api/admin/jobs/:id - Remove inappropriate job
router.delete('/jobs/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const jobRes = await query('SELECT j.*, e.user_id as employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [jobId]);

    if (jobRes.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = jobRes.rows[0];
    await query('DELETE FROM jobs WHERE id = $1', [jobId]);

    // Send moderation notice to employer
    await query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)',
      [
        job.employer_user_id,
        'Job Posting Removed',
        `Your job posting "${job.title}" was removed by Akazi moderation for violating platform guidelines.`,
        'system'
      ]
    );

    res.json({ message: 'Job posting successfully removed by admin.' });
  } catch (err) {
    console.error('Admin delete job error:', err);
    res.status(500).json({ message: 'Failed to delete job.', error: err.message });
  }
});

module.exports = router;
