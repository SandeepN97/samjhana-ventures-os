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

// Get number of days in a BS month by finding the last day before the 1st of next month
export function getBsMonthDays(year, month) {
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 11) { nextMonth = 0; nextYear++; }
  const firstOfNextMonth = bsToAd(nextYear, nextMonth, 1);
  const lastDay = new Date(firstOfNextMonth.getTime() - 24 * 60 * 60 * 1000);
  return adToBs(lastDay).day;
}

export const BS_MONTHS_NE = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पुष', 'माघ', 'फाल्गुन', 'चैत्र',
];

export const BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Aswin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
];

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export function toNepaliDigits(str) {
  return String(str).replace(/[0-9]/g, d => NEPALI_DIGITS[d]);
}

// Format AD date string as BS display: "३ चैत्र २०८२" or "3 Chaitra 2082"
export function formatBsDate(adDateStr, isNepali) {
  if (!adDateStr) return '';
  const jsDate = new Date(adDateStr + 'T12:00:00');
  if (isNaN(jsDate.getTime())) return adDateStr;
  const bs = adToBs(jsDate);
  const monthName = (isNepali ? BS_MONTHS_NE : BS_MONTHS_EN)[bs.month];
  const str = `${bs.day} ${monthName} ${bs.year}`;
  return isNepali ? toNepaliDigits(str) : str;
}