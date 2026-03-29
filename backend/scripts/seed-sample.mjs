#!/usr/bin/env node
/**
 * Full sample data for QA (shop, orders, messages, notifications, promos, cart, wishlist).
 * Does not delete any users. Only removes/replays rows tied to this script’s fixed IDs
 * (seed orders, demo carts, demo conversation, demo notifications, etc.).
 * Catalog: refreshes seed products/variants when nothing else references them; upserts promos by code.
 *
 *   DATABASE_URL="postgresql://..." node scripts/seed-sample.mjs
 *
 * Env:
 *   ADMIN_EMAIL          — must exist (default: heavenbowie0913@gmail.com). Run seed:admin first if missing.
 *   SAMPLE_CUSTOMER_EMAIL / SAMPLE_CUSTOMER_PASSWORD — optional (defaults below).
 */
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'heavenbowie0913@gmail.com').trim().toLowerCase();
const SAMPLE_CUSTOMER_EMAIL = (
  process.env.SAMPLE_CUSTOMER_EMAIL || 'customer@sample.heavensboutique.app'
).trim().toLowerCase();
const SAMPLE_CUSTOMER_PASSWORD = process.env.SAMPLE_CUSTOMER_PASSWORD || 'SamplePass123';
const SAMPLE_CUSTOMER_NAME = process.env.SAMPLE_CUSTOMER_NAME || 'Avery Sample';

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

if (SAMPLE_CUSTOMER_PASSWORD.length < 8) {
  console.error('SAMPLE_CUSTOMER_PASSWORD must be at least 8 characters');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

/** Fixed UUIDs so FK graph is stable across re-runs. */
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
  const admins = await sql`SELECT id FROM users WHERE email = ${ADMIN_EMAIL} LIMIT 1`;
  const admin = admins[0];
  if (!admin) {
    console.error(`No admin user with email ${ADMIN_EMAIL}. Run: npm run seed:admin`);
    process.exit(1);
  }
  const adminId = admin.id;

  // Align older DBs with database/migrations/002_orders_guest_checkout.sql
  console.log('Ensuring orders guest-checkout columns…');
  await sql`ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_email TEXT`;

  console.log('Removing prior seed rows (fixed IDs only — no user accounts deleted)…');
  await sql`DELETE FROM notifications WHERE id IN (${I.n1}, ${I.n2}, ${I.n3}, ${I.n4}, ${I.n5})`;
  await sql`DELETE FROM messages WHERE conversation_id = ${I.conv}`;
  await sql`DELETE FROM conversations WHERE id = ${I.conv}`;
  await sql`DELETE FROM order_items WHERE order_id IN (${I.orderPaid}, ${I.orderShipped}, ${I.orderPending})`;
  await sql`DELETE FROM orders WHERE id IN (${I.orderPaid}, ${I.orderShipped}, ${I.orderPending})`;
  await sql`DELETE FROM loyalty_ledger WHERE id IN (${I.loy1}, ${I.loy2})`;
  await sql`DELETE FROM carts WHERE id IN (${I.cartUser}, ${I.cartGuest})`;
  await sql`DELETE FROM user_addresses WHERE id = ${I.addr}`;

  await sql`
    DELETE FROM wishlist w
    WHERE w.user_id IN (SELECT id FROM users WHERE email = ${SAMPLE_CUSTOMER_EMAIL})
      AND w.product_id IN (${I.pDress}, ${I.pCoat}, ${I.pEarrings}, ${I.pCami}, ${I.pTrousers}, ${I.pBlazer})
  `;

  await sql`
    DELETE FROM product_variants v
    WHERE v.id IN (
      ${I.vDressS}, ${I.vDressM}, ${I.vDressL}, ${I.vCoatS}, ${I.vCoatM}, ${I.vCoatL}, ${I.vEar1},
      ${I.vCamiS}, ${I.vCamiM}, ${I.vCamiL}, ${I.vTrouS}, ${I.vTrouM}, ${I.vTrouL},
      ${I.vBlazerS}, ${I.vBlazerM}, ${I.vBlazerL}
    )
      AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.variant_id = v.id)
  `;
  await sql`
    DELETE FROM products p
    WHERE p.id IN (${I.pDress}, ${I.pCoat}, ${I.pEarrings}, ${I.pCami}, ${I.pTrousers}, ${I.pBlazer})
      AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id = p.id)
  `;

  const hash = await bcrypt.hash(SAMPLE_CUSTOMER_PASSWORD, 10);

  console.log('Sample customer (upsert by email — other accounts untouched)…');
  const upserted = await sql`
    INSERT INTO users (id, email, password_hash, full_name, phone, role, loyalty_points)
    VALUES (
      ${I.customer},
      ${SAMPLE_CUSTOMER_EMAIL},
      ${hash},
      ${SAMPLE_CUSTOMER_NAME},
      ${'+1 555 010 0199'},
      ${'customer'},
      ${120}
    )
    ON CONFLICT (email) DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone,
      role = EXCLUDED.role,
      loyalty_points = EXCLUDED.loyalty_points,
      updated_at = now()
    RETURNING id
  `;
  const customerId = upserted[0].id;

  await sql`
    UPDATE users SET tags = ARRAY['vip', 'email-opt-in']::text[] WHERE id = ${customerId}
  `;

  await sql`
    INSERT INTO user_addresses (id, user_id, label, line1, line2, city, state, postal, country, is_default)
    VALUES (
      ${I.addr},
      ${customerId},
      ${'Home'},
      ${'742 Evergreen Terrace'},
      ${'Apt 2'},
      ${'Springfield'},
      ${'IL'},
      ${'62704'},
      ${'US'},
      true
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      label = EXCLUDED.label,
      line1 = EXCLUDED.line1,
      line2 = EXCLUDED.line2,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      postal = EXCLUDED.postal,
      country = EXCLUDED.country,
      is_default = EXCLUDED.is_default
  `;

  console.log('Promo codes (upsert by code)…');
  await sql`
    INSERT INTO promo_codes (id, code, discount_type, discount_value, max_uses, uses_count, expires_at, active)
    VALUES
      (${I.promoWelcome}, ${'WELCOME10'}, ${'percent'}, 10, 100, 2, ${new Date(Date.now() + 86400000 * 90)}, true),
      (${I.promoShip}, ${'FREESHIP'}, ${'fixed_cents'}, 799, 50, 0, ${new Date(Date.now() + 86400000 * 30)}, true)
    ON CONFLICT (code) DO UPDATE SET
      discount_type = EXCLUDED.discount_type,
      discount_value = EXCLUDED.discount_value,
      max_uses = EXCLUDED.max_uses,
      expires_at = EXCLUDED.expires_at,
      active = EXCLUDED.active
  `;
  const [welcomePromo] = await sql`
    SELECT id FROM promo_codes WHERE UPPER(TRIM(code)) = ${'WELCOME10'} LIMIT 1
  `;
  const promoWelcomeId = welcomePromo.id;

  console.log('Products & variants…');
  await sql`
    INSERT INTO products (id, name, slug, description, category, price_cents, sale_price_cents, cost_cents, is_featured, shop_look_group)
    VALUES
      (
        ${I.pDress},
        ${'Silk Midi Dress — Blush'},
        ${'silk-midi-dress-blush'},
        ${'Bias-cut midi in washed silk. Soft pink, invisible zipper, fully lined.'},
        ${'Dresses'},
        18900,
        15900,
        8200,
        true,
        ${'spring-soiree'}
      ),
      (
        ${I.pCoat},
        ${'Cashmere Wrap Coat'},
        ${'cashmere-wrap-coat'},
        ${'Hand-finished collar, deep pockets, warm neutral camel.'},
        ${'Outerwear'},
        34900,
        null,
        21000,
        true,
        null
      ),
      (
        ${I.pEarrings},
        ${'Pearl Stud Trio'},
        ${'pearl-stud-trio'},
        ${'Three pairs: cream, blush, and champagne glass pearl.'},
        ${'Accessories'},
        4800,
        null,
        1750,
        false,
        null
      ),
      (
        ${I.pCami},
        ${'Satin Camisole'},
        ${'satin-camisole-ivory'},
        ${'Adjustable straps, French seams, ivory.'},
        ${'Tops'},
        6200,
        null,
        2800,
        false,
        ${'spring-soiree'}
      ),
      (
        ${I.pTrousers},
        ${'High-Rise Wide Leg Trousers'},
        ${'wide-leg-trousers-charcoal'},
        ${'Structured wool blend, pressed crease, charcoal.'},
        ${'Bottoms'},
        12800,
        10800,
        6200,
        false,
        null
      ),
      (
        ${I.pBlazer},
        ${'Tailored Blazer — Rose Quartz'},
        ${'tailored-blazer-rose'},
        ${'Single-breasted, light shoulder pad, pairs with the silk dress.'},
        ${'Outerwear'},
        16500,
        null,
        8800,
        false,
        ${'spring-soiree'}
      )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      price_cents = EXCLUDED.price_cents,
      sale_price_cents = EXCLUDED.sale_price_cents,
      cost_cents = EXCLUDED.cost_cents,
      is_featured = EXCLUDED.is_featured,
      shop_look_group = EXCLUDED.shop_look_group,
      updated_at = now()
  `;
  await sql`
    UPDATE products
    SET cloudinary_ids = ARRAY['demo/boutique-rose-dress', 'demo/boutique-coat']::text[]
    WHERE id = ${I.pDress}
  `;
  await sql`
    UPDATE products SET cloudinary_ids = ARRAY['demo/boutique-coat']::text[] WHERE id = ${I.pCoat}
  `;

  await sql`
    INSERT INTO product_variants (id, product_id, size, sku, stock) VALUES
      (${I.vDressS}, ${I.pDress}, ${'S'}, ${'HB-DRESS-S'}, 8),
      (${I.vDressM}, ${I.pDress}, ${'M'}, ${'HB-DRESS-M'}, 12),
      (${I.vDressL}, ${I.pDress}, ${'L'}, ${'HB-DRESS-L'}, 6),
      (${I.vCoatS}, ${I.pCoat}, ${'S'}, ${'HB-COAT-S'}, 4),
      (${I.vCoatM}, ${I.pCoat}, ${'M'}, ${'HB-COAT-M'}, 7),
      (${I.vCoatL}, ${I.pCoat}, ${'L'}, ${'HB-COAT-L'}, 3),
      (${I.vEar1}, ${I.pEarrings}, ${'One Size'}, ${'HB-EAR-1'}, 25),
      (${I.vCamiS}, ${I.pCami}, ${'S'}, ${'HB-CAMI-S'}, 10),
      (${I.vCamiM}, ${I.pCami}, ${'M'}, ${'HB-CAMI-M'}, 14),
      (${I.vCamiL}, ${I.pCami}, ${'L'}, ${'HB-CAMI-L'}, 9),
      (${I.vTrouS}, ${I.pTrousers}, ${'S'}, ${'HB-TR-S'}, 5),
      (${I.vTrouM}, ${I.pTrousers}, ${'M'}, ${'HB-TR-M'}, 8),
      (${I.vTrouL}, ${I.pTrousers}, ${'L'}, ${'HB-TR-L'}, 4),
      (${I.vBlazerS}, ${I.pBlazer}, ${'S'}, ${'HB-BLZ-S'}, 5),
      (${I.vBlazerM}, ${I.pBlazer}, ${'M'}, ${'HB-BLZ-M'}, 6),
      (${I.vBlazerL}, ${I.pBlazer}, ${'L'}, ${'HB-BLZ-L'}, 4)
    ON CONFLICT (id) DO UPDATE SET
      product_id = EXCLUDED.product_id,
      size = EXCLUDED.size,
      sku = EXCLUDED.sku,
      stock = EXCLUDED.stock
  `;

  const shipAddrJson = JSON.stringify({
    line1: '742 Evergreen Terrace',
    line2: 'Apt 2',
    city: 'Springfield',
    state: 'IL',
    postal: '62704',
    country: 'US',
  });

  console.log('Orders…');
  await sql`
    INSERT INTO orders (
      id, user_id, guest_email, status, subtotal_cents, discount_cents, tax_cents, shipping_cents,
      total_cents, currency, stripe_payment_intent_id, shipping_address, tracking_number, promo_code_id
    ) VALUES (
      ${I.orderPaid},
      ${customerId},
      null,
      ${'delivered'},
      31800,
      1590,
      0,
      799,
      31009,
      ${'usd'},
      ${'pi_sample_delivered_001'},
      ${shipAddrJson}::jsonb,
      ${'1Z999AA10123456784'},
      ${promoWelcomeId}
    )
  `;

  await sql`
    INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents) VALUES
      (${I.orderPaid}, ${I.pDress}, ${I.vDressM}, 1, 15900),
      (${I.orderPaid}, ${I.pEarrings}, ${I.vEar1}, 2, 4800)
  `;

  await sql`
    INSERT INTO orders (
      id, user_id, status, subtotal_cents, discount_cents, tax_cents, shipping_cents,
      total_cents, currency, stripe_payment_intent_id, shipping_address, tracking_number
    ) VALUES (
      ${I.orderShipped},
      ${customerId},
      ${'shipped'},
      34900,
      0,
      0,
      0,
      34900,
      ${'usd'},
      ${'pi_sample_shipped_002'},
      ${shipAddrJson}::jsonb,
      ${'1Z999AA10987654321'}
    )
  `;

  await sql`
    INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents) VALUES
      (${I.orderShipped}, ${I.pCoat}, ${I.vCoatM}, 1, 34900)
  `;

  await sql`
    INSERT INTO orders (
      id, user_id, status, subtotal_cents, discount_cents, tax_cents, shipping_cents,
      total_cents, currency, shipping_address
    ) VALUES (
      ${I.orderPending},
      ${customerId},
      ${'pending'},
      6200,
      0,
      0,
      799,
      6999,
      ${'usd'},
      ${shipAddrJson}::jsonb
    )
  `;

  await sql`
    INSERT INTO order_items (order_id, product_id, variant_id, quantity, unit_price_cents) VALUES
      (${I.orderPending}, ${I.pCami}, ${I.vCamiS}, 1, 6200)
  `;

  console.log('Wishlist, loyalty, carts…');
  await sql`
    INSERT INTO wishlist (user_id, product_id) VALUES (${customerId}, ${I.pBlazer})
    ON CONFLICT (user_id, product_id) DO NOTHING
  `;

  await sql`
    INSERT INTO loyalty_ledger (id, user_id, delta, reason, order_id) VALUES
      (${I.loy1}, ${customerId}, 50, ${'Welcome bonus'}, null),
      (${I.loy2}, ${customerId}, 70, ${'Order purchase'}, ${I.orderPaid})
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      delta = EXCLUDED.delta,
      reason = EXCLUDED.reason,
      order_id = EXCLUDED.order_id
  `;

  // Same shape as POST /cart and buildOrderTotals: variantId + quantity.
  const cartItemsJson = JSON.stringify([
    { variantId: I.vTrouM, quantity: 1 },
    { variantId: I.vCamiL, quantity: 2 },
  ]);
  const cartGuestJson = JSON.stringify([{ variantId: I.vEar1, quantity: 1 }]);

  await sql`
    INSERT INTO carts (id, user_id, guest_id, items_json, promo_hint, notified_1h, notified_24h)
    VALUES (
      ${I.cartUser},
      ${customerId},
      null,
      ${cartItemsJson}::jsonb,
      ${'WELCOME10'},
      false,
      false
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      guest_id = EXCLUDED.guest_id,
      items_json = EXCLUDED.items_json,
      promo_hint = EXCLUDED.promo_hint,
      notified_1h = EXCLUDED.notified_1h,
      notified_24h = EXCLUDED.notified_24h,
      updated_at = now()
  `;

  await sql`
    INSERT INTO carts (id, user_id, guest_id, items_json, notified_1h, notified_24h)
    VALUES (
      ${I.cartGuest},
      null,
      ${'guest-demo-uuid-0001'},
      ${cartGuestJson}::jsonb,
      false,
      false
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      guest_id = EXCLUDED.guest_id,
      items_json = EXCLUDED.items_json,
      notified_1h = EXCLUDED.notified_1h,
      notified_24h = EXCLUDED.notified_24h,
      updated_at = now()
  `;

  console.log('Conversations & messages…');
  await sql`
    INSERT INTO conversations (id, user_id, staff_id, order_id, title, last_message_at)
    VALUES (
      ${I.conv},
      ${customerId},
      ${adminId},
      ${I.orderPaid},
      ${'Question about blush dress'},
      ${new Date(Date.now() - 3600000)}
    )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      staff_id = EXCLUDED.staff_id,
      order_id = EXCLUDED.order_id,
      title = EXCLUDED.title,
      last_message_at = EXCLUDED.last_message_at
  `;

  await sql`
    INSERT INTO messages (conversation_id, sender_id, body, read_at) VALUES
      (${I.conv}, ${customerId}, ${'Hi! Does the blush dress run true to size?'}, ${new Date(Date.now() - 7200000)}),
      (${I.conv}, ${adminId}, ${'Hi Avery — the fit is true to size; the M is our most popular.'}, ${new Date(Date.now() - 5400000)}),
      (${I.conv}, ${customerId}, ${'Perfect, thank you!'}, null)
  `;

  console.log('Notifications…');
  await sql`
    INSERT INTO notifications (id, user_id, type, title, body, data, read_at) VALUES
      (
        ${I.n1},
        ${customerId},
        ${'order'},
        ${'Order delivered'},
        ${'Your silk midi dress is marked delivered.'},
        ${JSON.stringify({ orderId: I.orderPaid, status: 'delivered' })}::jsonb,
        ${new Date(Date.now() - 86400000)}
      ),
      (
        ${I.n2},
        ${customerId},
        ${'promotion'},
        ${'Weekend: extra 10% off sale'},
        ${'Use code WEEKEND10 on sale items through Sunday.'},
        ${JSON.stringify({ type: 'promotion' })}::jsonb,
        null
      ),
      (
        ${I.n3},
        ${customerId},
        ${'message'},
        ${'New reply from Heaven\'s Boutique'},
        ${'Open Messages to read the team reply.'},
        ${JSON.stringify({ conversationId: I.conv })}::jsonb,
        null
      ),
      (
        ${I.n4},
        ${customerId},
        ${'back_in_stock'},
        ${'Blazer back in stock'},
        ${'Rose quartz blazer in M is available again.'},
        ${JSON.stringify({ type: 'back_in_stock' })}::jsonb,
        null
      ),
      (
        ${I.n5},
        ${customerId},
        ${'abandoned_cart'},
        ${'Still thinking about those trousers?'},
        ${'Your cart is waiting — complete checkout when you are ready.'},
        ${JSON.stringify({ type: 'abandoned_cart' })}::jsonb,
        null
      )
    ON CONFLICT (id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      type = EXCLUDED.type,
      title = EXCLUDED.title,
      body = EXCLUDED.body,
      data = EXCLUDED.data,
      read_at = EXCLUDED.read_at
  `;

  console.log('');
  console.log('Sample data ready.');
  console.log(`  Admin (unchanged):     ${ADMIN_EMAIL}`);
  console.log(`  Sample customer:       ${SAMPLE_CUSTOMER_EMAIL}`);
  console.log(`  Sample password:       ${SAMPLE_CUSTOMER_PASSWORD}`);
  console.log('  Featured products:     silk dress, cashmere coat');
  console.log(`  Shop the look group:   spring-soiree (4 products)`);
  console.log(`  Promo codes:           WELCOME10 (10%), FREESHIP ($7.99 off)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
