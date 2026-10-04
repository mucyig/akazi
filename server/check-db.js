const { Pool } = require('pg');
const url = 'postgresql://postgres:%40brian250@localhost:5432/akazi';
const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });

pool.query('SELECT 1 AS ok')
  .then((res) => {
    console.log('CONNECTED');
    console.log(res.rows[0].ok);
    return pool.end();
  })
  .catch((err) => {
    console.error('CONNECTION_FAILED');
    console.error(err.message);
    process.exit(1);
  });
