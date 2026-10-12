// End-to-end tests against a real PostgreSQL database. Run:
//   TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/akazi_test npm test
// They create their own uniquely named users and never delete other data.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

if (!process.env.TEST_DATABASE_URL) {
  console.log('Skipping API tests: set TEST_DATABASE_URL to run them.');
  process.exit(0);
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.NODE_ENV = 'development';
process.env.MAIL_CAPTURE = '1';
process.env.PAYPACK_WEBHOOK_SECRET = 'whsec_test';
delete process.env.R2_BUCKET;

const { initDb, query, pool } = require('../src/db');
const app = require('../src/app');
const { outbox } = require('../src/lib/mailer');
const { todayKigali } = require('../src/lib/time');

const run = crypto.randomBytes(4).toString('hex');
const email = (n) => `${n}.${run}@test.rw`;
const PASS = 'Sup3rSecret99';
const PDF = () => new Blob([Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')], { type: 'application/pdf' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const login = async (e, p = PASS) => (await call('POST', '/api/auth/login', { json: { email: e, password: p } }));
const kigaliPlusDays = (d) => new Date(Date.now() + d * 86400000).toLocaleDateString('en-CA', { timeZone: 'Africa/Kigali' });

const ctx = {};
test.before(async () => {
  await initDb();
  server = app.listen(0); base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { server.close(); await pool.end(); });

test('server clock endpoint reports Rwanda timezone', async () => {
  const r = await call('GET', '/api/time');
  assert.equal(r.status, 200);
  assert.equal(r.data.timezone, 'Africa/Kigali');
  assert.ok(Math.abs(new Date(r.data.now) - Date.now()) < 5000);
});

test('registration validates input and creates accounts', async () => {
  const weak = new FormData();
  Object.entries({ name: 'Weak User', email: email('weak'), password: 'password1', date_of_birth: '1995-01-01', terms_accepted: 'true' }).forEach(([k, v]) => weak.append(k, v));
  assert.equal((await call('POST', '/api/auth/register-employee', { form: weak })).status, 400);

  const minor = new FormData();
  Object.entries({ name: 'Kid', email: email('kid'), password: PASS, date_of_birth: `${new Date().getFullYear() - 10}-01-01`, terms_accepted: 'true' }).forEach(([k, v]) => minor.append(k, v));
  assert.equal((await call('POST', '/api/auth/register-employee', { form: minor })).status, 400);

  const badGender = new FormData();
  Object.entries({ name: 'X', email: email('bg'), password: PASS, date_of_birth: '1995-01-01', gender: '<script>', terms_accepted: 'true' }).forEach(([k, v]) => badGender.append(k, v));
  assert.equal((await call('POST', '/api/auth/register-employee', { form: badGender })).status, 400);

  for (const who of ['alice', 'bob']) {
    const f = new FormData();
    Object.entries({ name: `${who} Tester`, email: email(who), password: PASS, date_of_birth: '1995-05-05', gender: 'female', terms_accepted: 'true' }).forEach(([k, v]) => f.append(k, v));
    f.append('resume', PDF(), 'cv.pdf');
    const r = await call('POST', '/api/auth/register-employee', { form: f });
    assert.equal(r.status, 201, JSON.stringify(r.data));
    ctx[who] = r.data;
  }
  assert.ok(ctx.alice.token);
  assert.equal(ctx.alice.user.email_verified, false);
  assert.ok(ctx.alice.profile.resume_url.startsWith('resumes/'), 'stores a key, not a public path');

  const dup = new FormData();
  Object.entries({ name: 'Dup', email: email('alice').toUpperCase(), password: PASS, date_of_birth: '1995-05-05', terms_accepted: 'true' }).forEach(([k, v]) => dup.append(k, v));
  assert.equal((await call('POST', '/api/auth/register-employee', { form: dup })).status, 409);

  const fake = new FormData();
  Object.entries({ name: 'Fake', email: email('fake'), password: PASS, date_of_birth: '1995-05-05', terms_accepted: 'true' }).forEach(([k, v]) => fake.append(k, v));
  fake.append('resume', new Blob(['this is not a pdf at all, just text']), 'cv.pdf');
  assert.equal((await call('POST', '/api/auth/register-employee', { form: fake })).status, 400, 'renamed text file must be rejected');
});

test('verification email is sent and link works once', async () => {
  const mail = outbox.find((m) => m.to === email('alice') && /Confirm your email/.test(m.subject));
  assert.ok(mail, 'verification email captured');
  const token = new URL(mail.ctaUrl).searchParams.get('token');
  assert.equal((await call('POST', '/api/auth/verify-email', { json: { token } })).status, 200);
  assert.equal((await call('POST', '/api/auth/verify-email', { json: { token } })).status, 400);
  const me = await call('GET', '/api/auth/me', { token: ctx.alice.token });
  assert.equal(me.data.user.email_verified, true);
});

test('forgot/reset password: generic answers, single use, old sessions die', async () => {
  const unknown = await call('POST', '/api/auth/forgot-password', { json: { email: email('nobody') } });
  const known = await call('POST', '/api/auth/forgot-password', { json: { email: email('bob') } });
  assert.equal(unknown.status, 200); assert.equal(known.status, 200);
  assert.deepEqual(unknown.data, known.data, 'same answer whether or not the account exists');
  await sleep(300);
  assert.equal(outbox.filter((m) => m.to === email('nobody')).length, 0);
  const mail = outbox.find((m) => m.to === email('bob') && /Reset your/.test(m.subject));
  assert.ok(mail, 'reset email captured');
  const token = new URL(mail.ctaUrl).searchParams.get('token');

  assert.equal((await call('POST', '/api/auth/reset-password', { json: { token, password: 'short' } })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset-password', { json: { token: 'a'.repeat(64), password: 'Another99Pass' } })).status, 400);

  await sleep(1100); // JWT timestamps have 1 second resolution
  const ok = await call('POST', '/api/auth/reset-password', { json: { token, password: 'Another99Pass' } });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal((await call('POST', '/api/auth/reset-password', { json: { token, password: 'Third99Passw' } })).status, 400, 'token is single use');
  assert.equal((await call('GET', '/api/auth/me', { token: ctx.bob.token })).status, 401, 'old session is signed out');
  assert.equal((await login(email('bob'))).status, 401, 'old password no longer works');
  const fresh = await login(email('bob'), 'Another99Pass');
  assert.equal(fresh.status, 200);
  ctx.bob.token = fresh.data.token;
});

test('account locks after repeated wrong passwords', async () => {
  const f = new FormData();
  Object.entries({ name: 'Lock Me', email: email('lock'), password: PASS, date_of_birth: '1995-05-05', terms_accepted: 'true' }).forEach(([k, v]) => f.append(k, v));
  assert.equal((await call('POST', '/api/auth/register-employee', { form: f })).status, 201);
  for (let i = 0; i < 5; i += 1) assert.equal((await login(email('lock'), 'WrongPass123')).status, 401);
  const locked = await login(email('lock'), PASS);
  assert.equal(locked.status, 429, 'even the right password is refused while locked');
});

test('employer registration, approval, and job lifecycle', async () => {
  const f = new FormData();
  Object.entries({ company_name: 'Test Hotel', contact_person: 'Boss Man', email: email('boss'), password: PASS, date_of_birth: '1985-01-01', website: 'javascript:alert(1)', terms_accepted: 'true' }).forEach(([k, v]) => f.append(k, v));
  assert.equal((await call('POST', '/api/auth/register-employer', { form: f })).status, 400, 'javascript: website rejected');

  const g = new FormData();
  Object.entries({ company_name: 'Test Hotel', contact_person: 'Boss Man', email: email('boss'), password: PASS, date_of_birth: '1985-01-01', website: 'testhotel.rw', terms_accepted: 'true' }).forEach(([k, v]) => g.append(k, v));
  g.append('registration_doc', PDF(), 'rdb.pdf');
  const reg = await call('POST', '/api/auth/register-employer', { form: g });
  assert.equal(reg.status, 201, JSON.stringify(reg.data));
  ctx.boss = reg.data;
  assert.ok(ctx.boss.employer.registration_doc_url.startsWith('documents/'));

  // pending employers cannot post jobs
  const jobBody = { title: 'Waiter', category: 'Hospitality', job_type: 'full-time', location: 'Kigali', description: 'Serve guests', requirements: 'Smile', deadline: kigaliPlusDays(10) };
  assert.equal((await call('POST', '/api/jobs', { token: ctx.boss.token, json: jobBody })).status, 403);

  // admin
  await query("INSERT INTO users (role,status,name,email,password_hash,email_verified_at) VALUES ('admin','approved','Adm',$1,$2,NOW())", [email('admin'), await require('bcryptjs').hash(PASS, 4)]);
  ctx.admin = (await login(email('admin'))).data;
  assert.equal(ctx.admin.user.role, 'admin');
  assert.equal((await call('PATCH', `/api/admin/employers/${ctx.boss.user.id}/approve`, { token: ctx.alice.token })).status, 403, 'non-admin cannot approve');
  assert.equal((await call('PATCH', `/api/admin/employers/${ctx.boss.user.id}/approve`, { token: ctx.admin.token })).status, 200);
  assert.equal((await call('PATCH', `/api/admin/employers/${ctx.boss.user.id}/approve`, { token: ctx.admin.token })).status, 409, 'cannot approve twice');

  // approved but unpaid still cannot post
  assert.equal((await call('POST', '/api/jobs', { token: ctx.boss.token, json: jobBody })).status, 403);
  await query("UPDATE employers SET payment_status='paid' WHERE user_id=$1", [ctx.boss.user.id]);

  assert.equal((await call('POST', '/api/jobs', { token: ctx.boss.token, json: { ...jobBody, deadline: '2020-01-01' } })).status, 400, 'past deadline');
  assert.equal((await call('POST', '/api/jobs', { token: ctx.boss.token, json: { ...jobBody, job_type: 'nonsense' } })).status, 400);
  const made = await call('POST', '/api/jobs', { token: ctx.boss.token, json: jobBody });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  ctx.job = made.data.job;
  assert.equal(String(ctx.job.deadline).length, 10, 'deadline is a plain YYYY-MM-DD string');

  const edit = await call('PUT', `/api/jobs/${ctx.job.id}`, { token: ctx.boss.token, json: { status: 'hacked' } });
  assert.equal(edit.status, 400);
  assert.equal((await call('PUT', `/api/jobs/${ctx.job.id}`, { token: ctx.alice.token, json: { title: 'Pwned' } })).status, 403);

  const list = await call('GET', '/api/jobs?category=Hospitality');
  assert.ok(list.data.jobs.some((j) => j.id === ctx.job.id), 'category filter finds it');
  const none = await call('GET', '/api/jobs?category=Nothing');
  assert.equal(none.data.jobs.length, 0, 'category filter actually filters');
  const detail = await call('GET', `/api/jobs/${ctx.job.id}`);
  assert.equal(detail.data.job.employer_user_id, undefined, 'owner id not exposed publicly');

  // profile leaks nothing private
  const prof = await call('GET', `/api/employers/${ctx.boss.employer.id}`);
  assert.equal(prof.status, 200);
  assert.equal(prof.data.employer.registration_doc_url, undefined);
  assert.equal(prof.data.employer.payment_status, undefined);
});

test('applications, private files and result notifications', async () => {
  const mk = (json = { why: 'I love hotels', gender: 'hacked' }) => {
    const f = new FormData();
    f.append('job_id', String(ctx.job.id));
    f.append('submitted_data', typeof json === 'string' ? json : JSON.stringify(json));
    f.append('attachments', PDF(), 'reference.pdf');
    return f;
  };
  assert.equal((await call('POST', '/api/applications', { token: ctx.boss.token, form: mk() })).status, 403, 'employers cannot apply');
  assert.equal((await call('POST', '/api/applications', { token: ctx.alice.token, form: mk('{broken') })).status, 400, 'broken answers rejected');

  const ok = await call('POST', '/api/applications', { token: ctx.alice.token, form: mk() });
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  ctx.app = ok.data.application;
  assert.equal(ctx.app.submitted_data.gender, 'female', 'gender comes from the profile, not the form');
  assert.ok(ctx.app.uploaded_files[0].key.startsWith('attachments/'));
  assert.equal((await call('POST', '/api/applications', { token: ctx.alice.token, form: mk() })).status, 409, 'no double application');
  assert.equal((await call('POST', '/api/applications', { token: ctx.bob.token, form: mk() })).status, 201);

  // ---- private files ----
  const resumeKey = ctx.alice.profile.resume_url;
  const open = (token, key) => call('GET', `/api/files/url?key=${encodeURIComponent(key)}`, { token });
  assert.equal((await open(null, resumeKey)).status, 401, 'guests cannot open files');
  assert.equal((await open(ctx.alice.token, resumeKey)).status, 200, 'owner can');
  assert.equal((await open(ctx.bob.token, resumeKey)).status, 404, 'another candidate cannot');
  assert.equal((await open(ctx.boss.token, ctx.app.resume_url)).status, 200, 'employer of the job can');
  assert.equal((await open(ctx.boss.token, ctx.app.uploaded_files[0].key)).status, 200, 'employer can open attachment');
  assert.equal((await open(ctx.bob.token, ctx.app.uploaded_files[0].key)).status, 404);
  assert.equal((await open(ctx.alice.token, ctx.boss.employer.registration_doc_url)).status, 404, 'business document is private');
  assert.equal((await open(ctx.admin.token, ctx.boss.employer.registration_doc_url)).status, 200, 'admin can');
  assert.equal((await open(ctx.boss.token, '../../etc/passwd')).status, 400, 'path tricks refused');
  const link = await open(ctx.alice.token, resumeKey);
  const raw = await fetch(base + link.data.url);
  assert.equal(raw.status, 200);
  assert.equal(raw.headers.get('content-type'), 'application/pdf');
  const forged = await fetch(base + link.data.url.replace(/sig=[a-f0-9]+/, 'sig=' + '0'.repeat(64)));
  assert.equal(forged.status, 403, 'tampered link refused');
  const pub = await fetch(base + '/uploads/' + resumeKey);
  assert.ok(!/pdf/.test(pub.headers.get('content-type') || ''), 'no public /uploads any more');
  assert.equal((await fetch(base + '/api/files/download?file=' + resumeKey)).status, 404, 'old download endpoint is gone');

  // ---- result notification dot ----
  const unseen = async () => (await call('GET', '/api/applications/unseen-count', { token: ctx.alice.token })).data.count;
  assert.equal(await unseen(), 0, 'nothing to see while pending');
  const past = await call('PATCH', `/api/applications/${ctx.app.id}/approve-interview`, { token: ctx.boss.token, json: { date: '2020-01-01', time: '09:00' } });
  assert.equal(past.status, 400, 'past interview rejected');
  const badTime = await call('PATCH', `/api/applications/${ctx.app.id}/approve-interview`, { token: ctx.boss.token, json: { date: kigaliPlusDays(3), time: '9:00 AM' } });
  assert.equal(badTime.status, 400, 'free-text time rejected');
  assert.equal((await call('PATCH', `/api/applications/${ctx.app.id}/approve-interview`, { token: ctx.bob.token, json: { date: kigaliPlusDays(3), time: '09:00' } })).status, 403, 'only the owning employer');

  const sched = await call('PATCH', `/api/applications/${ctx.app.id}/approve-interview`, { token: ctx.boss.token, json: { date: kigaliPlusDays(3), time: '14:30', location_or_link: 'Lobby' } });
  assert.equal(sched.status, 200, JSON.stringify(sched.data));
  assert.equal(sched.data.interview_details.timezone, 'Africa/Kigali');
  assert.match(sched.data.interview_details.display, /14:30 CAT$/);
  const stored = (await query('SELECT interview_at FROM applications WHERE id=$1', [ctx.app.id])).rows[0].interview_at;
  assert.equal(new Date(stored).getUTCHours(), 12, '14:30 in Kigali is 12:30 UTC, regardless of any device clock');

  assert.equal(await unseen(), 1, 'red dot count after result');
  const mine = await call('GET', '/api/applications/my', { token: ctx.alice.token });
  assert.equal(mine.data.applications[0].has_new_result, true);
  assert.equal((await call('POST', '/api/applications/mark-seen', { token: ctx.alice.token })).status, 200);
  assert.equal(await unseen(), 0, 'dot clears after viewing');
  assert.ok(outbox.some((m) => m.to === email('alice') && /update on your Akazi application/.test(m.subject)), 'candidate is emailed');

  // chat opens once approved: candidate waits for employer
  const cand = await call('POST', `/api/chat/${ctx.app.id}/messages`, { token: ctx.alice.token, json: { body: 'Hello' } });
  assert.equal(cand.status, 403);
  const emp = await call('POST', `/api/chat/${ctx.app.id}/messages`, { token: ctx.boss.token, json: { body: 'Welcome!' } });
  assert.equal(emp.status, 201, JSON.stringify(emp.data));
  assert.equal((await call('POST', `/api/chat/${ctx.app.id}/messages`, { token: ctx.alice.token, json: { body: 'Thanks' } })).status, 201);
  assert.equal((await call('GET', `/api/chat/${ctx.app.id}/messages`, { token: ctx.bob.token })).status, 404, 'strangers cannot read the thread');
  const convs = await call('GET', '/api/chat/conversations', { token: ctx.alice.token });
  assert.equal(convs.data.conversations.length, 1);

  // declining again re-lights the dot; declined is final
  assert.equal((await call('PATCH', `/api/applications/${ctx.app.id}/reject`, { token: ctx.boss.token, json: { rejection_reason: 'Filled' } })).status, 200);
  assert.equal(await unseen(), 1);
  assert.equal((await call('PATCH', `/api/applications/${ctx.app.id}/reject`, { token: ctx.boss.token, json: {} })).status, 409);
  assert.equal((await call('PATCH', `/api/applications/${ctx.app.id}/approve-interview`, { token: ctx.boss.token, json: { date: kigaliPlusDays(3), time: '10:00' } })).status, 409, 'declined cannot be re-invited');
});

test('deadline is enforced using Rwanda dates', async () => {
  const yesterday = kigaliPlusDays(-1);
  await query('UPDATE jobs SET deadline = $1 WHERE id = $2', [yesterday, ctx.job.id]);
  const list = await call('GET', '/api/jobs');
  assert.ok(!list.data.jobs.some((j) => j.id === ctx.job.id), 'expired job hidden from search');
  const f = new FormData(); f.append('job_id', String(ctx.job.id));
  const carol = new FormData();
  Object.entries({ name: 'Carol', email: email('carol'), password: PASS, date_of_birth: '1995-05-05', terms_accepted: 'true' }).forEach(([k, v]) => carol.append(k, v));
  const c = (await call('POST', '/api/auth/register-employee', { form: carol })).data;
  assert.equal((await call('POST', '/api/applications', { token: c.token, form: f })).status, 404, 'cannot apply after the deadline');
  await query('UPDATE jobs SET deadline = $1 WHERE id = $2', [todayKigali(), ctx.job.id]);
  assert.ok((await call('GET', '/api/jobs')).data.jobs.some((j) => j.id === ctx.job.id), 'still open on the deadline day itself');
});

test('payment webhook: signature, replay and downgrade protection', async () => {
  const empId = ctx.boss.employer.id;
  const ref = 'ref_' + run;
  await query("UPDATE employers SET payment_status='pending' WHERE id=$1", [empId]);
  await query("INSERT INTO payments (employer_id,user_id,ref,amount,status) VALUES ($1,$2,$3,5000,'pending')", [empId, ctx.boss.user.id, ref]);
  const send = (payload, sig) => {
    const raw = JSON.stringify(payload);
    const s = sig === undefined ? crypto.createHmac('sha256', 'whsec_test').update(raw).digest('base64') : sig;
    return call('POST', '/api/payments/paypack/webhook', { headers: { 'Content-Type': 'application/json', 'X-Paypack-Signature': s }, form: raw });
  };
  const ev = (status, amount = 5000) => ({ kind: 'transaction:processed', data: { ref, status, amount, provider: 'mtn' } });

  assert.equal((await send(ev('successful'), 'bogus')).status, 401, 'bad signature');
  assert.equal((await send(ev('successful'), '')).status, 401, 'missing signature');
  assert.equal((await send(ev('successful', 100))).data.rejected, true, 'wrong amount does not pay');
  assert.equal((await query('SELECT payment_status FROM employers WHERE id=$1', [empId])).rows[0].payment_status, 'pending');
  assert.equal((await send(ev('successful'))).status, 200);
  assert.equal((await query('SELECT payment_status FROM employers WHERE id=$1', [empId])).rows[0].payment_status, 'paid');
  assert.equal((await send(ev('failed'))).data.duplicate, true, 'late failure cannot undo a payment');
  assert.equal((await query('SELECT payment_status FROM employers WHERE id=$1', [empId])).rows[0].payment_status, 'paid');
  // initiating a payment without PayPack configured is refused, not faked
  assert.equal((await call('POST', '/api/payments/paypack/initiate', { token: ctx.boss.token, json: { phone: '0781234567' } })).status, 503);
});

test('notifications cannot be tampered with by other users', async () => {
  const mine = await call('GET', '/api/notifications', { token: ctx.alice.token });
  const id = mine.data.notifications[0].id;
  await call('PATCH', `/api/notifications/${id}/read`, { token: ctx.bob.token });
  const row = (await query('SELECT is_read FROM notifications WHERE id=$1', [id])).rows[0];
  assert.equal(row.is_read, false, "bob cannot mark alice's notification");
});

test('admin protections and audit trail', async () => {
  assert.equal((await call('PATCH', `/api/admin/users/${ctx.admin.user.id}/status`, { token: ctx.admin.token, json: { status: 'suspended' } })).status, 400);
  const other = await query("INSERT INTO users (role,status,name,email,password_hash) VALUES ('admin','approved','Other',$1,'x') RETURNING id", [email('admin2')]);
  assert.equal((await call('PATCH', `/api/admin/users/${other.rows[0].id}/status`, { token: ctx.admin.token, json: { status: 'suspended' } })).status, 403, 'admins protected');
  assert.equal((await call('PATCH', `/api/admin/users/${ctx.bob.user.id}/status`, { token: ctx.admin.token, json: { status: 'pending' } })).status, 400, 'arbitrary statuses refused');
  assert.equal((await call('PATCH', `/api/admin/users/${ctx.bob.user.id}/status`, { token: ctx.admin.token, json: { status: 'suspended' } })).status, 200);
  assert.equal((await call('GET', '/api/auth/me', { token: ctx.bob.token })).status, 403, 'suspended user is locked out immediately');
  const audit = await call('GET', '/api/admin/audit', { token: ctx.admin.token });
  assert.ok(audit.data.entries.some((e) => e.action === 'employer.approved'));
  assert.ok(audit.data.entries.some((e) => e.action === 'user.suspended'));
  assert.equal((await call('GET', '/api/admin/audit', { token: ctx.alice.token })).status, 403);
});

test('errors never leak internals', async () => {
  const r = await call('POST', '/api/auth/login', { headers: { 'Content-Type': 'application/json' }, form: '{bad json' });
  assert.equal(r.status, 400);
  assert.ok(!/at .*\.js|SyntaxError/.test(JSON.stringify(r.data)));
  const j = await call('GET', '/api/jobs/abc');
  assert.equal(j.status, 404);
  const x = await call('GET', '/api/jobs?search=%25%27%3B--');
  assert.equal(x.status, 200, 'search input is parameterised');
});
