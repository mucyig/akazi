// Background reconciliation for pending payments and desynchronized employer states.
const { pool, query, withTransaction } = require('../db');
const paypack = require('./paypack');
const { settlePayment } = require('./settle-payment');
const { buildWebhookUpdatePayload } = require('./payment-webhook');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RECONCILE_LOCK_ID = 727002;
let schedulerTimer = null;

async function reconcilePayments() {
  const summary = { checked: 0, settled: 0, expired: 0, repaired: 0, errors: 0 };

  // 1. Select pending payments older than 2 minutes (up to 50, oldest first)
  let pendingRows = [];
  try {
    const res = await query(
      `SELECT * FROM payments
       WHERE status = 'pending' AND created_at < NOW() - INTERVAL '2 minutes'
       ORDER BY created_at ASC
       LIMIT 50`
    );
    pendingRows = res.rows;
  } catch (err) {
    console.error('[Reconcile] Error fetching pending payments:', err.message);
    summary.errors++;
    return summary;
  }

  // 2. Process pending payments sequentially with a small delay
  for (const p of pendingRows) {
    summary.checked++;
    try {
      if (summary.checked > 1) {
        await sleep(100);
      }

      // Check transaction with PayPack
      let live = null;
      try {
        live = await paypack.findTransaction(p.ref);
      } catch (err) {
        console.warn(`[Reconcile] Could not reach PayPack for ref ${p.ref}:`, err.message);
        summary.errors++;
        continue; // Fail safe: never mark paid or failed if PayPack cannot be reached
      }

      const confirmed = live?.data || live;
      if (!confirmed) {
        summary.errors++;
        continue;
      }

      const info = buildWebhookUpdatePayload(confirmed, JSON.stringify(confirmed));

      // If final state, settle it
      if (info.status === 'paid' || info.status === 'failed') {
        const res = await settlePayment(p.ref, confirmed, JSON.stringify(confirmed), { source: 'reconcile' });
        if (res?.settled) summary.settled++;
      } else if (info.status === 'pending') {
        // If still pending, older than 30 minutes, and not processing, mark failed
        const ageMs = Date.now() - new Date(p.created_at).getTime();
        const isOlderThan30Min = ageMs > 30 * 60 * 1000;
        const isNotProcessing = confirmed.status !== 'processing' && confirmed.provider_status !== 'processing';

        if (isOlderThan30Min && isNotProcessing) {
          await withTransaction(async (q) => {
            await q(
              `UPDATE payments SET status = 'failed', provider_status = 'expired', updated_at = NOW()
               WHERE id = $1 AND status = 'pending'`,
              [p.id]
            );
            await q(
              `UPDATE employers SET payment_status = 'failed' WHERE id = $1 AND payment_status <> 'paid'`,
              [p.employer_id]
            );
            await q(
              `INSERT INTO audit_log (action, target_type, target_id, meta)
               VALUES ('payment.expired', 'payment', $1, $2)`,
              [p.ref, JSON.stringify({ employer_id: p.employer_id, age_minutes: Math.round(ageMs / 60000), source: 'reconcile' })]
            );
          });
          summary.expired++;
        }
      }
    } catch (err) {
      console.error(`[Reconcile] Error reconciling ref ${p.ref}:`, err.message);
      summary.errors++;
    }
  }

  // 3. Repair any paid payments whose employer is not marked 'paid'
  try {
    const desynced = await query(
      `SELECT p.id AS payment_id, p.ref, p.employer_id, e.payment_status AS employer_status
       FROM payments p
       JOIN employers e ON e.id = p.employer_id
       WHERE p.status = 'paid' AND e.payment_status <> 'paid'`
    );

    for (const row of desynced.rows) {
      try {
        await withTransaction(async (q) => {
          await q("UPDATE employers SET payment_status = 'paid' WHERE id = $1", [row.employer_id]);
          await q(
            `INSERT INTO audit_log (action, target_type, target_id, meta)
             VALUES ('payment.repaired', 'employer', $1, $2)`,
            [String(row.employer_id), JSON.stringify({ ref: row.ref, previous_status: row.employer_status, source: 'reconcile' })]
          );
        });
        summary.repaired++;
      } catch (repairErr) {
        console.error(`[Reconcile] Failed to repair employer ${row.employer_id}:`, repairErr.message);
        summary.errors++;
      }
    }
  } catch (err) {
    console.error('[Reconcile] Error checking desynchronized payments:', err.message);
    summary.errors++;
  }

  return summary;
}

function startReconciliationScheduler() {
  const rawInterval = process.env.RECONCILE_PAYMENTS_INTERVAL_MIN;
  if (!rawInterval) return null;
  const minutes = parseInt(rawInterval, 10);
  if (isNaN(minutes) || minutes <= 0) return null;

  console.log(`[Reconcile] Starting in-process reconciliation scheduler (every ${minutes} min).`);
  const intervalMs = minutes * 60 * 1000;

  async function tick() {
    let client;
    try {
      client = await pool.connect();
      const lockRes = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [RECONCILE_LOCK_ID]);
      if (!lockRes.rows[0]?.locked) {
        console.log('[Reconcile] Another instance holds the advisory lock; skipping run.');
        return;
      }
      try {
        const summary = await reconcilePayments();
        console.log('[Reconcile] Scheduled run complete:', summary);
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [RECONCILE_LOCK_ID]);
      }
    } catch (err) {
      console.error('[Reconcile] Scheduled run error:', err.message);
    } finally {
      if (client) client.release();
    }
  }

  schedulerTimer = setInterval(tick, intervalMs);
  return schedulerTimer;
}

function stopReconciliationScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  reconcilePayments,
  startReconciliationScheduler,
  stopReconciliationScheduler,
  RECONCILE_LOCK_ID,
};
