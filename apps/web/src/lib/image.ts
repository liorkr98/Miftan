/**
 * Photos are re-drawn in the browser before they are uploaded.
 *
 * Two reasons. A phone photo carries EXIF — often the GPS position it was
 * taken at, the device and the time — and a photo of the inside of someone's
 * home must not carry where that home is. Drawing the pixels onto a canvas and
 * encoding them again keeps the picture and nothing else. And a 12 MB camera
 * original is ten times what anyone needs to see a leak, on a tenant's mobile
 * data plan.
 *
 * PDFs, and anything the browser cannot decode (HEIC outside Safari), are sent
 * as they are.
 */

const MAX_EDGE = 2560;
const QUALITY = 0.85;
const REDRAWABLE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export async function prepareForUpload(file: File): Promise<File> {
  if (!REDRAWABLE.has(file.type) || typeof createImageBitmap !== 'function') return file;

  let bitmap: ImageBitmap;
  try {
    /* Applies the EXIF rotation to the pixels, so the photo stays upright once
       the tag that described the rotation is gone. */
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  /* PNG stays PNG (screenshots, plans with text); everything else is JPEG. */
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  if (!blob) return file;

  const name = file.name.replace(/\.[^.]+$/, '') + (type === 'image/png' ? '.png' : '.jpg');
  return new File([blob], name, { type, lastModified: Date.now() });
}
