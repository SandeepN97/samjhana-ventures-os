/** Money the Nepal way: Rs 1,50,000 (lakhs and crores), no decimals unless there are paisa. */
export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const hasPaisa = Math.abs(n - Math.round(n)) > 0.004;
  return `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: hasPaisa ? 2 : 0, maximumFractionDigits: 2 })}`;
}
