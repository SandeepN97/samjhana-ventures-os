import { mediaUrl } from '../api/api.js';
import { getProductVisual } from './FurnitureIllustrations';

/** The product's own picture when the admin has uploaded one, otherwise the drawn illustration. */
export default function ProductVisual({ product, fallback = null, fit = 'cover', className = '' }) {
  if (product?.imageUrl) {
    return (
      <img src={mediaUrl(product.imageUrl)} alt={product.name} loading="lazy"
        className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`} />
    );
  }
  if (fallback) return fallback;
  const { Illustration } = getProductVisual(product?.name);
  return <Illustration />;
}

/** The soft background colour behind a product's illustration. */
export function visualBackground(product) {
  return product?.imageUrl ? '#f7f3ed' : getProductVisual(product?.name).accent.bg;
}
