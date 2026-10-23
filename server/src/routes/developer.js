const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { hashKey } = require('../middleware/apiKeyAuth');

// All developer management endpoints require user login
router.use(authenticateToken);

// GET /api/developer/keys - List current user's API keys
router.get('/keys', async (req, res) => {
  try {
    const keysRes = await query(
      `SELECT id, name, key_prefix, tier, rate_limit_per_hour, is_active, last_used_at, created_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ keys: keysRes.rows });
  } catch (err) {
    console.error('[Developer Keys List Error]', err.message);
    res.status(500).json({ message: 'Failed to retrieve API keys.' });
  }
});

// POST /api/developer/keys - Create a new API key
router.post('/keys', async (req, res) => {
  try {
    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM api_keys WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );
    if (countRes.rows[0].count >= 5) {
      return res.status(400).json({
        message: 'You have reached the maximum limit of 5 active API keys. Please revoke an existing key to generate a new one.'
      });
    }

    const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = rawName.slice(0, 80) || 'Default API Key';

    // Generate secure API key: ak_live_ + 48 hex chars (24 bytes)
    const rawKey = `ak_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyHash = hashKey(rawKey);
    const keyPrefix = `${rawKey.slice(0, 14)}...`;

    const insRes = await query(
      `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, tier, rate_limit_per_hour, is_active)
       VALUES ($1, $2, $3, $4, 'free', 120, true)
       RETURNING id, name, key_prefix, tier, rate_limit_per_hour, created_at`,
      [req.user.id, keyHash, keyPrefix, name]
    );

    res.status(201).json({
      message: 'API key created successfully. Save your key now — it will not be shown again.',
      apiKey: rawKey,
      keyDetails: insRes.rows[0]
    });
  } catch (err) {
    console.error('[Developer Key Creation Error]', err.message);
    res.status(500).json({ message: 'Failed to create API key.' });
  }
});

// DELETE /api/developer/keys/:id - Revoke an API key
router.delete('/keys/:id', async (req, res) => {
  try {
    const keyId = parseInt(req.params.id, 10);
    if (!Number.isInteger(keyId)) {
      return res.status(400).json({ message: 'Invalid API key ID.' });
    }

    const checkRes = await query(
      'SELECT id, user_id FROM api_keys WHERE id = $1',
      [keyId]
    );

    if (!checkRes.rows.length) {
      return res.status(404).json({ message: 'API key not found.' });
    }

    if (checkRes.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You do not have permission to delete this key.' });
    }

    await query('DELETE FROM api_keys WHERE id = $1', [keyId]);
    res.json({ message: 'API key revoked and deleted successfully.' });
  } catch (err) {
    console.error('[Developer Key Delete Error]', err.message);
    res.status(500).json({ message: 'Failed to revoke API key.' });
  }
});

module.exports = router;
