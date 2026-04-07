#!/usr/bin/env node
/**
 * Removes QA sample catalog, orders, and related rows created by `seed-sample.mjs`.
 * Does not delete admin or other real user accounts. Safe to run before going live.
 *
 *   DATABASE_URL="postgresql://..." node scripts/clear-sample-data.mjs
 *
 * Env (optional, must match seed-sample if you overrode them):
 *   SAMPLE_CUSTOMER_EMAIL — default customer@sample.heavensboutique.app
 *
 * Uses DATABASE_URL, or DATABASE_URL_UNPOOLED if DATABASE_URL is empty (Vercel/Neon pulls).
 */
import { neon } from '@neondatabase/serverless';

const SAMPLE_CUSTOMER_EMAIL = (
  process.env.SAMPLE_CUSTOMER_EMAIL || 'customer@sample.heavensboutique.app'
).trim().toLowerCase();

const dbUrl = (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || '').trim();
if (!dbUrl) {
  console.error('Missing DATABASE_URL or DATABASE_URL_UNPOOLED');
  process.exit(1);
}

const sql = neon(dbUrl);

/** Same fixed UUIDs as scripts/seed-sample.mjs */
const I = {
  customer: 'cafe1000-0001-4001-8001-000000000001',
  promoWelcome: 'cafe2000-0002-4002-8002-000000000002',
  promoShip: 'cafe2000-0003-4003-8003-000000000003',
  pDress: 'cafe3000-0001-4001-8001-000000000011',
  pCoat: 'cafe3000-0002-4002-8002-000000000012',
  pEarrings: 'cafe3000-0003-4003-8003-000000000013',
  pCami: 'cafe3000-0004-4004-8004-000000000014',
  pTrousers: 'cafe3000-0005-4005-8005-000000000015',
  pBlazer: 'cafe3000-0006-4006-8006-000000000016',
  vDressS: 'cafe4000-0001-4001-8001-000000000021',
  vDressM: 'cafe4000-0002-4002-8002-000000000022',
  vDressL: 'cafe4000-0003-4003-8003-000000000023',
  vCoatS: 'cafe4000-0004-4004-8004-000000000024',
  vCoatM: 'cafe4000-0005-4005-8005-000000000025',
  vCoatL: 'cafe4000-0006-4006-8006-000000000026',
  vEar1: 'cafe4000-0007-4007-8007-000000000027',
  vCamiS: 'cafe4000-0008-4008-8008-000000000028',
  vCamiM: 'cafe4000-0009-4009-8009-000000000029',
  vCamiL: 'cafe4000-000a-400a-800a-00000000002a',
  vTrouS: 'cafe4000-000b-400b-800b-00000000002b',
  vTrouM: 'cafe4000-000c-400c-800c-00000000002c',
  vTrouL: 'cafe4000-000d-400d-800d-00000000002d',
  vBlazerS: 'cafe4000-000e-400e-800e-00000000002e',
  vBlazerM: 'cafe4000-000f-400f-800f-00000000002f',
  vBlazerL: 'cafe4000-0010-4010-8010-000000000030',
  orderPaid: 'cafe5000-0001-4001-8001-000000000041',
  orderShipped: 'cafe5000-0002-4002-8002-000000000042',
  orderPending: 'cafe5000-0003-4003-8003-000000000043',
  conv: 'cafe6000-0001-4001-8001-000000000051',
  addr: 'cafe7000-0001-4001-8001-000000000061',
  cartUser: 'cafe8000-0001-4001-8001-000000000071',
  cartGuest: 'cafe8000-0002-4002-8002-000000000072',
  n1: 'cafe9000-0001-4001-8001-000000000081',
  n2: 'cafe9000-0002-4002-8002-000000000082',
  n3: 'cafe9000-0003-4003-8003-000000000083',
  n4: 'cafe9000-0004-4004-8004-000000000084',
  n5: 'cafe9000-0005-4005-8005-000000000085',
  loy1: 'cafe9000-0011-4011-8011-000000000091',
  loy2: 'cafe9000-0012-4012-8012-000000000092',
};

async function main() {
  console.log('Removing sample data (seed IDs from seed-sample.mjs)…');

  await sql`DELETE FROM notifications WHERE id IN (${I.n1}, ${I.n2}, ${I.n3}, ${I.n4}, ${I.n5})`;
  await sql`DELETE FROM messages WHERE conversation_id = ${I.conv}`;
  await sql`DELETE FROM conversations WHERE id = ${I.conv}`;

  await sql`
    DELETE FROM loyalty_ledger
    WHERE id IN (${I.loy1}, ${I.loy2})
       OR order_id IN (${I.orderPaid}, ${I.orderShipped}, ${I.orderPending})
  `;

  await sql`
    DELETE FROM order_items
    WHERE order_id IN (${I.orderPaid}, ${I.orderShipped}, ${I.orderPending})
       OR product_id IN (${I.pDress}, ${I.pCoat}, ${I.pEarrings}, ${I.pCami}, ${I.pTrousers}, ${I.pBlazer})
       OR variant_id IN (${I.vDressS}, ${I.vDressM}, ${I.vDressL}, ${I.vCoatS}, ${I.vCoatM}, ${I.vCoatL}, ${I.vEar1}, ${I.vCamiS}, ${I.vCamiM}, ${I.vCamiL}, ${I.vTrouS}, ${I.vTrouM}, ${I.vTrouL}, ${I.vBlazerS}, ${I.vBlazerM}, ${I.vBlazerL})
  `;

  await sql`
    DELETE FROM orders o
    WHERE o.id IN (${I.orderPaid}, ${I.orderShipped}, ${I.orderPending})
       OR NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  `;

  await sql`DELETE FROM carts WHERE id IN (${I.cartUser}, ${I.cartGuest})`;

  await sql`DELETE FROM user_addresses WHERE id = ${I.addr}`;

  await sql`
    DELETE FROM wishlist
    WHERE product_id IN (${I.pDress}, ${I.pCoat}, ${I.pEarrings}, ${I.pCami}, ${I.pTrousers}, ${I.pBlazer})
  `;

  await sql`
    DELETE FROM product_variants
    WHERE id IN (${I.vDressS}, ${I.vDressM}, ${I.vDressL}, ${I.vCoatS}, ${I.vCoatM}, ${I.vCoatL}, ${I.vEar1}, ${I.vCamiS}, ${I.vCamiM}, ${I.vCamiL}, ${I.vTrouS}, ${I.vTrouM}, ${I.vTrouL}, ${I.vBlazerS}, ${I.vBlazerM}, ${I.vBlazerL})
  `;

  await sql`
    DELETE FROM products
    WHERE id IN (${I.pDress}, ${I.pCoat}, ${I.pEarrings}, ${I.pCami}, ${I.pTrousers}, ${I.pBlazer})
  `;

  await sql`
    DELETE FROM promo_codes
    WHERE id IN (${I.promoWelcome}, ${I.promoShip})
      AND NOT EXISTS (SELECT 1 FROM orders WHERE promo_code_id IN (${I.promoWelcome}, ${I.promoShip}))
  `;

  const sampleUsers = await sql`
    SELECT id FROM users WHERE lower(trim(email)) = ${SAMPLE_CUSTOMER_EMAIL} LIMIT 1
  `;
  const sampleId = sampleUsers[0]?.id;
  if (sampleId) {
    await sql`
      UPDATE users
      SET loyalty_points = 0,
          tags = '{}',
          updated_at = now()
      WHERE id = ${sampleId}
    `;
  }

  const pCount = await sql`
    SELECT count(*)::int AS c FROM products WHERE id IN (${I.pDress}, ${I.pCoat}, ${I.pEarrings}, ${I.pCami}, ${I.pTrousers}, ${I.pBlazer})
  `;
  const oCount = await sql`
    SELECT count(*)::int AS c FROM orders WHERE id IN (${I.orderPaid}, ${I.orderShipped}, ${I.orderPending})
  `;

  console.log('Done. Remaining seed product rows:', pCount[0].c, '| Remaining seed order rows:', oCount[0].c);
  console.log('You can add live products from the iOS admin catalog.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
