const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Safety: these tests write data, so they only ever use TEST_DATABASE_URL, never the DATABASE_URL from server/.env
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://unused:unused@127.0.0.1:1/unused';

require('../src/lib/env');
const paypack = require('../src/lib/paypack');
const { settlePayment } = require('../src/lib/settle-payment');
const { reconcilePayments } = require('../src/lib/reconcile-payments');

const testDbUrl = process.env.TEST_DATABASE_URL;
let dbAvailable = false;
let query = null;
let initDb = null;
let pool = null;
let app = null;
let server = null;
let base = null;

if (testDbUrl) {
  process.env.DATABASE_URL = testDbUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
  process.env.NODE_ENV = 'development';
  const db = require('../src/db');
  query = db.query;
  initDb = db.initDb;
  pool = db.pool;
  app = require('../src/app');
  dbAvailable = true;
}

const origFindTransaction = paypack.findTransaction;
const origIsConfigured = paypack.isConfigured;

test.before(async () => {
  if (dbAvailable) {
    await initDb();
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  }
});

test.after(async () => {
  paypack.findTransaction = origFindTransaction;
  paypack.isConfigured = origIsConfigured;
  if (server) server.close();
  if (pool) await pool.end();
});

async function createEmployerWithPayment({ amount = 5000, paymentStatus = 'pending', employerStatus = 'pending', ageMinutes = 0 } = {}) {
  const email = `emp.${crypto.randomBytes(6).toString('hex')}@test.rw`;
  const u = await query(
    "INSERT INTO users (role, status, name, email, password_hash, email_verified_at) VALUES ('employer', 'approved', 'Test Co', $1, 'hash', NOW()) RETURNING id",
    [email]
  );
  const userId = u.rows[0].id;
  const e = await query(
    "INSERT INTO employers (user_id, company_name, payment_status) VALUES ($1, 'Test Corp', $2) RETURNING id",
    [userId, employerStatus]
  );
  const employerId = e.rows[0].id;
  const ref = `ref_${crypto.randomBytes(8).toString('hex')}`;

  const createdAt = new Date(Date.now() - ageMinutes * 60 * 1000);
  const p = await query(
    `INSERT INTO payments (employer_id, user_id, ref, amount, phone, kind, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, '0781234567', 'CASHIN', $5, $6, $6) RETURNING *`,
    [employerId, userId, ref, amount, paymentStatus, createdAt]
  );

  return { userId, employerId, ref, payment: p.rows[0], email };
}

test('Task 1: settlePayment pending -> paid updates both payments and employers, creates one notification; idempotent on second call', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  const { employerId, userId, ref } = await createEmployerWithPayment();

  // First call: settle payment
  const res1 = await settlePayment(
    ref,
    { status: 'successful', amount: 5000, provider: 'mtn' },
    '{"status":"successful"}',
    { source: 'webhook' }
  );

  assert.equal(res1.settled, true);
  assert.equal(res1.status, 'paid');

  // Verify payment row is paid
  const p1 = (await query('SELECT status, provider FROM payments WHERE ref = $1', [ref])).rows[0];
  assert.equal(p1.status, 'paid');
  assert.equal(p1.provider, 'mtn');

  // Verify employer row is paid
  const e1 = (await query('SELECT payment_status FROM employers WHERE id = $1', [employerId])).rows[0];
  assert.equal(e1.payment_status, 'paid');

  // Verify notification was created
  const notifs1 = (await query('SELECT * FROM notifications WHERE user_id = $1 AND type = $2', [userId, 'payment'])).rows;
  assert.equal(notifs1.length, 1);
  assert.match(notifs1[0].message, /5,000 RWF/);

  // Second call: idempotent (duplicate)
  const res2 = await settlePayment(
    ref,
    { status: 'successful', amount: 5000, provider: 'mtn' },
    '{"status":"successful"}',
    { source: 'webhook' }
  );

  assert.equal(res2.duplicate, true);
  assert.equal(res2.status, 'paid');

  // Verify NO duplicate notification was created
  const notifs2 = (await query('SELECT * FROM notifications WHERE user_id = $1 AND type = $2', [userId, 'payment'])).rows;
  assert.equal(notifs2.length, 1, 'Calling settlePayment twice must create no second notification');
});

test('Task 1 & 5: amount mismatch is rejected and audited, payment stays pending', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  const { employerId, ref } = await createEmployerWithPayment({ amount: 5000 });

  const res = await settlePayment(
    ref,
    { status: 'successful', amount: 100, provider: 'mtn' },
    '{"status":"successful","amount":100}',
    { source: 'webhook' }
  );

  assert.equal(res.rejected, true);
  assert.equal(res.reason, 'amount_mismatch');

  // Payment must remain pending
  const p = (await query('SELECT status FROM payments WHERE ref = $1', [ref])).rows[0];
  assert.equal(p.status, 'pending');

  // Employer must remain pending
  const e = (await query('SELECT payment_status FROM employers WHERE id = $1', [employerId])).rows[0];
  assert.equal(e.payment_status, 'pending');

  // Audit entry must be recorded
  const auditRes = await query("SELECT * FROM audit_log WHERE action = 'payment.amount_mismatch' AND target_id = $1", [ref]);
  assert.equal(auditRes.rows.length, 1);
  assert.equal(auditRes.rows[0].meta.expected, 5000);
  assert.equal(auditRes.rows[0].meta.got, 100);
});

test('Task 1 & 5: a paid payment with an unpaid employer is repaired', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  // Payment is paid, but employer is unpaid/pending (simulating the old desync bug)
  const { employerId, ref } = await createEmployerWithPayment({ paymentStatus: 'paid', employerStatus: 'unpaid' });

  const res = await settlePayment(
    ref,
    { status: 'successful', amount: 5000 },
    '{}',
    { source: 'status_check' }
  );

  assert.equal(res.duplicate, true);
  assert.equal(res.repaired, true);

  // Employer should now be repaired to 'paid'
  const e = (await query('SELECT payment_status FROM employers WHERE id = $1', [employerId])).rows[0];
  assert.equal(e.payment_status, 'paid');

  // Audit entry should be recorded
  const auditRes = await query("SELECT * FROM audit_log WHERE action = 'payment.repaired' AND target_id = $1", [String(employerId)]);
  assert.ok(auditRes.rows.length > 0);
  assert.equal(auditRes.rows[0].meta.ref, ref);
});

test('Task 1 & 5: transaction rollback: if the employer update fails, payment stays pending', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  const { ref } = await createEmployerWithPayment();

  // Create a temporary trigger to simulate a DB failure on employer update
  await query(`
    CREATE OR REPLACE FUNCTION fail_test_employer_update() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'simulated employer update failure';
    END;
    $$ LANGUAGE plpgsql;
  `);

  await query(`
    CREATE TRIGGER trig_fail_employer_update
    BEFORE UPDATE ON employers
    FOR EACH ROW
    EXECUTE FUNCTION fail_test_employer_update();
  `);

  let threw = false;
  try {
    await settlePayment(
      ref,
      { status: 'successful', amount: 5000, provider: 'mtn' },
      '{}',
      { source: 'webhook' }
    );
  } catch (err) {
    threw = true;
    assert.match(err.message, /simulated employer update failure/);
  } finally {
    // Drop trigger
    await query('DROP TRIGGER IF EXISTS trig_fail_employer_update ON employers');
    await query('DROP FUNCTION IF EXISTS fail_test_employer_update()');
  }

  assert.ok(threw, 'settlePayment should throw when transaction query fails');

  // Payment MUST remain pending due to transaction rollback
  const p = (await query('SELECT status FROM payments WHERE ref = $1', [ref])).rows[0];
  assert.equal(p.status, 'pending', 'Payment must stay pending after transaction rollback');
});

test('Task 2 & 5: status endpoint: pending payment + mocked findTransaction returning paid -> response status paid', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  // Payment older than 25 seconds
  const { userId, employerId, ref } = await createEmployerWithPayment({ ageMinutes: 1 });
  const token = jwt.sign({ id: userId, role: 'employer' }, process.env.JWT_SECRET);

  paypack.isConfigured = () => true;
  paypack.findTransaction = async (r) => {
    assert.equal(r, ref);
    return { data: { ref, status: 'successful', amount: 5000, provider: 'mtn' } };
  };

  const res = await fetch(`${base}/api/payments/paypack/status/${ref}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.payment.status, 'paid');
  assert.ok(data.payment.age_seconds >= 60);
  assert.ok(data.payment.expires_at);

  // Verify DB updated
  const p = (await query('SELECT status FROM payments WHERE ref = $1', [ref])).rows[0];
  assert.equal(p.status, 'paid');
  const e = (await query('SELECT payment_status FROM employers WHERE id = $1', [employerId])).rows[0];
  assert.equal(e.payment_status, 'paid');
});

test('Task 3 & 5: reconcilePayments: settles a paid one, expires an old pending one, continues after one error', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  // Item 1: pending 5 minutes ago, PayPack reports successful -> settles
  const item1 = await createEmployerWithPayment({ ageMinutes: 5 });
  // Item 2: pending 35 minutes ago, PayPack reports pending/failed -> expires
  const item2 = await createEmployerWithPayment({ ageMinutes: 35 });
  // Item 3: pending 10 minutes ago, PayPack throws error -> continues after error
  const item3 = await createEmployerWithPayment({ ageMinutes: 10 });
  // Item 4: paid payment with desynced employer -> repairs
  const item4 = await createEmployerWithPayment({ paymentStatus: 'paid', employerStatus: 'unpaid' });

  paypack.isConfigured = () => true;
  paypack.findTransaction = async (ref) => {
    if (ref === item1.ref) {
      return { data: { ref, status: 'successful', amount: 5000, provider: 'mtn' } };
    }
    if (ref === item2.ref) {
      return { data: { ref, status: 'pending' } }; // not processing
    }
    if (ref === item3.ref) {
      throw new Error('PayPack 503 gateway unavailable');
    }
    throw new Error('Unexpected ref: ' + ref);
  };

  const summary = await reconcilePayments();

  assert.ok(summary.checked >= 3);
  assert.ok(summary.settled >= 1, 'Should settle item 1');
  assert.ok(summary.expired >= 1, 'Should expire item 2');
  assert.ok(summary.errors >= 1, 'Should catch error for item 3 and continue');
  assert.ok(summary.repaired >= 1, 'Should repair item 4');

  // Verify item 1 settled
  const p1 = (await query('SELECT status FROM payments WHERE ref = $1', [item1.ref])).rows[0];
  assert.equal(p1.status, 'paid');

  // Verify item 2 expired to failed
  const p2 = (await query('SELECT status, provider_status FROM payments WHERE ref = $1', [item2.ref])).rows[0];
  assert.equal(p2.status, 'failed');
  assert.equal(p2.provider_status, 'expired');

  // Verify item 3 stayed pending (fail safe)
  const p3 = (await query('SELECT status FROM payments WHERE ref = $1', [item3.ref])).rows[0];
  assert.equal(p3.status, 'pending');

  // Verify item 4 employer repaired
  const e4 = (await query('SELECT payment_status FROM employers WHERE id = $1', [item4.employerId])).rows[0];
  assert.equal(e4.payment_status, 'paid');
});
