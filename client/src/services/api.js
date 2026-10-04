// API Client Helper with Token Handling & Error Normalization

const API_BASE = '/api';

export function getAuthToken() {
  return localStorage.getItem('akazi_token');
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem('akazi_token', token);
  } else {
    localStorage.removeItem('akazi_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getAuthToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If not FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.message || response.statusText || 'An error occurred';
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body, isFormData = false) => {
    return request(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  },
  put: (endpoint, body, isFormData = false) => {
    return request(endpoint, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  },
  patch: (endpoint, body) => {
    return request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
