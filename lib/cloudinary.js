export function cloudinaryImageUrl(publicId) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud || !publicId) return null;
  return `https://res.cloudinary.com/${cloud}/image/upload/f_auto,q_auto/${publicId}`;
}
