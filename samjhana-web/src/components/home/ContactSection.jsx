import { ArrowUpRight, Clock3, MapPin, MessageCircle, Phone } from 'lucide-react';
import { useSection } from '../../site/SiteContext';
import { mapEmbedUrl, telLink, whatsappLink } from '../../site/links';

function coordinates(contact) {
  const lat = Number(contact.latitude);
  const lng = Number(contact.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return '';
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
}

/** "Plan your stop": where we are, how to call, and a map. */
export default function ContactSection() {
  const contact = useSection('contact');
  const identity = useSection('identity');
  const tel = telLink(contact);
  const wa = whatsappLink(contact);
  const embed = mapEmbedUrl(contact);
  const place = [contact.addressLine, coordinates(contact)].filter(Boolean).join(' · ');

  return (
    <section id="contact" className="hub-contact" aria-labelledby="contact-heading">
      <div className="hub-contact-copy">
        <p className="hub-lane-label">{contact.eyebrow}</p>
        <h2 id="contact-heading">{contact.title}</h2>
        <p>{contact.copy}</p>
        <div className="hub-contact-location"><MapPin size={17} /><span><strong>{identity.name}</strong><small>{place}</small></span></div>
        <div className="hub-contact-actions">
          {tel && <a href={tel} className="btn-dark"><Phone size={16} /> Call {contact.phone}</a>}
          {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn-outline"><MessageCircle size={16} /> WhatsApp</a>}
          {contact.hoursNote && <span className="hub-hours"><Clock3 size={15} /> {contact.hoursNote}</span>}
        </div>
      </div>
      {(embed || contact.mapsUrl) && (
        <div className="hub-map-card">
          {embed && <iframe title={`${identity.name || 'Our'} location map`} src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />}
          {contact.mapsUrl && (
            <a className="hub-map-overlay" href={contact.mapsUrl} target="_blank" rel="noreferrer"><strong>{identity.name}</strong><small>Open in Maps <ArrowUpRight size={14} /></small></a>
          )}
          {contact.addressLine && <span className="hub-map-badge"><MapPin size={13} /> {contact.addressLine}</span>}
        </div>
      )}
    </section>
  );
}
