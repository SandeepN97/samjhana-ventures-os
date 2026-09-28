import { useState, useCallback } from 'react';

let _id = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);

  /**
   * Shows a toast. Toasts that share a `key` (e.g. one EV session) replace each other instead of
   * stacking, so "Payment confirmed — unlocking" is swapped for "Connector unlocked" rather than
   * both appearing at once.
   */
  const showToast = useCallback((message, type = 'info', duration = 2000, key = undefined) => {
    const id = ++_id;
    setToasts(prev => [
      ...(key === undefined ? prev : prev.filter(t => t.key !== key)),
      { id, message, type, duration, key },
    ]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}
