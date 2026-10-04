const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { optionalAuth, authenticateToken, requireActiveEmployer } = require('../middleware/auth');

// 1. GET /api/jobs - Browse and search jobs
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, category, location, job_type, workplace_type } = req.query;

    const sql = `
      SELECT j.*, 
             e.company_name, 
             e.logo_url, 
             e.location as employer_location,
             e.industry,
             (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) as applicant_count
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE j.status = 'active' AND u.status = 'approved'
    `;

    const result = await query(sql, []);
    let jobs = result.rows || [];

    // Filter logic
    if (search) {
      const q = search.toLowerCase();
      jobs = jobs.filter(j => 
        (j.title && j.title.toLowerCase().includes(q)) ||
        (j.company_name && j.company_name.toLowerCase().includes(q)) ||
        (j.description && j.description.toLowerCase().includes(q)) ||
        (j.responsibilities && j.responsibilities.toLowerCase().includes(q)) ||
        (j.requirements && j.requirements.toLowerCase().includes(q)) ||
        (j.working_conditions && j.working_conditions.toLowerCase().includes(q)) ||
        (j.location && j.location.toLowerCase().includes(q))
      );
    }

    if (location && location !== 'all') {
      const loc = location.toLowerCase();
      jobs = jobs.filter(j => 
        (j.location && j.location.toLowerCase().includes(loc)) ||
        (j.workplace_type && j.workplace_type.toLowerCase().includes(loc))
      );
    }

    if (job_type && job_type !== 'all') {
      jobs = jobs.filter(j => j.job_type && j.job_type.toLowerCase() === job_type.toLowerCase());
    }

    // Sort by newest first
    jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ jobs, total: jobs.length });
  } catch (err) {
    console.error('Fetch jobs error:', err);
    res.status(500).json({ message: 'Error retrieving job listings.', error: err.message });
  }
});

// 2. GET /api/jobs/:id - Single job details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const sql = `
      SELECT j.*, 
             e.company_name, 
             e.logo_url, 
             e.website as employer_website,
             e.description as employer_description,
             e.location as employer_location,
             e.contact_person,
             e.industry,
             e.user_id as employer_user_id
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      WHERE j.id = $1
    `;

    const result = await query(sql, [jobId]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ message: 'Job posting not found.' });
    }

    const job = result.rows[0];

    // Check if current user has applied
    let userApplication = null;
    if (req.user && req.user.role === 'employee') {
      const appRes = await query(
        'SELECT id, status, created_at, interview_details, rejection_reason FROM applications WHERE job_id = $1 AND employee_id = $2',
        [jobId, req.user.id]
      );
      if (appRes.rows && appRes.rows.length > 0) {
        userApplication = appRes.rows[0];
      }
    }

    const countRes = await query('SELECT COUNT(*) as count FROM applications WHERE job_id = $1', [jobId]);
    const applicantCount = parseInt(countRes.rows[0]?.count || 0, 10);

    res.json({
      job: {
        ...job,
        applicant_count: applicantCount
      },
      has_applied: !!userApplication,
      application: userApplication
    });
  } catch (err) {
    console.error('Get job details error:', err);
    res.status(500).json({ message: 'Error retrieving job posting.', error: err.message });
  }
});

// 3. POST /api/jobs - Create a new job post (Approved & paid employers only!)
router.post('/', authenticateToken, requireActiveEmployer, async (req, res) => {
  try {
    const {
      title,
      category,
      job_type,
      workplace_type,
      location,
      salary_range,
      working_conditions,
      responsibilities,
      description,
      requirements,
      benefits,
      custom_fields,
      deadline
    } = req.body;

    if (!title || !location) {
      return res.status(400).json({ message: 'Job title and location are required.' });
    }

    // Lookup employer_id for this user
    const empRes = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer profile not found for this user.' });
    }
    const employerId = empRes.rows[0].id;

    const parsedCustomFields = typeof custom_fields === 'string' ? JSON.parse(custom_fields || '[]') : (custom_fields || []);

    const insertSql = `
      INSERT INTO jobs (
        employer_id, title, category, job_type, workplace_type, location,
        salary_range, working_conditions, responsibilities, description,
        requirements, benefits, custom_fields, deadline, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const jobRes = await query(insertSql, [
      employerId,
      title,
      category || 'Hospitality & Services',
      job_type || 'full-time',
      workplace_type || 'On-site',
      location,
      salary_range || '',
      working_conditions || '',
      responsibilities || description || '',
      description || responsibilities || '',
      requirements || '',
      benefits || '',
      JSON.stringify(parsedCustomFields),
      deadline || null,
      'active'
    ]);

    res.status(201).json({
      message: 'Job posted successfully!',
      job: jobRes.rows[0]
    });
  } catch (err) {
    console.error('Job creation error:', err);
    res.status(500).json({ message: 'Failed to create job post.', error: err.message });
  }
});

// 4. PUT /api/jobs/:id - Edit job post
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const existingJob = await query('SELECT j.*, e.user_id as employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [jobId]);
    
    if (existingJob.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = existingJob.rows[0];
    if (req.user.role !== 'admin' && job.employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to edit this job posting.' });
    }

    const {
      title,
      category,
      job_type,
      workplace_type,
      location,
      salary_range,
      working_conditions,
      responsibilities,
      description,
      requirements,
      benefits,
      custom_fields,
      deadline,
      status
    } = req.body;

    const parsedCustomFields = custom_fields ? (typeof custom_fields === 'string' ? JSON.parse(custom_fields) : custom_fields) : job.custom_fields;

    const updateSql = `
      UPDATE jobs SET
        title = COALESCE($1, title),
        category = COALESCE($2, category),
        job_type = COALESCE($3, job_type),
        workplace_type = COALESCE($4, workplace_type),
        location = COALESCE($5, location),
        salary_range = COALESCE($6, salary_range),
        working_conditions = COALESCE($7, working_conditions),
        responsibilities = COALESCE($8, responsibilities),
        description = COALESCE($9, description),
        requirements = COALESCE($10, requirements),
        benefits = COALESCE($11, benefits),
        custom_fields = COALESCE($12, custom_fields),
        deadline = COALESCE($13, deadline),
        status = COALESCE($14, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $15
      RETURNING *
    `;

    const updated = await query(updateSql, [
      title,
      category,
      job_type,
      workplace_type,
      location,
      salary_range,
      working_conditions,
      responsibilities,
      description,
      requirements,
      benefits,
      JSON.stringify(parsedCustomFields),
      deadline,
      status,
      jobId
    ]);

    res.json({
      message: 'Job posting updated successfully.',
      job: updated.rows[0]
    });
  } catch (err) {
    console.error('Job update error:', err);
    res.status(500).json({ message: 'Failed to update job post.', error: err.message });
  }
});

// 5. DELETE /api/jobs/:id - Delete or remove job
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    const existingJob = await query('SELECT j.*, e.user_id as employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [jobId]);

    if (existingJob.rows.length === 0) {
      return res.status(404).json({ message: 'Job not found.' });
    }

    const job = existingJob.rows[0];
    if (req.user.role !== 'admin' && job.employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to remove this job.' });
    }

    await query('DELETE FROM jobs WHERE id = $1', [jobId]);

    res.json({ message: 'Job posting removed successfully.' });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({ message: 'Failed to remove job posting.', error: err.message });
  }
});

module.exports = router;
