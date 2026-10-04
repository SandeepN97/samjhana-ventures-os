import { useSection } from '../site/SiteContext';
import { telLink, whatsappLink } from '../site/links';

export default function Footer() {
  const identity = useSection('identity');
  const contact = useSection('contact');
  const tel = telLink(contact);
  const whatsapp = whatsappLink(contact);

  const links = {
    Shop: [['Furniture', '/furniture'], ['Honey & beekeeping', '/beekeeping'], ['Track your order', '/track']],
    Visit: [['Fuel & EV', '/#fuel-ev'], ['Bike repair', '/#bike-repair'], ['Restaurant', '/#restaurant']],
    Contact: [
      tel && [`Call ${contact.phone}`, tel],
      whatsapp && ['WhatsApp', whatsapp],
      contact.mapsUrl && ['Directions', contact.mapsUrl],
    ].filter(Boolean),
  };

  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-serif text-xl text-white">{identity.name}</p>
            <p className="text-xs text-white/30 font-sans mt-0.5">{identity.tagline}</p>
          </div>
          <p className="text-white/40 text-sm font-sans leading-relaxed">{identity.footerBlurb}</p>
        </div>

        {/* Link columns */}
        {Object.entries(links).map(([heading, items]) => (
          <div key={heading}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-5">{heading}</p>
            <ul className="space-y-2.5">
              {items.map(([item, href]) => (
                <li key={item}>
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} className="text-sm text-white/40 hover:text-white transition-colors font-sans">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/30 font-sans">
            © {new Date().getFullYear()} {identity.copyrightName}. All rights reserved.
          </p>
          <p className="font-serif italic text-gold/60 text-sm">{identity.footerNote}</p>
        </div>
      </div>
    </footer>
  );
}
