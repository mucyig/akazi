// Standalone runner for payment reconciliation. Usable via cron or one-off tasks.
// Usage: node server/src/scripts/reconcile-payments.js
const { pool, initDb } = require('../db');
const { reconcilePayments } = require('../lib/reconcile-payments');

(async () => {
  await initDb();
  console.log('[Reconcile] Starting payment reconciliation...');
  const summary = await reconcilePayments();
  console.log('[Reconcile] Summary:', summary);
  await pool.end();
})().catch((err) => {
  console.error('[Reconcile] Fatal error:', err.message);
  process.exit(1);
});
