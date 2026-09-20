import React from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../../hooks/useLocaleFormat';

// Pictogram colours per state. Kept deliberately simple (body + LED + bolt + base).
const TONES = {
  selected: { body: '#dcfce7', stroke: '#16a34a', led: '#16a34a', bolt: '#16a34a' },
  ready: { body: '#f3f4f6', stroke: '#9ca3af', led: '#22c55e', bolt: '#9ca3af' },
  busy: { body: '#fef3e2', stroke: '#d97706', led: '#f59e0b', bolt: '#d97706' },
  unavailable: { body: '#fef3e2', stroke: '#d97706', led: '#f59e0b', bolt: '#d97706' },
  offline: { body: '#f3f4f6', stroke: '#d1d5db', led: '#9ca3af', bolt: '#d1d5db' },
};

const PILLS = {
  ready: { className: 'bg-green-100 text-green-700', labelKey: 'evLive.statusReady' },
  busy: { className: 'bg-amber-100 text-amber-700', labelKey: 'evLive.statusCharging' },
  unavailable: { className: 'bg-amber-100 text-amber-700', labelKey: 'evLive.statusUnavailable' },
  offline: { className: 'bg-gray-100 text-gray-500', labelKey: 'evLive.statusOffline' },
};

function StationIcon({ tone, pulse }) {
  return (
    <svg viewBox="0 0 40 56" width="36" height="50" className="mx-auto mb-1.5" aria-hidden="true">
      <rect x="4" y="2" width="32" height="42" rx="6" fill={tone.body} stroke={tone.stroke} strokeWidth="2.5" />
      <circle
        cx="20" cy="14" r="3.5" fill={tone.led}
        className={pulse ? 'charger-led-pulse' : undefined}
        style={pulse ? { animation: 'ledpulse 1.1s ease-in-out infinite' } : undefined}
      />
      <path d="M22 22l-7 10h5l-2 8 8-10h-5l1-8z" fill={tone.bolt} />
      <rect x="0" y="46" width="40" height="6" rx="3" fill="#a8a29e" />
    </svg>
  );
}

/**
 * One physical charger. `state` comes from chargerState(): only a "ready" charger can be
 * chosen; the others are rendered disabled so the operator can still see why.
 */
export default function ChargerCard({ charger, state, selected, invalid = false, onSelect }) {
  const { t } = useTranslation();
  const { num } = useLocaleFormat();
  const disabled = state !== 'ready';
  const pill = PILLS[state] || PILLS.offline;
  const tone = selected ? TONES.selected : TONES[state] || TONES.offline;
  const power = num(parseFloat(charger.maxPowerKw));
  const status = t(pill.labelKey);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${t('evConsole.charger', { number: num(charger.displayOrder) })}, ${charger.model}, ${power} kW, ${status}`}
      disabled={disabled}
      onClick={() => onSelect(charger.id)}
      className={`relative min-h-[44px] rounded-xl border-2 p-2.5 pt-3 text-center transition-colors ${
        selected
          ? 'border-green-500 bg-green-50'
          : invalid ? 'border-red-400 bg-white' : 'border-gray-200 bg-white'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'active:scale-[0.97]'}`}
    >
      {selected && (
        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}
      <StationIcon tone={tone} pulse={state === 'busy'} />
      <p className="break-words text-xs font-bold leading-tight text-gray-800">{charger.model}</p>
      <p className="mt-0.5 text-[10px] leading-tight text-gray-500">{power}kW</p>
      <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${pill.className}`}>
        ● {status}
      </span>
    </button>
  );
}
