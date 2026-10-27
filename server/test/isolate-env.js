// Preloaded by `npm test` (node --require). Blanks anything that could make a test touch real services,
// even when server/.env holds production keys. dotenv never overrides a variable that is already set.
for (const k of Object.keys(process.env)) {
  if (/^(B2_|R2_|STORAGE_)/.test(k)) process.env[k] = '';
}
for (const k of ['B2_BUCKET', 'B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_ENDPOINT', 'B2_REGION',
  'R2_BUCKET', 'R2_ACCOUNT_ID', 'RESEND_API_KEY']) process.env[k] = '';
