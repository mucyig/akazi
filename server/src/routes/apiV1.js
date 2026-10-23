const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { CLIENT_URL } = require('../lib/env');
const { authenticateApiKey } = require('../middleware/apiKeyAuth');

// All v1 endpoints require a valid API key
router.use(authenticateApiKey);

const ATTRIBUTION_NOTICE = 'Powered by Akazi.rw (https://akazi.rw). All applications must link directly back to the Akazi apply URL.';

// GET /api/v1/meta - Overview of the API & your key
router.get('/meta', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    attribution_notice: ATTRIBUTION_NOTICE,
    key_info: {
      name: req.apiKey.name,
      tier: req.apiKey.tier,
      rate_limit_per_hour: req.apiKey.rate_limit_per_hour
    },
    documentation: `${CLIENT_URL || 'https://akazi.rw'}/developers`,
    support_and_commercial: 'support@akazi.rw'
  });
});

// GET /api/v1/jobs - List verified active jobs with filters
router.get('/jobs', async (req, res) => {
  try {
    const { category, job_type, workplace_type, location, search } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [
      "j.status = 'active'",
      "u.status = 'approved'",
      "(j.deadline IS NULL OR j.deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date)"
    ];
    const params = [];

    if (category && typeof category === 'string' && category.trim()) {
      params.push(category.trim());
      where.push(`lower(j.category) = lower($${params.length})`);
    }

    if (job_type && typeof job_type === 'string' && job_type.trim()) {
      params.push(job_type.trim());
      where.push(`lower(j.job_type) = lower($${params.length})`);
    }

    if (workplace_type && typeof workplace_type === 'string' && workplace_type.trim()) {
      params.push(workplace_type.trim());
      where.push(`lower(j.workplace_type) = lower($${params.length})`);
    }

    if (location && typeof location === 'string' && location.trim()) {
      params.push(`%${location.trim().toLowerCase()}%`);
      where.push(`lower(j.location) LIKE $${params.length}`);
    }

    if (search && typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      where.push(`(lower(j.title) LIKE $${params.length} OR lower(j.description) LIKE $${params.length} OR lower(e.company_name) LIKE $${params.length})`);
    }

    // Total count query
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE ${where.join(' AND ')}
    `;
    const countRes = await query(countSql, params);
    const total = countRes.rows[0]?.total || 0;

    // Jobs query
    params.push(limit, offset);
    const jobsSql = `
      SELECT j.id, j.title, j.category, j.job_type, j.workplace_type, j.location,
             j.salary_range, j.deadline, j.created_at,
             e.company_name, e.logo_url, e.website
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE ${where.join(' AND ')}
      ORDER BY j.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const jobsRes = await query(jobsSql, params);

    const baseUrl = CLIENT_URL || 'https://akazi.rw';
    const jobs = jobsRes.rows.map((j) => ({
      id: j.id,
      title: j.title,
      category: j.category,
      job_type: j.job_type,
      workplace_type: j.workplace_type,
      location: j.location,
      salary_range: j.salary_range || 'Confidential',
      deadline: j.deadline,
      company: {
        name: j.company_name,
        verified: true,
        logo_url: j.logo_url,
        website: j.website
      },
      apply_url: `${baseUrl}/jobs/${j.id}?utm_source=partner_api`,
      published_at: j.created_at
    }));

    res.json({
      status: 'success',
      attribution: ATTRIBUTION_NOTICE,
      total,
      limit,
      offset,
      jobs
    });
  } catch (err) {
    console.error('[API v1 /jobs Error]', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to retrieve jobs.' });
  }
});

// GET /api/v1/jobs/:id - Full details for a single job
router.get('/jobs/:id', async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!Number.isInteger(jobId)) {
      return res.status(400).json({ error: 'bad_request', message: 'Invalid job ID.' });
    }

    const sql = `
      SELECT j.id, j.title, j.category, j.job_type, j.workplace_type, j.location,
             j.description, j.requirements, j.responsibilities, j.working_conditions,
             j.benefits, j.salary_range, j.deadline, j.created_at,
             e.company_name, e.logo_url, e.website, e.industry
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE j.id = $1 AND j.status = 'active' AND u.status = 'approved'
        AND (j.deadline IS NULL OR j.deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date)
    `;
    const result = await query(sql, [jobId]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'not_found', message: 'Job not found or no longer active.' });
    }

    const j = result.rows[0];
    const baseUrl = CLIENT_URL || 'https://akazi.rw';

    res.json({
      status: 'success',
      attribution: ATTRIBUTION_NOTICE,
      job: {
        id: j.id,
        title: j.title,
        category: j.category,
        job_type: j.job_type,
        workplace_type: j.workplace_type,
        location: j.location,
        salary_range: j.salary_range || 'Confidential',
        description: j.description,
        requirements: j.requirements,
        responsibilities: j.responsibilities,
        working_conditions: j.working_conditions,
        benefits: j.benefits,
        deadline: j.deadline,
        company: {
          name: j.company_name,
          industry: j.industry,
          verified: true,
          logo_url: j.logo_url,
          website: j.website
        },
        apply_url: `${baseUrl}/jobs/${j.id}?utm_source=partner_api`,
        published_at: j.created_at
      }
    });
  } catch (err) {
    console.error('[API v1 /jobs/:id Error]', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to retrieve job details.' });
  }
});

// GET /api/v1/categories - Active job categories and counts
router.get('/categories', async (req, res) => {
  try {
    const sql = `
      SELECT j.category, COUNT(*)::int AS active_jobs
      FROM jobs j
      JOIN employers e ON j.employer_id = e.id
      JOIN users u ON e.user_id = u.id
      WHERE j.status = 'active' AND u.status = 'approved'
        AND (j.deadline IS NULL OR j.deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date)
      GROUP BY j.category
      ORDER BY active_jobs DESC, j.category ASC
    `;
    const result = await query(sql);

    res.json({
      status: 'success',
      attribution: ATTRIBUTION_NOTICE,
      categories: result.rows
    });
  } catch (err) {
    console.error('[API v1 /categories Error]', err.message);
    res.status(500).json({ error: 'server_error', message: 'Failed to retrieve categories.' });
  }
});

module.exports = router;
