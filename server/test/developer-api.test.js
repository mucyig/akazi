const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

require('../src/lib/env');
const { initDb, query, pool } = require('../src/db');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

let server;
let base;
let testUser;
let userToken;
let apiKey;
let keyId;

test.before(async () => {
  await initDb();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  const email = `dev_${crypto.randomBytes(4).toString('hex')}@akazi.rw`;
  const passHash = await bcrypt.hash('Password123!', 4);
  const uRes = await query(
    `INSERT INTO users (role, status, name, email, password_hash, email_verified_at)
     VALUES ('employee', 'approved', 'Dev User', $1, $2, NOW()) RETURNING id, role, status, name, email`,
    [email, passHash]
  );
  testUser = uRes.rows[0];
  userToken = generateToken(testUser);
});

test.after(async () => {
  if (testUser?.id) {
    await query('DELETE FROM users WHERE id = $1', [testUser.id]);
  }
  server.close();
  await pool.end();
});

test('Developer API: Key generation, access control, rate limiting, and v1 endpoints', async () => {
  // 1. Calling /api/v1/jobs without key must return 401
  const noKeyRes = await fetch(`${base}/api/v1/jobs`);
  assert.equal(noKeyRes.status, 401, 'Request without key must be 401');
  const noKeyData = await noKeyRes.json();
  assert.equal(noKeyData.error, 'unauthorized');

  // 2. Calling with bogus key must return 401
  const badKeyRes = await fetch(`${base}/api/v1/jobs`, {
    headers: { 'X-Akazi-Key': 'ak_live_bogusbogusbogusbogusbogus' }
  });
  assert.equal(badKeyRes.status, 401);

  // 3. Generate key via /api/developer/keys
  const genRes = await fetch(`${base}/api/developer/keys`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`
    },
    body: JSON.stringify({ name: 'Testing Bot Key' })
  });
  assert.equal(genRes.status, 201, 'Key creation must succeed');
  const genData = await genRes.json();
  assert.ok(genData.apiKey, 'Must return raw API key');
  assert.ok(genData.apiKey.startsWith('ak_live_'));
  apiKey = genData.apiKey;
  keyId = genData.keyDetails.id;

  // 4. List keys via /api/developer/keys
  const listRes = await fetch(`${base}/api/developer/keys`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.equal(listRes.status, 200);
  const listData = await listRes.json();
  assert.ok(listData.keys.some((k) => k.id === keyId));

  // 5. Query /api/v1/jobs with valid API key
  const jobsRes = await fetch(`${base}/api/v1/jobs`, {
    headers: { 'X-Akazi-Key': apiKey }
  });
  assert.equal(jobsRes.status, 200, 'Request with valid key must succeed');
  const jobsData = await jobsRes.json();
  assert.equal(jobsData.status, 'success');
  assert.ok(jobsData.attribution, 'Must include attribution notice');
  assert.ok(Array.isArray(jobsData.jobs), 'Must return jobs array');
  assert.ok(jobsRes.headers.get('x-ratelimit-limit'), 'Must include rate limit headers');

  // 6. Query /api/v1/categories
  const catsRes = await fetch(`${base}/api/v1/categories`, {
    headers: { Authorization: `Bearer ${apiKey}` } // Testing Bearer key support
  });
  assert.equal(catsRes.status, 200);
  const catsData = await catsRes.json();
  assert.equal(catsData.status, 'success');
  assert.ok(Array.isArray(catsData.categories));

  // 7. Query /api/v1/meta
  const metaRes = await fetch(`${base}/api/v1/meta`, {
    headers: { 'X-Akazi-Key': apiKey }
  });
  assert.equal(metaRes.status, 200);
  const metaData = await metaRes.json();
  assert.equal(metaData.key_info.name, 'Testing Bot Key');

  // 8. Revoke key
  const delRes = await fetch(`${base}/api/developer/keys/${keyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userToken}` }
  });
  assert.equal(delRes.status, 200);

  // 9. Querying with revoked key must now fail with 401
  const afterDelRes = await fetch(`${base}/api/v1/jobs`, {
    headers: { 'X-Akazi-Key': apiKey }
  });
  assert.equal(afterDelRes.status, 401);
});
