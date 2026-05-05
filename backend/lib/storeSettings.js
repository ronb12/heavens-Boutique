/**
 * Store-wide feature flags from `store_settings` (migration 025).
 * Env `GIFT_CARDS_PURCHASE_DISABLED=true` forces purchase off without DB (emergency).
 */

export async function isGiftCardPurchaseEnabled(sql) {
  if (String(process.env.GIFT_CARDS_PURCHASE_DISABLED || '').toLowerCase() === 'true') {
    return false;
  }
  try {
    const rows = await sql`
      SELECT gift_cards_purchase_enabled FROM store_settings WHERE id = 1 LIMIT 1
    `;
    if (!rows[0]) return true;
    return rows[0].gift_cards_purchase_enabled !== false;
  } catch (e) {
    if (e?.code === '42P01') return true;
    console.error('store_settings read', e);
    return true;
  }
}
