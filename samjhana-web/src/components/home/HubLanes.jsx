import { useState } from 'react';
import { ArrowUpRight, Fuel, MapPin, ShoppingBag, Utensils, Wrench, Zap } from 'lucide-react';
import { useSection } from '../../site/SiteContext';
import { mediaPath, mediaUrl } from '../../api/api.js';
import SmartLink from '../ui/SmartLink';

export const SERVICE_ICONS = { fuel: Fuel, zap: Zap, wrench: Wrench, utensils: Utensils, mappin: MapPin };

function Lane({ tone, lane, active, onActivate, children }) {
  const image = mediaUrl(mediaPath(lane.image));
  return (
    <article className={`hub-lane ${tone} ${active ? 'hub-lane-active' : ''}`} onMouseEnter={onActivate} onFocusCapture={onActivate} onTouchStart={onActivate}>
      <div className="hub-lane-copy">
        <p className="hub-lane-label">{lane.eyebrow}</p>
        <h1>{lane.title}</h1>
        <p className="hub-nepali">{lane.nepali}</p>
        <p className="hub-lane-description">{lane.copy}</p>
        <p className="hub-lane-note">{lane.note}</p>
      </div>
      {image && <img className="hub-scene" src={image} alt="" aria-hidden="true" />}
      <div className="hub-link-grid">{children}</div>
      {lane.cta && <SmartLink href={lane.ctaHref} className="btn-dark hub-cta">{lane.cta}<ArrowUpRight size={16} /></SmartLink>}
    </article>
  );
}

/** The two big panels at the top of the home page. Every word, link and picture comes from the website content. */
export default function HubLanes() {
  const hub = useSection('hub');
  const [activeLane, setActiveLane] = useState(null);
  const visit = hub.visit || {};
  const shop = hub.shop || {};

  return (
    <section className="hub-lanes" aria-label="Services and shop" onMouseLeave={() => setActiveLane(null)}>
      <Lane tone="hub-visit" lane={visit} active={activeLane === 'visit'} onActivate={() => setActiveLane('visit')}>
        {(visit.services || []).map(({ label, nepali, icon, href }) => {
          const Icon = SERVICE_ICONS[icon] || MapPin;
          return (
            <SmartLink key={`${label}-${href}`} href={href} className="hub-link-card">
              <Icon size={18} /><span><strong>{label}</strong><small>{nepali}</small></span><ArrowUpRight size={14} />
            </SmartLink>
          );
        })}
      </Lane>
      <Lane tone="hub-shop" lane={shop} active={activeLane === 'shop'} onActivate={() => setActiveLane('shop')}>
        {(shop.cards || []).map(({ label, nepali, image, href }) => (
          <SmartLink key={`${label}-${href}`} href={href} className="hub-link-card">
            <span className="hub-card-image">{image ? <img src={mediaUrl(mediaPath(image))} alt="" loading="lazy" /> : <ShoppingBag size={18} />}</span>
            <span><strong>{label}</strong><small>{nepali}</small></span>
          </SmartLink>
        ))}
      </Lane>
    </section>
  );
}
