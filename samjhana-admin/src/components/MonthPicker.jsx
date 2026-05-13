import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { adToBs, bsToAd, BS_MONTHS_NE, toNepaliDigits } from '../utils/nepaliDate';

const MONTH_NAMES_SHORT_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES_FULL_EN  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const ACCENT_MAP = {
  green:  { ring: 'focus-within:ring-green-500',  bg: 'bg-green-600 text-white'  },
  orange: { ring: 'focus-within:ring-orange-500', bg: 'bg-orange-600 text-white' },
  blue:   { ring: 'focus-within:ring-blue-500',   bg: 'bg-blue-600 text-white'   },
  red:    { ring: 'focus-within:ring-red-500',     bg: 'bg-red-600 text-white'    },
  purple: { ring: 'focus-within:ring-purple-500', bg: 'bg-purple-600 text-white' },
  indigo: { ring: 'focus-within:ring-indigo-500', bg: 'bg-indigo-600 text-white' },
};

// value is always "YYYY-MM" in AD
export default function MonthPicker({ value, onChange, error, className = '', accentColor = 'green' }) {
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const accent = ACCENT_MAP[accentColor] || ACCENT_MAP.green;

  // AD view year (English mode)
  const [adYear, setAdYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear());

  // BS view year (Nepali mode) — derive from value or today
  const [bsYear, setBsYear] = useState(() => {
    if (value) {
      try {
        const [y, m] = value.split('-').map(Number);
        return adToBs(new Date(y, m - 1, 15)).year;
      } catch { /* fall through */ }
    }
    return adToBs(new Date()).year;
  });

  // Keep view years in sync when value changes externally
  useEffect(() => {
    if (!value) return;
    const [y, m] = value.split('-').map(Number);
    setAdYear(y);
    try { setBsYear(adToBs(new Date(y, m - 1, 15)).year); } catch { /* ignore */ }
  }, [value]);

  // Click-outside closes dropdown
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Select a month in AD mode (monthIdx 0-based)
  const selectAdMonth = (monthIdx) => {
    onChange(`${adYear}-${String(monthIdx + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  // Select a month in BS mode (bsMonthIdx 0-based)
  const selectBsMonth = (bsMonthIdx) => {
    try {
      const adDate = bsToAd(bsYear, bsMonthIdx, 15);
      onChange(`${adDate.getFullYear()}-${String(adDate.getMonth() + 1).padStart(2, '0')}`);
    } catch {
      // fallback: just use bsYear loosely
      onChange(`${bsYear - 57}-${String(bsMonthIdx + 1).padStart(2, '0')}`);
    }
    setOpen(false);
  };

  // Which month is currently selected?
  const selectedAdMonth = value ? parseInt(value.split('-')[1]) - 1 : null; // 0-based
  const selectedAdYear  = value ? parseInt(value.split('-')[0]) : null;

  const selectedBs = (() => {
    if (!value) return null;
    try {
      const [y, m] = value.split('-').map(Number);
      return adToBs(new Date(y, m - 1, 15));
    } catch { return null; }
  })();

  // Display text in trigger button
  const displayValue = () => {
    if (!value) return '';
    const [y, m] = value.split('-').map(Number);
    if (isNepali && selectedBs) {
      return `${BS_MONTHS_NE[selectedBs.month]} ${toNepaliDigits(selectedBs.year)}`;
    }
    return `${MONTH_NAMES_FULL_EN[m - 1]} ${y}`;
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Trigger — same style as DatePicker */}
      <div
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-3 text-base border-2 rounded-xl cursor-pointer
          flex items-center justify-between gap-2 bg-white
          focus-within:outline-none focus-within:ring-2 ${accent.ring}
          ${error ? 'border-red-500' : 'border-gray-300'}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); }
          if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
        }}
        role="button"
        aria-label="Pick month"
      >
        <span className={displayValue() ? 'text-gray-900' : 'text-gray-400'}>
          {displayValue() || t('common.selectMonth', 'Select month')}
        </span>
        <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg p-2.5 min-w-[280px]">
          {isNepali ? (
            <>
              {/* BS year navigation */}
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setBsYear(y => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Previous year">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-sm">{toNepaliDigits(bsYear)}</span>
                <button type="button" onClick={() => setBsYear(y => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Next year">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {/* BS month grid */}
              <div className="grid grid-cols-4 gap-1">
                {BS_MONTHS_NE.map((name, idx) => {
                  const isSel = selectedBs && selectedBs.month === idx && selectedBs.year === bsYear;
                  return (
                    <button key={idx} type="button" onClick={() => selectBsMonth(idx)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        isSel ? accent.bg : 'hover:bg-gray-100 text-gray-700'
                      }`}>
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* AD year navigation */}
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => setAdYear(y => y - 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Previous year">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-semibold text-sm">{adYear}</span>
                <button type="button" onClick={() => setAdYear(y => y + 1)}
                  className="p-1.5 rounded-lg hover:bg-gray-100" aria-label="Next year">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              {/* AD month grid */}
              <div className="grid grid-cols-4 gap-1">
                {MONTH_NAMES_SHORT_EN.map((name, idx) => {
                  const isSel = selectedAdMonth === idx && selectedAdYear === adYear;
                  return (
                    <button key={idx} type="button" onClick={() => selectAdMonth(idx)}
                      className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                        isSel ? accent.bg : 'hover:bg-gray-100 text-gray-700'
                      }`}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
