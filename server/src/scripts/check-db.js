// Quick connection test: npm --prefix server run check-db
const { pool } = require('../db');
pool.query('SELECT 1 AS ok')
  .then(() => { console.log('Database connection OK'); return pool.end(); })
  .catch((e) => { console.error('Database connection FAILED:', e.message); process.exit(1); });
