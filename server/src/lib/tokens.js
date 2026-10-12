const crypto = require('crypto');
const { query } = require('../db');

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// Creates a fresh random token for the user and returns the raw value (only its hash is stored).
// Any older unused token of the same purpose is invalidated.
async function createToken(userId, purpose, ttlMinutes) {
  const raw = crypto.randomBytes(32).toString('hex');
  await query('DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL', [userId, purpose]);
  await query(
    "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, NOW() + ($4 || ' minutes')::interval)",
    [userId, purpose, sha256(raw), String(ttlMinutes)]
  );
  return raw;
}

// Atomically spends a token. Returns the user id, or null if it is wrong, expired or already used.
async function consumeToken(raw, purpose) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const r = await query(
    'UPDATE auth_tokens SET used_at = NOW() WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW() RETURNING user_id',
    [sha256(raw), purpose]
  );
  return r.rows[0] ? r.rows[0].user_id : null;
}

async function recentTokenCount(userId, purpose, minutes) {
  const r = await query(
    "SELECT COUNT(*)::int AS n FROM auth_tokens WHERE user_id = $1 AND purpose = $2 AND created_at > NOW() - ($3 || ' minutes')::interval",
    [userId, purpose, String(minutes)]
  );
  return r.rows[0].n;
}

module.exports = { createToken, consumeToken, recentTokenCount, sha256 };
