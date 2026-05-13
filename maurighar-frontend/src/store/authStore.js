import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set) => ({
      customer: null,
      token: null,
      login:  (customer, token) => set({ customer, token }),
      logout: () => set({ customer: null, token: null }),
    }),
    { name: 'mv-auth' }
  )
);