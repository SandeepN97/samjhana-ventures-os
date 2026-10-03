import { Link } from 'react-router-dom';
import { useSection } from '../site/SiteContext';
import SmartLink from './ui/SmartLink';
import { telLink, whatsappLink } from '../site/links';

/** Footer links come from the site's content: the shop's departments, the visit shortcuts and the contact details. */
export default function Footer() {
  const identity = useSection('identity');
  const contact = useSection('contact');
  const hub = useSection('hub');
  const shopCards = (hub.shop?.cards || []).filter((c) => c.href);
  const services = hub.visit?.services || [];
  const tel = telLink(contact);
  const wa = whatsappLink(contact);

  return (
    <footer className="bg-dark text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-serif text-xl">{identity.name}</p>
            <p className="mt-0.5 text-xs text-white/40">{identity.tagline}</p>
          </div>
          {identity.footerBlurb && <p className="text-sm leading-relaxed text-white/50">{identity.footerBlurb}</p>}
        </div>

        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-gold-light">Shop</p>
          <ul className="space-y-2.5 text-sm text-white/50">
            <li><Link to="/shop" className="hover:text-white">All products</Link></li>
            {shopCards.map((c) => <li key={c.label}><SmartLink href={c.href} className="hover:text-white">{c.label}</SmartLink></li>)}
            <li><Link to="/cart" className="hover:text-white">Your cart</Link></li>
            <li><Link to="/track" className="hover:text-white">Track an order</Link></li>
          </ul>
        </div>

        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-gold-light">Visit</p>
          <ul className="space-y-2.5 text-sm text-white/50">
            {services.map((s) => <li key={`${s.label}-${s.href}`}><SmartLink href={s.href} className="hover:text-white">{s.label}</SmartLink></li>)}
          </ul>
        </div>

        <div>
          <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-gold-light">Contact</p>
          <ul className="space-y-2.5 text-sm text-white/50">
            {tel && <li><a href={tel} className="hover:text-white">Call {contact.phone}</a></li>}
            {wa && <li><a href={wa} target="_blank" rel="noreferrer" className="hover:text-white">WhatsApp</a></li>}
            {contact.email && <li><a href={`mailto:${contact.email}`} className="hover:text-white">{contact.email}</a></li>}
            {contact.mapsUrl && <li><a href={contact.mapsUrl} target="_blank" rel="noreferrer" className="hover:text-white">Directions</a></li>}
            {contact.addressLine && <li>{contact.addressLine}</li>}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <p className="text-xs text-white/30">© {new Date().getFullYear()} {identity.copyrightName || identity.name}. All rights reserved.</p>
          {identity.footerNote && <p className="font-serif text-sm italic text-gold-light/60">{identity.footerNote}</p>}
        </div>
      </div>
    </footer>
  );
}
