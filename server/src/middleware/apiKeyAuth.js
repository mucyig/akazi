const crypto = require('crypto');
const { query } = require('../db');

// In-memory rate limiting map: keyHash -> { count, resetAt }
const rateLimitMap = new Map();
// Throttled last_used_at updates: keyId -> lastUpdatedTimestamp
const lastUsedCache = new Map();

// Periodically clean up expired rate limit buckets
setInterval(() => {
  const now = Date.now();
  for (const [hash, bucket] of rateLimitMap.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitMap.delete(hash);
    }
  }
}, 60 * 1000).unref();

const hashKey = (key) => crypto.createHash('sha256').update(key.trim()).digest('hex');

async function authenticateApiKey(req, res, next) {
  // Extract key from X-Akazi-Key or Authorization header
  let rawKey = req.headers['x-akazi-key'];
  if (!rawKey && req.headers['authorization']) {
    const parts = req.headers['authorization'].split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
      rawKey = parts[1];
    }
  }

  if (!rawKey || typeof rawKey !== 'string') {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'API key is required. Pass your key in the "X-Akazi-Key" header or "Authorization: Bearer <key>". You can generate a free key at /developers',
      docs: '/developers'
    });
  }

  const trimmed = rawKey.trim();
  if (!/^ak_(live|test)_[a-zA-Z0-9_-]{24,64}$/.test(trimmed)) {
    return res.status(401).json({
      error: 'invalid_key',
      message: 'API key format is invalid. Keys must start with ak_live_ or ak_test_.'
    });
  }

  const keyHash = hashKey(trimmed);

  try {
    const keyRes = await query(
      `SELECT id, user_id, key_prefix, name, tier, rate_limit_per_hour, is_active
       FROM api_keys
       WHERE key_hash = $1`,
      [keyHash]
    );

    const apiKey = keyRes.rows[0];
    if (!apiKey) {
      return res.status(401).json({
        error: 'invalid_key',
        message: 'The provided API key does not exist or has been deleted.'
      });
    }

    if (!apiKey.is_active) {
      return res.status(403).json({
        error: 'key_revoked',
        message: 'This API key has been revoked or deactivated.'
      });
    }

    // Rate Limiting per 1-hour window
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    let bucket = rateLimitMap.get(keyHash);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      rateLimitMap.set(keyHash, bucket);
    }

    bucket.count += 1;
    const limit = apiKey.rate_limit_per_hour || 120;
    const remaining = Math.max(0, limit - bucket.count);
    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

    res.set('X-RateLimit-Limit', String(limit));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      res.set('Retry-After', String(resetSeconds));
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Free tier rate limit reached (${limit} requests/hour). To protect platform stability, requests are capped. Please retry in ${Math.ceil(resetSeconds / 60)} minutes or contact support@akazi.rw for Pro or Enterprise high-throughput access.`,
        tier: apiKey.tier,
        limit,
        reset_in_seconds: resetSeconds
      });
    }

    // Throttled update of last_used_at (at most once every 60s per key to avoid DB write load)
    const lastUpdate = lastUsedCache.get(apiKey.id) || 0;
    if (now - lastUpdate > 60 * 1000) {
      lastUsedCache.set(apiKey.id, now);
      query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [apiKey.id]).catch(() => {});
    }

    req.apiKey = apiKey;
    next();
  } catch (err) {
    console.error('[API Key Auth Error]', err.message);
    res.status(500).json({ error: 'server_error', message: 'Unable to verify API key.' });
  }
}

module.exports = { authenticateApiKey, hashKey };
