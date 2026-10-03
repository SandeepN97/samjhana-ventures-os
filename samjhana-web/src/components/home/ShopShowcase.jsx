import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader } from 'lucide-react';
import { shopApi } from '../../api/api.js';
import { useSection } from '../../site/SiteContext';
import ProductCard from '../ProductCard';
import CustomOrderCard from '../CustomOrderCard';

/** A taste of the shop on the home page: the first products, with tabs for each department. */
export default function ShopShowcase() {
  const shop = useSection('shop');
  const [type, setType] = useState('');
  const [data, setData] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    shopApi.products({ type: type || undefined, size: 8 })
      .then((result) => {
        if (cancelled) return;
        setData(result);
        if (!type) setDepartments(result.facets?.types || []);
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('error'); });
    return () => { cancelled = true; };
  }, [type, attempt]);

  return (
    <section id="shop" className="bg-warm py-20" aria-labelledby="shop-heading">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="section-label">{shop.heading ? 'Shop' : ''}</p>
            <h2 id="shop-heading" className="font-serif text-4xl text-dark lg:text-5xl">{shop.heading || 'Shop'}</h2>
            {shop.intro && <p className="mt-2 max-w-2xl text-dark/60">{shop.intro}</p>}
          </div>
          <Link to="/shop" className="flex items-center gap-1 text-sm font-medium text-gold hover:underline">All products <ArrowRight size={14} /></Link>
        </div>

        {departments.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Departments">
            <button type="button" role="tab" aria-selected={!type} onClick={() => setType('')} className={`pill ${!type ? 'pill-active' : 'pill-inactive'}`}>All</button>
            {departments.map((d) => (
              <button type="button" role="tab" key={d.value} aria-selected={type === d.value} onClick={() => setType(d.value)} className={`pill ${type === d.value ? 'pill-active' : 'pill-inactive'}`}>{d.label}</button>
            ))}
          </div>
        )}

        {state === 'loading' && !data ? (
          <div className="flex items-center justify-center gap-3 py-20 text-dark/40" role="status"><Loader size={20} className="animate-spin" /> Loading the shop…</div>
        ) : state === 'error' ? (
          <div role="alert" className="py-12 text-center">
            <p className="text-dark/60">The shop couldn&apos;t be loaded just now.</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-outline mt-4">Try again</button>
          </div>
        ) : data.items.length === 0 ? (
          <p className="py-12 text-center font-serif text-xl text-dark/40">Products are coming soon.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {data.items.map((p) => <li key={p.id}><ProductCard product={p} className="h-full" /></li>)}
          </ul>
        )}

        <CustomOrderCard />
      </div>
    </section>
  );
}
