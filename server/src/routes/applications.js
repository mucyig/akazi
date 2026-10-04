const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// 1. POST /api/applications - Submit an application (Job Seeker)
router.post('/', authenticateToken, requireRole('employee'), upload.fields([
  { name: 'resume', maxCount: 1 },
  { name: 'attachments', maxCount: 5 }
]), async (req, res) => {
  try {
    const { job_id, submitted_data } = req.body;

    if (!job_id) {
      return res.status(400).json({ message: 'job_id is required.' });
    }

    const jobId = parseInt(job_id, 10);

    // Verify job is active
    const jobRes = await query(`
      SELECT j.*, e.company_name, e.user_id as employer_user_id 
      FROM jobs j 
      JOIN employers e ON j.employer_id = e.id 
      WHERE j.id = $1 AND j.status = 'active'
    `, [jobId]);

    if (jobRes.rows.length === 0) {
      return res.status(404).json({ message: 'This job posting is no longer active or was not found.' });
    }

    const job = jobRes.rows[0];

    // Check if already applied
    const existing = await query('SELECT id FROM applications WHERE job_id = $1 AND employee_id = $2', [jobId, req.user.id]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'You have already submitted an application for this position.' });
    }

    // Determine resume URL
    let resume_url = null;
    if (req.files && req.files['resume'] && req.files['resume'][0]) {
      resume_url = `/uploads/resumes/${req.files['resume'][0].filename}`;
    } else {
      // Fallback to seeker's profile resume
      const profileRes = await query('SELECT resume_url FROM job_seekers WHERE user_id = $1', [req.user.id]);
      if (profileRes.rows.length > 0) {
        resume_url = profileRes.rows[0].resume_url;
      }
    }

    // Process extra attachments
    const uploaded_files = [];
    if (req.files && req.files['attachments']) {
      req.files['attachments'].forEach(f => {
        uploaded_files.push({
          name: f.originalname,
          url: `/uploads/attachments/${f.filename}`,
          size: f.size,
          mimetype: f.mimetype
        });
      });
    }

    const parsedData = typeof submitted_data === 'string' ? JSON.parse(submitted_data || '{}') : (submitted_data || {});

    const insertSql = `
      INSERT INTO applications (job_id, employee_id, submitted_data, uploaded_files, resume_url, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `;

    const appRes = await query(insertSql, [
      jobId,
      req.user.id,
      JSON.stringify(parsedData),
      JSON.stringify(uploaded_files),
      resume_url
    ]);

    // Send in-app notification to employer
    try {
      await query(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
        [
          job.employer_user_id,
          'New Applicant Received',
          `${req.user.name} submitted an application for ${job.title}.`,
          'new_application',
          `/employer/applicants/${job.id}`
        ]
      );
    } catch (e) {
      console.warn('Failed to send application notification to employer', e);
    }

    // Confirmation notification to employee
    try {
      await query(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
        [
          req.user.id,
          'Application Submitted',
          `Your application for ${job.title} at ${job.company_name} was delivered.`,
          'application_status',
          '/applications'
        ]
      );
    } catch (e) {
      console.warn('Failed to send confirmation notification to employee', e);
    }

    res.status(201).json({
      message: 'Application submitted successfully!',
      application: appRes.rows[0]
    });
  } catch (err) {
    console.error('Submit application error:', err);
    res.status(500).json({ message: 'Error submitting application.', error: err.message });
  }
});

// 2. GET /api/applications/my - Job seeker dashboard
router.get('/my', authenticateToken, requireRole('employee'), async (req, res) => {
  try {
    const sql = `
      SELECT a.*,
             j.title as job_title,
             j.location as job_location,
             j.job_type,
             j.salary_range,
             e.company_name,
             e.logo_url as company_logo
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN employers e ON j.employer_id = e.id
      WHERE a.employee_id = $1
      ORDER BY a.created_at DESC
    `;

    const result = await query(sql, [req.user.id]);
    res.json({ applications: result.rows || [] });
  } catch (err) {
    console.error('Fetch my applications error:', err);
    res.status(500).json({ message: 'Failed to retrieve applications.', error: err.message });
  }
});

// 3. GET /api/applications/job/:jobId - List applicants for a job
router.get('/job/:jobId', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);

    // Verify job belongs to this employer or user is admin
    const jobRes = await query(`
      SELECT j.*, e.user_id as employer_user_id, e.company_name 
      FROM jobs j 
      JOIN employers e ON j.employer_id = e.id 
      WHERE j.id = $1
    `, [jobId]);

    if (jobRes.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = jobRes.rows[0];
    if (req.user.role !== 'admin' && job.employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to view applicants for this job.' });
    }

    const sql = `
      SELECT a.*,
             u.name as applicant_name,
             u.email as applicant_email,
             u.phone as applicant_phone,
             js.skills as applicant_skills,
             js.headline as applicant_headline,
             js.resume_url as profile_resume_url,
             js.portfolio_url
      FROM applications a
      JOIN users u ON a.employee_id = u.id
      LEFT JOIN job_seekers js ON js.user_id = u.id
      WHERE a.job_id = $1
      ORDER BY a.created_at DESC
    `;

    const appsRes = await query(sql, [jobId]);

    res.json({
      job,
      applicants: appsRes.rows || []
    });
  } catch (err) {
    console.error('Fetch job applicants error:', err);
    res.status(500).json({ message: 'Failed to retrieve applicants.', error: err.message });
  }
});

// 4. PATCH /api/applications/:id/reject - Reject candidate with optional reason
router.patch('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.id, 10);
    const { rejection_reason } = req.body;

    // Verify ownership
    const appRes = await query(`
      SELECT a.*, j.title as job_title, e.company_name, e.user_id as employer_user_id
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN employers e ON j.employer_id = e.id
      WHERE a.id = $1
    `, [appId]);

    if (appRes.rows.length === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const app = appRes.rows[0];
    if (req.user.role !== 'admin' && app.employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to manage this application.' });
    }

    const defaultReason = rejection_reason || 'Thank you for your interest. After careful consideration, we have chosen to move forward with other candidates at this time.';

    await query(
      'UPDATE applications SET status = $1, rejection_reason = $2 WHERE id = $3',
      ['rejected', defaultReason, appId]
    );

    // Notify candidate
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
      [
        app.employee_id,
        'Application Status Update',
        `${app.company_name} has updated the status of your application for ${app.job_title}.`,
        'application_status',
        '/applications'
      ]
    );

    res.json({ message: 'Candidate application rejected.', status: 'rejected' });
  } catch (err) {
    console.error('Reject application error:', err);
    res.status(500).json({ message: 'Failed to update application.', error: err.message });
  }
});

// 5. PATCH /api/applications/:id/approve-interview - Approve and schedule interview
router.patch('/:id/approve-interview', authenticateToken, async (req, res) => {
  try {
    const appId = parseInt(req.params.id, 10);
    const { date, time, timezone, format, location_or_link, interviewer, notes } = req.body;

    if (!date || !time) {
      return res.status(400).json({ message: 'Interview date and time are required.' });
    }

    // Verify ownership
    const appRes = await query(`
      SELECT a.*, j.title as job_title, e.company_name, e.user_id as employer_user_id
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      JOIN employers e ON j.employer_id = e.id
      WHERE a.id = $1
    `, [appId]);

    if (appRes.rows.length === 0) {
      return res.status(404).json({ message: 'Application not found.' });
    }

    const app = appRes.rows[0];
    if (req.user.role !== 'admin' && app.employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to schedule interview.' });
    }

    const interviewDetails = {
      date,
      time,
      timezone: timezone || 'UTC',
      format: format || 'Video Call',
      location_or_link: location_or_link || 'Link will be emailed prior to meeting',
      interviewer: interviewer || app.company_name,
      notes: notes || 'Please prepare your portfolio/experience overview.',
      scheduled_at: new Date().toISOString()
    };

    await query(
      'UPDATE applications SET status = $1, interview_details = $2 WHERE id = $3',
      ['approved', JSON.stringify(interviewDetails), appId]
    );

    // Notify candidate
    await query(
      'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
      [
        app.employee_id,
        'Interview Invitation Scheduled!',
        `Congratulations! ${app.company_name} invited you to interview for ${app.job_title} on ${date} at ${time}.`,
        'interview_scheduled',
        '/applications'
      ]
    );

    res.json({
      message: 'Application approved and interview scheduled.',
      status: 'approved',
      interview_details: interviewDetails
    });
  } catch (err) {
    console.error('Schedule interview error:', err);
    res.status(500).json({ message: 'Failed to schedule interview.', error: err.message });
  }
});

module.exports = router;
