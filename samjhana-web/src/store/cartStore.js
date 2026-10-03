import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MAX_PER_LINE = 50;

const count = (items) => items.reduce((sum, i) => sum + i.qty, 0);
const clamp = (qty) => Math.max(1, Math.min(MAX_PER_LINE, Math.floor(Number(qty)) || 1));

/**
 * The shopping cart: only which products and how many. Names, prices, pictures and stock are always read
 * fresh from the shop, so a price changed in the admin is never out of date in somebody's cart.
 */
export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      count: 0,
      lastAdded: null,

      add(slug, qty = 1) {
        const items = get().items;
        const existing = items.find((i) => i.slug === slug);
        const next = existing
          ? items.map((i) => (i.slug === slug ? { ...i, qty: clamp(i.qty + qty) } : i))
          : [...items, { slug, qty: clamp(qty) }];
        set({ items: next, count: count(next), lastAdded: { slug, at: Date.now() } });
      },

      setQty(slug, qty) {
        const next = get().items.map((i) => (i.slug === slug ? { ...i, qty: clamp(qty) } : i));
        set({ items: next, count: count(next) });
      },

      remove(slug) {
        const next = get().items.filter((i) => i.slug !== slug);
        set({ items: next, count: count(next) });
      },

      clear() {
        set({ items: [], count: 0, lastAdded: null });
      },

      dismissAdded() {
        set({ lastAdded: null });
      },
    }),
    {
      name: 'mv-cart-v2',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) state.count = count(state.items || []);
      },
    },
  ),
);
