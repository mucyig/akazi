export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy /api/* and /uploads/* to the Render backend API
    if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) {
      const backendUrl = new URL(url.pathname + url.search, 'https://akazi-api.onrender.com');

      const headers = new Headers(request.headers);
      headers.set('host', 'akazi-api.onrender.com');
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

      const init = {
        method: request.method,
        headers,
        redirect: 'follow',
      };

      if (!['GET', 'HEAD'].includes(request.method) && request.body) {
        init.body = request.body;
        init.duplex = 'half';
      }

      return fetch(backendUrl, init);
    }

    // Static assets fallback with SPA (Single Page Application) routing
    const assetResponse = await env.ASSETS.fetch(request);
    if (assetResponse.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      const indexUrl = new URL('/index.html', request.url);
      return env.ASSETS.fetch(indexUrl);
    }
    return assetResponse;
  },
};
