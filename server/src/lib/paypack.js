// PayPack mobile money client (Rwanda: MTN MoMo, Airtel Money, Tigo Cash)
// Docs: https://docs.paypack.rw
//
// Uses the global fetch available in Node 18+. Credentials are read from the
// environment so the rest of the app never has to know the gateway details.
const crypto = require('crypto');

const PAYPACK_BASE_URL = (process.env.PAYPACK_BASE_URL || 'https://payments.paypack.rw/api').replace(/\/+$/, '');

// Access tokens are JWT tokens that expire after ~15 minutes. Cache in memory.
let tokenCache = { access: null, expiresAt: 0 };

function isConfigured() {
  return Boolean(process.env.PAYPACK_CLIENT_ID && process.env.PAYPACK_CLIENT_SECRET);
}

function assertFetchAvailable() {
  if (typeof fetch !== 'function') {
    throw new Error('PayPack requires Node.js 18 or newer (global fetch is not available).');
  }
}

async function paypackFetch(path, { method = 'GET', body, token, idempotencyKey } = {}) {
  assertFetchAvailable();

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = String(idempotencyKey).slice(0, 32);
  // Route webhooks to the matching dashboard environment (Development/Production)
  if (process.env.PAYPACK_MODE) headers['X-Webhook-Mode'] = process.env.PAYPACK_MODE;

  const res = await fetch(`${PAYPACK_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `PayPack request failed (${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Authenticate the application and cache the access token.
async function getAccessToken(force = false) {
  if (!isConfigured()) {
    throw new Error('PayPack is not configured. Set PAYPACK_CLIENT_ID and PAYPACK_CLIENT_SECRET in server/.env.');
  }

  const now = Date.now();
  if (!force && tokenCache.access && now < tokenCache.expiresAt) {
    return tokenCache.access;
  }

  const data = await paypackFetch('/auth/agents/authorize', {
    method: 'POST',
    body: {
      client_id: process.env.PAYPACK_CLIENT_ID,
      client_secret: process.env.PAYPACK_CLIENT_SECRET,
    },
  });

  tokenCache = {
    access: data.access,
    // Refresh one minute before the documented 15 minute expiry
    expiresAt: now + 14 * 60 * 1000,
  };
  return tokenCache.access;
}

// Request that funds be deposited from a customer's mobile money wallet.
async function cashin({ amount, number, idempotencyKey }) {
  const token = await getAccessToken();
  return paypackFetch('/transactions/cashin', {
    method: 'POST',
    token,
    idempotencyKey,
    body: { amount, number },
  });
}

// Look up a transaction by its PayPack reference.
async function findTransaction(ref) {
  const token = await getAccessToken();
  return paypackFetch(`/transactions/find/${encodeURIComponent(ref)}`, { token });
}

// Verify the X-Paypack-Signature header (base64 HMAC-SHA256 of the raw body).
function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.PAYPACK_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  PAYPACK_BASE_URL,
  isConfigured,
  getAccessToken,
  cashin,
  findTransaction,
  verifyWebhookSignature,
};
