import { resolveProductImageUrl } from './productImages.js';

/**
 * @param {object} row
 * @param {object[]} variants
 * @param {{ includeCost?: boolean }} [opts]
 */
export function mapProduct(row, variants, opts = {}) {
  const images = (row.cloudinary_ids || []).map((id) => resolveProductImageUrl(id)).filter(Boolean);
  const out = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    priceCents: row.price_cents,
    salePriceCents: row.sale_price_cents,
    isFeatured: row.is_featured,
    shopLookGroup: row.shop_look_group,
    images,
    variants: (variants || []).map((v) => ({
      id: v.id,
      size: v.size,
      sku: v.sku,
      stock: v.stock,
    })),
  };
  if (opts.includeCost) {
    out.costCents = row.cost_cents != null && row.cost_cents !== undefined ? row.cost_cents : null;
  }
  return out;
}
