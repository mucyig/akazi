function normalizePaypackStatus(data = {}) {
  const providerStatus = data?.status;
  const status = typeof providerStatus === 'string' ? providerStatus.toLowerCase() : '';

  if (status === 'successful' || status === 'success') {
    return {
      status: 'paid',
      providerStatus,
    };
  }

  if (status === 'failed') {
    return {
      status: 'failed',
      providerStatus,
    };
  }

  return {
    status: 'pending',
    providerStatus: providerStatus || 'pending',
  };
}

function resolvePaypackStatus(currentStatus, incomingStatus) {
  if (currentStatus === 'paid' || incomingStatus === 'paid') return 'paid';
  if (currentStatus === 'failed' || incomingStatus === 'failed') return 'failed';
  return 'pending';
}

function isProcessedPaypackEvent(event) {
  return event?.kind === 'transaction:processed';
}

function buildWebhookUpdatePayload(data = {}, rawBody) {
  const provider = data?.provider || null;
  const normalized = normalizePaypackStatus(data);
  const rawPayload = Buffer.isBuffer(rawBody)
    ? rawBody.toString('utf8')
    : (typeof rawBody === 'string'
      ? rawBody
      : JSON.stringify(rawBody || data || {}, null, 2));

  return {
    status: normalized.status,
    provider,
    providerStatus: normalized.providerStatus,
    rawPayload,
  };
}

module.exports = {
  normalizePaypackStatus,
  resolvePaypackStatus,
  isProcessedPaypackEvent,
  buildWebhookUpdatePayload,
};
