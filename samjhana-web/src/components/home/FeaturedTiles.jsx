import { useState } from 'react';
import { ArrowUpRight, ShoppingBag, X } from 'lucide-react';
import { useSection } from '../../site/SiteContext';
import { mediaPath, mediaUrl } from '../../api/api.js';
import SmartLink from '../ui/SmartLink';
import { whatsappLink } from '../../site/links';

/** "From our shop": four tiles, each opening a short story with a button. All of it comes from the website content. */
export default function FeaturedTiles() {
  const featured = useSection('featured');
  const contact = useSection('contact');
  const [story, setStory] = useState(null);
  const tiles = featured.tiles || [];
  const wa = whatsappLink(contact);
  if (tiles.length === 0) return null;

  return (
    <>
      <section className="hub-featured" aria-labelledby="featured-heading">
        <div className="hub-section-heading">
          <div><p className="hub-lane-label">{featured.eyebrow}</p><h2 id="featured-heading">{featured.title}</h2></div>
          {wa && featured.linkLabel && <a href={wa} target="_blank" rel="noreferrer" className="hub-text-link">{featured.linkLabel} <ArrowUpRight size={15} /></a>}
        </div>
        <div className="hub-product-grid">
          {tiles.map((tile) => (
            <button type="button" key={tile.title} onClick={() => setStory(tile)} className="hub-product-card">
              <div className={`hub-product-art ${tile.image ? 'hub-product-art-illustration' : ''}`}>
                {tile.image ? <img className="hub-isolated-art" src={mediaUrl(mediaPath(tile.image))} alt={tile.title} loading="lazy" /> : <ShoppingBag size={34} strokeWidth={1.2} />}
              </div>
              <strong>{tile.title}</strong><span>{tile.nepali}</span>
            </button>
          ))}
        </div>
      </section>

      {story && (
        <div className="story-modal-backdrop" role="presentation" onClick={() => setStory(null)}>
          <section className="story-modal hub-story-modal" role="dialog" aria-modal="true" aria-labelledby="shop-story-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="story-modal-close" aria-label="Close story" onClick={() => setStory(null)}><X size={18} /></button>
            <p className="hub-lane-label">{featured.eyebrow}</p>
            <h2 id="shop-story-title">{story.storyTitle || story.title}</h2>
            <p>{story.storyBody}</p>
            {story.action && <SmartLink href={story.href} className="btn-dark story-modal-action" onClick={() => setStory(null)}>{story.action} <ArrowUpRight size={16} /></SmartLink>}
          </section>
        </div>
      )}
    </>
  );
}
