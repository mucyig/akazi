const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

require('../src/lib/env');
const { inspectFile, findDuplicateDoc } = require('../src/lib/filescan');
const { scanBuffer, setMockScanner, resetMockScanner } = require('../src/lib/scanner');
const { ALLOWED, SIGNATURES, storeUpload } = require('../src/middleware/upload');
const storage = require('../src/lib/storage');

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
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

const PDF_CLEAN = () => Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n%%EOF');

function createDocx({ files = {}, relsTargetMode = null } = {}) {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'));
  zip.addFile('word/document.xml', Buffer.from('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>'));
  const relsContent = relsTargetMode
    ? `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://example.com" Target="http://evil.com" TargetMode="${relsTargetMode}"/></Relationships>`
    : '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>';
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(relsContent));

  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}

test.before(async () => {
  if (dbAvailable) {
    await initDb();
    server = app.listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  }
});

test.after(async () => {
  resetMockScanner();
  if (server) server.close();
  if (pool) await pool.end();
});

test('Task 1: legacy .doc is removed from ALLOWED and SIGNATURES', () => {
  assert.ok(!ALLOWED.includes('doc'), 'doc should not be in ALLOWED');
  assert.equal(SIGNATURES.doc, undefined, 'SIGNATURES.doc should be removed');
  assert.ok(ALLOWED.includes('pdf'));
  assert.ok(ALLOWED.includes('docx'));
  assert.ok(ALLOWED.includes('png'));
  assert.ok(ALLOWED.includes('jpg'));
  assert.ok(ALLOWED.includes('jpeg'));
  assert.ok(ALLOWED.includes('webp'));
});

test('Task 2 & 7: A .docx containing vbaProject.bin is rejected', async () => {
  const docx = createDocx({ files: { 'word/vbaProject.bin': Buffer.from('VBA macro binary') } });
  const res = await inspectFile(docx, 'docx');
  assert.equal(res.ok, false);
  assert.match(res.reason, /vbaProject\.bin/i);
});

test('Task 2 & 7: A .docx containing embeddings/ is rejected', async () => {
  const docx = createDocx({ files: { 'word/embeddings/oleObject1.bin': Buffer.from('OLE object') } });
  const res = await inspectFile(docx, 'docx');
  assert.equal(res.ok, false);
  assert.match(res.reason, /embeddings\//i);
});

test('Task 2 & 7: A .docx containing executable or script files is rejected', async () => {
  for (const badFile of ['word/payload.exe', 'word/script.js', 'word/tool.bat', 'word/lib.dll']) {
    const docx = createDocx({ files: { [badFile]: Buffer.from('content') } });
    const res = await inspectFile(docx, 'docx');
    assert.equal(res.ok, false, `Expected ${badFile} to be rejected`);
    assert.match(res.reason, /forbidden|executable|script/i);
  }
});

test('Task 2 & 7: A .docx with .rels containing TargetMode="External" is rejected', async () => {
  const docx = createDocx({ relsTargetMode: 'External' });
  const res = await inspectFile(docx, 'docx');
  assert.equal(res.ok, false);
  assert.match(res.reason, /TargetMode="External"/i);
});

test('Task 2 & 7: A PDF containing /JavaScript is rejected', async () => {
  const pdfWithJs = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Action /S /JavaScript /JS (app.alert("xss")) >>\nendobj\ntrailer\n<<>>\n%%EOF');
  const res = await inspectFile(pdfWithJs, 'pdf');
  assert.equal(res.ok, false);
  assert.match(res.reason, /\/JavaScript/i);
});

test('Task 2: PDF containing other forbidden tokens (/Launch, /OpenAction, /EmbeddedFile, /RichMedia) is rejected', async () => {
  for (const token of ['/Launch', '/OpenAction', '/EmbeddedFile', '/RichMedia', '/JS']) {
    const pdf = Buffer.from(`%PDF-1.4\n1 0 obj\n<< ${token} (payload) >>\nendobj\ntrailer\n<<>>\n%%EOF`);
    const res = await inspectFile(pdf, 'pdf');
    assert.equal(res.ok, false, `Expected token ${token} to be rejected`);
    assert.match(res.reason, new RegExp(token.replace('/', '\\/'), 'i'));
  }
});

test('Task 2 & 7: A zip bomb-like docx (high ratio > 100:1) is rejected', async () => {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.addFile('word/document.xml', Buffer.from('<w:document/>'));
  // Buffer of 200KB zeros compresses down to ~200 bytes, ratio ~1000:1
  zip.addFile('word/huge.xml', Buffer.alloc(200 * 1024, 0));
  const bombDocx = zip.toBuffer();

  const res = await inspectFile(bombDocx, 'docx');
  assert.equal(res.ok, false);
  assert.match(res.reason, /ratio|zip bomb/i);
});

test('Task 2: A docx with entry count > 500 is rejected', async () => {
  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from('<Types/>'));
  zip.addFile('word/document.xml', Buffer.from('<w:document/>'));
  for (let i = 0; i < 505; i++) {
    zip.addFile(`word/extra${i}.xml`, Buffer.from('<x/>'));
  }
  const bigZip = zip.toBuffer();
  const res = await inspectFile(bigZip, 'docx');
  assert.equal(res.ok, false);
  assert.match(res.reason, /too many entries/i);
});

test('Task 2 & 7: A renamed .exe with .pdf extension is rejected', async () => {
  const fakeExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00This program cannot be run in DOS mode');
  assert.equal(SIGNATURES.pdf(fakeExe), false);
  assert.equal(SIGNATURES.docx(fakeExe), false);
});

test('Task 2 & 7: A clean small PDF and docx are accepted', async () => {
  const cleanPdf = PDF_CLEAN();
  assert.equal(SIGNATURES.pdf(cleanPdf), true);
  const pdfRes = await inspectFile(cleanPdf, 'pdf');
  assert.equal(pdfRes.ok, true);

  const cleanDocx = createDocx();
  assert.equal(SIGNATURES.docx(cleanDocx), true);
  const docxRes = await inspectFile(cleanDocx, 'docx');
  assert.equal(docxRes.ok, true);
});

test('Task 2: Image trailing data detection (png, jpg, webp)', async () => {
  // Clean PNG
  const cleanPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  assert.equal((await inspectFile(cleanPng, 'png')).ok, true);
  // Appended PNG
  const dirtyPng = Buffer.concat([cleanPng, Buffer.from('injected payload')]);
  assert.equal((await inspectFile(dirtyPng, 'png')).ok, false);

  // Clean JPEG
  const cleanJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xd9]);
  assert.equal((await inspectFile(cleanJpg, 'jpg')).ok, true);
  // Appended JPEG
  const dirtyJpg = Buffer.concat([cleanJpg, Buffer.from('extra trailing bytes')]);
  assert.equal((await inspectFile(dirtyJpg, 'jpg')).ok, false);

  // Clean WEBP (RIFF header with correct length)
  const cleanWebp = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x0c, 0x00, 0x00, 0x00, // Size - 8 (12 bytes)
    0x57, 0x45, 0x42, 0x50, // WEBP
    0x56, 0x50, 0x38, 0x20, // VP8
    0x00, 0x00, 0x00, 0x00,
  ]);
  assert.equal((await inspectFile(cleanWebp, 'webp')).ok, true);
  // Appended WEBP
  const dirtyWebp = Buffer.concat([cleanWebp, Buffer.from('extra bytes')]);
  assert.equal((await inspectFile(dirtyWebp, 'webp')).ok, false);
});

test('Task 4: Scanner fallback in development vs production', async () => {
  const origEnv = process.env.NODE_ENV;
  const origHost = process.env.CLAMAV_HOST;
  const origAllow = process.env.ALLOW_UNSCANNED_UPLOADS;
  delete process.env.CLAMAV_HOST;

  try {
    // Development -> clean
    process.env.NODE_ENV = 'development';
    const devRes = await scanBuffer(Buffer.from('hello'));
    assert.equal(devRes.status, 'clean');

    // Production without ALLOW_UNSCANNED_UPLOADS -> error
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_UNSCANNED_UPLOADS;
    const prodRes = await scanBuffer(Buffer.from('hello'));
    assert.equal(prodRes.status, 'error');

    // Production with ALLOW_UNSCANNED_UPLOADS=true -> clean
    process.env.ALLOW_UNSCANNED_UPLOADS = 'true';
    const overrideRes = await scanBuffer(Buffer.from('hello'));
    assert.equal(overrideRes.status, 'clean');
  } finally {
    process.env.NODE_ENV = origEnv;
    if (origHost) process.env.CLAMAV_HOST = origHost; else delete process.env.CLAMAV_HOST;
    if (origAllow) process.env.ALLOW_UNSCANNED_UPLOADS = origAllow; else delete process.env.ALLOW_UNSCANNED_UPLOADS;
  }
});

test('Task 3, 5 & 7: With scan_status pending or infected, GET /api/files/url returns no link', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  // Create an admin user token to test canAccess
  const adminEmail = `admin.${crypto.randomBytes(4).toString('hex')}@test.rw`;
  const adminRes = await query(
    "INSERT INTO users (role, status, name, email, password_hash, email_verified_at) VALUES ('admin', 'approved', 'Test Admin', $1, 'hash', NOW()) RETURNING id, role, email",
    [adminEmail]
  );
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: adminRes.rows[0].id, role: 'admin', email: adminEmail }, process.env.JWT_SECRET);

  const pendingKey = `documents/${crypto.randomBytes(16).toString('hex')}.pdf`;
  const infectedKey = `documents/${crypto.randomBytes(16).toString('hex')}.pdf`;
  const cleanKey = `documents/${crypto.randomBytes(16).toString('hex')}.pdf`;

  // Write physical files in storage
  await storage.put(pendingKey, PDF_CLEAN());
  await storage.put(infectedKey, PDF_CLEAN());
  await storage.put(cleanKey, PDF_CLEAN());

  // Record scans
  await query('INSERT INTO file_scans (key, sha256, status) VALUES ($1, $2, $3)', [pendingKey, 'dummy-sha1', 'pending']);
  await query('INSERT INTO file_scans (key, sha256, status) VALUES ($1, $2, $3)', [infectedKey, 'dummy-sha2', 'infected']);
  await query('INSERT INTO file_scans (key, sha256, status) VALUES ($1, $2, $3)', [cleanKey, 'dummy-sha3', 'clean']);

  // GET pendingKey -> 409
  const resPending = await fetch(`${base}/api/files/url?key=${encodeURIComponent(pendingKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resPending.status, 409, 'pending file should return 409');
  const bodyPending = await resPending.json();
  assert.equal(bodyPending.message, 'This file is still being checked.');

  // GET infectedKey -> 409
  const resInfected = await fetch(`${base}/api/files/url?key=${encodeURIComponent(infectedKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resInfected.status, 409, 'infected file should return 409');

  // GET cleanKey -> 200
  const resClean = await fetch(`${base}/api/files/url?key=${encodeURIComponent(cleanKey)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(resClean.status, 200, 'clean file should return 200');
  const bodyClean = await resClean.json();
  assert.ok(bodyClean.url, 'clean file should return a download url');

  // Cleanup storage
  await storage.remove([pendingKey, infectedKey, cleanKey]);
});

test('Task 4 & 7: With a mocked scanner returning error, the upload stays unavailable', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  setMockScanner(async () => ({ status: 'error', detail: 'Scanner timed out' }));

  const adminEmail = `admin.${crypto.randomBytes(4).toString('hex')}@test.rw`;
  const adminRes = await query(
    "INSERT INTO users (role, status, name, email, password_hash, email_verified_at) VALUES ('admin', 'approved', 'Test Admin', $1, 'hash', NOW()) RETURNING id",
    [adminEmail]
  );
  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: adminRes.rows[0].id, role: 'admin', email: adminEmail }, process.env.JWT_SECRET);

  const file = {
    buffer: PDF_CLEAN(),
    originalname: 'test_doc.pdf',
    size: PDF_CLEAN().length,
  };

  // Upload should succeed in storing file, but file_scans.status is 'error'
  const key = await storeUpload(file, 'documents');
  const row = (await query('SELECT status, detail FROM file_scans WHERE key = $1', [key])).rows[0];
  assert.equal(row.status, 'error');

  // Requesting download URL must fail closed with 409
  const res = await fetch(`${base}/api/files/url?key=${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 409, 'File with status error must stay unavailable');
  const data = await res.json();
  assert.equal(data.message, 'This file is still being checked.');

  resetMockScanner();
  await storage.remove(key);
});

test('Task 3: With a mocked scanner returning infected, storeUpload deletes file, writes audit_log, and throws 400', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  setMockScanner(async () => ({ status: 'infected', detail: 'Eicar-Test-Signature FOUND' }));

  const file = {
    buffer: PDF_CLEAN(),
    originalname: 'bad_resume.pdf',
    size: PDF_CLEAN().length,
  };

  let threw = false;
  try {
    await storeUpload(file, 'resumes');
  } catch (err) {
    threw = true;
    assert.equal(err.status, 400);
    assert.match(err.message, /flagged as infected or unsafe/i);
  }
  assert.ok(threw, 'storeUpload should throw 400 on infected file');

  const auditRes = await query("SELECT * FROM audit_log WHERE action = 'file.infected' ORDER BY id DESC LIMIT 1");
  assert.ok(auditRes.rows.length > 0, 'Infected file must be recorded in audit_log');
  assert.match(auditRes.rows[0].meta.detail, /Eicar-Test-Signature/);

  resetMockScanner();
});

test('Task 6: Duplicate registration document detection finds existing employer hash', async (t) => {
  if (!dbAvailable) {
    t.skip('Database not configured');
    return;
  }

  const sha = crypto.randomBytes(32).toString('hex');
  const key = `documents/${crypto.randomBytes(16).toString('hex')}.pdf`;

  // Insert mock scan and employer
  await query('INSERT INTO file_scans (key, sha256, status) VALUES ($1, $2, $3)', [key, sha, 'clean']);
  const userRes = await query("INSERT INTO users (role, status, name, email, password_hash) VALUES ('employer', 'approved', 'Emp1', $1, 'pw') RETURNING id", [`emp.${crypto.randomBytes(4).toString('hex')}@test.rw`]);
  const empRes = await query("INSERT INTO employers (user_id, company_name, registration_doc_url) VALUES ($1, 'Acme Corp', $2) RETURNING id", [userRes.rows[0].id, key]);

  // Find duplicate
  const dup = await findDuplicateDoc(sha, null);
  assert.ok(dup, 'Should find duplicate document');
  assert.equal(dup.employer_id, empRes.rows[0].id);

  // Excluding user should return null
  const excluded = await findDuplicateDoc(sha, userRes.rows[0].id);
  assert.equal(excluded, null, 'Should exclude same user_id');
});
