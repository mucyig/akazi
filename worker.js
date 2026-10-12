export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy /api/* to the Render backend API. (Files are no longer served from here:
    if (url.pathname.startsWith('/api')) {
      const backendTarget = env.BACKEND_URL || 'https://akazi-api.onrender.com';
      const backendUrl = new URL(url.pathname + url.search, backendTarget);

      const headers = new Headers(request.headers);
      headers.set('host', new URL(backendTarget).host);
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

      // Tell the API the visitor's real address, proven by a shared secret (so nobody can fake it by
      // calling the API directly). Anything a visitor sends under these names is thrown away first.
      headers.delete('x-proxy-secret');
      headers.delete('x-real-client-ip');
      if (env.PROXY_SECRET) {
        headers.set('x-proxy-secret', env.PROXY_SECRET);
        headers.set('x-real-client-ip', request.headers.get('cf-connecting-ip') || '');
      }

      const init = { method: request.method, headers, redirect: 'manual' };

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
