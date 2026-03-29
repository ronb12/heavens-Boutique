import { handleCors, json } from '../../lib/http.js';
import handleUpload from '../../lib/admin/routes/upload.js';
import handleReports from '../../lib/admin/routes/reports.js';
import handleOrdersPost from '../../lib/admin/routes/ordersPost.js';
import handleCustomersIndex from '../../lib/admin/routes/customersIndex.js';
import handleCustomersById from '../../lib/admin/routes/customersById.js';

function normalizeSegments(query) {
  const raw = query?.segments ?? query?.slug ?? query?.path;
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    return raw.includes('/') ? raw.split('/').filter(Boolean) : [raw];
  }
  return [String(raw)];
}

function pathnameCandidates(req) {
  const out = [];
  const push = (v) => {
    if (typeof v !== 'string' || !v.trim()) return;
    const pathOnly = v.split('?')[0].trim();
    if (pathOnly) out.push(pathOnly);
  };
  push(req.url);
  push(req.headers?.['x-vercel-original-url']);
  push(req.headers?.['x-invoke-path']);
  push(req.headers?.['x-forwarded-uri']);
  return out;
}

/** Catch-all sometimes receives `req.url` relative to the route (e.g. `/upload`), not `/api/admin/upload`. */
function segmentsFromUrl(req) {
  for (let raw of pathnameCandidates(req)) {
    try {
      let pathname = raw.startsWith('http') ? new URL(raw).pathname : raw;
      pathname = decodeURIComponent(pathname);
      if (!pathname.startsWith('/')) pathname = `/${pathname}`;

      const prefix = '/api/admin/';
      if (pathname.startsWith(prefix)) {
        const rest = pathname.slice(prefix.length).replace(/\/+$/, '');
        if (rest) return rest.split('/').filter(Boolean);
        continue;
      }

      // Relative to api/admin/[...segments] mount
      const known = new Set(['upload', 'reports', 'orders', 'customers', 'promos']);
      const tail = pathname.replace(/^\/+/, '');
      if (tail) {
        const parts = tail.split('/').filter(Boolean);
        if (parts[0] && known.has(parts[0])) return parts;
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

export default async function handler(req, res) {
  const fromUrl = segmentsFromUrl(req);
  const segments = fromUrl.length > 0 ? fromUrl : normalizeSegments(req.query || {});
  const head = segments[0];

  if (!head) {
    if (handleCors(req, res)) return;
    return json(res, 404, { error: 'Not found' });
  }

  if (head === 'upload') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleUpload(req, res);
  }
  if (head === 'reports') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleReports(req, res);
  }
  if (head === 'orders') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleOrdersPost(req, res);
  }
  if (head === 'customers') {
    if (segments.length === 1) return handleCustomersIndex(req, res);
    if (segments.length === 2) {
      const prevQuery = { ...(req.query || {}) };
      req.query = { ...prevQuery, id: segments[1] };
      try {
        return await handleCustomersById(req, res);
      } finally {
        req.query = prevQuery;
      }
    }
    if (handleCors(req, res)) return;
    return json(res, 404, { error: 'Not found' });
  }

  if (handleCors(req, res)) return;
  return json(res, 404, { error: 'Not found' });
}
