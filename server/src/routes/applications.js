const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole, requireActiveEmployer, requireVerifiedEmail } = require('../middleware/auth');
const { upload, storeUpload } = require('../middleware/upload');
const storage = require('../lib/storage');
const { cleanStr, checkFullName, validatePhone, normalizePhone, safeJson, isPgUnique } = require('../lib/validate');
const { kigaliToInstant, isValidYmd, formatKigali, TZ } = require('../lib/time');
const { sendMailLater } = require('../lib/mailer');
const { CLIENT_URL } = require('../lib/env');
const { audit } = require('../lib/audit');

const MAX_ANSWER_JSON = 30 * 1024;

const notify = (uid, title, message, type, link) =>
  query('INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)', [uid, title, message, type, link]).catch(() => {});

// A short, private email: the details stay inside the app
function emailCandidateResult(candidateId, title, intro) {
  query('SELECT email, name FROM users WHERE id = $1', [candidateId]).then((r) => {
    const u = r.rows[0];
    if (!u) return;
    sendMailLater({
      to: u.email, subject: 'There is an update on your Akazi application', title, intro,
      ctaLabel: 'See my applications', ctaUrl: `${CLIENT_URL}/applications`,
      outro: 'For your privacy the details are only shown after you sign in.',
    });
  }).catch(() => {});
}

// 1. Submit an application
router.post('/', authenticateToken, requireRole('employee'), requireVerifiedEmail,
  upload.fields([{ name: 'resume', maxCount: 1 }, { name: 'attachments', maxCount: 5 }]),
  async (req, res) => {
    const stored = [];
    try {
      const jobId = parseInt(req.body?.job_id, 10);
      if (!Number.isInteger(jobId)) return res.status(400).json({ message: 'job_id is required.' });

      const jobRes = await query(
        `SELECT j.id, j.title, j.deadline, e.company_name, e.user_id AS employer_user_id
         FROM jobs j JOIN employers e ON j.employer_id = e.id JOIN users u ON u.id = e.user_id
         WHERE j.id = $1 AND j.status = 'active' AND u.status = 'approved'
           AND (j.deadline IS NULL OR j.deadline >= (NOW() AT TIME ZONE 'Africa/Kigali')::date)`, [jobId]);
      const job = jobRes.rows[0];
      if (!job) return res.status(404).json({ message: 'This job posting is closed, past its deadline, or was not found.' });

      const dup = await query('SELECT id FROM applications WHERE job_id = $1 AND employee_id = $2', [jobId, req.user.id]);
      if (dup.rows.length) return res.status(409).json({ message: 'You have already submitted an application for this position.' });

      const rawData = req.body?.submitted_data;
      if (typeof rawData === 'string' && rawData.length > MAX_ANSWER_JSON) return res.status(400).json({ message: 'Your answers are too long.' });
      const parsed = rawData === undefined || rawData === '' ? {} : safeJson(rawData, undefined);
      if (parsed === undefined) return res.status(400).json({ message: 'Your application answers are not valid.' });
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return res.status(400).json({ message: 'Your application answers are not valid.' });

      if (parsed.candidate_name) {
        const nameErr = checkFullName(parsed.candidate_name);
        if (nameErr) return res.status(400).json({ message: `Full name: ${nameErr}` });
      }
      if (parsed.phone) {
        const phoneErr = validatePhone(parsed.phone);
        if (phoneErr) return res.status(400).json({ message: `Phone: ${phoneErr}` });
        parsed.phone = normalizePhone(parsed.phone);
      }

      const profile = (await query('SELECT gender, resume_url FROM job_seekers WHERE user_id = $1', [req.user.id])).rows[0] || {};
      // The gender chosen at registration is authoritative and cannot be altered on an application
      if (profile.gender) parsed.gender = profile.gender; else delete parsed.gender;

      let resume = null;
      if (req.files?.resume?.[0]) { resume = await storeUpload(req.files.resume[0], 'resumes'); stored.push(resume); }
      else if (profile.resume_url) resume = profile.resume_url;

      const uploaded = [];
      for (const f of req.files?.attachments || []) {
        const key = await storeUpload(f, 'attachments'); stored.push(key);
        uploaded.push({ name: cleanStr(f.originalname, 120), key, size: f.size, mimetype: storage.contentTypeFor(key) });
      }

      const ins = await query(
        `INSERT INTO applications (job_id, employee_id, submitted_data, uploaded_files, resume_url, status)
         VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
        [jobId, req.user.id, JSON.stringify(parsed), JSON.stringify(uploaded), resume]);

      await notify(job.employer_user_id, 'New Applicant Received', `${req.user.name} submitted an application for ${job.title}.`, 'new_application', `/employer/applicants/${job.id}`);
      await notify(req.user.id, 'Application Submitted', `Your application for ${job.title} at ${job.company_name} was delivered.`, 'application_status', '/applications');

      res.status(201).json({ message: 'Application submitted successfully!', application: ins.rows[0] });
    } catch (err) {
      if (stored.length) await storage.remove(stored);
      if (isPgUnique(err)) return res.status(409).json({ message: 'You have already submitted an application for this position.' });
      console.error('Submit application error:', err.message);
      res.status(500).json({ message: 'Error submitting application.' });
    }
  });

// 2. My applications (job seeker)
router.get('/my', authenticateToken, requireRole('employee'), async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, (a.status NOT IN ('pending', 'applied') AND a.result_seen_at IS NULL) AS has_new_result,
              j.title AS job_title, j.location AS job_location, j.job_type, j.salary_range, e.company_name, e.logo_url AS company_logo
       FROM applications a JOIN jobs j ON a.job_id = j.id JOIN employers e ON j.employer_id = e.id
       WHERE a.employee_id = $1 ORDER BY a.created_at DESC`, [req.user.id]);
    res.json({ applications: result.rows });
  } catch (err) {
    console.error('Fetch my applications error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve applications.' });
  }
});

// How many results the candidate has not looked at yet (drives the red dot)
router.get('/unseen-count', authenticateToken, requireRole('employee'), async (req, res) => {
  try {
    const r = await query("SELECT COUNT(*)::int AS n FROM applications WHERE employee_id = $1 AND status NOT IN ('pending', 'applied') AND result_seen_at IS NULL", [req.user.id]);
    res.set('Cache-Control', 'no-store');
    res.json({ count: r.rows[0].n });
  } catch (err) {
    console.error('Unseen count error:', err.message);
    res.status(500).json({ message: 'Could not load your results.' });
  }
});

router.post('/mark-seen', authenticateToken, requireRole('employee'), async (req, res) => {
  try {
    await query("UPDATE applications SET result_seen_at = NOW() WHERE employee_id = $1 AND status NOT IN ('pending', 'applied') AND result_seen_at IS NULL", [req.user.id]);
    res.json({ count: 0 });
  } catch (err) {
    console.error('Mark seen error:', err.message);
    res.status(500).json({ message: 'Could not update your results.' });
  }
});

// 3. Applicants for one job
router.get('/job/:jobId', authenticateToken, async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (!Number.isInteger(jobId)) return res.status(404).json({ message: 'Job not found.' });
    const jobRes = await query(
      `SELECT j.*, e.user_id AS employer_user_id, e.company_name FROM jobs j JOIN employers e ON j.employer_id = e.id WHERE j.id = $1`, [jobId]);
    const job = jobRes.rows[0];
    if (!job) return res.status(404).json({ message: 'Job not found.' });
    if (req.user.role !== 'admin' && job.employer_user_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized to view applicants for this job.' });
    }

    // Automatically transition unviewed 'pending'/'applied' applications to 'viewed' when opened by employer
    if (job.employer_user_id === req.user.id || req.user.role === 'admin') {
      const unviewed = await query(
        `UPDATE applications
         SET status = 'viewed', viewed_at = NOW(), status_changed_at = NOW(), result_seen_at = NULL, updated_at = NOW()
         WHERE job_id = $1 AND status IN ('pending', 'applied') AND viewed_at IS NULL
         RETURNING id, employee_id`, [jobId]);
      for (const a of unviewed.rows) {
        notify(a.employee_id, 'Application Viewed by Employer',
          `${job.company_name} has opened and reviewed your application for ${job.title}.`,
          'application_viewed', '/applications');
        emailCandidateResult(a.employee_id, 'Your application was viewed',
          `${job.company_name} has opened and reviewed your application for ${job.title}.`);
        audit(req, 'application.viewed', 'application', a.id);
      }
    }

    const appsRes = await query(
      `SELECT a.*, u.name AS applicant_name, u.email AS applicant_email, u.phone AS applicant_phone,
              js.gender AS applicant_gender, js.skills AS applicant_skills, js.headline AS applicant_headline, js.portfolio_url
       FROM applications a JOIN users u ON a.employee_id = u.id LEFT JOIN job_seekers js ON js.user_id = u.id
       WHERE a.job_id = $1 ORDER BY a.created_at DESC`, [jobId]);
    res.json({ job, applicants: appsRes.rows });
  } catch (err) {
    console.error('Fetch job applicants error:', err.message);
    res.status(500).json({ message: 'Failed to retrieve applicants.' });
  }
});

async function loadOwnedApplication(req, res) {
  const appId = parseInt(req.params.id, 10);
  if (!Number.isInteger(appId)) { res.status(404).json({ message: 'Application not found.' }); return null; }
  const r = await query(
    `SELECT a.*, j.title AS job_title, e.company_name, e.user_id AS employer_user_id
     FROM applications a JOIN jobs j ON a.job_id = j.id JOIN employers e ON j.employer_id = e.id WHERE a.id = $1`, [appId]);
  const app = r.rows[0];
  if (!app) { res.status(404).json({ message: 'Application not found.' }); return null; }
  if (req.user.role !== 'admin' && app.employer_user_id !== req.user.id) {
    res.status(403).json({ message: 'Unauthorized to manage this application.' }); return null;
  }
  return app;
}

// 4. Mark candidate application as viewed
router.patch('/:id/view', authenticateToken, requireActiveEmployer, async (req, res) => {
  try {
    const app = await loadOwnedApplication(req, res);
    if (!app) return;
    if (!app.viewed_at) {
      const nextStatus = ['pending', 'applied'].includes(app.status) ? 'viewed' : app.status;
      await query(
        `UPDATE applications
         SET status = $1, viewed_at = NOW(), status_changed_at = NOW(), result_seen_at = NULL, updated_at = NOW()
         WHERE id = $2`, [nextStatus, app.id]);
      notify(app.employee_id, 'Application Viewed by Employer',
        `${app.company_name} has opened and reviewed your application for ${app.job_title}.`,
        'application_viewed', '/applications');
      emailCandidateResult(app.employee_id, 'Your application was viewed',
        `${app.company_name} has opened and reviewed your application for ${app.job_title}.`);
      audit(req, 'application.viewed', 'application', app.id);
      return res.json({ message: 'Application marked as viewed.', status: nextStatus, viewed_at: new Date().toISOString() });
    }
    res.json({ message: 'Application already viewed.', status: app.status, viewed_at: app.viewed_at });
  } catch (err) {
    console.error('Mark application viewed error:', err.message);
    res.status(500).json({ message: 'Failed to update application.' });
  }
});

// 5. Shortlist a candidate
router.patch('/:id/shortlist', authenticateToken, requireActiveEmployer, async (req, res) => {
  try {
    const app = await loadOwnedApplication(req, res);
    if (!app) return;
    if (app.status === 'rejected') {
      return res.status(409).json({ message: 'This application was declined and cannot be shortlisted.' });
    }
    await query(
      `UPDATE applications
       SET status = 'shortlisted',
           shortlisted_at = COALESCE(shortlisted_at, NOW()),
           viewed_at = COALESCE(viewed_at, NOW()),
           status_changed_at = NOW(),
           result_seen_at = NULL,
           updated_at = NOW()
       WHERE id = $1`, [app.id]);
    notify(app.employee_id, 'Application Shortlisted! 🎉',
      `Great news! ${app.company_name} has shortlisted your application for ${app.job_title}.`,
      'application_shortlisted', '/applications');
    emailCandidateResult(app.employee_id, 'Good news! You have been shortlisted',
      `Congratulations! ${app.company_name} has shortlisted your application for ${app.job_title}. They will contact you regarding next steps.`);
    audit(req, 'application.shortlisted', 'application', app.id);
    res.json({ message: 'Candidate shortlisted successfully.', status: 'shortlisted' });
  } catch (err) {
    console.error('Shortlist candidate error:', err.message);
    res.status(500).json({ message: 'Failed to shortlist candidate.' });
  }
});

// 6. Invite to interview (or reschedule). Time is always Rwanda time (Africa/Kigali).
router.patch('/:id/approve-interview', authenticateToken, requireActiveEmployer, async (req, res) => {
  try {
    const app = await loadOwnedApplication(req, res);
    if (!app) return;
    if (app.status === 'rejected') return res.status(409).json({ message: 'This application was declined and can no longer be scheduled.' });

    const b = req.body || {};
    const date = cleanStr(b.date, 10);
    const time = cleanStr(b.time, 5);
    if (!isValidYmd(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return res.status(400).json({ message: 'Choose a valid interview date and time (24-hour format, Rwanda time).' });
    }
    const when = kigaliToInstant(date, time);
    if (!when || when.getTime() < Date.now() + 5 * 60 * 1000) {
      return res.status(400).json({ message: 'The interview must be in the future (Rwanda time).' });
    }
    const wasApproved = app.status === 'approved' || app.status === 'interview';
    const details = {
      date, time, timezone: TZ, display: formatKigali(when),
      format: cleanStr(b.format, 60) || 'Video Call',
      location_or_link: cleanStr(b.location_or_link, 500) || 'Link will be sent before the meeting',
      interviewer: cleanStr(b.interviewer, 120) || app.company_name,
      notes: cleanStr(b.notes, 1500) || 'Please prepare your portfolio/experience overview.',
      scheduled_at: new Date().toISOString(),
    };
    await query(
      `UPDATE applications SET status = 'approved', interview_details = $1, interview_at = $2, rejection_reason = NULL,
              viewed_at = COALESCE(viewed_at, NOW()),
              shortlisted_at = COALESCE(shortlisted_at, NOW()),
              status_changed_at = NOW(), result_seen_at = NULL, updated_at = NOW() WHERE id = $3`,
      [JSON.stringify(details), when.toISOString(), app.id]);
    await notify(app.employee_id, wasApproved ? 'Interview Updated' : 'Interview Invitation Scheduled! 📅',
      `${app.company_name} ${wasApproved ? 'updated your interview for' : 'invited you to interview for'} ${app.job_title}: ${details.display}.`, 'interview_scheduled', '/applications');
    emailCandidateResult(app.employee_id, wasApproved ? 'Your interview details changed' : 'Good news about your application', `${app.company_name} has news about your application for ${app.job_title}.`);
    audit(req, 'application.interview_scheduled', 'application', app.id);
    res.json({ message: 'Application approved and interview scheduled.', status: 'approved', interview_details: details });
  } catch (err) {
    console.error('Schedule interview error:', err.message);
    res.status(500).json({ message: 'Failed to schedule interview.' });
  }
});

// 7. Make final decision: Offer Extended / Hired
router.patch('/:id/hire', authenticateToken, requireActiveEmployer, async (req, res) => {
  try {
    const app = await loadOwnedApplication(req, res);
    if (!app) return;
    if (app.status === 'rejected') {
      return res.status(409).json({ message: 'This application was declined and cannot be marked as hired without reopening.' });
    }
    const notes = cleanStr(req.body?.decision_notes, 1500) || 'Congratulations! You have been selected for this position. Our hiring team will contact you regarding onboarding.';
    await query(
      `UPDATE applications
       SET status = 'hired',
           decision_at = NOW(),
           decision_notes = $1,
           rejection_reason = NULL,
           viewed_at = COALESCE(viewed_at, NOW()),
           status_changed_at = NOW(),
           result_seen_at = NULL,
           updated_at = NOW()
       WHERE id = $2`, [notes, app.id]);
    await notify(app.employee_id, 'Job Offer / Selected! 🌟',
      `Congratulations! ${app.company_name} has chosen to hire you for ${app.job_title}!`,
      'application_hired', '/applications');
    emailCandidateResult(app.employee_id, 'Congratulations on your job offer!',
      `${app.company_name} has selected you for ${app.job_title}! Sign in to Akazi to review details.`);
    audit(req, 'application.hired', 'application', app.id);
    res.json({ message: 'Candidate marked as hired / offer extended.', status: 'hired', decision_notes: notes });
  } catch (err) {
    console.error('Hire candidate error:', err.message);
    res.status(500).json({ message: 'Failed to record hire decision.' });
  }
});

// 8. Make final decision: Decline candidate
router.patch('/:id/reject', authenticateToken, requireActiveEmployer, async (req, res) => {
  try {
    const app = await loadOwnedApplication(req, res);
    if (!app) return;
    if (app.status === 'rejected') return res.status(409).json({ message: 'This application was already declined.' });
    const reason = cleanStr(req.body?.rejection_reason, 1000) || 'Thank you for your interest. After careful consideration, we have chosen to move forward with other candidates at this time.';

    await query(
      `UPDATE applications SET status = 'rejected', rejection_reason = $1,
              decision_at = NOW(),
              viewed_at = COALESCE(viewed_at, NOW()),
              status_changed_at = NOW(), result_seen_at = NULL, updated_at = NOW() WHERE id = $2`, [reason, app.id]);
    await notify(app.employee_id, 'Application Decision Update',
      `${app.company_name} has updated the status of your application for ${app.job_title}.`, 'application_status', '/applications');
    emailCandidateResult(app.employee_id, 'Your application has a new result', `${app.company_name} has reviewed your application for ${app.job_title}.`);
    audit(req, 'application.rejected', 'application', app.id);
    res.json({ message: 'Candidate application rejected.', status: 'rejected' });
  } catch (err) {
    console.error('Reject application error:', err.message);
    res.status(500).json({ message: 'Failed to update application.' });
  }
});

module.exports = router;
