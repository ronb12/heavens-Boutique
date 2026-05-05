/**
 * Map a postgres error to a client-safe { status, error } for admin APIs.
 * @param {any} e
 * @param {{ fallback?: string }} [opts]
 * @returns {{ status: number, error: string }}
 */
export function postgresClientError(e, opts = {}) {
  const fallback = opts.fallback || 'Request failed';
  if (!e || typeof e !== 'object') {
    return { status: 500, error: fallback };
  }
  const code = e.code;
  if (code === '23505') {
    const detail = String(e.detail || '');
    const cstr = String(e.constraint || '');
    const isSku = /Key \(sku\)=/i.test(detail) || cstr.includes('product_variants_sku') || cstr.includes('sku');
    return {
      status: 409,
      error: isSku
        ? 'That SKU is already in use. Use a different SKU or leave it blank.'
        : 'A product with this slug (or another unique value) already exists. Try a different custom slug.',
    };
  }
  if (code === '42703' || code === '42P01') {
    return {
      status: 500,
      error:
        'The database is missing a required column or table. Run all migrations in `database/migrations` (including supplier fields on `products` from 017), then try again.',
    };
  }
  const msg = typeof e.message === 'string' && e.message.trim() ? e.message.trim() : fallback;
  return { status: 500, error: msg };
}
