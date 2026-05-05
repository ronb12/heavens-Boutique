import { getDb } from '../../db.js';
import { requireStoreAccess, PERM } from '../../auth.js';
import { json, readJson, handleCors } from '../../http.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccess(req, PERM.CUSTOMERS);
  if (admin.error) return json(res, admin.status, { error: admin.error });

  const userId = req.query?.id;
  if (!userId) return json(res, 400, { error: 'Missing id' });

  const sql = getDb();

  try {
    if (req.method === 'GET') {
      const users = await sql`
        SELECT
          id,
          email,
          full_name,
          phone,
          role,
          loyalty_points,
          tags,
          created_at,
          updated_at,
          (fcm_token IS NOT NULL AND length(trim(fcm_token)) > 0) AS push_enabled
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;
      const u = users[0];
      if (!u) return json(res, 404, { error: 'Not found' });

      const addresses = await sql`
        SELECT id, label, line1, line2, city, state, postal, country, is_default, created_at
        FROM user_addresses
        WHERE user_id = ${userId}
        ORDER BY is_default DESC, created_at ASC
      `;

      const recentOrders = await sql`
        SELECT id, status, total_cents, created_at, stripe_payment_intent_id
        FROM orders
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT 30
      `;

      return json(res, 200, {
        user: {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          phone: u.phone,
          role: u.role,
          loyaltyPoints: u.loyalty_points,
          tags: u.tags || [],
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          pushEnabled: Boolean(u.push_enabled),
        },
        addresses: addresses.map((a) => ({
          id: a.id,
          label: a.label,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          postal: a.postal,
          country: a.country,
          isDefault: a.is_default,
          createdAt: a.created_at,
        })),
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          status: o.status,
          totalCents: o.total_cents,
          createdAt: o.created_at,
          stripePaymentIntentId: o.stripe_payment_intent_id,
        })),
      });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (Array.isArray(body.tags)) {
        await sql`UPDATE users SET tags = ${body.tags}, updated_at = now() WHERE id = ${userId}`;
      }
      const rows = await sql`
        SELECT
          id,
          email,
          full_name,
          phone,
          role,
          loyalty_points,
          tags,
          created_at,
          updated_at,
          (fcm_token IS NOT NULL AND length(trim(fcm_token)) > 0) AS push_enabled
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;
      const u = rows[0];
      if (!u) return json(res, 404, { error: 'Not found' });
      return json(res, 200, {
        user: {
          id: u.id,
          email: u.email,
          fullName: u.full_name,
          phone: u.phone,
          role: u.role,
          loyaltyPoints: u.loyalty_points,
          tags: u.tags || [],
          createdAt: u.created_at,
          updatedAt: u.updated_at,
          pushEnabled: Boolean(u.push_enabled),
        },
      });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
