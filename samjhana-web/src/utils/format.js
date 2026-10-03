/** Money the Nepal way: Rs 1,50,000 (lakhs and crores), no decimals unless there are paisa. */
export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const hasPaisa = Math.abs(n - Math.round(n)) > 0.004;
  return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: hasPaisa ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "wood" → "Wood", "broodFrames" → "Brood frames". */
export function humanize(key) {
  const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export const STOCK_LABELS = {
  IN_STOCK: { text: 'In stock', tone: 'text-green-700' },
  LOW_STOCK: { text: 'Only a few left', tone: 'text-amber-700' },
  OUT_OF_STOCK: { text: 'Out of stock', tone: 'text-red-700' },
};
