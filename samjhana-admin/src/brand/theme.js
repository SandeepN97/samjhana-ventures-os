/**
 * One theme per area of the admin. Class strings are written out in full so Tailwind
 * can see them at build time; never build them with string templates.
 *
 * core      Samjhana itself: login, dashboard, records, reports, analytics, daily close,
 *           pending review, settings, staff
 * petrol    Shringeshwor petrol pump
 * ev        EV charging
 * furniture Furniture shop
 * beekeeping Beekeeping shop
 * rental    House rentals
 * loans     Bank loans
 */
export const UNIT_THEMES = {
  core: {
    header: 'bg-core-800',
    headerHover: 'hover:bg-core-700',
    headerSubtle: 'text-core-300',
    button: 'bg-core-800 hover:bg-core-700 focus-visible:ring-core-500',
    soft: 'bg-core-100 text-core-800',
    text: 'text-core-700',
    border: 'border-core-700',
    tile: 'bg-core-700 hover:bg-core-800',
  },
  petrol: {
    header: 'bg-petrol-600',
    headerHover: 'hover:bg-petrol-700',
    headerSubtle: 'text-petrol-100',
    button: 'bg-petrol-600 hover:bg-petrol-700 focus-visible:ring-petrol-400',
    soft: 'bg-petrol-50 text-petrol-800',
    text: 'text-petrol-700',
    border: 'border-petrol-600',
    tile: 'bg-petrol-500 hover:bg-petrol-600',
  },
  ev: {
    header: 'bg-ev-600',
    headerHover: 'hover:bg-ev-700',
    headerSubtle: 'text-ev-100',
    button: 'bg-ev-600 hover:bg-ev-700 focus-visible:ring-ev-400',
    soft: 'bg-ev-50 text-ev-800',
    text: 'text-ev-700',
    border: 'border-ev-600',
    tile: 'bg-ev-500 hover:bg-ev-600',
  },
  furniture: {
    header: 'bg-furniture-600',
    headerHover: 'hover:bg-furniture-700',
    headerSubtle: 'text-furniture-100',
    button: 'bg-furniture-600 hover:bg-furniture-700 focus-visible:ring-furniture-400',
    soft: 'bg-furniture-50 text-furniture-800',
    text: 'text-furniture-700',
    border: 'border-furniture-600',
    tile: 'bg-furniture-500 hover:bg-furniture-600',
  },
  beekeeping: {
    header: 'bg-beekeeping-600',
    headerHover: 'hover:bg-beekeeping-700',
    headerSubtle: 'text-beekeeping-100',
    button: 'bg-beekeeping-600 hover:bg-beekeeping-700 focus-visible:ring-beekeeping-400',
    soft: 'bg-beekeeping-50 text-beekeeping-800',
    text: 'text-beekeeping-700',
    border: 'border-beekeeping-600',
    tile: 'bg-beekeeping-500 hover:bg-beekeeping-600',
  },
  rental: {
    header: 'bg-rental-600',
    headerHover: 'hover:bg-rental-700',
    headerSubtle: 'text-rental-100',
    button: 'bg-rental-600 hover:bg-rental-700 focus-visible:ring-rental-400',
    soft: 'bg-rental-50 text-rental-800',
    text: 'text-rental-700',
    border: 'border-rental-600',
    tile: 'bg-rental-500 hover:bg-rental-600',
  },
  loans: {
    header: 'bg-loans-600',
    headerHover: 'hover:bg-loans-700',
    headerSubtle: 'text-loans-100',
    button: 'bg-loans-600 hover:bg-loans-700 focus-visible:ring-loans-400',
    soft: 'bg-loans-50 text-loans-800',
    text: 'text-loans-700',
    border: 'border-loans-600',
    tile: 'bg-loans-500 hover:bg-loans-600',
  },
};

/** Status colours shared by every area, so "paid", "pending" and "failed" always look the same. */
export const STATUS_STYLES = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
};

export function unitTheme(unit) {
  return UNIT_THEMES[unit] ?? UNIT_THEMES.core;
}
