import { json, handleCors } from '../lib/http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  return json(res, 200, {
    ok: true,
    name: "Heaven's Boutique API",
    docs: 'See /api/products, /api/admin/upload, /api/admin/reports, /api/admin/customers (GET/POST), /api/admin/orders (POST manual order), /api/auth/login, /api/auth/apple, etc.',
  });
}
