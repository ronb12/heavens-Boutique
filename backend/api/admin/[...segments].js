import { handleCors, json } from '../../lib/http.js';
import handleUpload from '../../lib/admin/routes/upload.js';
import handleReports from '../../lib/admin/routes/reports.js';
import handleOrdersPost from '../../lib/admin/routes/ordersPost.js';
import handleCustomersIndex from '../../lib/admin/routes/customersIndex.js';
import handleCustomersById from '../../lib/admin/routes/customersById.js';

function normalizeSegments(query) {
  const raw = query?.segments;
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    return raw.includes('/') ? raw.split('/').filter(Boolean) : [raw];
  }
  return [String(raw)];
}

export default async function handler(req, res) {
  const segments = normalizeSegments(req.query || {});
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
