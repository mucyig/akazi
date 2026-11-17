// PostgreSQL only. There is no silent fallback database any more: if Postgres is down the server stops.
const fs = require('fs');
const path = require('path');
require('../lib/env');
const { Pool, types } = require('pg');

// DATE columns (job deadline) stay plain 'YYYY-MM-DD' strings, so no timezone can shift them by a day.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  max: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', (e) => console.error('[Database] idle client error:', e.message));

async function query(text, params = []) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('[Database] query error:', err.message);
    throw err;
  }
}

// Run several statements atomically
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn((text, params = []) => client.query(text, params));
    await client.query('COMMIT');
    return out;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query("SET TIME ZONE 'UTC'");
    await client.query('SELECT pg_advisory_lock(727001)');

    // Older databases: remember whether the verification column is new so existing users are grandfathered in
    const col = await client.query("SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email_verified_at'");
    const usersExist = await client.query("SELECT to_regclass('public.users') AS t");
    const hadVerifyColumn = col.rows.length > 0;

    // 1. Ensure all base tables exist before running column migrations
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

    // 2. Idempotent column migrations for databases created by earlier versions
    const migrations = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ",
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ",
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS result_seen_at TIMESTAMPTZ",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS verification_tick_status VARCHAR(20) NOT NULL DEFAULT 'unverified'",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS verification_tick_doc_url TEXT",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS verification_applied_at TIMESTAMPTZ",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS verification_tick_notes TEXT",
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status VARCHAR(30)",
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_payload TEXT",
      "ALTER TABLE job_seekers ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'other'",
      "ALTER TABLE job_seekers DROP COLUMN IF EXISTS national_id",
      "ALTER TABLE audit_log ALTER COLUMN target_id TYPE VARCHAR(255)",
    ];
    for (const sql of migrations) await client.query(sql);

    // 3. Fix check constraints from older schemas if necessary
    // Older databases may have a jobs.status check without 'removed' (used when moderation takes a job down)
    await client.query(`DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'jobs'::regclass AND conname = 'jobs_status_check'
                 AND pg_get_constraintdef(oid) NOT LIKE '%removed%') THEN
        ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
        ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('active','closed','removed'));
      END IF;
    END $$;`);

    // 4. Create indexes only after all tables and referenced columns exist
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email))",
      "CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status)",
      "CREATE INDEX IF NOT EXISTS idx_employers_is_verified ON employers(is_verified)",
      "CREATE INDEX IF NOT EXISTS idx_employers_tick_status ON employers(verification_tick_status)",
      "CREATE INDEX IF NOT EXISTS idx_payments_employer ON payments(employer_id)",
      "CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)",
      "CREATE INDEX IF NOT EXISTS idx_jobs_employer_id ON jobs(employer_id)",
      "CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)",
      "CREATE INDEX IF NOT EXISTS idx_jobs_active_created ON jobs(status, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category)",
      "CREATE INDEX IF NOT EXISTS idx_jobs_location ON jobs(location)",
      "CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id)",
      "CREATE INDEX IF NOT EXISTS idx_applications_employee ON applications(employee_id)",
      "CREATE INDEX IF NOT EXISTS idx_applications_job_status ON applications(job_id, status)",
      "CREATE INDEX IF NOT EXISTS idx_applications_emp_status ON applications(employee_id, status)",
      "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose)",
      "CREATE INDEX IF NOT EXISTS idx_chat_app ON chat_messages(application_id)",
      "CREATE INDEX IF NOT EXISTS idx_chat_app_created ON chat_messages(application_id, created_at ASC)",
      "CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_file_scans_sha256 ON file_scans(sha256)",
      "CREATE INDEX IF NOT EXISTS idx_file_scans_status ON file_scans(status)",
      "CREATE INDEX IF NOT EXISTS idx_reports_job ON reports(job_id)",
      "CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)",
      "CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC)",
      "CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash)",
      "CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id)",
      "CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active)",
    ];
    for (const sql of indexes) await client.query(sql);

    // 5. Data grandfathering & backfill
    if (usersExist.rows[0].t && !hadVerifyColumn) {
      // Accounts that existed before email verification keep working
      await client.query('UPDATE users SET email_verified_at = COALESCE(created_at, NOW()) WHERE email_verified_at IS NULL');
    }
    // Existing results should not light up the "new result" dot for everyone after the upgrade
    await client.query("UPDATE applications SET status_changed_at = COALESCE(updated_at, created_at), result_seen_at = COALESCE(updated_at, created_at) WHERE status <> 'pending' AND status_changed_at IS NULL");

    // 6. Legacy data imports
    await importLegacyChat(client);
    console.log('[Database] Connected to PostgreSQL and schema is up to date.');
  } finally {
    try { await client.query('SELECT pg_advisory_unlock(727001)'); } catch { /* ignore */ }
    client.release();
  }
}

// One-time import of the old data/chat.json file into the chat_messages table
async function importLegacyChat(client) {
  const file = path.join(__dirname, '../../data/chat.json');
  if (!fs.existsSync(file)) return;
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM chat_messages');
    if (rows[0].n === 0) {
      const store = JSON.parse(fs.readFileSync(file, 'utf8'));
      let ok = 0;
      for (const m of store.messages || []) {
        try {
          await client.query(
            'INSERT INTO chat_messages (application_id, sender_id, body, created_at, read_at) VALUES ($1,$2,$3,$4,$5)',
            [m.application_id, m.sender_id, String(m.body || '').slice(0, 2000), m.created_at, m.read_at]
          );
          ok += 1;
        } catch { /* message belongs to a row that no longer exists */ }
      }
      console.log(`[Database] Imported ${ok} chat message(s) from chat.json.`);
    }
    fs.renameSync(file, file + '.imported');
  } catch (e) {
    console.warn('[Database] Could not import chat.json:', e.message);
  }
}

module.exports = { pool, query, withTransaction, initDb };
