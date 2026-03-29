import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { uploadProductImageToBlob } from '../../lib/blobUpload.js';
import { uploadProductImageBuffer } from '../../lib/cloudinaryUpload.js';
import { isProbablyImage, sniffContentType } from '../../lib/imageSniff.js';

const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireAdmin(req);
  if (admin.error) return json(res, admin.status, { error: admin.error });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const body = await readJson(req, { maxChars: 4_500_000 });
    const raw = String(body.imageBase64 || '').trim();
    if (!raw) return json(res, 400, { error: 'Missing imageBase64' });

    let buffer;
    try {
      const b64 = raw.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
    } catch {
      return json(res, 400, { error: 'Invalid base64' });
    }

    if (buffer.length > MAX_BYTES) {
      return json(res, 400, { error: 'Image too large (max 8 MB)' });
    }
    if (buffer.length < 24) {
      return json(res, 400, { error: 'Image too small' });
    }
    if (!isProbablyImage(buffer)) {
      return json(res, 400, { error: 'File must be a JPEG, PNG, WebP, or GIF image' });
    }

    const contentType = sniffContentType(buffer);
    if (!contentType.startsWith('image/')) {
      return json(res, 400, { error: 'File must be a JPEG, PNG, WebP, or GIF image' });
    }

    if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
      const { url } = await uploadProductImageToBlob(buffer, contentType);
      return json(res, 200, {
        publicId: url,
        url,
        width: null,
        height: null,
        storage: 'vercel-blob',
      });
    }

    const result = await uploadProductImageBuffer(buffer);
    return json(res, 200, {
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      storage: 'cloudinary',
    });
  } catch (e) {
    if (e.message === 'Payload too large') {
      return json(res, 413, {
        error: 'Image payload too large. Use a smaller photo or let the app compress it; server limit is about 4.5 MB.',
      });
    }
    if (e.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      return json(res, 503, {
        error:
          'Vercel Blob upload failed. In the Vercel project: Storage → Blob → link store, ensure BLOB_READ_WRITE_TOKEN is set, then redeploy. Or set Cloudinary env vars as a fallback.',
      });
    }
    if (e.message?.includes('must be set')) {
      return json(res, 503, {
        error:
          'Image upload is not configured. On Vercel, add a Blob store and BLOB_READ_WRITE_TOKEN (see backend/.env.example). For local dev without Blob, set CLOUDINARY_* instead.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Upload failed' });
  }
}
