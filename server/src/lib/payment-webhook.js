function normalizePaypackStatus(data = {}) {
  const rawStatus = data?.status || data?.data?.status;
  const status = typeof rawStatus === 'string' ? rawStatus.toLowerCase().trim() : '';

  if (status === 'successful' || status === 'success' || status === 'paid' || status === 'completed') {
    return {
      status: 'paid',
      providerStatus: data?.status || status,
    };
  }

  if (status === 'failed' || status === 'cancelled' || status === 'declined' || status === 'expired') {
    return {
      status: 'failed',
      providerStatus: data?.status || status,
    };
  }

  return {
    status: 'pending',
    providerStatus: data?.status || 'pending',
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
