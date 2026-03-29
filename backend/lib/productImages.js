import { cloudinaryImageUrl } from './cloudinary.js';

/**
 * `products.cloudinary_ids` may hold Cloudinary public IDs or absolute image URLs (e.g. Vercel Blob).
 */
export function resolveProductImageUrl(stored) {
  const s = String(stored ?? '').trim();
  if (!s) return null;
  if (s.startsWith('https://') || s.startsWith('http://')) return s;
  return cloudinaryImageUrl(s);
}
