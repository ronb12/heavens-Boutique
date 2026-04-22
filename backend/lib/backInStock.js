import { sendPushToToken } from './fcm.js';
import { sendBackInStockEmail } from './emailTemplates.js';

/**
 * Notify subscribers for variants that just restocked (0 -> >0) and clear subscriptions.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {{ variantId: string, productId: string, productName: string, size: string }} v
 */
export async function notifyBackInStock(sql, v) {
  const variantId = String(v.variantId || '').trim();
  if (!variantId) return;

  const subs = await sql`
    SELECT s.user_id, u.email, u.fcm_token
    FROM back_in_stock_subscriptions s
    JOIN users u ON u.id = s.user_id
    WHERE s.variant_id = ${variantId}
  `;
  if (!subs.length) return;

  const title = 'Back in stock';
  const body = `${v.productName}${v.size ? ` · ${v.size}` : ''} is available again.`;

  for (const s of subs) {
    try {
      await sql`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          ${s.user_id},
          'back_in_stock',
          ${title},
          ${body},
          ${JSON.stringify({ productId: v.productId, variantId, type: 'back_in_stock' })}::jsonb
        )
      `;
    } catch (e) {
      console.error('back_in_stock insert notification', e);
    }

    const tok = s.fcm_token?.trim();
    if (tok) {
      try {
        await sendPushToToken({
          token: tok,
          title,
          body: body.slice(0, 240),
          data: { type: 'back_in_stock', productId: v.productId, variantId },
        });
      } catch (e) {
        console.error('back_in_stock push', e);
      }
    }

    const email = s.email?.trim();
    if (email) {
      try {
        await sendBackInStockEmail({
          to: email,
          productName: v.productName,
          variantSize: v.size,
          productUrl: null,
        });
      } catch (e) {
        console.error('back_in_stock email', e);
      }
    }
  }

  try {
    await sql`DELETE FROM back_in_stock_subscriptions WHERE variant_id = ${variantId}`;
  } catch (e) {
    console.error('back_in_stock clear subs', e);
  }
}

