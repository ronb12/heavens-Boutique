import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { uploadProductImageToBlob } from '../../lib/blobUpload.js';
import { uploadProductImageBuffer } from '../../lib/cloudinaryUpload.js';

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
          'Blob upload failed. Check BLOB_READ_WRITE_TOKEN in Vercel (Storage → Blob) or configure Cloudinary instead.',
      });
    }
    if (e.message?.includes('must be set')) {
      return json(res, 503, {
        error:
          'Image upload is not configured. Add BLOB_READ_WRITE_TOKEN (Vercel Blob, free tier on Hobby) or Cloudinary API env vars — see backend/.env.example.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Upload failed' });
  }
}

function sniffContentType(buf) {
  if (buf.length < 12) return 'application/octet-stream';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    if (buf.slice(0, 20).toString('ascii').includes('WEBP')) return 'image/webp';
  }
  return 'application/octet-stream';
}

function isProbablyImage(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
    return buf.slice(0, 20).toString('ascii').includes('WEBP');
  }
  return false;
}
