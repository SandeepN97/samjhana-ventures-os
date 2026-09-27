import React from 'react';
import { STATUS_STYLES } from '../../brand/theme';

/** A rounded status pill. `tone` is success, warning, danger, info or neutral. */
export default function StatusBadge({ tone = 'neutral', className = '', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[tone] ?? STATUS_STYLES.neutral} ${className}`}>
      {children}
    </span>
  );
}
