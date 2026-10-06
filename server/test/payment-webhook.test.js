const test = require('node:test');
const assert = require('node:assert/strict');

const { normalizePaypackStatus, buildWebhookUpdatePayload } = require('../src/lib/payment-webhook');

test('successful paypack event maps to paid status', () => {
  const result = normalizePaypackStatus({ status: 'successful', provider: 'mtn' });

  assert.equal(result.status, 'paid');
  assert.equal(result.providerStatus, 'successful');
});

test('failed paypack event preserves its raw provider payload', () => {
  const data = {
    status: 'failed',
    provider: 'mtn',
    provider_error: 'Insufficient funds',
  };

  const payload = buildWebhookUpdatePayload(data, JSON.stringify(data));

  assert.equal(payload.status, 'failed');
  assert.equal(payload.provider, 'mtn');
  assert.equal(payload.providerStatus, 'failed');
  assert.match(payload.rawPayload, /Insufficient funds/);
});

test('unknown paypack status remains pending', () => {
  const result = normalizePaypackStatus({ status: 'processing', provider: 'airtel' });

  assert.equal(result.status, 'pending');
  assert.equal(result.providerStatus, 'processing');
});
