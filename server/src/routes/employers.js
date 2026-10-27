const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { upload, storeUpload, discardUploads } = require('../middleware/upload');
const { cleanStr } = require('../lib/validate');

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

// Public profile: only approved employers, and never private business documents or payment details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(404).json({ message: 'Employer not found.' });
    const r = await query(
      `SELECT e.id, e.company_name, e.industry, e.website, e.location, e.description, e.logo_url, e.contact_person, e.is_verified, e.created_at, u.status AS user_status
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

// Employer applies for an official Verified Tick
router.post('/apply-verification', authenticateToken, upload.single('verification_doc'), async (req, res) => {
  const stored = [];
  try {
    if (req.user.role !== 'employer') return res.status(403).json({ message: 'Employer account required.' });
    const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
    if (!empRes.rows.length) return res.status(404).json({ message: 'Employer profile not found.' });
    const employer = empRes.rows[0];

    let doc_key = null;
    if (req.file) {
      doc_key = await storeUpload(req.file, 'documents', req);
      stored.push(doc_key);
    } else if (!employer.registration_doc_url && !employer.verification_tick_doc_url) {
      return res.status(400).json({ message: 'Please upload an official business document (such as an RDB certificate or business license) to apply for the verified tick.' });
    }

    const notes = cleanStr(req.body?.notes, 1000) || '';
    const targetDoc = doc_key || employer.verification_tick_doc_url || employer.registration_doc_url;

    await query(
      `UPDATE employers
       SET verification_tick_status = 'applied',
           verification_applied_at = NOW(),
           verification_tick_doc_url = $1,
           verification_tick_notes = $2
       WHERE id = $3`,
      [targetDoc, notes, employer.id]
    );

    const admins = await query("SELECT id FROM users WHERE role = 'admin'");
    for (const a of admins.rows) {
      await query(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)',
        [a.id, 'New Verification Tick Application', `${employer.company_name} applied for the Akazi Verified Business Tick.`, 'employer_approval', '/admin']
      );
    }

    res.json({ message: 'Your application for the Verified Business Tick has been submitted. Our team will review your business credentials.' });
  } catch (err) {
    if (stored.length) await discardUploads(stored);
    console.error('Apply verification error:', err.message);
    res.status(500).json({ message: 'Failed to submit verification application.' });
  }
});

// Upload or update company logo
router.post('/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  const stored = [];
  try {
    if (req.user.role !== 'employer' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Employer account required.' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Please select an image file to upload as company logo.' });
    }
    if (!/\.(png|jpe?g|webp)$/i.test(req.file.originalname || '')) {
      return res.status(400).json({ message: 'Company logo must be an image (PNG, JPG, or WEBP).' });
    }

    const empRes = await query('SELECT id, logo_url FROM employers WHERE user_id = $1', [req.user.id]);
    if (!empRes.rows.length) {
      return res.status(404).json({ message: 'Employer profile not found.' });
    }

    const logoKey = await storeUpload(req.file, 'logos', req);
    stored.push(logoKey);

    await query('UPDATE employers SET logo_url = $1 WHERE user_id = $2', [logoKey, req.user.id]);

    res.json({ message: 'Company logo updated successfully.', logo_url: logoKey });
  } catch (err) {
    if (stored.length) await discardUploads(stored);
    console.error('Update employer logo error:', err.message);
    res.status(500).json({ message: 'Failed to update company logo.' });
  }
});

module.exports = router;
