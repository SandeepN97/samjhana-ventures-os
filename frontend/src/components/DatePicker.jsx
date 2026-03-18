import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  format, parse, isToday, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, getYear, getMonth,
} from 'date-fns';
import {
  adToBs, bsToAd, getBsMonthDays, BS_MONTHS_NE, toNepaliDigits, formatBsDate,
} from '../utils/nepaliDate';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_HEADERS_NE = ['आ', 'सो', 'मं', 'बु', 'बि', 'शु', 'श'];

function formatAdDisplay(dateStr) {
  if (!dateStr) return '';
  const parsed = parse(dateStr, 'yyyy-MM-dd', new Date());
  if (isNaN(parsed.getTime())) return dateStr;
  return `${parsed.getDate()} ${MONTH_NAMES_EN[parsed.getMonth()].slice(0, 3)} ${parsed.getFullYear()}`;
}

const ACCENT_MAP = {
  green:  { ring: 'focus-within:ring-green-500',  bg: 'bg-green-600 text-white',  },
  orange: { ring: 'focus-within:ring-orange-500', bg: 'bg-orange-600 text-white', },
  blue:   { ring: 'focus-within:ring-blue-500',   bg: 'bg-blue-600 text-white',   },
  red:    { ring: 'focus-within:ring-red-500',    bg: 'bg-red-600 text-white',    },
  purple: { ring: 'focus-within:ring-purple-500', bg: 'bg-purple-600 text-white', },
  indigo: { ring: 'focus-within:ring-indigo-500', bg: 'bg-indigo-600 text-white', },
};

function bsViewFromAd(adDate) {
  const bs = adToBs(adDate);
  return { year: bs.year, month: bs.month };
}
function bsViewPrev({ year, month }) {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}
function bsViewNext({ year, month }) {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

export default function DatePicker({ value, onChange, error, className = '', accentColor = 'green' }) {
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const p = parse(value, 'yyyy-MM-dd', new Date());
      return isNaN(p.getTime()) ? new Date() : p;
    }
    return new Date();
  });
  const [bsView, setBsView] = useState(() => bsViewFromAd(viewDate));
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
      const p = parse(value, 'yyyy-MM-dd', new Date());
      if (!isNaN(p.getTime())) {
        setViewDate(p);
        setBsView(bsViewFromAd(p));
      }
    }
  }, [value]);

  const displayValue = isNepali ? formatBsDate(value, true) : formatAdDisplay(value);

  function selectDay(jsDate) {
    onChange(format(jsDate, 'yyyy-MM-dd'));
    setOpen(false);
  }

  // ---- AD calendar ----
  const selectedAdDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : null;
  const monthStart = startOfMonth(viewDate);
  const adDays = eachDayOfInterval({ start: monthStart, end: endOfMonth(viewDate) });
  const adPad = Array(getDay(monthStart)).fill(null);
  const adMonthLabel = `${MONTH_NAMES_EN[getMonth(viewDate)]} ${getYear(viewDate)}`;

  // ---- BS calendar ----
  const { year: bsYear, month: bsMonth } = bsView;
  const bsDaysInMonth = getBsMonthDays(bsYear, bsMonth);
  const bsFirstAd = bsToAd(bsYear, bsMonth, 1);
  const bsPad = Array(bsFirstAd.getDay()).fill(null);
  const selectedBs = selectedAdDate ? adToBs(selectedAdDate) : null;
  const todayBs = adToBs(new Date());
  const bsMonthLabel = `${BS_MONTHS_NE[bsMonth]} ${toNepaliDigits(bsYear)}`;

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-3 text-base border-2 rounded-xl cursor-pointer
          flex items-center justify-between gap-2 bg-white
          focus-within:outline-none focus-within:ring-2 ${accent.ring}
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); }
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
        }}
        role="button"
        aria-label="Pick date"
      >
        <span className={displayValue ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue || (isNepali ? 'मिति छान्नुहोस्' : 'Select date')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 min-w-[280px]">
          {isNepali ? (
            // BS Calendar
            <>
              <div className="flex items-center justify-between mb-1.5">
                <button type="button" onClick={() => setBsView(v => bsViewPrev(v))}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Previous month">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-sm">{bsMonthLabel}</span>
                <button type="button" onClick={() => setBsView(v => bsViewNext(v))}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Next month">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-0.5">
                {DAY_HEADERS_NE.map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-medium text-gray-400 py-0.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {bsPad.map((_, i) => <div key={`pad-${i}`} />)}
                {Array.from({ length: bsDaysInMonth }, (_, i) => i + 1).map(bsDay => {
                  const adDate = bsToAd(bsYear, bsMonth, bsDay);
                  const isSel = selectedBs && selectedBs.year === bsYear && selectedBs.month === bsMonth && selectedBs.day === bsDay;
                  const isCurrent = todayBs.year === bsYear && todayBs.month === bsMonth && todayBs.day === bsDay;
                  return (
                    <button key={bsDay} type="button" onClick={() => selectDay(adDate)}
                      className={`h-8 w-full flex items-center justify-center text-xs rounded-md transition-colors
                        ${isSel ? accent.bg : isCurrent ? 'ring-1 ring-gray-300 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`}>
                      {toNepaliDigits(bsDay)}
                    </button>
                  );
                })}
              </div>
              <button type="button"
                onClick={() => { selectDay(new Date()); setBsView(bsViewFromAd(new Date())); }}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-800 pt-1.5 mt-1 border-t border-gray-100">
                आज
              </button>
            </>
          ) : (
            // AD Calendar
            <>
              <div className="flex items-center justify-between mb-1.5">
                <button type="button" onClick={() => setViewDate(d => subMonths(d, 1))}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Previous month">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-sm">{adMonthLabel}</span>
                <button type="button" onClick={() => setViewDate(d => addMonths(d, 1))}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Next month">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-0.5">
                {DAY_HEADERS_EN.map((d, i) => (
                  <div key={i} className="text-center text-[11px] font-medium text-gray-400 py-0.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {adPad.map((_, i) => <div key={`pad-${i}`} />)}
                {adDays.map(day => {
                  const selected = selectedAdDate && isSameDay(day, selectedAdDate);
                  const today = isToday(day);
                  return (
                    <button key={day.toISOString()} type="button" onClick={() => selectDay(day)}
                      className={`h-8 w-full flex items-center justify-center text-xs rounded-md transition-colors
                        ${selected ? accent.bg : today ? 'ring-1 ring-gray-300 font-semibold text-gray-900' : 'text-gray-700 hover:bg-gray-100'}`}>
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={() => selectDay(new Date())}
                className="w-full text-center text-xs text-gray-500 hover:text-gray-800 pt-1.5 mt-1 border-t border-gray-100">
                Today
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}