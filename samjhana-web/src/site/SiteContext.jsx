import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { siteApi } from '../api/api.js';

const CACHE_KEY = 'mv-site-cache';
const SiteContext = createContext({ site: null, loading: true, error: false, retry: () => {} });

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeCache(site) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(site));
  } catch {
    // private window or full storage: the site simply works without a saved copy
  }
}

/**
 * Loads the website's text and picture choices from the backend once. The last good copy is kept in this
 * browser, so if the server is asleep or unreachable the site still shows its content instead of going blank.
 * Pass {@code initial} (tests, previews) to skip the request.
 */
export function SiteProvider({ children, initial = null }) {
  const [site, setSite] = useState(initial || readCache());
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    siteApi.get()
      .then((data) => { setSite(data); writeCache(data); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (!initial) load(); }, [initial, load]);

  const value = useMemo(() => ({ site, loading, error: error && !site, stale: error && !!site, retry: load }), [site, loading, error, load]);
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  return useContext(SiteContext);
}

/** One section of the site's content (an empty object until it has loaded). */
export function useSection(key) {
  const { site } = useSite();
  return (site && site[key]) || {};
}
