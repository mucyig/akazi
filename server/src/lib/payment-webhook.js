function normalizePaypackStatus(data = {}) {
  const status = data?.status;

  if (status === 'successful') {
    return {
      status: 'paid',
      providerStatus: status,
    };
  }

  if (status === 'failed') {
    return {
      status: 'failed',
      providerStatus: status,
    };
  }

  return {
    status: 'pending',
    providerStatus: status || 'pending',
  };
}

function buildWebhookUpdatePayload(data = {}, rawBody) {
  const provider = data?.provider || null;
  const normalized = normalizePaypackStatus(data);
  const rawPayload = typeof rawBody === 'string'
    ? rawBody
    : (rawBody ? JSON.stringify(rawBody, null, 2) : JSON.stringify(data || {}, null, 2));

  return {
    status: normalized.status,
    provider,
    providerStatus: normalized.providerStatus,
    rawPayload,
  };
}

module.exports = {
  normalizePaypackStatus,
  buildWebhookUpdatePayload,
};
