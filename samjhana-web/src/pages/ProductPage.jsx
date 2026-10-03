import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader, Truck, Store, Wallet, Check } from 'lucide-react';
import { shopApi } from '../api/api.js';
import { useSection } from '../site/SiteContext';
import { useCartStore } from '../store/cartStore';
import Picture from '../components/ui/Picture';
import StockStatus from '../components/ui/StockStatus';
import ProductCard from '../components/ProductCard';
import { formatMoney, humanize } from '../utils/format';

const QUANTITIES = Array.from({ length: 10 }, (_, i) => i + 1);

/** Turns a product's free-form details (specs, what a kit includes, jar size...) into readable rows. */
function DetailRows({ details }) {
  const rows = [];
  const lists = [];
  Object.entries(details || {}).forEach(([key, value]) => {
    if (value === null || value === '' || key === 'originalPrice' || key === 'savings' || key === 'featured') return;
    if (Array.isArray(value)) lists.push([key, value]);
    else if (typeof value === 'object') Object.entries(value).forEach(([k, v]) => v !== '' && v !== null && rows.push([k, v]));
    else rows.push([key, value]);
  });
  if (rows.length === 0 && lists.length === 0) return null;
  return (
    <section className="mt-8" aria-label="Product details">
      <h2 className="mb-3 font-serif text-2xl text-dark">Details</h2>
      {rows.length > 0 && (
        <table className="w-full max-w-xl text-sm">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-warm-border">
                <th scope="row" className="w-2/5 py-2 pr-4 text-left font-medium text-dark/60">{humanize(k)}</th>
                <td className="py-2 text-dark">{String(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {lists.map(([k, items]) => (
        <div key={k} className="mt-4">
          <h3 className="mb-1 font-medium text-dark">{humanize(k)}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-dark/80">{items.map((item) => <li key={String(item)}>{String(item)}</li>)}</ul>
        </div>
      ))}
    </section>
  );
}

export default function ProductPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const shop = useSection('shop');
  const add = useCartStore((s) => s.add);
  const [product, setProduct] = useState(null);
  const [state, setState] = useState('loading');     // loading | ready | missing | error
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    setSelected(0);
    setQty(1);
    shopApi.product(slug)
      .then((p) => { if (!cancelled) { setProduct(p); setState('ready'); } })
      .catch((err) => { if (!cancelled) setState(err?.response?.status === 404 ? 'missing' : 'error'); });
    return () => { cancelled = true; };
  }, [slug, attempt]);

  if (state === 'loading') {
    return <div className="flex items-center justify-center gap-3 py-32 text-dark/40" role="status"><Loader size={20} className="animate-spin" /> Loading…</div>;
  }
  if (state === 'missing') {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-3xl text-dark">We can&apos;t find that product</h1>
        <p className="mt-2 text-dark/60">It may have been removed. Have a look at what we have.</p>
        <Link to="/shop" className="btn-dark mt-6">Back to the shop</Link>
      </main>
    );
  }
  if (state === 'error') {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center" role="alert">
        <p className="text-dark/70">We couldn&apos;t load this product.</p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="btn-dark mt-4">Try again</button>
      </main>
    );
  }

  const out = product.stockStatus === 'OUT_OF_STOCK';
  const images = product.images || [];
  const original = Number(product.details?.originalPrice);
  const saving = original > Number(product.price) ? original - Number(product.price) : 0;

  const addToCart = () => {
    add(product.id, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };
  const buyNow = () => { add(product.id, qty); navigate('/cart'); };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-dark/50">
        <Link to="/" className="hover:text-dark">Home</Link> › <Link to="/shop" className="hover:text-dark">Shop</Link> ›{' '}
        <Link to={`/shop?type=${product.type}`} className="hover:text-dark">{product.typeLabel}</Link> ›{' '}
        <Link to={`/shop?type=${product.type}&category=${product.category}`} className="hover:text-dark">{product.categoryLabel}</Link>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr_18rem]">
        <section aria-label="Pictures">
          <div className="aspect-square overflow-hidden rounded-xl border border-warm-border bg-white">
            <Picture src={images[selected]} alt={product.name} className="h-full w-full" fit="contain" />
          </div>
          {images.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <li key={src}>
                  <button type="button" onClick={() => setSelected(i)} aria-label={`Show picture ${i + 1}`} aria-current={i === selected ? 'true' : undefined}
                    className={`block h-16 w-16 overflow-hidden rounded-lg border-2 ${i === selected ? 'border-gold' : 'border-warm-border'}`}>
                    <Picture src={src} alt="" className="h-full w-full" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="About this product">
          {product.badge && <span className="mb-2 inline-block rounded bg-dark px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">{product.badge}</span>}
          <h1 className="font-serif text-3xl leading-tight text-dark">{product.name}</h1>
          {product.nameNepali && <p className="mt-1 text-dark/50">{product.nameNepali}</p>}
          <div className="mt-4 border-t border-warm-border pt-4">
            <p className="font-serif text-3xl text-dark">{formatMoney(product.price)}</p>
            {saving > 0 && <p className="mt-1 text-sm text-green-700">You save {formatMoney(saving)} <span className="text-dark/40 line-through">{formatMoney(original)}</span></p>}
            {product.details?.unit && <p className="text-sm text-dark/50">{product.details.unit}</p>}
          </div>
          {product.description && <p className="mt-4 leading-relaxed text-dark/80">{product.description}</p>}
          <DetailRows details={product.details} />
        </section>

        <aside aria-label="Buy" className="h-fit rounded-xl border border-warm-border bg-white p-5 lg:sticky lg:top-36">
          <p className="font-serif text-2xl text-dark">{formatMoney(product.price)}</p>
          <StockStatus status={product.stockStatus} className="mt-1 block text-base" />
          {!out && (
            <label className="mt-4 flex items-center gap-3 text-sm">
              <span className="text-dark/70">Quantity</span>
              <select value={qty} onChange={(e) => setQty(Number(e.target.value))} className="min-h-[44px] rounded border border-warm-border bg-warm px-3">
                {QUANTITIES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
          <button type="button" disabled={out} onClick={addToCart}
            className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-cta font-semibold text-dark hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-warm-soft disabled:text-dark/40">
            {added ? <><Check size={18} aria-hidden="true" /> Added to cart</> : out ? 'Out of stock' : 'Add to cart'}
          </button>
          {!out && (
            <button type="button" onClick={buyNow} className="mt-2 min-h-[48px] w-full rounded-full bg-dark font-semibold text-white hover:opacity-90">Buy now</button>
          )}
          {added && <Link to="/cart" className="mt-3 block text-center text-sm font-medium text-gold underline">View cart</Link>}

          <ul className="mt-5 space-y-3 border-t border-warm-border pt-4 text-sm text-dark/70">
            {shop.deliveryNote && <li className="flex gap-2"><Truck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{shop.deliveryNote}</li>}
            {shop.pickupNote && <li className="flex gap-2"><Store size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{shop.pickupNote}</li>}
            {shop.paymentNote && <li className="flex gap-2"><Wallet size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{shop.paymentNote}</li>}
          </ul>
        </aside>
      </div>

      {product.related?.length > 0 && (
        <section className="mt-14" aria-label="Related products">
          <h2 className="mb-4 font-serif text-2xl text-dark">More like this</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {product.related.slice(0, 4).map((p) => <li key={p.id}><ProductCard product={p} className="h-full" /></li>)}
          </ul>
        </section>
      )}
    </main>
  );
}
