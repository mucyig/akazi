// Checks your PayPack credentials from server/.env (nothing is hard-coded): npm --prefix server run check-paypack
require('../lib/env');
const paypack = require('../lib/paypack');
(async () => {
  if (!paypack.isConfigured()) { console.error('PAYPACK_CLIENT_ID / PAYPACK_CLIENT_SECRET are not set in server/.env'); process.exit(1); }
  await paypack.getAccessToken(true);
  console.log('PayPack credentials work (access token received).');
})().catch((e) => { console.error('PayPack check FAILED:', e.message); process.exit(1); });
