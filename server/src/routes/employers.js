const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// GET /api/employers/dashboard - metrics for the signed-in employer
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') return res.status(403).json({ message: 'Employer account required.' });
    const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
    if (!empRes.rows.length) return res.status(404).json({ message: 'Employer profile not found.' });
    const employer = empRes.rows[0];

    const jobsRes = await query(
      `SELECT j.*, (SELECT COUNT(*)::int FROM applications a WHERE a.job_id = j.id) AS applicant_count
       FROM jobs j WHERE j.employer_id = $1 ORDER BY j.created_at DESC`, [employer.id]);
    const jobs = jobsRes.rows;

    let metrics = { totalApplicants: 0, pendingApplicants: 0, scheduledInterviews: 0, rejectedApplicants: 0 };
    let recentApplicants = [];
    if (jobs.length) {
      const appsRes = await query(
        `SELECT a.id, a.job_id, a.status, a.created_at, j.title AS job_title, u.name AS applicant_name, u.email AS applicant_email,
                js.skills AS applicant_skills, js.headline AS applicant_headline
         FROM applications a JOIN jobs j ON a.job_id = j.id JOIN users u ON a.employee_id = u.id
         LEFT JOIN job_seekers js ON js.user_id = u.id
         WHERE j.employer_id = $1 ORDER BY a.created_at DESC`, [employer.id]);
      const all = appsRes.rows;
      metrics = {
        totalApplicants: all.length,
        pendingApplicants: all.filter((a) => a.status === 'pending').length,
        scheduledInterviews: all.filter((a) => a.status === 'approved').length,
        rejectedApplicants: all.filter((a) => a.status === 'rejected').length,
      };
      recentApplicants = all.slice(0, 5);
    }

    res.json({
      employer, accountStatus: req.user.status,
      metrics: { totalJobs: jobs.length, activeJobs: jobs.filter((j) => j.status === 'active').length, ...metrics },
      jobs, recentApplicants,
    });
  } catch (err) {
    console.error('Employer dashboard error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve employer dashboard.' });
  }
});

router.get('/my-jobs', authenticateToken, async (req, res) => {
  try {
    const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
    if (!empRes.rows.length) return res.status(404).json({ message: 'Employer profile not found.' });
    const result = await query(
      `SELECT j.*,
              (SELECT COUNT(*)::int FROM applications WHERE job_id = j.id) AS applicant_count,
              (SELECT COUNT(*)::int FROM applications WHERE job_id = j.id AND status = 'pending') AS pending_count,
              (SELECT COUNT(*)::int FROM applications WHERE job_id = j.id AND status = 'approved') AS approved_count
       FROM jobs j WHERE j.employer_id = $1 ORDER BY j.created_at DESC`, [empRes.rows[0].id]);
    res.json({ jobs: result.rows });
  } catch (err) {
    console.error('Fetch employer jobs error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve jobs.' });
  }
});

// Public profile: only verified employers, and never private business documents or payment details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Employer not found.' });
    const r = await query(
      `SELECT e.id, e.company_name, e.industry, e.website, e.location, e.description, e.logo_url, e.contact_person, e.created_at, u.status AS user_status
       FROM employers e JOIN users u ON e.user_id = u.id WHERE e.id = $1`, [id]);
    const employer = r.rows[0];
    if (!employer || (employer.user_status !== 'approved' && req.user?.role !== 'admin')) {
      return res.status(404).json({ message: 'Employer not found.' });
    }
    const jobs = await query(
      `SELECT * FROM jobs WHERE employer_id = $1 AND status = 'active'
         AND (deadline IS NULL OR deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date) ORDER BY created_at DESC`, [id]);
    res.json({ employer, jobs: jobs.rows });
  } catch (err) {
    console.error('Fetch employer profile error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve employer.' });
  }
});

module.exports = router;
