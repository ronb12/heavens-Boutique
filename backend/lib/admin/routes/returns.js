import { requireStoreAccess, PERM } from '../../auth.js';
import { json, readJson, handleCors } from '../../http.js';
import { getDb } from '../../db.js';
import { createReturnLabel } from '../../easypost.js';
import { sendReturnLabelEmail } from '../../emailTemplates.js';

/**
 * Handles /api/admin/returns        (GET list)
 *                /api/admin/returns/:id  (GET detail, PATCH update)
 */
export default async function handleAdminReturns(req, res, segments) {
  if (handleCors(req, res)) return;
  const auth = await requireStoreAccess(req, PERM.RETURNS);
  if (auth.error) return json(res, auth.status, { error: auth.error });

  const sql = getDb();
  const returnId = segments[1] || null;

  function fmtAdminReturn(r) {
    if (!r) return null;
    return {
      id: r.id,
      orderId: r.order_id,
      userId: r.user_id,
      reason: r.reason,
      notes: r.notes,
      status: r.status,
      items: r.items,
      easypostReturnId: r.easypost_return_id,
      returnLabelUrl: r.return_label_url,
      adminNotes: r.admin_notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  if (!returnId) {
    // List all returns
    if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
    const rows = await sql`
      SELECT r.*, o.total_cents, u.email AS user_email, o.guest_email
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN users u ON u.id = r.user_id
      ORDER BY r.created_at DESC
      LIMIT 100
    `;
    return json(res, 200, {
      returns: rows.map((r) => ({
        ...fmtAdminReturn(r),
        email: r.user_email || r.guest_email || '',
        totalCents: r.total_cents,
      })),
    });
  }

  const rows = await sql`
    SELECT r.*, o.total_cents, o.shipping_address, u.email AS user_email, o.guest_email
    FROM returns r
    JOIN orders o ON o.id = r.order_id
    LEFT JOIN users u ON u.id = r.user_id
    WHERE r.id = ${returnId}
    LIMIT 1
  `;
  const ret = rows[0];
  if (!ret) return json(res, 404, { error: 'Return not found' });

  if (req.method === 'GET') {
    return json(res, 200, {
      return: {
        ...fmtAdminReturn(ret),
        email: ret.user_email || ret.guest_email || '',
        totalCents: ret.total_cents,
        shippingAddress: ret.shipping_address || null,
      },
    });
  }

  if (req.method === 'PATCH') {
    const body = await readJson(req);
    const updates = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.adminNotes !== undefined) updates.admin_notes = body.adminNotes;

    const shouldGenerateLabel =
      body.generateLabel === true || (body.status === 'approved' && !ret.return_label_url);

    if (shouldGenerateLabel) {
      const orderRows = await sql`
        SELECT o.*, u.email AS user_email
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.id = ${ret.order_id}
        LIMIT 1
      `;
      const order = orderRows[0];
      const fromAddress = order?.shipping_address;
      if (!fromAddress) return json(res, 400, { error: 'Order has no shipping address for return label' });

      const weightRows = await sql`
        SELECT COALESCE(SUM(oi.quantity * pv.weight_oz), 8) AS total_oz
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE oi.order_id = ${ret.order_id}
      `;
      const weightOz = Number(weightRows[0]?.total_oz) || 8;

      const label = await createReturnLabel({ fromAddress, weightOz, sql });
      updates.easypost_return_id = label.shipmentId;
      updates.return_label_url = label.labelUrl;

      const toEmail = order?.guest_email || order?.user_email || '';
      if (toEmail) {
        try {
          await sendReturnLabelEmail({
            to: toEmail,
            returnId,
            orderId: ret.order_id,
            labelUrl: label.labelUrl,
            carrier: label.carrier,
            trackingCode: label.trackingCode,
          });
        } catch (emailErr) {
          console.error('return label email', emailErr);
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date();
      await sql`UPDATE returns SET ${sql(updates)} WHERE id = ${returnId}`;
    }

    const updatedRows = await sql`
      SELECT r.*, o.total_cents, o.shipping_address, u.email AS user_email, o.guest_email
      FROM returns r
      JOIN orders o ON o.id = r.order_id
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ${returnId}
      LIMIT 1
    `;
    const updated = updatedRows[0];
    return json(res, 200, {
      return: {
        ...fmtAdminReturn(updated),
        email: updated?.user_email || updated?.guest_email || '',
        totalCents: updated?.total_cents ?? null,
        shippingAddress: updated?.shipping_address || null,
      },
    });
  }

  return json(res, 405, { error: 'Method not allowed' });
}
