import { useState } from 'react';
import { ArrowUpRight, Armchair, Fuel, Hexagon, MapPin, ShoppingBag, Utensils, Wrench, Zap } from 'lucide-react';
import { useSection } from '../../site/SiteContext';
import { mediaPath, mediaUrl } from '../../api/api.js';
import SmartLink from '../ui/SmartLink';

const SERVICE_ICONS = { fuel: Fuel, zap: Zap, wrench: Wrench, utensils: Utensils, mappin: MapPin };
// Only the honey and furniture tiles swap their photo for a line icon (same style as the service tiles); the other tiles keep their look.
// Every tile's icon or picture gets the `hub-icon` class, which is what the hover animation in index.css targets.
// The icon set has no bee, so honey is a honeycomb.
const SHOP_ICONS = { honey: Hexagon, chair: Armchair };
const ICON_BY_HREF = { '/beekeeping': 'honey', '/furniture': 'chair' };
const ICON_BY_LABEL = [[/honey|bee/i, 'honey'], [/furniture/i, 'chair']];

/** Picks a tile's icon: the card's own `icon` key first, then its link, then its English label (older saved content has no `icon` key). */
function shopIcon({ icon, href, label }) {
  const key = (SHOP_ICONS[icon] && icon) || ICON_BY_HREF[href] || (ICON_BY_LABEL.find(([re]) => re.test(label || '')) || [])[1];
  return SHOP_ICONS[key] || null;
}

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
              <Icon className="hub-icon" size={18} aria-hidden="true" /><span><strong>{label}</strong><small>{nepali}</small></span><ArrowUpRight size={14} />
            </SmartLink>
          );
        })}
      </Lane>
      <Lane tone="hub-shop" lane={shop} active={activeLane === 'shop'} onActivate={() => setActiveLane('shop')}>
        {(shop.cards || []).map((card) => {
          const { label, nepali, image, href } = card;
          const Icon = shopIcon(card);
          return (
            <SmartLink key={`${label}-${href}`} href={href} className="hub-link-card">
              <span className="hub-card-image">
                {Icon ? <Icon className="hub-icon" size={20} aria-hidden="true" />
                  : image ? <img className="hub-icon" src={mediaUrl(mediaPath(image))} alt="" loading="lazy" /> : <ShoppingBag className="hub-icon" size={18} aria-hidden="true" />}
              </span>
              <span><strong>{label}</strong><small>{nepali}</small></span>
            </SmartLink>
          );
        })}
      </Lane>
    </section>
  );
}
