import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal, X, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { shopApi } from '../api/api.js';
import { useSection } from '../site/SiteContext';
import ProductCard from '../components/ProductCard';
import { formatMoney } from '../utils/format';

const SORTS = [
  { value: '', label: 'Featured' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest first' },
  { value: 'name', label: 'Name: A to Z' },
];
const PAGE_SIZE = 24;

function pageWindow(page, totalPages) {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

/** The whole catalogue, Amazon-style: filters on the side, sort on top, a grid of products, pages at the bottom. */
export default function ShopPage() {
  const shop = useSection('shop');
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '');

  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const category = params.get('category') || '';
  const inStock = params.get('inStock') === '1';
  const sort = params.get('sort') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const appliedMin = params.get('minPrice') || '';
  const appliedMax = params.get('maxPrice') || '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const query = { page, size: PAGE_SIZE };
    if (q) query.q = q;
    if (type) query.type = type;
    if (category) query.category = category;
    if (appliedMin) query.minPrice = appliedMin;
    if (appliedMax) query.maxPrice = appliedMax;
    if (inStock) query.inStock = true;
    if (sort) query.sort = sort;
    shopApi.products(query)
      .then((result) => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, type, category, appliedMin, appliedMax, inStock, sort, page, attempt]);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === '' || value === null || value === undefined || value === false) next.delete(key);
      else next.set(key, value === true ? '1' : String(value));
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  const clearAll = () => {
    setMinPrice('');
    setMaxPrice('');
    setParams(q ? new URLSearchParams({ q }) : new URLSearchParams());
  };

  const facets = data?.facets;
  const typeLabel = facets?.types?.find((t) => t.value === type)?.label;
  const categoryLabel = facets?.categories?.find((c) => c.value === category && (!type || c.type === type))?.label;
  const hasFilters = Boolean(type || category || inStock || appliedMin || appliedMax);
  const heading = q ? `Results for “${q}”` : categoryLabel || typeLabel || shop.heading || 'Shop';
  const from = data && data.total > 0 ? (data.page - 1) * data.size + 1 : 0;
  const to = data ? Math.min(data.total, data.page * data.size) : 0;
  const categories = useMemo(() => (facets?.categories || []).filter((c) => !type || c.type === type), [facets, type]);

  const filterPanel = (
    <div className="space-y-6 text-sm">
      {facets?.types?.length > 0 && (
        <section aria-label="Department">
          <h2 className="mb-2 font-semibold text-dark">Department</h2>
          <ul className="space-y-1">
            <li><button type="button" onClick={() => update({ type: '', category: '' })} aria-pressed={!type} className={`min-h-[36px] ${!type ? 'font-semibold text-gold' : 'text-dark/70 hover:text-dark'}`}>All departments</button></li>
            {facets.types.map((t) => (
              <li key={t.value}>
                <button type="button" onClick={() => update({ type: t.value, category: '' })} aria-pressed={type === t.value}
                  className={`min-h-[36px] text-left ${type === t.value ? 'font-semibold text-gold' : 'text-dark/70 hover:text-dark'}`}>
                  {t.label} <span className="text-dark/40">({t.count})</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {categories.length > 0 && (
        <section aria-label="Category">
          <h2 className="mb-2 font-semibold text-dark">Category</h2>
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={`${c.type}-${c.value}`}>
                <button type="button" onClick={() => update({ type: c.type, category: category === c.value ? '' : c.value })} aria-pressed={category === c.value}
                  className={`min-h-[36px] text-left ${category === c.value ? 'font-semibold text-gold' : 'text-dark/70 hover:text-dark'}`}>
                  {c.label} <span className="text-dark/40">({c.count})</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Price">
        <h2 className="mb-2 font-semibold text-dark">Price</h2>
        <form onSubmit={(e) => { e.preventDefault(); update({ minPrice, maxPrice }); }} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="min-price" className="sr-only">Minimum price</label>
            <input id="min-price" type="number" min="0" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value)}
              className="min-h-[44px] w-full rounded border border-warm-border bg-white px-2" />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor="max-price" className="sr-only">Maximum price</label>
            <input id="max-price" type="number" min="0" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}
              className="min-h-[44px] w-full rounded border border-warm-border bg-white px-2" />
          </div>
          <button type="submit" className="min-h-[44px] rounded border border-dark px-3 font-medium hover:bg-dark hover:text-white">Go</button>
        </form>
        {facets?.price?.min != null && <p className="mt-1 text-xs text-dark/40">{formatMoney(facets.price.min)} to {formatMoney(facets.price.max)}</p>}
      </section>

      <section aria-label="Availability">
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked })} className="h-5 w-5" />
          In stock only
        </label>
      </section>

      {hasFilters && <button type="button" onClick={clearAll} className="min-h-[44px] text-sm font-medium text-gold underline">Clear all filters</button>}
    </div>
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-dark/50">
        <Link to="/" className="hover:text-dark">Home</Link> › <Link to="/shop" className="hover:text-dark">Shop</Link>
        {typeLabel && <> › <span className="text-dark/80">{typeLabel}</span></>}
      </nav>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-dark">{heading}</h1>
          {!q && !hasFilters && shop.intro && <p className="mt-1 max-w-2xl text-sm text-dark/60">{shop.intro}</p>}
          {data && !loading && (
            <p className="mt-1 text-sm text-dark/60" aria-live="polite">
              {data.total === 0 ? 'No results' : `${from}–${to} of ${data.total} ${data.total === 1 ? 'result' : 'results'}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}
            className="flex min-h-[44px] items-center gap-2 rounded border border-warm-border bg-white px-3 text-sm font-medium lg:hidden">
            <SlidersHorizontal size={16} aria-hidden="true" /> Filters
          </button>
          <label className="flex items-center gap-2 text-sm text-dark/70">
            <span>Sort by</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value })} className="min-h-[44px] rounded border border-warm-border bg-white px-2 text-dark">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      {hasFilters && (
        <ul className="mb-4 flex flex-wrap gap-2" aria-label="Active filters">
          {[type && { key: 'type', label: typeLabel || type }, category && { key: 'category', label: categoryLabel || category },
            appliedMin && { key: 'minPrice', label: `From ${formatMoney(appliedMin)}` }, appliedMax && { key: 'maxPrice', label: `Up to ${formatMoney(appliedMax)}` },
            inStock && { key: 'inStock', label: 'In stock only' }].filter(Boolean).map((chip) => (
            <li key={chip.key}>
              <button type="button" onClick={() => { if (chip.key === 'minPrice') setMinPrice(''); if (chip.key === 'maxPrice') setMaxPrice(''); update({ [chip.key]: '' }); }}
                aria-label={`Remove filter ${chip.label}`} className="flex min-h-[36px] items-center gap-1 rounded-full border border-warm-border bg-white px-3 text-sm">
                {chip.label} <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-8 lg:grid-cols-[14rem_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} rounded-xl border border-warm-border bg-white p-4 lg:block lg:border-0 lg:bg-transparent lg:p-0`} aria-label="Filters">
          {filterPanel}
        </aside>

        <div className="min-w-0">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-3 py-24 text-dark/40" role="status"><Loader size={20} className="animate-spin" /> Loading products…</div>
          ) : error ? (
            <div role="alert" className="rounded-xl border border-warm-border bg-white p-8 text-center">
              <p className="mb-4 text-dark/70">We couldn&apos;t load the products. Please try again.</p>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-dark">Try again</button>
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-xl border border-warm-border bg-white p-10 text-center">
              <p className="font-serif text-xl text-dark/60">Nothing matches that.</p>
              <p className="mt-1 text-sm text-dark/50">Try fewer filters or a different word.</p>
              {(hasFilters || q) && <button type="button" onClick={() => { clearAll(); setParams(new URLSearchParams()); }} className="btn-outline mt-4">See all products</button>}
            </div>
          ) : (
            <>
              <ul className={`grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
                {data.items.map((p) => <li key={p.id}><ProductCard product={p} className="h-full" /></li>)}
              </ul>

              {data.totalPages > 1 && (
                <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-1">
                  <button type="button" disabled={data.page <= 1} onClick={() => update({ page: data.page - 1 })} aria-label="Previous page"
                    className="flex h-11 w-11 items-center justify-center rounded border border-warm-border bg-white disabled:opacity-40"><ChevronLeft size={18} /></button>
                  {pageWindow(data.page, data.totalPages).map((p, i, all) => (
                    <span key={p} className="flex items-center gap-1">
                      {i > 0 && p - all[i - 1] > 1 && <span className="px-1 text-dark/40">…</span>}
                      <button type="button" onClick={() => update({ page: p })} aria-current={p === data.page ? 'page' : undefined}
                        className={`h-11 min-w-[2.75rem] rounded border px-3 text-sm ${p === data.page ? 'border-dark bg-dark text-white' : 'border-warm-border bg-white'}`}>{p}</button>
                    </span>
                  ))}
                  <button type="button" disabled={data.page >= data.totalPages} onClick={() => update({ page: data.page + 1 })} aria-label="Next page"
                    className="flex h-11 w-11 items-center justify-center rounded border border-warm-border bg-white disabled:opacity-40"><ChevronRight size={18} /></button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
