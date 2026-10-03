import { useState } from 'react';
import { Package } from 'lucide-react';
import { mediaUrl } from '../../api/api.js';

/**
 * A picture the backend serves. When there is none, or it fails to load, a quiet placeholder takes its place so
 * a missing photo never leaves a broken-image icon or a hole in the layout.
 */
export default function Picture({ src, alt = '', className = '', fit = 'cover', placeholderClass = '' }) {
  const [failed, setFailed] = useState(false);
  const url = mediaUrl(src);
  if (!url || failed) {
    return (
      <div className={`flex items-center justify-center bg-warm-soft text-dark/20 ${className} ${placeholderClass}`} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
        <Package size={36} strokeWidth={1.2} aria-hidden="true" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`} />;
}
