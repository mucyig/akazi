// Loads server/.env and refuses to start with unsafe configuration.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const isProd = process.env.NODE_ENV === 'production';
const KNOWN_BAD_SECRETS = ['akazi_super_secure', 'changeme', 'secret', 'your-secret'];
const problems = [];

const secret = process.env.JWT_SECRET || '';
if (secret.length < 32 || KNOWN_BAD_SECRETS.some((s) => secret.toLowerCase().includes(s))) {
  problems.push('JWT_SECRET must be set to a random string of at least 32 characters. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}
if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is required (PostgreSQL connection string).');

if (isProd) {
  if (!process.env.CLIENT_URL || !/^https:\/\//.test(process.env.CLIENT_URL)) problems.push('CLIENT_URL must be your public https:// address in production.');
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET']) {
    if (!process.env[k]) problems.push(`${k} is required in production (documents are stored in Cloudflare R2).`);
  }
  if (!process.env.RESEND_API_KEY) problems.push('RESEND_API_KEY is required in production (password reset emails).');
  if (process.env.PAYPACK_CLIENT_ID && !process.env.PAYPACK_WEBHOOK_SECRET) problems.push('PAYPACK_WEBHOOK_SECRET is required when PayPack is configured.');
}

if (problems.length) {
  console.error('\n[Fatal] Configuration problems:\n - ' + problems.join('\n - ') + '\n');
  process.exit(1);
}

module.exports = {
  isProd,
  JWT_SECRET: secret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '3d',
  CLIENT_URL: (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, ''),
  PROXY_SECRET: process.env.PROXY_SECRET || '',
  REQUIRE_EMAIL_VERIFICATION: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
};
