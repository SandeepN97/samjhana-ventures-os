import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Check } from 'lucide-react';

export default function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder,
  error,
  className = '',
  accentColor = 'green',
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search when opened
  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  const selectedOption = options.find(o => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(o =>
      (o.label && o.label.toLowerCase().includes(q)) ||
      (o.subtitle && o.subtitle.toLowerCase().includes(q))
    );
  }, [options, search]);

  const defaultPlaceholder = t('common.select');

  const ringClass = `focus:ring-${accentColor}-500`;

  function handleSelect(opt) {
    onChange(String(opt.value));
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="relative" ref={ref}>
      <div
        onClick={() => setOpen(o => !o)}
        className={`w-full px-4 py-4 text-lg border-2 rounded-xl cursor-pointer flex items-center justify-between
          bg-white focus:outline-none focus:ring-2 ${ringClass}
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${className}`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(o => !o); } }}
        role="button"
        aria-label="Select option"
      >
        <span className={selectedOption ? 'text-gray-900 truncate' : 'text-gray-400 truncate'}>
          {selectedOption ? selectedOption.label : (placeholder || defaultPlaceholder)}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border-2 border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="w-full bg-transparent text-base outline-none"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400 text-center">
                {t('common.noOptions')}
              </div>
            ) : (
              filtered.map(opt => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between
                      hover:bg-gray-50 active:bg-gray-100 transition-colors
                      ${isSelected ? 'bg-green-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${isSelected ? 'text-green-700' : 'text-gray-900'}`}>
                        {opt.label}
                      </div>
                      {opt.subtitle && (
                        <div className="text-xs text-gray-500 truncate">{opt.subtitle}</div>
                      )}
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-green-600 flex-shrink-0 ml-2" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
