import React from 'react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import { clampPercent } from '../../utils/evSession';

const PRESETS = [
  { value: 50, label: '50%' },
  { value: 80, label: '80%' },
  { value: 100, labelKey: 'evLive.presetFull' },
];
const STEP = 5;

/**
 * Charge target: three presets plus a − / number / + stepper (no slider — staff need to enter
 * a precise number quickly on a touchscreen). `value` is a string so the box can be empty
 * while typing; presets and stepper always stay in sync with it.
 */
export default function ChargeTargetCard({ value, onChange, currentSoc = null }) {
  const { t } = useTranslation();
  const { num } = useLocaleFormat();
  const numeric = value === '' ? NaN : Number(value);

  const stepBy = (delta) => onChange(String(clampPercent((Number.isNaN(numeric) ? 0 : numeric) + delta)));
  const handleTyped = (event) => {
    const raw = event.target.value;
    if (raw === '') return onChange('');
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) onChange(String(clampPercent(parsed)));
    return undefined;
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow-md">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('evLive.chargeTarget')}</p>
      <p className="mb-3 text-xs text-gray-400">
        {t('evLive.currentBattery')}:{' '}
        <b className="text-gray-700">{currentSoc == null ? '—' : `${num(currentSoc)}%`}</b>{' '}
        {t('evLive.reportedByCharger')}
      </p>

      <div className="mb-3 flex gap-2">
        {PRESETS.map((preset) => {
          const active = numeric === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(String(preset.value))}
              className={`min-h-[44px] flex-1 rounded-lg border-2 py-2 text-sm font-bold ${
                active ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              {preset.labelKey ? t(preset.labelKey) : num(preset.value) + '%'}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={t('evLive.decrease')}
          onClick={() => stepBy(-STEP)}
          className="h-11 w-11 rounded-xl border-2 border-gray-300 text-xl font-bold text-gray-700"
        >
          −
        </button>
        <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-gray-300 py-2">
          <input
            type="number"
            inputMode="numeric"
            min="0"
            max="100"
            aria-label={t('evLive.targetInput')}
            value={value}
            onChange={handleTyped}
            className="w-16 border-none text-center text-2xl font-bold outline-none"
          />
          <span className="text-lg font-bold text-gray-500">%</span>
        </div>
        <button
          type="button"
          aria-label={t('evLive.increase')}
          onClick={() => stepBy(STEP)}
          className="h-11 w-11 rounded-xl border-2 border-gray-300 text-xl font-bold text-gray-700"
        >
          +
        </button>
      </div>
    </div>
  );
}
