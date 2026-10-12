// One-time move of existing local files (server/uploads) into your Cloudflare R2 bucket, then clean the database
// references so they hold plain keys (resumes/abc.pdf) instead of old /uploads/... paths.
//   1. put the R2_* values in server/.env   2. npm run migrate-uploads            (dry run: lists what it would do)
//   3. npm run migrate-uploads -- --apply    (uploads + rewrites the database)
const fs = require('fs');
const path = require('path');
const { query, initDb, pool } = require('../db');
const storage = require('../lib/storage');

const apply = process.argv.includes('--apply');

function* walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

(async () => {
  if (storage.mode !== 'r2') { console.error('R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET in server/.env first.'); process.exit(1); }
  await initDb();
  let n = 0;
  for (const file of walk(storage.LOCAL_ROOT)) {
    const key = path.relative(storage.LOCAL_ROOT, file).split(path.sep).join('/');
    if (!storage.KEY_RE.test(key)) { console.log('skip (not a valid key):', key); continue; }
    console.log(`${apply ? 'upload' : 'would upload'}: ${key}`);
    if (apply) await storage.put(key, fs.readFileSync(file));
    n += 1;
  }
  console.log(`${n} file(s) ${apply ? 'uploaded' : 'found'}.`);
  if (apply) {
    const strip = "regexp_replace(%s, '^/?uploads/', '')";
    for (const [table, col] of [['employers', 'registration_doc_url'], ['employers', 'logo_url'], ['job_seekers', 'resume_url'], ['applications', 'resume_url']]) {
      await query(`UPDATE ${table} SET ${col} = ${strip.replace('%s', col)} WHERE ${col} ~ '^/?uploads/'`);
    }
    const apps = (await query("SELECT id, uploaded_files FROM applications WHERE uploaded_files::text LIKE '%\"url\"%'")).rows;
    for (const a of apps) {
      const files = (a.uploaded_files || []).map((f) => {
        const key = f.key || storage.normalizeKey(f.url || '');
        const { url, ...rest } = f;
        return key ? { ...rest, key } : f;
      });
      await query('UPDATE applications SET uploaded_files = $1 WHERE id = $2', [JSON.stringify(files), a.id]);
    }
    console.log('Database references updated. After checking that files open correctly you may delete server/uploads.');
  }
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
