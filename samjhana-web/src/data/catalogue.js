import { useEffect, useState } from 'react';
import { shopApi } from '../api/api.js';

const cache = new Map();

/** Every product of one kind (all pages of the public catalogue), kept for the visit so pages open instantly. */
async function loadAll(type) {
  const items = [];
  for (let page = 1; page <= 10; page += 1) {
    const data = await shopApi.products({ type, page, size: 60 });
    items.push(...(data.items || []));
    if (page >= (data.totalPages || 1)) break;
  }
  return items;
}

export function forgetCatalogue() {
  cache.clear();
}

/** {items, loading, error, retry} for the products of a type ('FURNITURE' or 'BEEKEEPING'). */
export function useCatalogue(type) {
  const [state, setState] = useState(() => ({ items: cache.get(type) || [], loading: !cache.has(type), error: false }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(type) && attempt === 0) return undefined;
    setState((s) => ({ ...s, loading: true, error: false }));
    loadAll(type)
      .then((items) => {
        cache.set(type, items);
        if (!cancelled) setState({ items, loading: false, error: false });
      })
      .catch(() => { if (!cancelled) setState({ items: [], loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [type, attempt]);

  return { ...state, retry: () => { cache.delete(type); setAttempt((n) => n + 1); } };
}

const inStock = (p) => p.stockStatus !== 'OUT_OF_STOCK';

/** A furniture product in the shape the furniture pages use. Only a status is public, never a count. */
export function toFurniture(p) {
  return {
    ...p,
    price: Number(p.price),
    sellingPrice: Number(p.price),
    inStock: inStock(p),
    lowStock: p.stockStatus === 'LOW_STOCK',
    imageUrl: p.image || '',
  };
}

const BADGE_COLORS = { Traditional: 'green', 'Raw · Unfiltered': 'raw' };

/** A beekeeping product in the shape the Maurighar page uses (details carry specs, kit contents, honey unit...). */
export function toBee(p) {
  const d = p.details || {};
  return {
    id: p.id,
    name: p.name,
    nepali: p.nameNepali,
    description: p.description || '',
    price: Number(p.price),
    badge: p.badge || undefined,
    badgeColor: d.badgeColor || BADGE_COLORS[p.badge] || 'amber',
    bgColor: d.bgColor || '#E8A400',
    inStock: inStock(p),
    image: p.image || '',
    type: d.type,
    specs: d.specs || {},
    unit: d.unit,
    category: d.category,
    level: d.level,
    featured: Boolean(d.featured),
    includes: Array.isArray(d.includes) ? d.includes : [],
    originalPrice: d.originalPrice,
    savings: d.savings,
    imageUrl: p.image || '',
  };
}

/** The Maurighar products sorted into the sections of the page. */
export function groupBee(unsorted) {
  // Shown in product-code order (hive-001, hive-002 ...), the way the page was laid out; new products follow.
  const items = [...unsorted].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const bee = items.map(toBee);
  const byCat = (c) => items.map((p, i) => (p.category === c ? bee[i] : null)).filter(Boolean);
  const tools = byCat('TOOL');
  return {
    all: bee,
    hives: byCat('HIVE'),
    protectiveGear: byCat('GEAR'),
    tools,
    honeyProducts: byCat('HONEY'),
    starterKits: byCat('KIT'),
    queenDevices: tools.filter((t) => t.category === 'queen'),
    waxAndFrames: bee.filter((b) => /wax|foundation|frame/i.test(b.name)),
    smokers: bee.filter((b) => /smoker/i.test(b.name)),
  };
}
