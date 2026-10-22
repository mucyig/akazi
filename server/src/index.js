require('./lib/env');
const { initDb } = require('./db');
const app = require('./app');
const { startReconciliationScheduler } = require('./lib/reconcile-payments');

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Akazi API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`));
    startReconciliationScheduler();
  })
  .catch((err) => {
    // No silent fallback: a server without its real database must not pretend to work.
    const detail = err.errors ? err.errors.map(e => e.message || e.code).join('; ') : (err.message || err.code || String(err));
    console.error('[Fatal] Could not start the database:', detail);
    process.exit(1);
  });
