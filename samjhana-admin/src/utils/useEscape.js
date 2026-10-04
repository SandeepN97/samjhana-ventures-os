import { useEffect } from 'react';

/** Calls `onEscape` when the Escape key is pressed while `active` (a window is open), so it can be closed from the keyboard. */
export default function useEscape(onEscape, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const handler = (e) => { if (e.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, active]);
}
