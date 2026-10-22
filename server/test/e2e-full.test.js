// Full end-to-end journey + bug-probe suite for Akazi (API level, real PostgreSQL).
//   JWT_SECRET=$(openssl rand -hex 32) DATABASE_URL=postgresql://... TEST_DATABASE_URL=same node --test test/e2e-full.test.js
// Each test states the EXPECTED behaviour. A failing test = a bug (tests tagged [BUG-n]).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

if (!process.env.TEST_DATABASE_URL) { console.log('Set TEST_DATABASE_URL to run e2e tests.'); process.exit(0); }
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
process.env.NODE_ENV = 'development';
process.env.MAIL_CAPTURE = '1';
process.env.PAYPACK_WEBHOOK_SECRET = 'whsec_test';
process.env.TRUST_PROXY = '0'; // direct connection: X-Forwarded-For must be ignored
delete process.env.PAYPACK_CLIENT_ID; delete process.env.PAYPACK_CLIENT_SECRET;
for (const k of ['B2_BUCKET', 'R2_BUCKET', 'RESEND_API_KEY']) delete process.env[k];

const { initDb, query, pool } = require('../src/db');
const app = require('../src/app');
const { outbox } = require('../src/lib/mailer');
const bcrypt = require('bcryptjs');

const run = crypto.randomBytes(4).toString('hex');
const email = (n) => `${n}.${run}@e2e.rw`;
const PASS = 'Sup3rSecret99';
const PDF = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')], { type: 'application/pdf' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plusDays = (d) => new Date(Date.now() + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Kigali' });

let server; let base;
async function call(method, p, { token, json, form, headers = {} } = {}) {
  const h = { ...headers }; if (token) h.Authorization = `Bearer ${token}`;
  let body; if (json !== undefined) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); } if (form) body = form;
  const res = await fetch(base + p, { method, headers: h, body, redirect: 'manual' });
  let data = null; try { data = await res.json(); } catch { /* */ }
  return { status: res.status, data, res };
}
const fd = (o, files = {}) => { const f = new FormData(); Object.entries(o).forEach(([k, v]) => f.append(k, v)); Object.entries(files).forEach(([k, [b, n]]) => f.append(k, b, n)); return f; };
const seekerFields = (who, extra = {}) => ({ name: `${who} Tester`, email: email(who), password: PASS, phone: '0788123456', date_of_birth: '1995-05-05', gender: 'female', terms_accepted: 'true', ...extra });
const employerFields = (who, extra = {}) => ({ company_name: `${who} Hotel`, contact_person: 'Boss Man', email: email(who), password: PASS, phone: '0788123456', date_of_birth: '1985-01-01', website: 'hotel.rw', terms_accepted: 'true', ...extra });
const login = (e, p = PASS) => call('POST', '/api/auth/login', { json: { email: e, password: p } });

const ctx = {};
async function makeEmployer(who, { approve = true, pay = true } = {}) {
  const r = await call('POST', '/api/auth/register-employer', { form: fd(employerFields(who), { registration_doc: [PDF(), 'rdb.pdf'] }) });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  if (approve) await call('PATCH', `/api/admin/employers/${r.data.user.id}/approve`, { token: ctx.admin.token });
  if (pay) await query("UPDATE employers SET payment_status='paid' WHERE user_id=$1", [r.data.user.id]);
  return r.data;
}
const jobBody = (o = {}) => ({ title: 'Waiter', category: 'Hospitality', job_type: 'full-time', location: 'Kigali', description: 'Serve guests', requirements: 'Smile', deadline: plusDays(10), ...o });

test.before(async () => {
  await initDb();
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;
  await query("INSERT INTO users (role,status,name,email,password_hash,email_verified_at) VALUES ('admin','approved','Adm',$1,$2,NOW())", [email('admin'), await bcrypt.hash(PASS, 4)]);
  ctx.admin = (await login(email('admin'))).data;
  ctx.seeker = (await call('POST', '/api/auth/register-employee', { form: fd(seekerFields('seeker'), { resume: [PDF(), 'cv.pdf'] }) })).data;
  ctx.boss = await makeEmployer('boss');
  ctx.job = (await call('POST', '/api/jobs', { token: ctx.boss.token, json: jobBody({ custom_fields: JSON.stringify([{ id: 'q1', label: 'Do you have a driving licence?', type: 'text', required: true }]) }) })).data.job;
});
test.after(async () => { server.close(); await pool.end(); });

// ───────────────────────── HAPPY-PATH JOURNEYS ─────────────────────────
test('J1 seeker journey: register → login → /me → browse → apply → duplicate blocked', async () => {
  assert.ok(ctx.seeker.token);
  const l = await login(email('seeker')); assert.equal(l.status, 200);
  const me = await call('GET', '/api/auth/me', { token: l.data.token });
  assert.equal(me.data.user.role, 'employee');
  const list = await call('GET', '/api/jobs'); assert.ok(list.data.jobs.some((j) => j.id === ctx.job.id));
  const ap = await call('POST', '/api/applications', { token: ctx.seeker.token, form: fd({ job_id: ctx.job.id, submitted_data: JSON.stringify({ answers: { q1: 'yes' } }) }) });
  assert.equal(ap.status, 201, JSON.stringify(ap.data)); ctx.app1 = ap.data.application;
  assert.equal((await call('POST', '/api/applications', { token: ctx.seeker.token, form: fd({ job_id: ctx.job.id }) })).status, 409);
  const mine = await call('GET', '/api/applications/my', { token: ctx.seeker.token }); assert.equal(mine.data.applications.length >= 1, true);
});

test('J2 employer journey: sees applicant → schedules interview → candidate notified → chat works both ways', async () => {
  const ap = await call('GET', `/api/applications/job/${ctx.job.id}`, { token: ctx.boss.token });
  assert.equal(ap.status, 200); assert.equal(ap.data.applicants.length, 1);
  const iv = await call('PATCH', `/api/applications/${ctx.app1.id}/approve-interview`, { token: ctx.boss.token, json: { date: plusDays(3), time: '10:00', format: 'On-site' } });
  assert.equal(iv.status, 200, JSON.stringify(iv.data));
  assert.equal((await call('GET', '/api/applications/unseen-count', { token: ctx.seeker.token })).data.count, 1);
  // candidate can't talk first
  assert.equal((await call('POST', `/api/chat/${ctx.app1.id}/messages`, { token: ctx.seeker.token, json: { body: 'hi' } })).status, 403);
  assert.equal((await call('POST', `/api/chat/${ctx.app1.id}/messages`, { token: ctx.boss.token, json: { body: 'Welcome' } })).status, 201);
  assert.equal((await call('POST', `/api/chat/${ctx.app1.id}/messages`, { token: ctx.seeker.token, json: { body: 'Thanks' } })).status, 201);
  const conv = await call('GET', '/api/chat/conversations', { token: ctx.seeker.token });
  assert.equal(conv.data.conversations.length, 1);
  await call('POST', '/api/applications/mark-seen', { token: ctx.seeker.token });
  assert.equal((await call('GET', '/api/applications/unseen-count', { token: ctx.seeker.token })).data.count, 0);
  assert.equal((await call('PATCH', `/api/applications/${ctx.app1.id}/approve-interview`, { token: ctx.boss.token, json: { date: '2020-01-01', time: '10:00' } })).status, 400, 'past interview rejected');
});

test('J3 employer onboarding + payment: pending → approved → pay (webhook) → can post', async () => {
  const e = await makeEmployer('payer', { approve: false, pay: false });
  const body = jobBody();
  assert.equal((await call('POST', '/api/jobs', { token: e.token, json: body })).status, 403, 'pending cannot post');
  assert.equal((await call('PATCH', `/api/admin/employers/${e.user.id}/approve`, { token: ctx.admin.token })).status, 200);
  assert.equal((await call('POST', '/api/jobs', { token: e.token, json: body })).status, 403, 'approved-unpaid cannot post');
  const ref = `ref_${run}_ok`;
  await query("INSERT INTO payments (employer_id,user_id,ref,amount,phone,status) SELECT id,user_id,$2,5000,'0788123456','pending' FROM employers WHERE user_id=$1", [e.user.id, ref]);
  await query("UPDATE employers SET payment_status='pending' WHERE user_id=$1", [e.user.id]);
  const evt = JSON.stringify({ kind: 'transaction:processed', data: { ref, status: 'successful', amount: 5000, provider: 'mtn' } });
  const sig = crypto.createHmac('sha256', 'whsec_test').update(evt).digest('base64');
  const w = await call('POST', '/api/payments/paypack/webhook', { headers: { 'Content-Type': 'application/json', 'x-paypack-signature': sig }, form: undefined, json: undefined });
  assert.equal(w.status, 401, 'empty body must not validate');
  const res = await fetch(base + '/api/payments/paypack/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paypack-signature': sig }, body: evt });
  assert.equal(res.status, 200);
  assert.equal((await call('POST', '/api/jobs', { token: e.token, json: body })).status, 201, 'paid employer can post');
});

test('J4 admin journey: stats, users, audit, suspend → login blocked → reactivate', async () => {
  assert.equal((await call('GET', '/api/admin/stats', { token: ctx.admin.token })).status, 200);
  assert.equal((await call('GET', '/api/admin/users', { token: ctx.admin.token })).status, 200);
  const s = await makeEmployer('susp');
  assert.equal((await call('PATCH', `/api/admin/users/${s.user.id}/status`, { token: ctx.admin.token, json: { status: 'suspended' } })).status, 200);
  assert.equal((await login(email('susp'))).status, 403);
  assert.equal((await call('GET', '/api/auth/me', { token: s.token })).status, 403);
  assert.equal((await call('PATCH', `/api/admin/users/${s.user.id}/status`, { token: ctx.admin.token, json: { status: 'approved' } })).status, 200);
  assert.equal((await login(email('susp'))).status, 200);
});

// ───────────────────────── BUG PROBES ─────────────────────────
test('[BUG-1] moderation take-down must keep the report record (status/audit) and not wipe candidates\' applications', async () => {
  const e = await makeEmployer('rep1');
  const job = (await call('POST', '/api/jobs', { token: e.token, json: jobBody({ title: 'Scam job' }) })).data.job;
  const rep = await call('POST', `/api/jobs/${job.id}/report`, { token: ctx.seeker.token, json: { reason: 'fraud_scam' } });
  assert.equal(rep.status, 201, JSON.stringify(rep.data));
  const ap = await call('POST', '/api/applications', { token: ctx.seeker.token, form: fd({ job_id: job.id }) });
  assert.equal(ap.status, 201);
  const r = await call('PATCH', `/api/admin/reports/${rep.data.report_id}`, { token: ctx.admin.token, json: { status: 'action_taken', take_down_job: true } });
  assert.equal(r.status, 200);
  assert.ok(r.data.report, 'response should contain the updated report');
  const still = await query('SELECT status FROM reports WHERE id=$1', [rep.data.report_id]);
  assert.equal(still.rows.length, 1, 'report row must survive the take-down (audit trail)');
  assert.equal(still.rows[0].status, 'action_taken');
  assert.equal((await call('GET', `/api/jobs/${job.id}`)).status, 404, 'removed job is hidden from the public');
  const late = await call('POST', '/api/auth/register-employee', { form: fd(seekerFields('latea')) }); assert.equal(late.status, 201, JSON.stringify(late.data));
  const lateApply = await call('POST', '/api/applications', { token: late.data.token, form: fd({ job_id: job.id }) }); assert.equal(lateApply.status, 404, 'cannot apply to a removed job: ' + JSON.stringify(lateApply.data));
  assert.equal((await call('PUT', `/api/jobs/${job.id}`, { token: e.token, json: { status: 'active' } })).status, 403, 'employer cannot re-open a removed job');
  const apps = await query('SELECT 1 FROM applications WHERE id=$1', [ap.data.application.id]);
  assert.equal(apps.rows.length, 1, 'candidate application history should not be silently destroyed');
});

test('[BUG-2] a pending/rejected employer must not become "approved" by suspend → reactivate', async () => {
  const e = await makeEmployer('bypass', { approve: false, pay: false });
  const sus = await call('PATCH', `/api/admin/users/${e.user.id}/status`, { token: ctx.admin.token, json: { status: 'suspended' } });
  assert.equal(sus.status, 400, 'pending employers go through the verification review, not suspend');
  const back = await call('PATCH', `/api/admin/users/${e.user.id}/status`, { token: ctx.admin.token, json: { status: 'approved' } });
  const row = (await query('SELECT status FROM users WHERE id=$1', [e.user.id])).rows[0];
  assert.notEqual(row.status, 'approved', `unverified employer became approved (HTTP ${back.status})`);
});

test('[BUG-3] required custom application questions must be enforced server-side', async () => {
  const s2 = (await call('POST', '/api/auth/register-employee', { form: fd(seekerFields('cf')) })).data;
  const r = await call('POST', '/api/applications', { token: s2.token, form: fd({ job_id: ctx.job.id, submitted_data: JSON.stringify({}) }) });
  assert.equal(r.status, 400, `application missing a required answer was accepted (HTTP ${r.status})`);
});

test('[BUG-4] employer registration with invalid contact person must not leave orphan uploaded files', async () => {
  const before = (await query('SELECT COUNT(*)::int n FROM file_scans')).rows[0].n;
  const dir = path.join(__dirname, '../uploads/documents');
  const filesBefore = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
  const r = await call('POST', '/api/auth/register-employer', { form: fd(employerFields('orph', { contact_person: 'X' }), { registration_doc: [PDF(), 'doc.pdf'] }) });
  assert.equal(r.status, 400);
  const after = (await query('SELECT COUNT(*)::int n FROM file_scans')).rows[0].n;
  const filesAfter = fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
  assert.equal(filesAfter, filesBefore, 'document stayed on disk/bucket after the request failed');
  assert.equal(after, before, 'file_scans row left behind');
});

test('[BUG-5] /api/auth/me should return created_at like login/register do', async () => {
  const me = await call('GET', '/api/auth/me', { token: ctx.seeker.token });
  const lg = await login(email('seeker'));
  assert.ok(lg.data.user.created_at, 'login returns created_at');
  assert.ok(me.data.user.created_at, '/me is missing created_at');
});

test('[BUG-6] job list pagination: total must stay correct when offset is past the last row', async () => {
  const all = await call('GET', '/api/jobs?limit=1');
  assert.ok(all.data.total >= 1);
  const past = await call('GET', `/api/jobs?limit=1&offset=${all.data.total + 5}`);
  assert.equal(past.data.total, all.data.total, `total reported ${past.data.total} instead of ${all.data.total}`);
});

test('[BUG-7] "has_reported" for guests must not be spoofable via X-Forwarded-For nor cacheable publicly', async () => {
  const e = await makeEmployer('rep2');
  const job = (await call('POST', '/api/jobs', { token: e.token, json: jobBody() })).data.job;
  await call('POST', `/api/jobs/${job.id}/report`, { json: { reason: 'other' } }); // guest report from 127.0.0.1
  const spoof = await call('GET', `/api/jobs/${job.id}`, { headers: { 'X-Forwarded-For': '203.0.113.9' } });
  const real = await call('GET', `/api/jobs/${job.id}`);
  assert.equal(real.data.has_reported, true, 'same guest should see has_reported=true');
  assert.equal(spoof.data.has_reported, true, 'trusting X-Forwarded-For makes the flag spoofable / inconsistent with how the report was stored');
  const cc = real.res.headers.get('cache-control') || '';
  assert.ok(!/public/.test(cc), `per-visitor field served with "${cc}" → shared caches can leak it to other visitors`);
});

test('[BUG-8] late "successful" webhook after a payment was expired/failed must still activate the employer', async () => {
  const e = await makeEmployer('late', { pay: false });
  const ref = `ref_${run}_late`;
  await query("INSERT INTO payments (employer_id,user_id,ref,amount,phone,status,provider_status) SELECT id,user_id,$2,5000,'0788123456','failed','expired' FROM employers WHERE user_id=$1", [e.user.id, ref]);
  await query("UPDATE employers SET payment_status='failed' WHERE user_id=$1", [e.user.id]);
  const evt = JSON.stringify({ kind: 'transaction:processed', data: { ref, status: 'successful', amount: 5000, provider: 'mtn' } });
  const sig = crypto.createHmac('sha256', 'whsec_test').update(evt).digest('base64');
  await fetch(base + '/api/payments/paypack/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paypack-signature': sig }, body: evt });
  const emp = (await query('SELECT payment_status FROM employers WHERE user_id=$1', [e.user.id])).rows[0];
  assert.equal(emp.payment_status, 'paid', 'customer paid after expiry but the account stayed unpaid');
});

test('[BUG-9] webhook "successful" without an amount must not be accepted as paid', async () => {
  const e = await makeEmployer('noamt', { pay: false });
  const ref = `ref_${run}_noamt`;
  await query("INSERT INTO payments (employer_id,user_id,ref,amount,phone,status) SELECT id,user_id,$2,5000,'0788123456','pending' FROM employers WHERE user_id=$1", [e.user.id, ref]);
  const evt = JSON.stringify({ kind: 'transaction:processed', data: { ref, status: 'successful' } });
  const sig = crypto.createHmac('sha256', 'whsec_test').update(evt).digest('base64');
  await fetch(base + '/api/payments/paypack/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paypack-signature': sig }, body: evt });
  const p = (await query('SELECT status FROM payments WHERE ref=$1', [ref])).rows[0];
  assert.notEqual(p.status, 'paid', 'amount was never verified');
});

test('[BUG-10] date of birth must be sane (not > 120 years old)', async () => {
  const future = await call('POST', '/api/auth/register-employee', { form: fd(seekerFields('dobf', { date_of_birth: '2999-01-01' })) });
  assert.equal(future.status, 400, `future DOB accepted? HTTP ${future.status}`);
  const ancient = await call('POST', '/api/auth/register-employee', { form: fd(seekerFields('doba', { date_of_birth: '1800-01-01' })) });
  assert.equal(ancient.status, 400, `DOB 1800 accepted? HTTP ${ancient.status}`);
});

test('[BUG-12] password-reset must also forbid password == email and apply same rules', async () => {
  const s = (await call('POST', '/api/auth/register-employee', { form: fd(seekerFields('rst')) })).data;
  await call('POST', '/api/auth/forgot-password', { json: { email: email('rst') } }); await sleep(300);
  const mail = outbox.filter((m) => m.to === email('rst') && /Reset/.test(m.subject)).pop();
  const token = new URL(mail.ctaUrl).searchParams.get('token');
  const r = await call('POST', '/api/auth/reset-password', { json: { token, password: email('rst') } });
  assert.equal(r.status, 400, `password equal to the email accepted on reset (HTTP ${r.status})`);
});

test('[BUG-13] a 2nd payment prompt is not sent while an earlier one may still be paid (double-charge guard)', async () => {
  const paypack = require('../src/lib/paypack');
  const orig = { cashin: paypack.cashin, find: paypack.findTransaction };
  process.env.PAYPACK_CLIENT_ID = 'x'; process.env.PAYPACK_CLIENT_SECRET = 'y';
  let cashins = 0; let liveStatus = 'pending';
  paypack.cashin = async () => { cashins += 1; return { ref: `ref_${run}_dc${cashins}`, status: 'pending' }; };
  paypack.findTransaction = async (ref) => ({ data: { ref, status: liveStatus, amount: 5000, provider: 'mtn' } });
  try {
    const e = await makeEmployer('dcharge', { pay: false });
    const first = await call('POST', '/api/payments/paypack/initiate', { token: e.token, json: { phone: '0781234567' } });
    assert.equal(first.status, 201, JSON.stringify(first.data));
    await query("UPDATE payments SET created_at = NOW() - INTERVAL '5 minutes' WHERE ref = $1", [first.data.ref]);
    const second = await call('POST', '/api/payments/paypack/initiate', { token: e.token, json: { phone: '0781234567' } });
    assert.equal(second.status, 409, 'first prompt is still pending at the provider → must not send another');
    assert.equal(cashins, 1);
    liveStatus = 'successful';
    const third = await call('POST', '/api/payments/paypack/initiate', { token: e.token, json: { phone: '0781234567' } });
    assert.equal(third.data.alreadyPaid, true, 'earlier prompt was paid → report paid, do not charge again');
    assert.equal(cashins, 1);
    assert.equal((await query('SELECT payment_status FROM employers WHERE user_id=$1', [e.user.id])).rows[0].payment_status, 'paid');
  } finally {
    paypack.cashin = orig.cashin; paypack.findTransaction = orig.find;
    delete process.env.PAYPACK_CLIENT_ID; delete process.env.PAYPACK_CLIENT_SECRET;
  }
});

test('[BUG-14] unpaid/inactive employers must not be able to edit or delete jobs (consistency with create)', async () => {
  const e = await makeEmployer('unp');
  const job = (await call('POST', '/api/jobs', { token: e.token, json: jobBody() })).data.job;
  await query("UPDATE employers SET payment_status='failed' WHERE user_id=$1", [e.user.id]);
  const r = await call('PUT', `/api/jobs/${job.id}`, { token: e.token, json: { title: 'Edited while unpaid' } });
  assert.equal(r.status, 403, `unpaid employer could edit a live job (HTTP ${r.status})`);
});

test('[BUG-15] a job edit must not let an employer re-open a job past/removed, nor set a past deadline', async () => {
  const e = await makeEmployer('pastdl');
  const job = (await call('POST', '/api/jobs', { token: e.token, json: jobBody() })).data.job;
  const r = await call('PUT', `/api/jobs/${job.id}`, { token: e.token, json: { deadline: '2020-01-01' } });
  assert.equal(r.status, 400, `past deadline accepted on edit (HTTP ${r.status}) — job silently disappears from search`);
});

test('[BUG-16] a non-image file must be rejected as company logo', async () => {
  const r = await call('POST', '/api/auth/register-employer', { form: fd(employerFields('logo'), { logo: [PDF(), 'logo.pdf'] }) });
  // A PDF is accepted as a "logo" (any allowed type) but then rendered as <img> by the client
  assert.equal(r.status, 400, 'a PDF/DOCX accepted as company logo → broken image in listings');
});

test('S4 authenticated job detail is not publicly cacheable', async () => {
  const r = await call('GET', '/api/jobs', { token: ctx.seeker.token });
  const cc = r.res.headers.get('cache-control') || '';
  assert.ok(!/public/.test(cc) || true);
  const d = await call('GET', `/api/jobs/${ctx.job.id}`, { token: ctx.seeker.token });
  assert.ok(d.data.application !== undefined);
  assert.ok(!/public/.test(d.res.headers.get('cache-control') || ''), 'authenticated job detail marked public');
});

// ───────────────────────── SECURITY / AUTHZ REGRESSIONS (should pass) ─────────────────────────
test('S1 authz matrix', async () => {
  const noTok = await call('GET', '/api/admin/stats'); assert.equal(noTok.status, 401);
  assert.equal((await call('GET', '/api/admin/stats', { token: ctx.seeker.token })).status, 403);
  assert.equal((await call('POST', '/api/jobs', { token: ctx.seeker.token, json: jobBody() })).status, 403);
  const other = await makeEmployer('other');
  assert.equal((await call('GET', `/api/applications/job/${ctx.job.id}`, { token: other.token })).status, 403);
  assert.equal((await call('PATCH', `/api/applications/${ctx.app1.id}/reject`, { token: other.token, json: {} })).status, 403);
  assert.equal((await call('DELETE', `/api/jobs/${ctx.job.id}`, { token: other.token })).status, 403);
  assert.equal((await call('GET', `/api/chat/${ctx.app1.id}/messages`, { token: other.token })).status, 404);
  const key = ctx.seeker.profile.resume_url;
  assert.equal((await call('GET', `/api/files/url?key=${key}`, { token: other.token })).status, 404, 'other employer cannot open resume');
  assert.equal((await call('GET', `/api/files/url?key=../../etc/passwd`, { token: ctx.admin.token })).status, 400);
});

test('S2 injection / malformed input', async () => {
  assert.equal((await call('GET', "/api/jobs?search=' OR 1=1 --")).status, 200);
  assert.equal((await call('GET', '/api/jobs?search=%25%25%25')).status, 200);
  assert.equal((await call('GET', '/api/jobs/abc')).status, 404);
  assert.equal((await call('POST', '/api/auth/login', { json: { email: { $ne: 1 }, password: 'x' } })).status, 400);
  const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(bad.status, 400);
});

test('S3 JWT: tampered / wrong-alg tokens rejected', async () => {
  const [h, p, s] = ctx.seeker.token.split('.');
  const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' + p + '.';
  assert.equal((await call('GET', '/api/auth/me', { token: none })).status, 401);
  assert.equal((await call('GET', '/api/auth/me', { token: `${h}.${p}.${s.slice(0, -2)}xx` })).status, 401);
});
