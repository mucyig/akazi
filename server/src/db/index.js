// PostgreSQL only. There is no silent fallback database any more: if Postgres is down the server stops.
const fs = require('fs');
const path = require('path');
require('../lib/env');
const { Pool, types } = require('pg');

// DATE columns (job deadline) stay plain 'YYYY-MM-DD' strings, so no timezone can shift them by a day.
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
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

    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

    // Idempotent migrations for databases created by earlier versions
    const alters = [
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_logins INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ",
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ",
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ",
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS result_seen_at TIMESTAMPTZ",
      "ALTER TABLE employers ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid'",
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_status VARCHAR(30)",
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS raw_payload TEXT",
      "ALTER TABLE job_seekers ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'other'",
      "ALTER TABLE job_seekers DROP COLUMN IF EXISTS national_id",
    ];
    for (const sql of alters) await client.query(sql);

    if (usersExist.rows[0].t && !hadVerifyColumn) {
      // Accounts that existed before email verification keep working
      await client.query('UPDATE users SET email_verified_at = COALESCE(created_at, NOW()) WHERE email_verified_at IS NULL');
    }
    // Existing results should not light up the "new result" dot for everyone after the upgrade
    await client.query("UPDATE applications SET status_changed_at = COALESCE(updated_at, created_at), result_seen_at = COALESCE(updated_at, created_at) WHERE status <> 'pending' AND status_changed_at IS NULL");

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
