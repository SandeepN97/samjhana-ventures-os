import NepaliDate from 'nepali-date-converter';

// Convert an AD JS Date to BS { year, month (0-indexed), day }
export function adToBs(jsDate) {
  const nd = new NepaliDate(jsDate);
  return { year: nd.getYear(), month: nd.getMonth(), day: nd.getDate() };
}

// Convert BS { year, month (0-indexed), day } to AD JS Date
export function bsToAd(year, month, day) {
  const nd = new NepaliDate(year, month, day);
  return nd.toJsDate();
}

// Get number of days in a BS month
export function bsMonthDays(year, month) {
  const nd = new NepaliDate(year, month, 1);
  return nd.getMonthDaysCount ? nd.getMonthDaysCount() : _getDaysFromConfig(year, month);
}

function _getDaysFromConfig(year, month) {
  // Fallback: find days by checking when month changes
  const monthNames = ['Baisakh','Jestha','Asar','Shrawan','Bhadra','Aswin','Kartik','Mangsir','Poush','Magh','Falgun','Chaitra'];
  // Use dateConfigMap from the package
  try {
    // eslint-disable-next-line no-undef
    const { dateConfigMap } = _getConfig();
    const yearData = dateConfigMap[year];
    if (yearData) return Object.values(yearData)[month] || 30;
  } catch {}
  return 30;
}

// Cache for dateConfigMap
let _configCache = null;
function _getConfig() {
  if (!_configCache) {
    // We'll store it lazily
  }
  return _configCache;
}

// Better approach: use NepaliDate to find days by iterating
export function getBsMonthDays(year, month) {
  // The last day of the month is the day before the 1st of next month
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) { nextMonth = 0; nextYear++; }
  const firstOfNextMonth = bsToAd(nextYear, nextMonth, 1);
  const lastDay = new Date(firstOfNextMonth.getTime() - 24 * 60 * 60 * 1000);
  const lastBs = adToBs(lastDay);
  return lastBs.day;
}

// BS month names in Nepali
export const BS_MONTHS_NE = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फाल्गुन', 'चैत्र',
];

// BS month names in English
export const BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

// Format a BS date for display: "3 चैत्र 2082" or "3 Chaitra 2082"
const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
function toNepaliDigits(str) {
  return String(str).replace(/[0-9]/g, d => NEPALI_DIGITS[d]);
}

export function formatBsDate(adDateStr, isNepali) {
  if (!adDateStr) return '';
  const parts = adDateStr.split('-');
  if (parts.length !== 3) return adDateStr;
  const jsDate = new Date(adDateStr + 'T12:00:00');
  const bs = adToBs(jsDate);
  const monthNames = isNepali ? BS_MONTHS_NE : BS_MONTHS_EN;
  const monthShort = monthNames[bs.month];
  const str = `${bs.day} ${monthShort} ${bs.year}`;
  return isNepali ? toNepaliDigits(str) : str;
}

export { toNepaliDigits };