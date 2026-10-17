import { useEffect, useState } from 'react';

const DESKTOP_QUERY = '(min-width: 1024px)';

const matches = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia(DESKTOP_QUERY).matches
  : false);

/**
 * True on a desktop-width screen (1024px and wider, Tailwind's `lg`). Phones and tablets get false,
 * so every desktop-only layout is left out of the page entirely there. Without matchMedia
 * (older browsers, tests) it is false, which keeps the phone layout.
 */
export default function useDesktop() {
  const [desktop, setDesktop] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}
