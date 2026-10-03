import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MAX_PER_LINE = 50;

const recompute = (items) => ({
  count: items.reduce((s, i) => s + i.qty, 0),
  total: items.reduce((s, i) => (i.unavailable ? s : s + Number(i.price) * i.qty), 0),
});

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      open:  false,
      count: 0,
      total: 0,

      setOpen: (v) => set({ open: v }),

      addItem(product, qty = 1, openCart = true) {
        const items = get().items;
        const existing = items.find((i) => i.id === product.id);
        // Only what the cart shows is kept (never stock or cost); prices are re-read from the shop at checkout.
        const line = { id: product.id, name: product.name, price: Number(product.price), imageUrl: product.imageUrl || product.image || '' };
        const newItems = existing
          ? items.map((i) => i.id === product.id ? { ...i, qty: Math.min(MAX_PER_LINE, i.qty + qty) } : i)
          : [...items, { ...line, qty: Math.min(MAX_PER_LINE, qty) }];
        set({ items: newItems, ...(openCart && { open: true }), ...recompute(newItems) });
      },

      removeItem(id) {
        const newItems = get().items.filter((i) => i.id !== id);
        set({ items: newItems, ...recompute(newItems) });
      },

      updateQty(id, qty) {
        if (qty < 1) { get().removeItem(id); return; }
        const newItems = get().items.map((i) => i.id === id ? { ...i, qty: Math.min(MAX_PER_LINE, qty) } : i);
        set({ items: newItems, ...recompute(newItems) });
      },

      /** Brings names, prices and pictures up to date with the shop; a product no longer sold is marked unavailable. */
      syncProducts(products) {
        const byId = new Map(products.map((p) => [p.id, p]));
        const newItems = get().items.map((i) => {
          const p = byId.get(i.id);
          if (!p) return { ...i, unavailable: true };
          return { ...i, name: p.name, price: Number(p.price), imageUrl: p.image || '', unavailable: p.stockStatus === 'OUT_OF_STOCK' };
        });
        set({ items: newItems, ...recompute(newItems) });
      },

      clearCart() {
        set({ items: [], count: 0, total: 0 });
      },
    }),
    {
      name: 'mv-cart-v3',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state?.items) {
          const { count, total } = recompute(state.items);
          state.count = count;
          state.total = total;
        }
      },
    }
  )
);