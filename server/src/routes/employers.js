const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// 1. GET /api/employers/dashboard - Metrics for logged-in employer
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Employer account required.' });
    }

    const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer profile not found.' });
    }
    const employer = empRes.rows[0];

    // Jobs posted by this employer
    const jobsRes = await query(`
      SELECT j.*,
             (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applicant_count
      FROM jobs j
      WHERE j.employer_id = $1
      ORDER BY j.created_at DESC
    `, [employer.id]);
    const jobs = jobsRes.rows || [];

    // Applicants count & status breakdown
    const jobIds = jobs.map(j => j.id);
    let totalApplicants = 0;
    let pendingApplicants = 0;
    let scheduledInterviews = 0;
    let rejectedApplicants = 0;
    let recentApplicants = [];

    if (jobIds.length > 0) {
      const appsRes = await query(`
        SELECT a.*, j.title as job_title, u.name as applicant_name, u.email as applicant_email,
               js.skills as applicant_skills, js.headline as applicant_headline
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        JOIN users u ON a.employee_id = u.id
        LEFT JOIN job_seekers js ON js.user_id = u.id
        WHERE j.employer_id = $1
        ORDER BY a.created_at DESC
      `, [employer.id]);

      const allApps = appsRes.rows || [];
      totalApplicants = allApps.length;
      pendingApplicants = allApps.filter(a => a.status === 'pending').length;
      scheduledInterviews = allApps.filter(a => a.status === 'approved').length;
      rejectedApplicants = allApps.filter(a => a.status === 'rejected').length;
      recentApplicants = allApps.slice(0, 5);
    }

    res.json({
      employer,
      accountStatus: req.user.status,
      metrics: {
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.status === 'active').length,
        totalApplicants,
        pendingApplicants,
        scheduledInterviews,
        rejectedApplicants
      },
      jobs,
      recentApplicants
    });
  } catch (err) {
    console.error('Employer dashboard error:', err);
    res.status(500).json({ message: 'Failed to retrieve employer dashboard.', error: err.message });
  }
});

// 2. GET /api/employers/my-jobs - All jobs for logged-in employer with applicant counts
router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer profile not found.' });
    }
    const employerId = empRes.rows[0].id;

    const sql = `
      SELECT j.*,
             (SELECT COUNT(*) FROM applications WHERE job_id = j.id) as applicant_count,
             (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'pending') as pending_count,
             (SELECT COUNT(*) FROM applications WHERE job_id = j.id AND status = 'approved') as approved_count
      FROM jobs j
      WHERE j.employer_id = $1
      ORDER BY j.created_at DESC
    `;

    const result = await query(sql, [employerId]);
    res.json({ jobs: result.rows || [] });
  } catch (err) {
    console.error('Fetch employer jobs error:', err);
    res.status(500).json({ message: 'Failed to retrieve jobs.' });
  }
});

// 3. GET /api/employers/:id - Public profile of an employer
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const empRes = await query(`
      SELECT e.*, u.status as user_status
      FROM employers e
      JOIN users u ON e.user_id = u.id
      WHERE e.id = $1
    `, [id]);

    if (empRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer not found.' });
    }

    const employer = empRes.rows[0];

    // Fetch active jobs
    const jobsRes = await query(`
      SELECT * FROM jobs 
      WHERE employer_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `, [id]);

    res.json({
      employer,
      jobs: jobsRes.rows || []
    });
  } catch (err) {
    console.error('Fetch employer profile error:', err);
    res.status(500).json({ message: 'Failed to retrieve employer.' });
  }
});

module.exports = router;
