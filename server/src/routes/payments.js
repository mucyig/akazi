const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query } = require('../db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const paypack = require('../lib/paypack');

// Employer verification fee (RWF) - employer must pay this AFTER admin approval.
const EMPLOYER_FEE = parseInt(process.env.PAYPACK_EMPLOYER_FEE_RWF || '5000', 10);

// Normalize a Rwandan mobile money number to local 07XXXXXXXX format.
function normalizeRwPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local = '';
  if (/^2507\d{8}$/.test(digits)) local = '0' + digits.slice(3); // 250788... -> 0788...
  else if (/^07\d{8}$/.test(digits)) local = digits;             // 0788...
  else if (/^7\d{8}$/.test(digits)) local = '0' + digits;        // 788...  -> 0788...
  // Rwandan mobile prefixes: MTN (078/079), Airtel (072/073)
  return /^07[2389]\d{7}$/.test(local) ? local : null;
}

// 1. POST /api/payments/paypack/initiate - Start the 5,000 RWF verification payment
router.post('/paypack/initiate', authenticateToken, requireRole('employer'), async (req, res) => {
  try {
    // Payment is only unlocked AFTER an administrator has approved the business.
    if (req.user.status !== 'approved') {
      return res.status(403).json({
        message: 'Your business must be verified by an administrator before you can pay.',
        code: 'EMPLOYER_NOT_APPROVED'
      });
    }

    if (!paypack.isConfigured()) {
      return res.status(503).json({ message: 'Mobile money payments are not configured yet. Please try again later.' });
    }

    const empRes = await query('SELECT * FROM employers WHERE user_id = $1', [req.user.id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ message: 'Employer profile not found.' });
    }
    const employer = empRes.rows[0];

    if (employer.payment_status === 'paid') {
      return res.json({ alreadyPaid: true, status: 'paid', amount: EMPLOYER_FEE });
    }

    const phone = normalizeRwPhone(req.body?.phone || req.user.phone);
    if (!phone) {
      return res.status(400).json({ message: 'Enter a valid Rwandan mobile money number (e.g. 078 123 4567).' });
    }

    const idempotencyKey = crypto.randomBytes(16).toString('hex');

    // Ask PayPack to trigger the mobile money prompt
    let payload;
    try {
      payload = await paypack.cashin({ amount: EMPLOYER_FEE, number: phone, idempotencyKey });
    } catch (e) {
      await query('UPDATE employers SET payment_status = $1 WHERE id = $2', ['failed', employer.id]);
      return res.status(502).json({ message: e.message || 'Payment could not be started. Please try again.', status: 'failed' });
    }

    const ref = payload?.ref || null;

    // Track the transaction locally so the webhook and UI can follow it
    await query(
      `INSERT INTO payments (employer_id, user_id, ref, amount, phone, kind, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [employer.id, req.user.id, ref, EMPLOYER_FEE, phone, 'CASHIN', 'pending']
    );
    await query('UPDATE employers SET payment_status = $1 WHERE id = $2', ['pending', employer.id]);

    res.status(201).json({
      message: 'Payment request sent. Approve the prompt on your phone.',
      ref,
      amount: EMPLOYER_FEE,
      phone,
      status: payload?.status || 'pending'
    });
  } catch (err) {
    console.error('PayPack initiate error:', err);
    res.status(500).json({ message: 'Failed to start the payment.', error: err.message });
  }
});

// 2. GET /api/payments/paypack/latest - Most recent payment for the signed-in employer
router.get('/paypack/latest', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    const payment = result.rows[0] || null;
    res.json({
      payment: payment
        ? { ref: payment.ref, amount: payment.amount, status: payment.status, phone: payment.phone, created_at: payment.created_at }
        : null
    });
  } catch (err) {
    console.error('PayPack latest error:', err);
    res.status(500).json({ message: 'Failed to load the latest payment.' });
  }
});

// 3. GET /api/payments/paypack/status/:ref - Poll a specific transaction
router.get('/paypack/status/:ref', authenticateToken, async (req, res) => {
  try {
    const result = await query('SELECT * FROM payments WHERE ref = $1', [req.params.ref]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Payment not found.' });
    }
    const payment = result.rows[0];
    if (req.user.role !== 'admin' && payment.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    res.json({
      payment: { ref: payment.ref, amount: payment.amount, status: payment.status, phone: payment.phone }
    });
  } catch (err) {
    console.error('PayPack status error:', err);
    res.status(500).json({ message: 'Failed to check the payment status.' });
  }
});

// 4. POST /api/payments/paypack/webhook - PayPack calls this when a transaction is processed.
//    Public endpoint: authenticity is enforced with the signature header, not a JWT.
router.post('/paypack/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-paypack-signature'];
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');

    if (process.env.PAYPACK_WEBHOOK_SECRET && !paypack.verifyWebhookSignature(raw, signature)) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    const event = req.body || {};
    const data = event.data || {};

    // We only act on processed transactions
    if (event.kind && event.kind !== 'transaction:processed') {
      return res.json({ received: true, ignored: true });
    }

    const ref = data.ref;
    if (!ref) {
      return res.json({ received: true, ignored: true });
    }

    const result = await query('SELECT * FROM payments WHERE ref = $1', [ref]);
    const payment = result.rows[0];
    if (!payment) {
      return res.json({ received: true, unmatched: true });
    }

    const success = data.status === 'successful';
    const newStatus = success ? 'paid' : (data.status === 'failed' ? 'failed' : 'pending');

    await query('UPDATE payments SET status = $1, provider = $2 WHERE ref = $3', [
      newStatus,
      data.provider || null,
      ref
    ]);

    if (newStatus === 'paid') {
      await query('UPDATE employers SET payment_status = $1 WHERE id = $2', ['paid', payment.employer_id]);
      await query(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1, $2, $3, $4, $5)',
        [
          payment.user_id,
          'Payment received - your account is active!',
          `Your ${EMPLOYER_FEE.toLocaleString('en-US')} RWF verification payment was received. You can now post jobs and hire on Akazi.`,
          'payment',
          '/employer/dashboard'
        ]
      );
    } else if (newStatus === 'failed') {
      await query('UPDATE employers SET payment_status = $1 WHERE id = $2', ['failed', payment.employer_id]);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('PayPack webhook error:', err);
    res.status(500).json({ message: 'Webhook processing failed.' });
  }
});

module.exports = router;
