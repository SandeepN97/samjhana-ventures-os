import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const recompute = (items) => ({
  count: items.reduce((s, i) => s + i.qty, 0),
  total: items.reduce((s, i) => s + Number(i.price) * i.qty, 0),
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
        const newItems = existing
          ? items.map((i) => i.id === product.id ? { ...i, qty: i.qty + qty } : i)
          : [...items, { ...product, price: Number(product.price), qty }];
        set({ items: newItems, ...(openCart && { open: true }), ...recompute(newItems) });
      },

      removeItem(id) {
        const newItems = get().items.filter((i) => i.id !== id);
        set({ items: newItems, ...recompute(newItems) });
      },

      updateQty(id, qty) {
        if (qty < 1) { get().removeItem(id); return; }
        const newItems = get().items.map((i) => i.id === id ? { ...i, qty } : i);
        set({ items: newItems, ...recompute(newItems) });
      },

      clearCart() {
        set({ items: [], count: 0, total: 0 });
      },
    }),
    {
      name: 'mv-cart',
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