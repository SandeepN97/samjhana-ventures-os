import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

const NAV_LINKS = [
  { label: 'Furniture',   href: '/furniture',   isLink: true },
  { label: 'Mauri Ghar',  href: '/beekeeping',  isLink: true },
  { label: 'Fuel & EV',   href: '/#fuel-ev' },
  { label: 'Bike repair', href: '/#bike-repair' },
  { label: 'Restaurant',  href: '/#restaurant' },
];

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

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-warm/95 backdrop-blur-sm border-b border-warm-border">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <GridMark />
          <div className="leading-tight">
            <p className="font-serif font-semibold text-dark text-base leading-none">Samjhana Ventures</p>
            <p className="text-[11px] text-dark/50 font-sans mt-0.5">Gulmi, Nepal · Est. 2008</p>
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
              <a key={l.href} href={l.href}
                className="px-3.5 py-2 text-sm font-medium text-dark/70 hover:text-dark rounded transition-colors hover:bg-warm-soft">
                {l.label}
              </a>
            )
          )}
        </nav>

        {/* Cart + CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => openCart(true)} className="relative p-2 text-dark/60 hover:text-dark transition-colors">
            <ShoppingCart size={20} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
          <a href="#restaurant" className="btn-dark text-sm">View menu</a>
        </div>

        {/* Mobile toggle */}
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-dark">
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
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
              <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                className="block py-2.5 text-sm font-medium text-dark/80 hover:text-dark border-b border-warm-border/50">
                {l.label}
              </a>
            )
          )}
          <a href="#restaurant" onClick={() => setOpen(false)} className="btn-dark mt-3 w-full justify-center">View menu</a>
        </div>
      )}
    </header>
  );
}