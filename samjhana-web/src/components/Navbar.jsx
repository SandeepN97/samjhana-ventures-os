import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ShoppingCart, MessageCircle, MapPin, Phone } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useSection } from '../site/SiteContext';
import { telLink, whatsappLink } from '../site/links';

const NAV_LINKS = [
  { label: 'Visit & services', href: '/#fuel-ev', isHash: true },
  { label: 'Shop & order', href: '/shop', isLink: true },
  { label: 'About', href: '/#about', isHash: true },
  { label: 'Contact', href: '/#contact', isHash: true },
];

function HashLink({ href, children, className, onClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hash = href.replace('/#', '');

  function handleClick(e) {
    e.preventDefault();
    if (location.pathname === '/') {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 120);
    }
    onClick?.();
  }

  return <a href={href} onClick={handleClick} className={className}>{children}</a>;
}

function GridMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="0"  y="0"  width="12" height="12" rx="2" fill="#8B6914" />
      <rect x="16" y="0"  width="12" height="12" rx="2" fill="#8B6914" opacity=".5" />
      <rect x="0"  y="16" width="12" height="12" rx="2" fill="#8B6914" opacity=".5" />
      <rect x="16" y="16" width="12" height="12" rx="2" fill="#8B6914" />
    </svg>
  );
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { count, setOpen: openCart } = useCartStore();
  const identity = useSection('identity');
  const contact = useSection('contact');
  const tel = telLink(contact);
  const whatsapp = whatsappLink(contact);

  return (
    <header className="site-navbar fixed top-0 inset-x-0 z-50 bg-warm/95 backdrop-blur-sm border-b border-warm-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <GridMark />
          <div className="leading-tight">
            <p className="font-serif font-semibold text-dark text-base leading-none">{identity.name}</p>
            <p className="text-[11px] text-dark/50 font-sans mt-0.5">{identity.tagline}</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((l) =>
            l.isLink ? (
              <Link key={l.href} to={l.href}
                className="px-3.5 py-2 text-sm font-medium text-dark/70 hover:text-dark rounded transition-colors hover:bg-warm-soft">
                {l.label}
              </Link>
            ) : (
              <HashLink key={l.href} href={l.href}
                className="px-3.5 py-2 text-sm font-medium text-dark/70 hover:text-dark rounded transition-colors hover:bg-warm-soft">
                {l.label}
              </HashLink>
            )
          )}
        </nav>

        {/* Cart + CTA */}
        <div className="hidden md:flex items-center gap-3">
          <span className="hidden lg:flex items-center gap-2 text-xs text-dark/55"><span>EN</span><span className="text-dark/20">|</span><span>नेपाली</span></span>
          {tel && <a href={tel} aria-label={`Call ${identity.name || ''}`} className="hidden lg:inline-flex p-2 text-dark/60 hover:text-dark"><Phone size={17} /></a>}
          {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${identity.name || ''}`} className="hidden lg:inline-flex p-2 text-dark/60 hover:text-dark"><MessageCircle size={17} /></a>}
          {contact.mapsUrl && <a href={contact.mapsUrl} target="_blank" rel="noreferrer" aria-label="Get directions" className="hidden lg:inline-flex p-2 text-dark/60 hover:text-dark"><MapPin size={17} /></a>}
          <button aria-label="Open cart" onClick={() => openCart(true)} className="relative p-2 text-dark/60 hover:text-dark transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
          <HashLink href="/#contact" className="btn-dark text-sm">Talk to us</HashLink>
        </div>

        {/* Mobile: cart + menu */}
        <div className="md:hidden flex items-center">
          <button aria-label="Open cart" onClick={() => openCart(true)} className="relative min-h-[44px] min-w-[44px] flex items-center justify-center text-dark">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute top-1 right-0.5 w-4 h-4 bg-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center">{count}</span>
            )}
          </button>
          <button aria-label="Menu" onClick={() => setOpen(!open)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-dark">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-warm border-t border-warm-border px-6 py-4 space-y-1">
          {NAV_LINKS.map((l) =>
            l.isLink ? (
              <Link key={l.href} to={l.href} onClick={() => setOpen(false)}
                className="block py-2.5 text-sm font-medium text-dark/80 hover:text-dark border-b border-warm-border/50">
                {l.label}
              </Link>
            ) : (
              <HashLink key={l.href} href={l.href} onClick={() => setOpen(false)}
                className="block py-2.5 text-sm font-medium text-dark/80 hover:text-dark border-b border-warm-border/50">
                {l.label}
              </HashLink>
            )
          )}
          <HashLink href="/#contact" onClick={() => setOpen(false)} className="btn-dark mt-3 w-full justify-center">Call or WhatsApp</HashLink>
        </div>
      )}
    </header>
  );
}
