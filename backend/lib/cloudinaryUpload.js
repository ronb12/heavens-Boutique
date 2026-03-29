import { v2 as cloudinary } from 'cloudinary';

function ensureConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET must be set');
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

/**
 * @param {Buffer} buffer Raw image bytes
 * @returns {Promise<{ public_id: string, secure_url: string, width?: number, height?: number }>}
 */
export function uploadProductImageBuffer(buffer) {
  ensureConfigured();
  const folder = (process.env.CLOUDINARY_UPLOAD_FOLDER || 'heavens-boutique/products').replace(/^\/+|\/+$/g, '');

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        if (!result?.public_id || !result?.secure_url) {
          reject(new Error('Cloudinary returned no public_id'));
          return;
        }
        resolve({
          public_id: result.public_id,
          secure_url: result.secure_url,
          width: result.width,
          height: result.height,
        });
      }
    );
    stream.end(buffer);
  });
}
