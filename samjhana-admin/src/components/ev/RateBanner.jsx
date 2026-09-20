import React, { useEffect, useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../utils/api';
import useLocaleFormat from '../../hooks/useLocaleFormat';

const NEA_KEY = 'nea_rate';
const NEA_CACHE_KEY = 'ev_nea_rate';

/** The NEA rate from the shared system-settings table (cached so it survives a flaky connection). */
function useNeaRate() {
  const [value, setValue] = useState('');

  useEffect(() => {
    const cached = localStorage.getItem(NEA_CACHE_KEY) || '';
    api.get(`/api/settings/${NEA_KEY}`, { skipAuthRedirect: true })
      .then((res) => {
        const loaded = res.data?.value || cached;
        setValue(loaded);
        if (loaded) localStorage.setItem(NEA_CACHE_KEY, loaded);
      })
      .catch(() => setValue(cached));
  }, []);

  const save = async (next) => {
    await api.put(`/api/settings/${NEA_KEY}`, { value: next }, { skipAuthRedirect: true });
    setValue(next);
    localStorage.setItem(NEA_CACHE_KEY, next);
  };

  return { value, save };
}

/**
 * Top card of the Start Session screen: what the station pays NEA per unit of electricity.
 * It is business-sensitive, so the page renders this card for admins and managers only — and
 * the API refuses the setting to staff as well. Customers are NOT billed from it: they are
 * charged by car type and percentage (the vehicle's price per 1%).
 */
export default function RateBanner({ canEdit = true, showToast, onOpenBills }) {
  const { t } = useTranslation();
  const { num, currency } = useLocaleFormat();
  const nea = useNeaRate();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setInput(nea.value);
    setEditing(true);
  };

  const commit = async () => {
    const next = input.trim();
    if (!next || !(parseFloat(next) > 0)) return;
    setSaving(true);
    try {
      await nea.save(next);
      showToast(t('evLive.rateSaved'), 'success');
      setEditing(false);
    } catch (error) {
      showToast(error.response?.data?.message || t('evLive.rateSaveFailed'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const label = t('ev.neaRatePerUnit');

  return (
    <div className="mx-4 mt-4 space-y-2 rounded-xl bg-white p-4 shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-green-600">⚡ {label}</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-500">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  autoFocus
                  aria-label={label}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
                  className="w-32 rounded-lg border-2 border-green-400 py-2 pl-10 pr-3 text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                type="button"
                aria-label={t('evLive.saveRate')}
                disabled={saving}
                onClick={commit}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-500 text-white disabled:opacity-50"
              >
                <Check className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <p className="text-2xl font-black text-gray-900">
              {nea.value ? num(parseFloat(nea.value).toFixed(2)) : '—'}
              <span className="text-sm font-normal text-gray-400"> {t('evLive.neaRateUnit')}</span>
            </p>
          )}
        </div>
        {!editing && canEdit && (
          <button
            type="button"
            onClick={startEditing}
            className="flex min-h-[44px] items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-green-600 hover:bg-green-50"
          >
            <Pencil className="h-4 w-4" />
            {t('common.update')}
          </button>
        )}
      </div>
      {onOpenBills && (
        <button
          type="button"
          onClick={onOpenBills}
          className="min-h-[44px] text-sm font-medium text-green-600 underline-offset-2 hover:underline"
        >
          {t('evLive.neaBills')} →
        </button>
      )}
    </div>
  );
}
