// Backfills file_scans rows for existing files in storage or referenced in the database.
// Usage: node server/src/scripts/backfill-scans.js [--force]
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { query, initDb, pool } = require('../db');
const storage = require('../lib/storage');
const { inspectFile } = require('../lib/filescan');
const { scanBuffer } = require('../lib/scanner');

const force = process.argv.includes('--force');

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

async function streamToBuffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function collectKeys() {
  const keys = new Set();

  // 1. Files in local folder if present
  if (fs.existsSync(storage.LOCAL_ROOT)) {
    for (const file of walk(storage.LOCAL_ROOT)) {
      const rel = path.relative(storage.LOCAL_ROOT, file).split(path.sep).join('/');
      const k = storage.normalizeKey(rel);
      if (k) keys.add(k);
    }
  }

  // 2. References in employers
  const emp = await query('SELECT registration_doc_url, logo_url FROM employers');
  for (const row of emp.rows) {
    const docKey = storage.normalizeKey(row.registration_doc_url);
    if (docKey) keys.add(docKey);
    const logoKey = storage.normalizeKey(row.logo_url);
    if (logoKey) keys.add(logoKey);
  }

  // 3. References in job_seekers
  const js = await query('SELECT resume_url FROM job_seekers');
  for (const row of js.rows) {
    const rKey = storage.normalizeKey(row.resume_url);
    if (rKey) keys.add(rKey);
  }

  // 4. References in applications
  const apps = await query('SELECT resume_url, uploaded_files FROM applications');
  for (const row of apps.rows) {
    const rKey = storage.normalizeKey(row.resume_url);
    if (rKey) keys.add(rKey);
    const files = Array.isArray(row.uploaded_files) ? row.uploaded_files : [];
    for (const f of files) {
      const k = storage.normalizeKey(f.key || f.url || '');
      if (k) keys.add(k);
    }
  }

  return Array.from(keys);
}

async function run() {
  await initDb();
  console.log('[Backfill] Collecting files to scan...');
  const keys = await collectKeys();
  console.log(`[Backfill] Found ${keys.length} distinct file reference(s).`);

  let scanned = 0;
  let clean = 0;
  let infected = 0;
  let errored = 0;
  let skipped = 0;

  for (const key of keys) {
    if (!force) {
      const existing = await query('SELECT status FROM file_scans WHERE key = $1', [key]);
      if (existing.rows.length && existing.rows[0].status !== 'pending') {
        skipped += 1;
        continue;
      }
    }

    const item = await storage.getStream(key);
    if (!item) {
      console.warn(`[Backfill] File not found in storage: ${key}`);
      continue;
    }

    const buffer = await streamToBuffer(item.stream);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const ext = storage.extOf(key);

    const inspection = await inspectFile(buffer, ext);
    let status;
    let detail;

    if (!inspection.ok) {
      status = 'infected';
      detail = inspection.reason;
      infected += 1;
    } else {
      const scanRes = await scanBuffer(buffer);
      status = scanRes.status || 'error';
      detail = scanRes.detail || null;
      if (status === 'clean') clean += 1;
      else if (status === 'infected') infected += 1;
      else errored += 1;
    }

    await query(
      `INSERT INTO file_scans (key, sha256, status, scanned_at, detail)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (key) DO UPDATE
       SET sha256 = EXCLUDED.sha256,
           status = EXCLUDED.status,
           scanned_at = EXCLUDED.scanned_at,
           detail = EXCLUDED.detail`,
      [key, sha256, status, detail]
    );

    scanned += 1;
    console.log(`[Backfill] Scanned ${key}: status=${status} (${detail || 'OK'})`);
  }

  console.log(`\n[Backfill] Completed: ${scanned} scanned (${clean} clean, ${infected} infected, ${errored} errors), ${skipped} skipped.`);
  await pool.end();
}

run().catch((e) => {
  console.error('[Backfill] Fatal error:', e);
  process.exit(1);
});
