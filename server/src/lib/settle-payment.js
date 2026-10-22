// Shared, idempotent payment settlement logic inside a single database transaction.
// Updates payments and employers atomically, handles amount checks, creates notifications,
// audits transitions, and self-heals any desynchronized employer status.
const { withTransaction } = require('../db');
const { buildWebhookUpdatePayload } = require('./payment-webhook');

const EMPLOYER_FEE = parseInt(process.env.PAYPACK_EMPLOYER_FEE_RWF || '5000', 10);

async function settlePayment(ref, confirmedData, rawText, { source = 'webhook', clientIp = null, actorId = null } = {}) {
  return await withTransaction(async (q) => {
    // 1. Lock payment row to prevent race conditions
    const pRes = await q('SELECT * FROM payments WHERE ref = $1 FOR UPDATE', [ref]);
    if (!pRes.rows.length) {
      return { unmatched: true };
    }
    const payment = pRes.rows[0];

    // What the provider says now (the caller passes provider-confirmed data)
    const info = buildWebhookUpdatePayload(confirmedData, rawText);

    // A payment we gave up on (expired/failed) can still be paid later by the customer. Money received must
    // activate the account, so a provider-confirmed "paid" re-opens a failed payment. A paid payment is never downgraded.
    const lateSuccess = payment.status === 'failed' && info.status === 'paid';

    // 2. If already processed, ensure employer status is synchronized (self-healing)
    if (payment.status !== 'pending' && !lateSuccess) {
      let repaired = false;
      if (payment.status === 'paid') {
        const empRes = await q('SELECT id, payment_status FROM employers WHERE id = $1 FOR UPDATE', [payment.employer_id]);
        const employer = empRes.rows[0];
        if (employer && employer.payment_status !== 'paid') {
          await q("UPDATE employers SET payment_status = 'paid' WHERE id = $1", [payment.employer_id]);
          await q(
            'INSERT INTO audit_log (actor_id, action, target_type, target_id, meta, ip) VALUES ($1,$2,$3,$4,$5,$6)',
            [actorId, 'payment.repaired', 'employer', String(payment.employer_id), JSON.stringify({ ref, previous_status: employer.payment_status, source }), clientIp]
          );
          repaired = true;
        }
      } else if (payment.status === 'failed') {
        const empRes = await q('SELECT id, payment_status FROM employers WHERE id = $1 FOR UPDATE', [payment.employer_id]);
        const employer = empRes.rows[0];
        if (employer && employer.payment_status !== 'paid' && employer.payment_status !== 'failed') {
          await q("UPDATE employers SET payment_status = 'failed' WHERE id = $1 AND payment_status <> 'paid'", [payment.employer_id]);
        }
      }
      return { duplicate: true, status: payment.status, repaired };
    }

    // 4. Validate payment amount: it must be present AND equal to what we asked for
    if (info.status === 'paid' && (confirmedData?.amount === undefined || confirmedData?.amount === null || Number(confirmedData.amount) !== Number(payment.amount))) {
      console.error(`[Payments] Amount mismatch for ${ref}: expected ${payment.amount}, got ${confirmedData?.amount}`);
      await q(
        'INSERT INTO audit_log (actor_id, action, target_type, target_id, meta, ip) VALUES ($1,$2,$3,$4,$5,$6)',
        [actorId, 'payment.amount_mismatch', 'payment', ref, JSON.stringify({ expected: payment.amount, got: confirmedData?.amount ?? null, source }), clientIp]
      );
      return { rejected: true, reason: 'amount_mismatch' };
    }

    // 5. Still pending from provider
    if (info.status === 'pending') {
      return { pending: true, status: 'pending' };
    }

    // 6. Final state: paid
    if (info.status === 'paid') {
      await q(
        `UPDATE payments SET status = 'paid', provider = $1, provider_status = $2, raw_payload = $3, updated_at = NOW()
         WHERE id = $4`,
        [info.provider, info.providerStatus, info.rawPayload, payment.id]
      );
      await q("UPDATE employers SET payment_status = 'paid' WHERE id = $1", [payment.employer_id]);

      const feeFormatted = Number(payment.amount || EMPLOYER_FEE).toLocaleString('en-US');
      await q(
        'INSERT INTO notifications (user_id, title, message, type, link) VALUES ($1,$2,$3,$4,$5)',
        [
          payment.user_id,
          'Payment received - your account is active!',
          `Your ${feeFormatted} RWF verification payment was received. You can now post jobs and hire on Akazi.`,
          'payment',
          '/employer/dashboard',
        ]
      );

      await q(
        'INSERT INTO audit_log (actor_id, action, target_type, target_id, meta, ip) VALUES ($1,$2,$3,$4,$5,$6)',
        [actorId, 'payment.paid', 'payment', ref, JSON.stringify({ employer_id: payment.employer_id, source, late: lateSuccess }), clientIp]
      );

      return { settled: true, status: 'paid', payment: { ...payment, status: 'paid' } };
    }

    // 7. Final state: failed
    if (info.status === 'failed') {
      await q(
        `UPDATE payments SET status = 'failed', provider = $1, provider_status = $2, raw_payload = $3, updated_at = NOW()
         WHERE id = $4`,
        [info.provider, info.providerStatus, info.rawPayload, payment.id]
      );
      await q("UPDATE employers SET payment_status = 'failed' WHERE id = $1 AND payment_status <> 'paid'", [payment.employer_id]);

      await q(
        'INSERT INTO audit_log (actor_id, action, target_type, target_id, meta, ip) VALUES ($1,$2,$3,$4,$5,$6)',
        [actorId, 'payment.failed', 'payment', ref, JSON.stringify({ employer_id: payment.employer_id, source }), clientIp]
      );

      return { settled: true, status: 'failed', payment: { ...payment, status: 'failed' } };
    }

    return { received: true, ignored: true };
  });
}

module.exports = {
  settlePayment,
};
