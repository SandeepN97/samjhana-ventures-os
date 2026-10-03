import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Box, ChevronRight, MessageCircle, Phone, X } from 'lucide-react';
import { useCatalogue, toFurniture } from '../data/catalogue';
import { useSection } from '../site/SiteContext';
import { mediaPath, mediaUrl } from '../api/api.js';
import { telLink, whatsappLink } from '../site/links';
import ProductVisual from '../components/ProductVisual';
import SmartLink from '../components/ui/SmartLink';

const pic = (id) => mediaUrl(mediaPath(id));

export default function ShopOrderPage() {
  const hub = useSection('shopHub');
  const contact = useSection('contact');
  const furnitureCatalogue = useCatalogue('FURNITURE');
  const furniture = furnitureCatalogue.items.slice(0, 3).map(toFurniture);
  const [showVehicleStory, setShowVehicleStory] = useState(false);
  const f = hub.furniture || {};
  const h = hub.honey || {};
  const note = hub.vehicleNote || {};
  const story = hub.vehicleStory || {};
  const whatsapp = whatsappLink(contact);
  const tel = telLink(contact);

  return (
    <main className="shop-hub-page">
      <section className="shop-hub-hero">
        <div className="shop-hub-hero-copy">
          <p className="hub-lane-label">{hub.eyebrow}</p>
          <h1>{hub.titleLine1}<br /><em>{hub.titleLine2}</em></h1>
          <p className="shop-hub-nepali">{hub.nepali}</p>
          <p className="shop-hub-intro">{hub.intro}</p>
          <div className="shop-hub-actions">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-dark"><MessageCircle size={16} /> Ask on WhatsApp</a>}
            {tel && <a href={tel} className="btn-outline"><Phone size={16} /> {contact.phone}</a>}
          </div>
        </div>
        <div className="shop-hub-visual" aria-label="Samjhana Ventures products from Gulmi">
          {hub.image && <img className="shop-hub-scene" src={pic(hub.image)} alt="" />}
          <div className="shop-hub-visual-caption"><strong>{hub.captionTitle}</strong><span>{hub.captionNote}</span></div>
        </div>
      </section>

      <section className="shop-hub-choices" aria-label="Shop categories">
        <article className="shop-choice shop-choice-furniture">
          <div className="shop-choice-art">{f.image && <img src={pic(f.image)} alt="" />}</div>
          <div className="shop-choice-copy">
            <p className="hub-lane-label">{f.eyebrow}</p>
            <h2>{f.title}</h2>
            <p>{f.copy}</p>
            <div className="shop-preview-row">
              {furniture.length > 0
                ? furniture.map((item) => (
                  <Link key={item.id} to={`/furniture/${item.id}`} className="shop-mini-card">
                    <span><ProductVisual product={item} /></span>
                    <strong>{item.name}</strong>
                  </Link>
                ))
                : <span className="shop-preview-empty">{f.emptyNote}</span>}
            </div>
            <Link to="/furniture" className="shop-choice-link">{f.linkLabel} <ArrowUpRight size={16} /></Link>
          </div>
        </article>

        <article className="shop-choice shop-choice-honey">
          <div className="shop-choice-art">{h.image && <img src={pic(h.image)} alt="" />}</div>
          <div className="shop-choice-copy">
            <p className="hub-lane-label">{h.eyebrow}</p>
            <h2>{h.title}</h2>
            <p>{h.copy}</p>
            <div className="shop-preview-row">
              {(h.links || []).map((l) => (
                <SmartLink key={l.label} href={l.href} className="shop-mini-card">
                  <span>{l.image && <img src={pic(l.image)} alt="" />}</span>
                  <strong>{l.label}</strong>
                </SmartLink>
              ))}
            </div>
            <Link to="/beekeeping" className="shop-choice-link">{h.linkLabel} <ArrowUpRight size={16} /></Link>
          </div>
        </article>
      </section>

      {note.title && (
        <section className="shop-hub-note"><Box size={20} /><div><strong>{note.title}</strong><p>{note.text}</p></div>
          <button type="button" onClick={() => setShowVehicleStory(true)}>{note.button} <ChevronRight size={16} /></button></section>
      )}

      {showVehicleStory && <div className="story-modal-backdrop" role="presentation" onClick={() => setShowVehicleStory(false)}>
        <section className="story-modal" role="dialog" aria-modal="true" aria-labelledby="vehicle-story-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="story-modal-close" aria-label="Close vehicle essentials story" onClick={() => setShowVehicleStory(false)}><X size={18} /></button>
          <p className="hub-lane-label">{story.eyebrow}</p>
          <h2 id="vehicle-story-title">{story.title}</h2>
          <p>{story.text}</p>
          <div className="story-modal-steps">{(story.steps || []).map((step, i) => <span key={step}><b>{String(i + 1).padStart(2, '0')}</b> {step}</span>)}</div>
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="btn-dark story-modal-action"><MessageCircle size={16} /> {story.cta}</a>}
        </section>
      </div>}
    </main>
  );
}
