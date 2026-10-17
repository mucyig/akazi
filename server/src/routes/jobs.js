const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { optionalAuth, authenticateToken, requireActiveEmployer, requireVerifiedEmail } = require('../middleware/auth');
const { cleanStr, safeJson } = require('../lib/validate');
const { todayKigali, isValidYmd } = require('../lib/time');
const { audit } = require('../lib/audit');

const JOB_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance', 'volunteer'];
const WORKPLACES = ['on-site', 'remote', 'hybrid'];
const OPEN_FILTER = `j.status = 'active' AND u.status = 'approved' AND (j.deadline IS NULL OR j.deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date)`;
const likeEscape = (s) => s.replace(/[\\%_]/g, (c) => '\\' + c);

// Validates and normalises custom application questions
function cleanCustomFields(raw) {
  const arr = safeJson(raw, null);
  if (!Array.isArray(arr)) return null;
  if (arr.length > 20) return null;
  return arr.map((f, i) => ({
    ...f,
    id: cleanStr(f?.id, 60) || `q_${i}`,
    label: cleanStr(f?.label, 300),
    type: cleanStr(f?.type, 20) || 'text',
    required: !!f?.required,
  })).filter((f) => f.label);
}

// Validates the job form. Returns { error } or { value } (only fields that were provided)
function readJob(body, { partial }) {
  const v = {};
  const text = (k, max) => { if (body[k] !== undefined) v[k] = cleanStr(body[k], max); };
  text('title', 150); text('category', 100); text('location', 255); text('salary_range', 100);
  text('working_conditions', 4000); text('responsibilities', 6000); text('description', 8000); text('requirements', 6000); text('benefits', 4000);

  if (body.job_type !== undefined) {
    const jt = cleanStr(body.job_type, 30).toLowerCase();
    if (!JOB_TYPES.includes(jt)) return { error: 'Please choose a valid job type.' };
    v.job_type = jt;
  }
  if (body.workplace_type !== undefined) {
    const w = cleanStr(body.workplace_type, 30);
    if (!WORKPLACES.includes(w.toLowerCase())) return { error: 'Please choose a valid workplace type.' };
    v.workplace_type = w;
  }
  if (body.deadline !== undefined && body.deadline !== null && body.deadline !== '') {
    const d = cleanStr(body.deadline, 10);
    if (!isValidYmd(d)) return { error: 'Please choose a valid application deadline.' };
    if (!partial && d < todayKigali()) return { error: 'The application deadline cannot be in the past (Rwanda time).' };
    v.deadline = d;
  } else if (body.deadline === null || body.deadline === '') {
    v.deadline = null;
  }
  if (body.custom_fields !== undefined) {
    const cf = cleanCustomFields(body.custom_fields);
    if (!cf) return { error: 'The custom questions are not valid (maximum 20).' };
    v.custom_fields = JSON.stringify(cf);
  }
  if (body.status !== undefined) {
    const s = cleanStr(body.status, 20);
    if (!['active', 'closed'].includes(s)) return { error: 'Status must be active or closed.' };
    v.status = s;
  }
  return { value: v };
}

// 1. Browse and search (filtering happens in SQL)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, category, location, job_type, workplace_type } = req.query;
    const params = []; const where = [OPEN_FILTER];
    const add = (sql, val) => { params.push(val); where.push(sql.replace('$$', `$${params.length}`)); };

    if (typeof search === 'string' && search.trim()) {
      let cleaned = search.trim().toLowerCase();
      const stopPhrases = [
        'akazi mu rwanda', 'job in rwanda', 'jobs in rwanda',
        'imirimo mu rwanda', 'work in rwanda', 'imirimo',
        'akazi', 'jobs', 'job', 'mu rwanda', 'in rwanda', 'rwanda', 'kazi'
      ];
      for (const phrase of stopPhrases) {
        cleaned = cleaned.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), ' ').replace(/\s+/g, ' ').trim();
      }

      // If specific keywords remain (e.g. "driver", "nurse"), filter by them.
      // If the query was purely generic (e.g. "akazi mu rwanda"), all jobs in Rwanda match!
      if (cleaned.length > 0) {
        const q = `%${likeEscape(cleaned.slice(0, 100))}%`;
        add(`(lower(j.title) LIKE $$ OR lower(e.company_name) LIKE $$ OR lower(j.description) LIKE $$ OR lower(coalesce(j.responsibilities,'')) LIKE $$ OR lower(coalesce(j.requirements,'')) LIKE $$ OR lower(coalesce(j.working_conditions,'')) LIKE $$ OR lower(j.location) LIKE $$)`, q);
      }
    }
    if (typeof location === 'string' && location && location !== 'all') {
      add(`(lower(j.location) LIKE $$ OR lower(coalesce(j.workplace_type,'')) LIKE $$)`, `%${likeEscape(location.slice(0, 100).toLowerCase())}%`);
    }
    if (typeof category === 'string' && category && category !== 'all') add('lower(j.category) = $$', category.slice(0, 100).toLowerCase());
    if (typeof job_type === 'string' && job_type && job_type !== 'all') add('lower(j.job_type) = $$', job_type.slice(0, 30).toLowerCase());
    if (typeof workplace_type === 'string' && workplace_type && workplace_type !== 'all') add('lower(j.workplace_type) = $$', workplace_type.slice(0, 30).toLowerCase());

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    params.push(limit, offset);

    const result = await query(
      `SELECT j.*, e.company_name, e.logo_url, e.location AS employer_location, e.industry,
              (SELECT COUNT(*)::int FROM applications a WHERE a.job_id = j.id) AS applicant_count,
              COUNT(*) OVER()::int AS total_count
       FROM jobs j JOIN employers e ON j.employer_id = e.id JOIN users u ON e.user_id = u.id
       WHERE ${where.join(' AND ')} ORDER BY j.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    const total = result.rows[0]?.total_count || 0;
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=60');
    res.json({ jobs: result.rows.map(({ total_count, ...j }) => j), total, limit, offset });
  } catch (err) {
    console.error('Fetch jobs error:', err.message);
    res.status(500).json({ message: 'Error retrieving job listings.' });
  }
});

// 2. Single job. The public only sees open jobs from verified employers; owners and admins see their own.
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!Number.isInteger(jobId)) return res.status(404).json({ message: 'Job posting not found.' });
    const result = await query(
      `SELECT j.*, e.company_name, e.logo_url, e.website AS employer_website, e.description AS employer_description,
              e.location AS employer_location, e.contact_person, e.industry, e.user_id AS employer_user_id, u.status AS employer_status,
              (j.deadline IS NOT NULL AND j.deadline < (NOW() AT TIME ZONE 'Africa/Kigali')::date) AS is_expired
       FROM jobs j JOIN employers e ON j.employer_id = e.id JOIN users u ON u.id = e.user_id WHERE j.id = $1`, [jobId]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: 'Job posting not found.' });

    const isOwner = req.user && (req.user.role === 'admin' || req.user.id === row.employer_user_id);
    if (!isOwner && (row.status !== 'active' || row.employer_status !== 'approved')) return res.status(404).json({ message: 'Job posting not found.' });

    let application = null;
    if (req.user && req.user.role === 'employee') {
      const a = await query('SELECT id, status, created_at, viewed_at, shortlisted_at, interview_details, interview_at, decision_at, decision_notes, rejection_reason FROM applications WHERE job_id = $1 AND employee_id = $2', [jobId, req.user.id]);
      application = a.rows[0] || null;
    }
    const count = await query('SELECT COUNT(*)::int AS n FROM applications WHERE job_id = $1', [jobId]);
    const { employer_user_id, employer_status, ...job } = row;
    if (!req.user) res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({ job: { ...job, ...(isOwner ? { employer_user_id } : {}), applicant_count: count.rows[0].n }, has_applied: !!application, application });
  } catch (err) {
    console.error('Get job details error:', err.message);
    res.status(500).json({ message: 'Error retrieving job posting.' });
  }
});

// 3. Create (approved and paid employers only)
router.post('/', authenticateToken, requireActiveEmployer, requireVerifiedEmail, async (req, res) => {
  try {
    const { error, value: v } = readJob(req.body || {}, { partial: false });
    if (error) return res.status(400).json({ message: error });
    if (!v.title || !v.location) return res.status(400).json({ message: 'Job title and location are required.' });

    const emp = await query('SELECT id FROM employers WHERE user_id = $1', [req.user.id]);
    if (!emp.rows.length) return res.status(404).json({ message: 'Employer profile not found for this user.' });

    const description = v.description || v.responsibilities || '';
    const job = await query(
      `INSERT INTO jobs (employer_id, title, category, job_type, workplace_type, location, salary_range, working_conditions,
                         responsibilities, description, requirements, benefits, custom_fields, deadline, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active') RETURNING *`,
      [emp.rows[0].id, v.title, v.category || 'Hospitality & Services', v.job_type || 'full-time', v.workplace_type || 'On-site', v.location,
       v.salary_range || '', v.working_conditions || '', v.responsibilities || description, description, v.requirements || '', v.benefits || '',
       v.custom_fields || '[]', v.deadline || null]);
    res.status(201).json({ message: 'Job posted successfully!', job: job.rows[0] });
  } catch (err) {
    console.error('Job creation error:', err.message);
    res.status(500).json({ message: 'Failed to create job post.' });
  }
});

// 4. Edit
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!Number.isInteger(jobId)) return res.status(404).json({ message: 'Job not found.' });
    const existing = await query('SELECT j.id, e.user_id AS employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [jobId]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Job not found.' });
    if (req.user.role !== 'admin' && existing.rows[0].employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to edit this job posting.' });
    }
    const { error, value: v } = readJob(req.body || {}, { partial: true });
    if (error) return res.status(400).json({ message: error });
    if (v.title === '' || v.location === '') return res.status(400).json({ message: 'Job title and location cannot be empty.' });

    const cols = Object.keys(v);
    if (!cols.length) return res.status(400).json({ message: 'Nothing to update.' });
    const sets = cols.map((c, i) => `${c} = $${i + 1}`);
    const updated = await query(`UPDATE jobs SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${cols.length + 1} RETURNING *`, [...cols.map((c) => v[c]), jobId]);
    res.json({ message: 'Job posting updated successfully.', job: updated.rows[0] });
  } catch (err) {
    console.error('Job update error:', err.message);
    res.status(500).json({ message: 'Failed to update job post.' });
  }
});

// 5. Delete
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.id, 10);
    if (!Number.isInteger(jobId)) return res.status(404).json({ message: 'Job not found.' });
    const existing = await query('SELECT j.id, e.user_id AS employer_user_id FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1', [jobId]);
    if (!existing.rows.length) return res.status(404).json({ message: 'Job not found.' });
    if (req.user.role !== 'admin' && existing.rows[0].employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to remove this job.' });
    }
    await query('DELETE FROM jobs WHERE id = $1', [jobId]);
    audit(req, 'job.deleted', 'job', jobId);
    res.json({ message: 'Job posting removed successfully.' });
  } catch (err) {
    console.error('Delete job error:', err.message);
    res.status(500).json({ message: 'Failed to remove job posting.' });
  }
});

module.exports = router;
