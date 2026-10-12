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
  if (!process.env.CLIENT_URL || !/^https:\/\//.test(process.env.CLIENT_URL)) {
    // Default to Render URL if not explicitly provided
    process.env.CLIENT_URL = process.env.CLIENT_URL || 'https://akazi-api.onrender.com';
  }
  const hasB2 = Boolean(process.env.B2_BUCKET && (process.env.B2_KEY_ID || process.env.B2_APPLICATION_KEY_ID) && process.env.B2_APPLICATION_KEY);
  const hasR2 = Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
  if (!hasB2 && !hasR2) {
    console.warn('[Storage:warn] Cloud storage not configured (Backblaze B2 or Cloudflare R2). Uploads will be stored locally in server/uploads.');
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Mail:warn] RESEND_API_KEY not configured. Outgoing emails will be logged only.');
  }
  if (process.env.PAYPACK_CLIENT_ID && !process.env.PAYPACK_WEBHOOK_SECRET) {
    console.warn('[Payments:warn] PAYPACK_WEBHOOK_SECRET is not set. PayPack webhooks will be ignored.');
  }
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
