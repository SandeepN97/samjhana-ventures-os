import { Link, useNavigate } from 'react-router-dom';
import { Trash2, Loader, ShoppingBag } from 'lucide-react';
import useCartProducts from '../store/useCartProducts';
import { useCartStore } from '../store/cartStore';
import { useSection } from '../site/SiteContext';
import Picture from '../components/ui/Picture';
import StockStatus from '../components/ui/StockStatus';
import { formatMoney } from '../utils/format';

const QUANTITIES = Array.from({ length: 10 }, (_, i) => i + 1);

/** The delivery charge for an order, worked out the same way the shop does (the shop has the final say at checkout). */
export function deliveryFeeFor(subtotal, shop) {
  const fee = Number(shop.deliveryFee) || 0;
  const freeOver = Number(shop.freeDeliveryOver) || 0;
  if (fee <= 0) return 0;
  if (freeOver > 0 && subtotal >= freeOver) return 0;
  return fee;
}

export default function CartPage() {
  const navigate = useNavigate();
  const shop = useSection('shop');
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const { lines, subtotal, loading, error, blocked, retry } = useCartProducts();
  const itemCount = lines.reduce((n, l) => (l.product ? n + l.qty : n), 0);
  const fee = deliveryFeeFor(subtotal, shop);

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <ShoppingBag size={48} strokeWidth={1.2} className="mx-auto mb-4 text-dark/30" aria-hidden="true" />
        <h1 className="font-serif text-3xl text-dark">Your cart is empty</h1>
        <p className="mt-2 text-dark/60">Honey, hives and furniture are waiting.</p>
        <Link to="/shop" className="btn-dark mt-6">Start shopping</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-serif text-3xl text-dark">Your cart</h1>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-warm-border bg-white p-4 text-center">
          <p className="mb-3 text-dark/70">We couldn&apos;t check the latest prices. Please try again.</p>
          <button type="button" onClick={retry} className="btn-dark">Try again</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3" aria-label="Items in your cart">
          {loading && lines.every((l) => !l.product) ? (
            <li className="flex items-center justify-center gap-3 py-16 text-dark/40" role="status"><Loader size={20} className="animate-spin" /> Checking prices…</li>
          ) : lines.map((line) => {
            const p = line.product;
            const gone = !p;
            const out = p?.stockStatus === 'OUT_OF_STOCK';
            return (
              <li key={line.slug} className="flex gap-4 rounded-xl border border-warm-border bg-white p-4" data-testid="cart-line">
                <Link to={gone ? '/shop' : `/product/${p.id}`} className="block h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-warm-soft" aria-label={gone ? 'Back to the shop' : p.name}>
                  <Picture src={p?.image} alt="" className="h-full w-full" />
                </Link>
                <div className="min-w-0 flex-1">
                  {gone ? (
                    <p className="font-medium text-dark">This product is no longer available</p>
                  ) : (
                    <Link to={`/product/${p.id}`} className="font-medium text-dark hover:text-gold">{p.name}</Link>
                  )}
                  {p && <StockStatus status={p.stockStatus} className="mt-0.5 block" />}
                  {(gone || out) && <p role="alert" className="mt-1 text-sm text-red-700">Remove this to continue to checkout.</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    {p && !out && (
                      <label className="flex items-center gap-2 text-sm text-dark/70">
                        <span>Qty</span>
                        <select value={Math.min(line.qty, 10)} onChange={(e) => setQty(line.slug, Number(e.target.value))} aria-label={`Quantity of ${p.name}`}
                          className="min-h-[44px] rounded border border-warm-border bg-warm px-2">
                          {QUANTITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </label>
                    )}
                    <button type="button" onClick={() => remove(line.slug)} aria-label={`Remove ${p ? p.name : 'this product'} from the cart`}
                      className="flex min-h-[44px] items-center gap-1 rounded px-2 text-sm text-red-700 hover:bg-red-50"><Trash2 size={16} aria-hidden="true" /> Remove</button>
                  </div>
                </div>
                {p && !out && <p className="shrink-0 font-serif text-lg text-dark">{formatMoney(Number(p.price) * line.qty)}</p>}
              </li>
            );
          })}
        </ul>

        <aside aria-label="Order summary" className="h-fit rounded-xl border border-warm-border bg-white p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</dt><dd className="font-medium">{formatMoney(subtotal)}</dd></div>
            <div className="flex justify-between text-dark/60"><dt>Delivery</dt><dd>{fee > 0 ? `${formatMoney(fee)} (pickup is free)` : 'Free'}</dd></div>
          </dl>
          {Number(shop.freeDeliveryOver) > 0 && fee > 0 && (
            <p className="mt-2 text-xs text-green-700">Free delivery on orders over {formatMoney(shop.freeDeliveryOver)}.</p>
          )}
          <button type="button" disabled={loading || error || blocked || itemCount === 0} onClick={() => navigate('/checkout')}
            className="mt-5 min-h-[48px] w-full rounded-full bg-cta font-semibold text-dark hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-warm-soft disabled:text-dark/40">
            Proceed to checkout
          </button>
          {shop.paymentNote && <p className="mt-3 text-xs text-dark/50">{shop.paymentNote}</p>}
          <Link to="/shop" className="mt-4 block text-center text-sm text-gold underline">Keep shopping</Link>
        </aside>
      </div>
    </main>
  );
}
