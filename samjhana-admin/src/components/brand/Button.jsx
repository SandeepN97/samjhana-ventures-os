import React from 'react';
import { unitTheme } from '../../brand/theme';

const VARIANTS = {
  secondary: 'bg-white text-gray-800 border-2 border-gray-200 hover:bg-gray-50 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400',
};

/**
 * The admin's standard button: at least 44px tall for touch. `primary` takes the
 * business colour from `unit`; `secondary` and `danger` look the same everywhere.
 */
export default function Button({
  unit = 'core',
  variant = 'primary',
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  const colours = variant === 'primary' ? `${unitTheme(unit).button} text-white` : VARIANTS[variant];
  return (
    <button
      type={type}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${colours} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
