import { Hexagon } from 'lucide-react';
import { mediaUrl } from '../../api/api.js';

/** A product picture from the admin; a soft honeycomb mark stands in until one is uploaded. */
export default function BeeImg({ src, alt = '', className = '', loading }) {
  if (!src) {
    return <div className={`${className} flex items-center justify-center`} role="img" aria-label={alt}><Hexagon size={28} strokeWidth={1.2} className="text-[#8B6914]/25" /></div>;
  }
  return <img src={mediaUrl(src)} alt={alt} className={className} loading={loading} />;
}
