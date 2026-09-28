/**
 * "Today" for the business means today in Nepal, whatever timezone the phone or laptop is in.
 *
 * The server files every sale under Nepal's date, so the app must use the same calendar: a
 * browser in the US (or `toISOString()`, which is UTC) would otherwise call it a different day
 * for several hours each day, and today's sales would appear to be missing.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Kathmandu';

const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Today's date in Nepal as 'YYYY-MM-DD'. */
export function nepalToday(now = new Date()) {
  return ymd.format(now);
}

/**
 * Today's date in Nepal as a Date at local midnight, for code that does calendar arithmetic
 * with Date objects (week ranges, "3 days ago", calendar grids).
 */
export function nepalTodayDate(now = new Date()) {
  const [y, m, d] = nepalToday(now).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * A calendar Date (built from local year/month/day) as 'YYYY-MM-DD', without the UTC shift that
 * `toISOString()` applies: in Nepal, local midnight is still the previous day in UTC.
 */
export function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' moved by a number of days. */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return toDateStr(new Date(y, m - 1, d + days));
}
