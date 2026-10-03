import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Check } from 'lucide-react';
import Picture from './ui/Picture';
import StockStatus from './ui/StockStatus';
import { useCartStore } from '../store/cartStore';
import { formatMoney } from '../utils/format';

/** One product in a grid: picture, name, price, stock status and an Add to cart button. */
export default function ProductCard({ product, className = '' }) {
  const add = useCartStore((s) => s.add);
  const [added, setAdded] = useState(false);
  const out = product.stockStatus === 'OUT_OF_STOCK';

  const handleAdd = () => {
    add(product.id, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <article className={`flex flex-col overflow-hidden rounded-xl border border-warm-border bg-white ${className}`} data-testid="product-card">
      <Link to={`/product/${product.id}`} className="relative block aspect-square bg-warm-soft" aria-label={product.name}>
        <Picture src={product.image} alt="" className="h-full w-full" />
        {product.badge && (
          <span className="absolute left-2 top-2 rounded bg-dark px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">{product.badge}</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <Link to={`/product/${product.id}`} className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-snug text-dark hover:text-gold">
          {product.name}
        </Link>
        {product.nameNepali && <p className="line-clamp-1 text-xs text-dark/50">{product.nameNepali}</p>}
        <p className="font-serif text-xl text-dark">{formatMoney(product.price)}</p>
        <StockStatus status={product.stockStatus} />
        <button
          type="button"
          onClick={handleAdd}
          disabled={out}
          className="mt-auto flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-cta px-4 text-sm font-semibold text-dark transition-colors hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-warm-soft disabled:text-dark/40"
        >
          {added ? <><Check size={16} aria-hidden="true" /> Added</> : <><ShoppingCart size={16} aria-hidden="true" /> {out ? 'Out of stock' : 'Add to cart'}</>}
        </button>
      </div>
    </article>
  );
}
