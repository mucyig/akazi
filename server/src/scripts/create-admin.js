// Creates (or resets) the first administrator. Usage:
//   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password1' npm run create-admin
const bcrypt = require('bcryptjs');
const { query, initDb, pool } = require('../db');
const { checkEmailAndPassword } = require('../lib/validate');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Akazi Administrator';
  const bad = checkEmailAndPassword(email, password);
  if (bad) { console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD. Problem:', bad); process.exit(1); }
  await initDb();
  const hash = await bcrypt.hash(password, 12);
  const r = await query(
    `INSERT INTO users (role, status, name, email, password_hash, terms_accepted, email_verified_at, password_changed_at)
     VALUES ('admin','approved',$1,$2,$3,true,NOW(),NOW())
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin', status = 'approved', password_changed_at = NOW(), failed_logins = 0, locked_until = NULL
     RETURNING id`, [name, email, hash]);
  console.log(`Administrator ready: ${email} (id ${r.rows[0].id})`);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
