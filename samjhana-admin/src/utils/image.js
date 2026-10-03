const MAX_SIDE = 1600;
const MAX_BYTES = 3 * 1024 * 1024;
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

/** Scales a picture down to fit inside max × max, keeping its shape; never makes it bigger. */
export function fitWithin(width, height, max = MAX_SIDE) {
  if (width <= max && height <= max) return { width, height };
  const scale = max / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Where the picture with this id can be shown (the public, cacheable address). */
export function mediaUrl(id) {
  return id ? `${API_BASE}/api/public/media/${id}` : '';
}

/** A server-relative picture address (as the API sends it) made showable from here. */
export function resolveMediaUrl(path) {
  return path ? `${API_BASE}${path}` : '';
}

function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    // 'from-image' applies the phone's rotation, so an upright photo doesn't arrive sideways.
    return createImageBitmap(file, { imageOrientation: 'from-image' });
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

/**
 * Gets a picked photo ready to upload: made smaller (longest side 1600 px) and re-saved, which also bakes in the
 * phone's rotation. PNG stays PNG (so see-through pictures stay see-through), everything else becomes JPEG.
 * Rejects with Error('type') for a non-picture and Error('size') when it is still over 3 MB.
 */
export async function prepareImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('type');
  const bitmap = await loadImage(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
  // Keep the original when it was already small and re-saving would only make it bigger.
  const best = blob && (width !== bitmap.width || blob.size < file.size) ? blob : file;
  if (best.size > MAX_BYTES) throw new Error('size');
  return best;
}
