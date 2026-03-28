import { cloudinaryImageUrl } from './cloudinary.js';

export function mapProduct(row, variants) {
  const images = (row.cloudinary_ids || []).map((id) => cloudinaryImageUrl(id)).filter(Boolean);
  return {
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
}
