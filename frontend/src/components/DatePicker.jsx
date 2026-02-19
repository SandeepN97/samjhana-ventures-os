import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  getDay,
  getYear,
  getMonth,
  parse,
} from 'date-fns';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const MONTH_NAMES_NE = [
  'जनवरी', 'फेब्रुअरी', 'मार्च', 'अप्रिल', 'मे', 'जुन',
  'जुलाई', 'अगस्ट', 'सेप्टेम्बर', 'अक्टोबर', 'नोभेम्बर', 'डिसेम्बर'
];
const DAY_HEADERS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_HEADERS_NE = ['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श'];

const NEPALI_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
function toNepaliDigits(str) {
  return String(str).replace(/[0-9]/g, d => NEPALI_DIGITS[d]);
}

// Format display: "19 Feb 2026" or Nepali equivalent
function formatDisplay(dateStr, isNepali) {
  if (!dateStr) return '';
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (isNaN(parsed.getTime())) return dateStr;
  const day = parsed.getDate();
  const monthShort = isNepali
    ? MONTH_NAMES_NE[parsed.getMonth()].slice(0, 3)
    : MONTH_NAMES_EN[parsed.getMonth()].slice(0, 3);
  const year = parsed.getFullYear();
  const str = `${day} ${monthShort} ${year}`;
  return isNepali ? toNepaliDigits(str) : str;
}

const ACCENT_MAP = {
  green:  { ring: 'focus-within:ring-green-500',  bg: 'bg-green-600 text-white',  hover: 'hover:bg-green-50' },
  orange: { ring: 'focus-within:ring-orange-500', bg: 'bg-orange-600 text-white', hover: 'hover:bg-orange-50' },
  blue:   { ring: 'focus-within:ring-blue-500',   bg: 'bg-blue-600 text-white',   hover: 'hover:bg-blue-50' },
  red:    { ring: 'focus-within:ring-red-500',    bg: 'bg-red-600 text-white',    hover: 'hover:bg-red-50' },
  purple: { ring: 'focus-within:ring-purple-500', bg: 'bg-purple-600 text-white', hover: 'hover:bg-purple-50' },
  indigo: { ring: 'focus-within:ring-indigo-500', bg: 'bg-indigo-600 text-white', hover: 'hover:bg-indigo-50' },
};

export default function DatePicker({ value, onChange, error, className = '', accentColor = 'green' }) {
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const parsed = parse(value, 'yyyy-MM-dd', new Date());
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    }
    return new Date();
  });
  const ref = useRef(null);
  const accent = ACCENT_MAP[accentColor] || ACCENT_MAP.green;

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  useEffect(() => {
    if (value) {
      const parsed = parse(value, 'yyyy-MM-dd', new Date());
      if (!isNaN(parsed.getTime())) setViewDate(parsed);
    }
  }, [value]);

  const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);
  const padBefore = Array(startDow).fill(null);

  const monthLabel = isNepali
    ? `${MONTH_NAMES_NE[getMonth(viewDate)]} ${toNepaliDigits(getYear(viewDate))}`
    : `${MONTH_NAMES_EN[getMonth(viewDate)]} ${getYear(viewDate)}`;

  const dayHeaders = isNepali ? DAY_HEADERS_NE : DAY_HEADERS_EN;
  const displayValue = formatDisplay(value, isNepali);

  function selectDay(day) {
    onChange(format(day, 'yyyy-MM-dd'));
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-3 text-base border-2 rounded-xl cursor-pointer
          flex items-center justify-between gap-2 bg-white
          focus-within:outline-none focus-within:ring-2 ${accent.ring}
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        role="button"
        aria-label="Pick date"
      >
        <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue || (isNepali ? 'मिति छान्नुहोस्' : 'Select date')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 min-w-[280px]">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-1.5">
            <button
              type="button"
              onClick={() => setViewDate(d => subMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-sm">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewDate(d => addMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {dayHeaders.map((d, i) => (
              <div key={i} className="text-center text-[11px] font-medium text-gray-400 py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {padBefore.map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map(day => {
              const selected = selectedDate && isSameDay(day, selectedDate);
              const today = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`
                    h-8 w-full flex items-center justify-center text-xs rounded-md
                    transition-colors
                    ${selected
                      ? accent.bg
                      : today
                        ? 'ring-1 ring-gray-300 font-semibold text-gray-900'
                        : 'text-gray-700 hover:bg-gray-100'}
                  `}
                >
                  {isNepali ? toNepaliDigits(day.getDate()) : day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Today shortcut */}
          <button
            type="button"
            onClick={() => selectDay(new Date())}
            className="w-full text-center text-xs text-gray-500 hover:text-gray-800 pt-1.5 mt-1 border-t border-gray-100"
          >
            {isNepali ? 'आज' : 'Today'}
          </button>
        </div>
      )}
    </div>
  );
}
