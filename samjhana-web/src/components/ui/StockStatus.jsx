import { STOCK_LABELS } from '../../utils/format';

/** In stock / Only a few left / Out of stock. The shop only ever tells customers a status, never the real count. */
export default function StockStatus({ status, className = '' }) {
  const label = STOCK_LABELS[status];
  if (!label) return null;
  return <span className={`text-sm font-medium ${label.tone} ${className}`}>{label.text}</span>;
}
