/**
 * Minimal path router for Cloudflare Workers.
 * Supports :param segments. All paths are matched after stripping the /api/ prefix.
 */
export class Router {
  constructor() {
    // Each entry: { method, segments, handler }
    this._routes = [];
  }

  _add(method, path, handler) {
    // Normalise: strip leading slash, split into segments
    const clean = path.replace(/^\/+/, '').replace(/\/+$/, '');
    const segments = clean ? clean.split('/') : [];
    this._routes.push({ method: method.toUpperCase(), segments, handler });
  }

  get(path, handler) { this._add('GET', path, handler); return this; }
  post(path, handler) { this._add('POST', path, handler); return this; }
  put(path, handler) { this._add('PUT', path, handler); return this; }
  patch(path, handler) { this._add('PATCH', path, handler); return this; }
  delete(path, handler) { this._add('DELETE', path, handler); return this; }

  /**
   * Match a request pathname (already stripped of /api/ prefix) against registered routes.
   * Returns { handler, params } or null.
   */
  _match(method, pathname) {
    const clean = pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    const incoming = clean ? clean.split('/') : [];

    for (const route of this._routes) {
      if (route.method !== method) continue;
      if (route.segments.length !== incoming.length) continue;

      const params = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(':')) {
          params[seg.slice(1)] = decodeURIComponent(incoming[i]);
        } else if (seg !== incoming[i]) {
          matched = false;
          break;
        }
      }
      if (matched) return { handler: route.handler, params };
    }
    return null;
  }

  /**
   * Handle an incoming request.
   * @param {Request} request
   * @param {object} env
   * @param {object} ctx
   * @returns {Promise<Response>}
   */
  async handle(request, env, ctx) {
    const url = new URL(request.url);

    // Strip /api/ prefix
    let pathname = url.pathname;
    if (pathname.startsWith('/api/')) {
      pathname = pathname.slice(4); // leaves leading slash: /foo/bar
    } else if (pathname === '/api') {
      pathname = '/';
    }

    const match = this._match(request.method, pathname);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Not found', path: pathname }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return match.handler(request, env, ctx, match.params);
  }
}
