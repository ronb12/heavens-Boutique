import { randomUUID } from 'node:crypto';
import { requireStoreAccessAny, PERM } from '../../auth.js';
import { json, readJson, handleCors } from '../../http.js';
import { uploadProductImageToBlob } from '../../blobUpload.js';
import { uploadProductImageBuffer } from '../../cloudinaryUpload.js';
import { isProbablyImage, sniffContentType } from '../../imageSniff.js';

const MAX_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const admin = await requireStoreAccessAny(req, [PERM.PRODUCTS, PERM.HOMEPAGE]);
  if (admin.error) return json(res, admin.status, { error: admin.error });
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const uploadDebugId = randomUUID();
  const logInfo = (msg, extra) => {
    if (extra !== undefined) console.log(`[admin/upload ${uploadDebugId}]`, msg, extra);
    else console.log(`[admin/upload ${uploadDebugId}]`, msg);
  };
  const logErr = (msg, extra) => {
    if (extra !== undefined) console.error(`[admin/upload ${uploadDebugId}]`, msg, extra);
    else console.error(`[admin/upload ${uploadDebugId}]`, msg);
  };

  try {
    const body = await readJson(req, { maxChars: 4_500_000 });
    const raw = String(body.imageBase64 || '').trim();
    if (!raw) {
      logErr('reject missing imageBase64', { userId: admin.userId });
      return json(res, 400, { error: 'Missing imageBase64', uploadDebugId });
    }

    let buffer;
    try {
      const b64 = raw.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(b64, 'base64');
    } catch (parseErr) {
      logErr('reject invalid base64', { userId: admin.userId, cause: parseErr?.message });
      return json(res, 400, { error: 'Invalid base64', uploadDebugId });
    }

    if (buffer.length > MAX_BYTES) {
      logErr('reject too large', { userId: admin.userId, bytes: buffer.length, max: MAX_BYTES });
      return json(res, 400, {
        error: 'Image too large (max 8 MB)',
        details: `Decoded size is ${buffer.length} bytes.`,
        uploadDebugId,
      });
    }
    if (buffer.length < 24) {
      logErr('reject too small', { userId: admin.userId, bytes: buffer.length });
      return json(res, 400, {
        error: 'Image too small',
        details: `Decoded size is ${buffer.length} bytes (minimum 24).`,
        uploadDebugId,
      });
    }
    if (!isProbablyImage(buffer)) {
      logErr('reject not image magic bytes', { userId: admin.userId, bytes: buffer.length, headHex: buffer.subarray(0, 8).toString('hex') });
      return json(res, 400, {
        error: 'File must be a JPEG, PNG, WebP, or GIF image',
        details: 'First bytes did not match a supported image signature.',
        uploadDebugId,
      });
    }

    const contentType = sniffContentType(buffer);
    if (!contentType.startsWith('image/')) {
      logErr('reject sniff not image/*', { userId: admin.userId, contentType });
      return json(res, 400, {
        error: 'File must be a JPEG, PNG, WebP, or GIF image',
        details: `Sniffed content-type: ${contentType}`,
        uploadDebugId,
      });
    }

    const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
    logInfo('upload start', {
      userId: admin.userId,
      storage: useBlob ? 'vercel-blob' : 'cloudinary',
      bytes: buffer.length,
      contentType,
      base64PayloadChars: raw.length,
    });

    if (useBlob) {
      const { url, access } = await uploadProductImageToBlob(buffer, contentType);
      logInfo('upload ok blob', { userId: admin.userId, url, bytes: buffer.length, blobAccess: access });
      return json(res, 200, {
        publicId: url,
        url,
        width: null,
        height: null,
        storage: 'vercel-blob',
        blobAccess: access,
        ...(access === 'private'
          ? {
              warning:
                'Blob store is private: URLs may not load in the shop app. Prefer a public Blob store for catalog images (Vercel → Storage), or set BLOB_STORE_ACCESS=private explicitly.',
            }
          : {}),
      });
    }

    const result = await uploadProductImageBuffer(buffer);
    logInfo('upload ok cloudinary', { userId: admin.userId, publicId: result.public_id, bytes: buffer.length });
    return json(res, 200, {
      publicId: result.public_id,
      url: result.secure_url,
      width: result.width,
      height: result.height,
      storage: 'cloudinary',
    });
  } catch (e) {
    const details = e?.message || String(e);
    logErr('upload FAIL', {
      userId: admin.userId,
      name: e?.name,
      message: details,
      stack: e?.stack,
    });

    if (e.message === 'Payload too large') {
      return json(res, 413, {
        error: 'Image payload too large. Use a smaller photo or let the app compress it; server limit is about 4.5 MB.',
        details,
        uploadDebugId,
      });
    }
    if (e.message?.includes('BLOB_READ_WRITE_TOKEN')) {
      return json(res, 503, {
        error:
          'Vercel Blob upload failed. In the Vercel project: Storage → Blob → link store, ensure BLOB_READ_WRITE_TOKEN is set, then redeploy. Or set Cloudinary env vars as a fallback.',
        details,
        uploadDebugId,
      });
    }
    if (e.message?.includes('must be set')) {
      return json(res, 503, {
        error:
          'Image upload is not configured. On Vercel, add a Blob store and BLOB_READ_WRITE_TOKEN (see backend/.env.example). For local dev without Blob, set CLOUDINARY_* instead.',
        details,
        uploadDebugId,
      });
    }
    return json(res, 500, {
      error: 'Upload failed',
      details,
      uploadDebugId,
    });
  }
}
