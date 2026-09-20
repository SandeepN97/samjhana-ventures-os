import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Car, Check, ChevronDown, Search, Users, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import { toEnglishNumerals } from '../../utils/formatters';

/** kW · seats · price as small pills. `active` tints them for the selected state. */
function VehicleFacts({ vehicle, active = false }) {
  const { t } = useTranslation();
  const { num, money } = useLocaleFormat();
  const hasRate = vehicle.ratePerPercent !== null && vehicle.ratePerPercent !== undefined && vehicle.ratePerPercent !== '';
  const base = active ? 'bg-white/70 text-gray-600' : 'bg-gray-100 text-gray-600';

  return (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${base}`}>
        {num(parseFloat(vehicle.batteryCapacityKw))} kW
      </span>
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${base}`}>
        <Users className="h-3 w-3" aria-hidden="true" />
        {num(vehicle.seatingCapacity)} {t('ev.seats')}
      </span>
      {hasRate && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
          {money(vehicle.ratePerPercent)}
        </span>
      )}
    </span>
  );
}

/** Wraps the part of `text` that matches `query` in a <mark> so staff can see why a row matched. */
function Highlight({ text, query }) {
  const needle = query.trim();
  if (!needle) return text;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded bg-green-100 text-green-800">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/**
 * Vehicle chooser for the Start Session form (optional field). Opens a bottom sheet with a
 * sticky search and one rich row per vehicle — name, battery kW, seats and the green price
 * pill — plus a "No vehicle (walk-in)" row that clears the choice.
 */
export default function VehiclePicker({ vehicles, value, onChange, labelledBy, id }) {
  const { t } = useTranslation();
  const { num } = useLocaleFormat();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const triggerRef = useRef(null);
  const searchRef = useRef(null);
  const valueId = useId();

  const selected = vehicles.find((item) => String(item.id) === String(value));

  const matches = useMemo(() => {
    // Accept Devanagari digits in the search box ("१६" finds 16 seats / a price of 16).
    const needle = toEnglishNumerals(query).trim().toLowerCase();
    if (!needle) return vehicles;
    return vehicles.filter((item) => [
      item.vehicleName, item.batteryCapacityKw, item.seatingCapacity, item.ratePerPercent,
    ].some((field) => String(field ?? '').toLowerCase().includes(needle)));
  }, [vehicles, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
    triggerRef.current?.focus();
  };

  const choose = (nextId) => {
    onChange(nextId);
    close();
  };

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // keep the page from scrolling behind the sheet
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  const countLine = query.trim()
    ? t('evLive.vehiclesShown', { shown: num(matches.length), total: num(vehicles.length) })
    : t('evLive.vehiclesTotal', { total: num(vehicles.length) });

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${labelledBy} ${valueId}`}
        onClick={() => setOpen(true)}
        className="flex min-h-[64px] w-full items-center gap-3 rounded-xl border-2 border-gray-300 bg-white px-4 py-3 pr-14 text-left focus:outline-none focus:ring-2 focus:ring-green-500"
      >
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
          selected ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          <Car className="h-5 w-5" aria-hidden="true" />
        </span>
        <span id={valueId} className="min-w-0 flex-1">
          {selected ? (
            <>
              <span className="block truncate font-bold text-gray-800">{selected.vehicleName}</span>
              <VehicleFacts vehicle={selected} />
            </>
          ) : (
            <span className="text-gray-400">{t('evLive.vehiclePlaceholder')}</span>
          )}
        </span>
      </button>

      {selected ? (
        <button
          type="button"
          aria-label={t('evLive.clearVehicle')}
          onClick={() => onChange('')}
          className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      ) : (
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
      )}

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('evLive.chooseVehicle')}
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); close(); } }}
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className="text-lg font-bold text-gray-800">{t('evLive.chooseVehicle')}</h2>
              <button
                type="button"
                aria-label={t('evLive.closePicker')}
                onClick={close}
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('evLive.vehicleSearch')}
                  aria-label={t('evLive.vehicleSearch')}
                  className="min-h-[48px] w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-12 focus:border-green-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    aria-label={t('evLive.clearSearch')}
                    onClick={() => { setQuery(''); searchRef.current?.focus(); }}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
              <p className="mt-2 text-xs text-gray-500" aria-live="polite">{countLine}</p>
            </div>

            <div role="listbox" aria-label={t('evLive.chooseVehicle')} className="space-y-2 overflow-y-auto px-4 pb-6">
              {!query.trim() && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!selected}
                  onClick={() => choose('')}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-xl border-2 border-dashed p-3 text-left ${
                    selected ? 'border-gray-300 bg-white' : 'border-green-500 bg-green-50'
                  }`}
                >
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-gray-800">{t('evLive.noVehicle')}</span>
                    <span className="block text-xs text-gray-500">{t('evLive.noVehicleHint')}</span>
                  </span>
                  {!selected && <Check className="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />}
                </button>
              )}

              {matches.map((item) => {
                const isSelected = String(item.id) === String(value);
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(String(item.id))}
                    className={`relative flex min-h-[64px] w-full items-center gap-3 rounded-xl border-2 p-3 text-left active:scale-[0.99] ${
                      isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'
                    }`}
                  >
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                      isSelected ? 'bg-green-500 text-white' : 'bg-green-100 text-green-600'
                    }`}>
                      <Car className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold text-gray-800">
                        <Highlight text={item.vehicleName} query={toEnglishNumerals(query)} />
                      </span>
                      <VehicleFacts vehicle={item} active={isSelected} />
                    </span>
                    {isSelected && (
                      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
                        <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                );
              })}

              {vehicles.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">{t('evLive.noVehiclesSetup')}</p>
              )}
              {vehicles.length > 0 && matches.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">{t('evLive.noVehicleMatch', { query: query.trim() })}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
