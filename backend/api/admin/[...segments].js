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

/** Vercel often omits catch-all keys on `req.query`; pathname is reliable. */
function segmentsFromUrl(req) {
  try {
    const host = req.headers?.host || 'localhost';
    const u = new URL(req.url || '/', `http://${host}`);
    const pathname = decodeURIComponent(u.pathname);
    const prefix = '/api/admin/';
    if (!pathname.startsWith(prefix)) return [];
    const rest = pathname.slice(prefix.length).replace(/\/+$/, '');
    if (!rest) return [];
    return rest.split('/').filter(Boolean);
  } catch {
    return [];
  }
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
