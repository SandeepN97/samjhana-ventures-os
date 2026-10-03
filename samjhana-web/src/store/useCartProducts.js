import { useEffect, useMemo, useState } from 'react';
import { shopApi } from '../api/api.js';
import { useCartStore } from './cartStore';

/**
 * The cart's lines joined with the shop's current product data. A product that is no longer sold comes back
 * as `product: null`; the totals leave those out, so the cart never charges for something that is gone.
 */
export default function useCartProducts() {
  const items = useCartStore((s) => s.items);
  const slugKey = items.map((i) => i.slug).sort().join(',');
  const [products, setProducts] = useState({});
  const [loading, setLoading] = useState(items.length > 0);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!slugKey) {
      setProducts({});
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    shopApi.products({ slugs: slugKey, size: 60 })
      .then((data) => {
        if (cancelled) return;
        setProducts(Object.fromEntries((data.items || []).map((p) => [p.id, p])));
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slugKey, attempt]);

  const lines = useMemo(() => items.map((i) => ({ ...i, product: products[i.slug] || null })), [items, products]);
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => (l.product && l.product.stockStatus !== 'OUT_OF_STOCK' ? sum + Number(l.product.price) * l.qty : sum), 0),
    [lines],
  );
  const blocked = lines.some((l) => !loading && !error && (!l.product || l.product.stockStatus === 'OUT_OF_STOCK'));

  return { lines, subtotal, loading, error, blocked, retry: () => setAttempt((n) => n + 1) };
}
