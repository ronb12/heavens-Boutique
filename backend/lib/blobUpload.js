import { put } from '@vercel/blob';

/**
 * @param {Buffer} buffer
 * @param {string} contentType e.g. image/jpeg
 * @returns {Promise<{ url: string }>}
 */
export async function uploadProductImageToBlob(buffer, contentType) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !String(token).trim()) {
    throw new Error('BLOB_READ_WRITE_TOKEN must be set');
  }
  const ext = extensionForContentType(contentType);
  const pathname = `heavens-boutique/products/product.${ext}`;
  const blob = await put(pathname, buffer, {
    access: 'public',
    token: String(token).trim(),
    contentType,
    addRandomSuffix: true,
  });
  return { url: blob.url };
}

function extensionForContentType(ct) {
  const c = String(ct || '').toLowerCase();
  if (c.includes('png')) return 'png';
  if (c.includes('webp')) return 'webp';
  if (c.includes('gif')) return 'gif';
  return 'jpg';
}
