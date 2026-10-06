const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizePaypackStatus,
  resolvePaypackStatus,
  isProcessedPaypackEvent,
  buildWebhookUpdatePayload,
} = require('../src/lib/payment-webhook');

test('successful paypack event maps to paid status', () => {
  const result = normalizePaypackStatus({ status: 'successful', provider: 'mtn' });

  assert.equal(result.status, 'paid');
  assert.equal(result.providerStatus, 'successful');
});

test('documented success status alias maps to paid status', () => {
  const result = normalizePaypackStatus({ status: 'success' });

  assert.equal(result.status, 'paid');
  assert.equal(result.providerStatus, 'success');
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

test('late failed or pending events do not downgrade a paid payment', () => {
  assert.equal(resolvePaypackStatus('paid', 'failed'), 'paid');
  assert.equal(resolvePaypackStatus('paid', 'pending'), 'paid');
});

test('a successful event can upgrade a previously failed payment', () => {
  assert.equal(resolvePaypackStatus('failed', 'paid'), 'paid');
});

test('pending events do not erase a previously failed status', () => {
  assert.equal(resolvePaypackStatus('failed', 'pending'), 'failed');
});

test('only documented processed events are applied', () => {
  assert.equal(isProcessedPaypackEvent({ kind: 'transaction:processed' }), true);
  assert.equal(isProcessedPaypackEvent({ kind: 'transaction:created' }), false);
  assert.equal(isProcessedPaypackEvent({}), false);
});
