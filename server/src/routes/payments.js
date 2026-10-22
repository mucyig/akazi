const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const paypack = require('../lib/paypack');
const { buildWebhookUpdatePayload } = require('../lib/payment-webhook');
const { settlePayment } = require('../lib/settle-payment');
const { audit } = require('../lib/audit');

// In-memory throttle cache: maps ref -> timestamp of last PayPack lookup.
// Note: In a multi-instance or clustered deployment, this Map is per-process;
// for multi-server clusters a shared distributed cache (e.g. Redis) or database lock
// should be used instead.
const statusCheckThrottleMap = new Map();

function withTimeout(promise, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// Employer verification fee (RWF) - paid AFTER admin approval.
const EMPLOYER_FEE = parseInt(process.env.PAYPACK_EMPLOYER_FEE_RWF || '5000', 10);

// Normalize a Rwandan mobile money number to local 07XXXXXXXX format.
function normalizeRwPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = '';
  if (/^2507\d{8}$/.test(digits)) local = '0' + digits.slice(3);
  else if (/^07\d{8}$/.test(digits)) local = digits;
  else if (/^7\d{8}$/.test(digits)) local = '0' + digits;
  return /^07[2389]\d{7}$/.test(local) ? local : null;
}

const initiateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => `u${req.user?.id || req.clientIp || req.ip}`,
  message: { message: 'Too many payment attempts. Please try again later.' },
});
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => req.clientIp || req.ip,
});

// 1. Start the verification payment
router.post('/paypack/initiate', authenticateToken, requireRole('employer'), initiateLimiter, async (req, res) => {
  try {
    if (req.user.status !== 'approved') {
      return res.status(403).json({ message: 'Your business must be verified by an administrator before you can pay.', code: 'EMPLOYER_NOT_APPROVED' });
    }
    if (!paypack.isConfigured()) {
      return res.status(503).json({ message: 'Mobile money payments are not configured yet. Please try again later.' });
    }
    const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
    if (!empRes.rows.length) return res.status(404).json({ message: 'Employer profile not found.' });
    const employer = empRes.rows[0];
    if (employer.payment_status === 'paid') return res.json({ alreadyPaid: true, status: 'paid', amount: EMPLOYER_FEE });

    const phone = normalizeRwPhone(req.body?.phone || req.user.phone);
    if (!phone) return res.status(400).json({ message: 'Enter a valid Rwandan mobile money number (e.g. 078 123 4567).' });

    // One request at a time, and a daily cap: stops anyone from spamming prompts to a phone number
    const inflight = await query("SELECT 1 FROM payments WHERE employer_id = $1 AND status = 'pending' AND created_at > NOW() - INTERVAL '3 minutes' LIMIT 1", [employer.id]);
    if (inflight.rows.length) return res.status(409).json({ message: 'A payment request is already waiting for approval on your phone. Please approve it, or wait 3 minutes to try again.' });
    // Older prompts may still be answered on the phone: ask PayPack what happened to them before sending another,
    // otherwise the same employer could be charged twice.
    const older = await query("SELECT ref FROM payments WHERE employer_id = $1 AND status = 'pending' AND ref IS NOT NULL ORDER BY created_at DESC LIMIT 5", [employer.id]);
    for (const row of older.rows) {
      let live;
      try {
        live = await withTimeout(paypack.findTransaction(row.ref), 5000);
      } catch (e) {
        console.warn('[Payments] Could not check earlier payment', row.ref, e.message);
        return res.status(409).json({ message: 'We are still checking your previous payment request. Please wait a few minutes before trying again.' });
      }
      const confirmed = live?.data || live;
      const info = buildWebhookUpdatePayload(confirmed || {}, JSON.stringify(confirmed || {}));
      if (info.status === 'paid' || info.status === 'failed') {
        const settled = await settlePayment(row.ref, confirmed, JSON.stringify(confirmed), { source: 'initiate_check', clientIp: req.clientIp, actorId: req.user.id });
        if (settled?.status === 'paid') return res.json({ alreadyPaid: true, status: 'paid', amount: EMPLOYER_FEE });
      } else {
        return res.status(409).json({ message: 'Your previous payment request is still waiting on your phone. Please approve it, or wait for it to expire before trying again.' });
      }
    }
    const today = await query("SELECT COUNT(*)::int AS n FROM payments WHERE employer_id = $1 AND created_at > NOW() - INTERVAL '24 hours'", [employer.id]);
    if (today.rows[0].n >= 5) return res.status(429).json({ message: 'You reached the daily limit of payment attempts. Please try again tomorrow or contact support.' });

    let payload;
    try {
      payload = await paypack.cashin({ amount: EMPLOYER_FEE, number: phone, idempotencyKey: crypto.randomBytes(16).toString('hex') });
    } catch (e) {
      console.error('PayPack cashin failed:', e.message);
      await query("UPDATE employers SET payment_status = 'failed' WHERE id = $1 AND payment_status <> 'paid'", [employer.id]);
      return res.status(502).json({ message: 'The payment could not be started. Please check the number and try again.', status: 'failed' });
    }

    const ref = payload?.ref || null;
    await query('INSERT INTO payments (employer_id, user_id, ref, amount, phone, kind, status) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [employer.id, req.user.id, ref, EMPLOYER_FEE, phone, 'CASHIN', 'pending']);
    await query("UPDATE employers SET payment_status = 'pending' WHERE id = $1", [employer.id]);
    audit(req, 'payment.initiated', 'payment', ref, { amount: EMPLOYER_FEE });

    res.status(201).json({ message: 'Payment request sent. Approve the prompt on your phone.', ref, amount: EMPLOYER_FEE, phone, status: payload?.status || 'pending' });
  } catch (err) {
    console.error('PayPack initiate error:', err.message);
    res.status(500).json({ message: 'Failed to start the payment.' });
  }
});

router.get('/paypack/latest', authenticateToken, async (req, res) => {
  try {
    const r = await query('SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1', [req.user.id]);
    const p = r.rows[0] || null;
    res.json({ payment: p ? { ref: p.ref, amount: p.amount, status: p.status, phone: p.phone, created_at: p.created_at } : null });
  } catch (err) {
    console.error('PayPack latest error:', err.message);
    res.status(500).json({ message: 'Failed to load the latest payment.' });
  }
});

router.get('/paypack/status/:ref', authenticateToken, async (req, res) => {
  try {
    const ref = String(req.params.ref).slice(0, 100);
    const r = await query('SELECT * FROM payments WHERE ref = $1', [ref]);
    if (!r.rows.length) return res.status(404).json({ message: 'Payment not found.' });
    let p = r.rows[0];
    if (req.user.role !== 'admin' && p.user_id !== req.user.id) return res.status(403).json({ message: 'Access denied.' });

    const createdAt = new Date(p.created_at).getTime();
    const ageSeconds = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
    const expiresAt = new Date(createdAt + 3 * 60 * 1000).toISOString();

    // If still pending, older than 20 seconds, and PayPack is configured: check PayPack with throttling
    if (p.status === 'pending' && ageSeconds >= 20 && paypack.isConfigured()) {
      const lastCheck = statusCheckThrottleMap.get(ref) || 0;
      const now = Date.now();
      if (now - lastCheck >= 10000) {
        statusCheckThrottleMap.set(ref, now);
        try {
          const live = await withTimeout(paypack.findTransaction(ref), 5000);
          const confirmed = live?.data || live;
          if (confirmed) {
            const info = buildWebhookUpdatePayload(confirmed, JSON.stringify(confirmed));
            if (info.status === 'paid' || info.status === 'failed') {
              const settleRes = await settlePayment(ref, confirmed, JSON.stringify(confirmed), {
                source: 'status_check',
                clientIp: req.clientIp,
                actorId: req.user.id,
              });
              if (settleRes?.status) {
                p.status = settleRes.status;
              }
            }
          }
        } catch (e) {
          // If PayPack is unreachable or times out, just return the current DB status
          console.warn('[Payments] Live status check failed for', ref, e.message);
        }
      }
    }

    res.json({
      payment: {
        ref: p.ref,
        amount: p.amount,
        status: p.status,
        phone: p.phone,
        age_seconds: ageSeconds,
        expires_at: expiresAt,
      },
    });
  } catch (err) {
    console.error('PayPack status error:', err.message);
    res.status(500).json({ message: 'Failed to check the payment status.' });
  }
});

// 4. PayPack webhook. A payment is only ever marked paid when:
//    (a) the HMAC signature is valid (secret is mandatory), (b) PayPack's own API confirms the transaction,
//    (c) the amount matches, and (d) the payment is still pending (so events cannot be replayed or reversed).
router.post('/paypack/webhook', webhookLimiter, async (req, res) => {
  try {
    if (!process.env.PAYPACK_WEBHOOK_SECRET) {
      console.error('[Payments] Webhook received but PAYPACK_WEBHOOK_SECRET is not set. Ignoring.');
      return res.status(503).json({ message: 'Webhook is not configured.' });
    }
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    if (!paypack.verifyWebhookSignature(raw, req.headers['x-paypack-signature'])) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    const event = req.body || {};
    const data = event.data || {};
    if (event.kind !== 'transaction:processed') return res.json({ received: true, ignored: true });
    const ref = typeof data.ref === 'string' ? data.ref.slice(0, 100) : null;
    if (!ref) return res.json({ received: true, ignored: true });

    let confirmed = data;
    if (paypack.isConfigured()) {
      try {
        const live = await paypack.findTransaction(ref);
        confirmed = live?.data || live || data;
      } catch (e) {
        console.error('[Payments] Could not confirm transaction with PayPack:', e.message);
        return res.status(502).json({ message: 'Could not confirm the transaction. Please retry.' }); // PayPack will retry
      }
    } else if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ message: 'Payment gateway is not configured.' });
    }

    const result = await settlePayment(ref, confirmed, raw.toString('utf8'), {
      source: 'webhook',
      clientIp: req.clientIp,
    });

    if (result.unmatched) return res.json({ received: true, unmatched: true });
    if (result.duplicate) return res.json({ received: true, duplicate: true });
    if (result.rejected) return res.json({ received: true, rejected: true });
    if (result.pending) return res.json({ received: true, pending: true });
    if (result.ignored) return res.json({ received: true, ignored: true });

    res.json({ received: true });
  } catch (err) {
    console.error('PayPack webhook error:', err.message);
    res.status(500).json({ message: 'Webhook processing failed.' });
  }
});

module.exports = router;
