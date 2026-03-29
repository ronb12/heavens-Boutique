import { put } from '@vercel/blob';

/**
 * Vercel Blob store access must match `put({ access })`.
 * - Public store → `access: 'public'` (normal for product images in the app).
 * - Private store → `access: 'private'` (set BLOB_STORE_ACCESS=private). Shoppers may not load images unless you use a public store or a proxy.
 *
 * @param {Buffer} buffer
 * @param {string} contentType e.g. image/jpeg
 * @returns {Promise<{ url: string, access: 'public' | 'private' }>}
 */
export async function uploadProductImageToBlob(buffer, contentType) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !String(token).trim()) {
    throw new Error('BLOB_READ_WRITE_TOKEN must be set');
  }
  const ext = extensionForContentType(contentType);
  const pathname = `heavens-boutique/products/product.${ext}`;
  const tok = String(token).trim();
  const baseOpts = {
    token: tok,
    contentType,
    addRandomSuffix: true,
  };

  const mode = (process.env.BLOB_STORE_ACCESS || '').trim().toLowerCase();
  if (mode === 'private') {
    const blob = await put(pathname, buffer, { ...baseOpts, access: 'private' });
    return { url: blob.url, access: 'private' };
  }
  if (mode === 'public') {
    const blob = await put(pathname, buffer, { ...baseOpts, access: 'public' });
    return { url: blob.url, access: 'public' };
  }

  try {
    const blob = await put(pathname, buffer, { ...baseOpts, access: 'public' });
    return { url: blob.url, access: 'public' };
  } catch (e) {
    const msg = String(e?.message || '');
    if (msg.includes('private store') || msg.includes('private access')) {
      console.warn(
        '[blobUpload] Store rejected public uploads; using private access. For images to show in the iOS app and shop, use a public Blob store (Vercel → Storage) or set BLOB_STORE_ACCESS=public after switching the store to public.',
      );
      const blob = await put(pathname, buffer, { ...baseOpts, access: 'private' });
      return { url: blob.url, access: 'private' };
    }
    throw e;
  }
}

function extensionForContentType(ct) {
  const c = String(ct || '').toLowerCase();
  if (c.includes('png')) return 'png';
  if (c.includes('webp')) return 'webp';
  if (c.includes('gif')) return 'gif';
  return 'jpg';
}
