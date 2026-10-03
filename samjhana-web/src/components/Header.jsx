import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, ShoppingCart, PackageSearch, Phone } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useSection } from '../site/SiteContext';
import { shopApi } from '../api/api.js';
import SmartLink from './ui/SmartLink';
import { telLink } from '../site/links';

function GridMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="0" y="0" width="12" height="12" rx="2" fill="#c4a45a" />
      <rect x="16" y="0" width="12" height="12" rx="2" fill="#c4a45a" opacity=".55" />
      <rect x="0" y="16" width="12" height="12" rx="2" fill="#c4a45a" opacity=".55" />
      <rect x="16" y="16" width="12" height="12" rx="2" fill="#c4a45a" />
    </svg>
  );
}

/** The top of every page: name, search, order tracking, cart, and a strip of departments and services. */
export default function Header() {
  const identity = useSection('identity');
  const contact = useSection('contact');
  const hub = useSection('hub');
  const count = useCartStore((s) => s.count);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') || '');
  const [type, setType] = useState('');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    shopApi.products({ size: 1 })
      .then((data) => setDepartments(data.facets?.types || []))
      .catch(() => setDepartments([]));
  }, []);

  const submit = (event) => {
    event.preventDefault();
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query.trim());
    if (type) next.set('type', type);
    navigate(`/shop${next.toString() ? `?${next}` : ''}`);
  };

  const tel = telLink(contact);

  return (
    <header className="sticky top-0 z-50 text-white shadow-md">
      <div className="bg-dark">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={identity.name || 'Home'}>
            <GridMark />
            <span className="leading-tight">
              <span className="block font-serif text-base font-semibold">{identity.name}</span>
              <span className="block text-[11px] text-white/60">{identity.tagline}</span>
            </span>
          </Link>

          <form onSubmit={submit} role="search" className="order-last flex w-full min-w-0 overflow-hidden rounded-lg bg-white md:order-none md:w-auto md:flex-1" aria-label="Search the shop">
            <label className="sr-only" htmlFor="header-department">Department</label>
            <select id="header-department" value={type} onChange={(e) => setType(e.target.value)}
              className="max-w-[7.5rem] shrink-0 border-r border-warm-border bg-warm px-2 text-xs text-dark focus:outline-none sm:max-w-none sm:text-sm">
              <option value="">All</option>
              {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <label className="sr-only" htmlFor="header-search">Search products</label>
            <input id="header-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search honey, hives, furniture…"
              className="min-h-[44px] min-w-0 flex-1 px-3 text-sm text-dark placeholder:text-dark/40 focus:outline-none" />
            <button type="submit" aria-label="Search" className="flex w-12 shrink-0 items-center justify-center bg-cta text-dark hover:bg-cta-hover">
              <Search size={20} aria-hidden="true" />
            </button>
          </form>

          <nav aria-label="Account" className="ml-auto flex items-center gap-1 md:ml-0">
            {tel && (
              <a href={tel} aria-label={`Call ${contact.phone}`} className="hidden min-h-[44px] items-center gap-2 rounded px-3 text-sm text-white/80 hover:text-white lg:flex">
                <Phone size={18} aria-hidden="true" /> {contact.phone}
              </a>
            )}
            <Link to="/track" className="flex min-h-[44px] items-center gap-2 rounded px-3 text-sm text-white/80 hover:text-white">
              <PackageSearch size={20} aria-hidden="true" /> <span className="hidden sm:inline">Track order</span>
            </Link>
            <Link to="/cart" aria-label={`Cart, ${count} ${count === 1 ? 'item' : 'items'}`} className="relative flex min-h-[44px] items-center gap-2 rounded px-3 hover:text-cta">
              <ShoppingCart size={24} aria-hidden="true" />
              <span className="hidden text-sm font-medium sm:inline">Cart</span>
              {count > 0 && (
                <span className="absolute right-0 top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cta px-1 text-[11px] font-bold text-dark" data-testid="cart-count">{count}</span>
              )}
            </Link>
          </nav>
        </div>
      </div>

      <nav aria-label="Departments and services" className="bg-dark-soft">
        <ul className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 text-sm [scrollbar-width:none]">
          <li><Link to="/shop" className="flex min-h-[44px] items-center whitespace-nowrap rounded px-3 font-medium hover:bg-white/10">All products</Link></li>
          {departments.map((d) => (
            <li key={d.value}><Link to={`/shop?type=${d.value}`} className="flex min-h-[44px] items-center whitespace-nowrap rounded px-3 hover:bg-white/10">{d.label}</Link></li>
          ))}
          {(hub.visit?.services || []).map((s) => (
            <li key={`${s.label}-${s.href}`}><SmartLink href={s.href} className="flex min-h-[44px] items-center whitespace-nowrap rounded px-3 text-white/70 hover:bg-white/10 hover:text-white">{s.label}</SmartLink></li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
