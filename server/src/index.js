require('./lib/env');
const { initDb } = require('./db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Akazi API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`));
  })
  .catch((err) => {
    // No silent fallback: a server without its real database must not pretend to work.
    console.error('[Fatal] Could not start the database:', err.message);
    process.exit(1);
  });
