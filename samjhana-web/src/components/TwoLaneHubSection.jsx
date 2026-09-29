import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Fuel, MapPin, MessageCircle, Phone, ShoppingBag, Utensils, Wrench, X, Zap } from 'lucide-react';
import visitScene from '../assets/plates/visit-scene.png';
import shopScene from '../assets/plates/shop-scene.png';
import honeyIllustration from '../assets/plates/shop-honey-cutout.png';
import chairIllustration from '../assets/plates/shop-chair-cutout.png';
import bike from '../assets/plates/bike-cutout.png';
import honeyPhoto from '../assets/real/honey-jar.jpg';
import furniturePhoto from '../assets/real/wooden-chair.jpg';

const MAPS = 'https://www.google.com/maps/@27.9922809,83.3629821,48m/data=!3m1!1e3?entry=ttu&g_ep=EgoyMDI2MDkyMy4wIKXMDSoASAFQAw%3D%3D';
const MAP_EMBED = 'https://www.google.com/maps?q=27.9922809,83.3629821&z=17&output=embed';
const PHONE = '+977 9363147818';
const WHATSAPP = 'https://wa.me/9779363147818';

const services = [
  { label: 'Fuel', nepali: 'पेट्रोल', icon: Fuel, href: '#fuel-ev' },
  { label: 'EV charging', nepali: 'ईभी चार्जिङ', icon: Zap, href: '#fuel-ev' },
  { label: 'Bike repair', nepali: 'बाइक मर्मत', icon: Wrench, href: '#bike-repair' },
  { label: 'Restaurant', nepali: 'रेस्टुरेन्ट', icon: Utensils, href: '#restaurant' },
  { label: 'Location & hours', nepali: 'स्थान र समय', icon: MapPin, href: '#contact' },
];

const categories = [
  { label: 'Honey & beekeeping', nepali: 'मह र मौरीपालन', href: '/beekeeping', image: honeyPhoto },
  { label: 'Furniture', nepali: 'फर्निचर', href: '/furniture', image: furniturePhoto },
  { label: 'Bike accessories', nepali: 'बाइक सामग्री', href: WHATSAPP, image: bike },
  { label: 'Car accessories', nepali: 'कार सामग्री', href: WHATSAPP },
];

const shopStories = {
  'Honey, bottled with care': { title: 'A little of the hillside, carried home.', body: 'Maurighar honey begins with local hives, patient seasons, and the work of keeping bees well. Browse the honey collection when you are ready, or ask us which jar is available today.', action: 'Explore Maurighar', href: '/beekeeping' },
  'Furniture for real homes': { title: 'Made for the ordinary moments.', body: 'A table gathers people. A chair waits by the window. Our furniture is chosen for the daily life it will hold, then shaped further when a custom piece makes more sense.', action: 'Explore furniture', href: '/furniture' },
  'Bike essentials': { title: 'Keep the road moving.', body: 'For bike essentials, send a photo, a part name, or a short list. We will check what is available at Samjhana Ventures and help you choose the practical next step.', action: 'Ask on WhatsApp', href: WHATSAPP, external: true },
  'Car essentials': { title: 'The useful thing you need, when you need it.', body: 'Car products do not always fit a neat online category. Tell us what you are looking for and we will confirm availability before you make the trip.', action: 'Ask on WhatsApp', href: WHATSAPP, external: true },
};

function ActionLink({ href, children, external = false, className = '' }) {
  const props = external ? { href, target: '_blank', rel: 'noreferrer' } : {};
  return external ? <a {...props} className={className}>{children}</a> : <Link to={href} className={className}>{children}</Link>;
}

function Lane({ tone, eyebrow, title, nepali, copy, note, image, children, cta, ctaHref, active, onActivate }) {
  return (
    <article className={`hub-lane ${tone} ${active ? 'hub-lane-active' : ''}`} onMouseEnter={onActivate} onFocusCapture={onActivate} onTouchStart={onActivate}>
      <div className="hub-lane-copy">
        <p className="hub-lane-label">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="hub-nepali">{nepali}</p>
        <p className="hub-lane-description">{copy}</p>
        <p className="hub-lane-note">{note}</p>
      </div>
      <img className="hub-scene" src={image} alt="" aria-hidden="true" />
      <div className="hub-link-grid">{children}</div>
      <ActionLink href={ctaHref} className="btn-dark hub-cta">{cta}<ArrowUpRight size={16} /></ActionLink>
    </article>
  );
}

export default function TwoLaneHubSection() {
  const [activeLane, setActiveLane] = useState(null);
  const [story, setStory] = useState(null);
  return (
    <main className="hub-page">
      <section className="hub-lanes" aria-label="Samjhana Ventures services and shop" onMouseLeave={() => setActiveLane(null)}>
        <Lane active={activeLane === 'visit'} onActivate={() => setActiveLane('visit')} tone="hub-visit" eyebrow="Visit & services" title="Come for the journey." nepali="यात्राका लागि आउनुहोस्।"
          copy="A stop here is part of the journey: fuel for the next climb, a charge while you rest, a mechanic when the bike needs care, and a warm meal before the road opens again."
          note="Gulmi मा बाटोको बीचमा भरपर्दो साथ।" image={visitScene} cta="See visit options" ctaHref="#fuel-ev">
          {services.map(({ label, nepali, icon: Icon, href }) => <a key={label} href={href} className="hub-link-card"><Icon size={18} /><span><strong>{label}</strong><small>{nepali}</small></span><ArrowUpRight size={14} /></a>)}
        </Lane>
        <Lane active={activeLane === 'shop'} onActivate={() => setActiveLane('shop')} tone="hub-shop" eyebrow="Shop & order" title="Take a little home." nepali="घरमा पनि सम्झना लैजानुहोस्।"
          copy="Some things begin in the hills and travel home with you: honey from the hives, furniture for daily life, and practical essentials for the road."
          note="Browse the story first, then choose the right shop." image={shopScene} cta="Browse shop & order" ctaHref="/shop">
          {categories.map(({ label, nepali, image }) => <div key={label} className="hub-link-card"><span className="hub-card-image">{image ? <img src={image} alt="" /> : <ShoppingBag size={18} />}</span><span><strong>{label}</strong><small>{nepali}</small></span></div>)}
        </Lane>
      </section>

      <section id="about" className="hub-trust" aria-label="About Samjhana Ventures">
        <div><strong>16+</strong><span>years in Gulmi</span></div><div><strong>4</strong><span>ways to serve you</span></div><div><strong>4.9★</strong><span>static food rating</span></div><div><strong>2008</strong><span>established</span></div>
      </section>

      <section className="hub-featured" aria-labelledby="featured-heading">
        <div className="hub-section-heading"><div><p className="hub-lane-label">From our shop</p><h2 id="featured-heading">Made here. Ready for the road.</h2></div><a href={WHATSAPP} target="_blank" rel="noreferrer" className="hub-text-link">Ask on WhatsApp <ArrowUpRight size={15} /></a></div>
        <div className="hub-product-grid">
          {[
            ['Honey, bottled with care', 'मौरीको शुद्ध मह', honeyIllustration, 'isolated'],
            ['Furniture for real homes', 'घरका लागि फर्निचर', chairIllustration, 'isolated'],
            ['Bike essentials', 'बाइकका सामग्री', bike],
            ['Car essentials', 'कारका सामग्री', null],
          ].map(([name, nepali, image, renderArt]) => (
            <button type="button" key={name} onClick={() => setStory(shopStories[name])} className="hub-product-card">
              <div className={`hub-product-art ${renderArt ? 'hub-product-art-illustration' : ''}`}>
                {typeof renderArt === 'function' ? renderArt() : renderArt === 'isolated' ? <img className="hub-isolated-art" src={image} alt={name} /> : image ? <img className={image === bike ? '' : 'hub-product-photo'} src={image} alt="" /> : <ShoppingBag size={34} strokeWidth={1.2} />}
              </div>
              <strong>{name}</strong><span>{nepali}</span>
            </button>
          ))}
        </div>
      </section>

      {story && <div className="story-modal-backdrop" role="presentation" onClick={() => setStory(null)}>
        <section className="story-modal hub-story-modal" role="dialog" aria-modal="true" aria-labelledby="shop-story-title" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="story-modal-close" aria-label="Close story" onClick={() => setStory(null)}><X size={18} /></button>
          <p className="hub-lane-label">From our shop</p>
          <h2 id="shop-story-title">{story.title}</h2>
          <p>{story.body}</p>
          {story.external ? <a href={story.href} target="_blank" rel="noreferrer" className="btn-dark story-modal-action"><MessageCircle size={16} /> {story.action}</a> : <Link to={story.href} className="btn-dark story-modal-action">{story.action} <ArrowUpRight size={16} /></Link>}
        </section>
      </div>}

      <section id="contact" className="hub-contact" aria-labelledby="contact-heading">
        <div className="hub-contact-copy">
          <p className="hub-lane-label">Plan your stop</p>
          <h2 id="contact-heading">Make the stop easy.</h2>
          <p>Find us in Gulmi, then call or WhatsApp before you set out. We’ll confirm today’s hours, stock, and the easiest route.</p>
          <div className="hub-contact-location"><MapPin size={17} /><span><strong>Samjhana Ventures</strong><small>Gulmi, Nepal · 27.9923° N, 83.3630° E</small></span></div>
          <div className="hub-contact-actions">
            <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="btn-dark"><Phone size={16} /> Call {PHONE}</a>
            <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-outline"><MessageCircle size={16} /> WhatsApp</a>
            <span className="hub-hours"><Clock3 size={15} /> Hours confirmed by phone</span>
          </div>
        </div>
        <div className="hub-map-card"><iframe title="Samjhana Ventures location map" src={MAP_EMBED} loading="lazy" referrerPolicy="no-referrer-when-downgrade" /><a className="hub-map-overlay" href={MAPS} target="_blank" rel="noreferrer"><strong>Samjhana Ventures</strong><small>Open in Maps <ArrowUpRight size={14} /></small></a><span className="hub-map-badge"><MapPin size={13} /> Gulmi, Nepal</span></div>
      </section>
    </main>
  );
}
