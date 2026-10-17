const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

if (!process.env.TEST_DATABASE_URL) {
  process.exit(0);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.NODE_ENV = 'development';
process.env.MAIL_CAPTURE = '1';

const { initDb, query, pool } = require('../src/db');
const app = require('../src/app');
const { outbox } = require('../src/lib/mailer');

const run = crypto.randomBytes(4).toString('hex');
const email = (n) => `${n}.${run}@pipeline.rw`;
const PASS = 'Sup3rSecret99';
const PDF = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')], { type: 'application/pdf' });
const kigaliPlusDays = (d) => new Date(Date.now() + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Kigali' });

let server; let base;
async function call(method, path, { token, json, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let body;
  if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  const res = await fetch(base + path, { method, headers: h, body, redirect: 'manual' });
  let data = null; try { data = await res.json(); } catch { /* not json */ }
  return { status: res.status, data, res };
}

const ctx = {};
test.before(async () => {
  await initDb();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  // 1. Register and verify employer
  const empForm = new FormData();
  Object.entries({
    company_name: 'Pipeline Hotel',
    contact_person: 'Pierre Boss',
    phone: '0788111222',
    email: email('boss'),
    password: PASS,
    date_of_birth: '1985-01-01',
    website: 'pipelinehotel.rw',
    terms_accepted: 'true'
  }).forEach(([k, v]) => empForm.append(k, v));
  empForm.append('registration_doc', PDF(), 'rdb.pdf');
  const empReg = await call('POST', '/api/auth/register-employer', { form: empForm });
  assert.equal(empReg.status, 201);
  ctx.boss = empReg.data;

  // Approve employer in DB
  await query("UPDATE users SET status = 'approved', email_verified_at = NOW() WHERE id = $1", [ctx.boss.user.id]);
  await query("UPDATE employers SET payment_status = 'paid' WHERE user_id = $1", [ctx.boss.user.id]);

  // Post a job
  const jobRes = await call('POST', '/api/jobs', {
    token: ctx.boss.token,
    json: {
      title: 'Head Receptionist',
      category: 'Hospitality',
      job_type: 'full-time',
      location: 'Kigali, Nyarugenge',
      description: 'Lead reception staff with warmth and professionalism.',
      requirements: '2+ years hospitality experience, French and English.',
      deadline: kigaliPlusDays(14)
    }
  });
  assert.equal(jobRes.status, 201);
  ctx.job = jobRes.data.job;

  // 2. Register job seeker
  const candForm = new FormData();
  Object.entries({
    name: 'Jeanne Umutoni',
    email: email('jeanne'),
    phone: '0788333444',
    password: PASS,
    date_of_birth: '1996-04-12',
    gender: 'female',
    terms_accepted: 'true'
  }).forEach(([k, v]) => candForm.append(k, v));
  candForm.append('resume', PDF(), 'jeanne_cv.pdf');
  const candReg = await call('POST', '/api/auth/register-employee', { form: candForm });
  assert.equal(candReg.status, 201);
  ctx.cand = candReg.data;
  await query("UPDATE users SET email_verified_at = NOW() WHERE id = $1", [ctx.cand.user.id]);
});

test.after(async () => {
  server.close();
  await pool.end();
});

test('Anti-Ghosting Pipeline: Applied → Viewed → Shortlisted → Interview → Decision (with live pings)', async () => {
  const unseen = async () => (await call('GET', '/api/applications/unseen-count', { token: ctx.cand.token })).data.count;

  // Step 1: Candidate Applies
  const appForm = new FormData();
  appForm.append('job_id', String(ctx.job.id));
  appForm.append('submitted_data', JSON.stringify({ experience_summary: '5 years at Serena Hotel' }));
  const applyRes = await call('POST', '/api/applications', { token: ctx.cand.token, form: appForm });
  assert.equal(applyRes.status, 201);
  const appId = applyRes.data.application.id;
  assert.ok(appId);

  // At Applied stage, nothing unseen yet (candidate just applied)
  assert.equal(await unseen(), 0);

  // Step 2: Employer opens job applicants list -> triggers automatic "Viewed by employer" + ping!
  const listRes = await call('GET', `/api/applications/job/${ctx.job.id}`, { token: ctx.boss.token });
  assert.equal(listRes.status, 200);
  assert.equal(listRes.data.applicants.length, 1);
  assert.equal(listRes.data.applicants[0].status, 'viewed');
  assert.ok(listRes.data.applicants[0].viewed_at);

  // Candidate gets the live ping (unseen count increments)
  assert.equal(await unseen(), 1, 'candidate notified that application was viewed by employer');

  // Candidate checks My Applications
  let myApps = await call('GET', '/api/applications/my', { token: ctx.cand.token });
  assert.equal(myApps.status, 200);
  assert.equal(myApps.data.applications[0].status, 'viewed');
  assert.equal(myApps.data.applications[0].has_new_result, true);
  assert.ok(myApps.data.applications[0].viewed_at);

  // Candidate marks seen
  await call('POST', '/api/applications/mark-seen', { token: ctx.cand.token });
  assert.equal(await unseen(), 0, 'cleared after candidate views update');

  // Step 3: Employer Shortlists Candidate -> triggers "Shortlisted" status + ping!
  const shortlistRes = await call('PATCH', `/api/applications/${appId}/shortlist`, { token: ctx.boss.token });
  assert.equal(shortlistRes.status, 200);
  assert.equal(shortlistRes.data.status, 'shortlisted');

  // Candidate gets another live ping for shortlist milestone!
  assert.equal(await unseen(), 1, 'candidate notified that they are shortlisted');
  myApps = await call('GET', '/api/applications/my', { token: ctx.cand.token });
  assert.equal(myApps.data.applications[0].status, 'shortlisted');
  assert.ok(myApps.data.applications[0].shortlisted_at);
  await call('POST', '/api/applications/mark-seen', { token: ctx.cand.token });

  // Step 4: Employer Schedules Interview -> triggers "Interview" status + ping!
  const schedRes = await call('PATCH', `/api/applications/${appId}/approve-interview`, {
    token: ctx.boss.token,
    json: {
      date: kigaliPlusDays(3),
      time: '10:30',
      format: 'In-person Meeting',
      location_or_link: 'Hotel Lobby Conference Room A',
      notes: 'Bring certificates and original ID.'
    }
  });
  assert.equal(schedRes.status, 200);
  assert.equal(schedRes.data.interview_details.time, '10:30');

  // Candidate gets interview invitation ping!
  assert.equal(await unseen(), 1, 'candidate notified about interview schedule');
  myApps = await call('GET', '/api/applications/my', { token: ctx.cand.token });
  assert.ok(myApps.data.applications[0].interview_at);
  await call('POST', '/api/applications/mark-seen', { token: ctx.cand.token });

  // Step 5: Final Decision -> Employer extends offer / hires candidate!
  const hireRes = await call('PATCH', `/api/applications/${appId}/hire`, {
    token: ctx.boss.token,
    json: { decision_notes: 'Welcome to Pipeline Hotel! Onboarding starts Monday at 8 AM.' }
  });
  assert.equal(hireRes.status, 200);
  assert.equal(hireRes.data.status, 'hired');

  // Candidate gets celebratory decision ping!
  assert.equal(await unseen(), 1, 'candidate notified about final job offer decision');
  myApps = await call('GET', '/api/applications/my', { token: ctx.cand.token });
  assert.equal(myApps.data.applications[0].status, 'hired');
  assert.ok(myApps.data.applications[0].decision_at);
  assert.equal(myApps.data.applications[0].decision_notes, 'Welcome to Pipeline Hotel! Onboarding starts Monday at 8 AM.');

  // Ghosting is eliminated: in-app notifications and email updates sent!
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(outbox.some((m) => m.to === email('jeanne') && /update on your Akazi application/i.test(m.subject)));
});
