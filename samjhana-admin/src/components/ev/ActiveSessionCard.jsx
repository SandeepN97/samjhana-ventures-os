import React from 'react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import { clampPercent, formatElapsed } from '../../utils/evSession';

/** One in-progress session: plate chip, elapsed time, progress toward target, live kWh and cost. */
export default function ActiveSessionCard({ session, now, busy, onStop }) {
  const { t } = useTranslation();
  const { num, money } = useLocaleFormat();
  const soc = session.currentSoc ?? session.startSoc;
  const progress = clampPercent(soc ?? 0);
  const kwh = Number(session.energyDeliveredKwh || 0).toFixed(1);
  const subline = [session.chargerModel, session.vehicleCatalogName].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl bg-white p-4 shadow-md" data-testid="active-session">
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-lg bg-gray-900 px-2.5 py-1 font-mono text-sm font-bold text-green-400">
          {session.plateNumber}
        </span>
        <span
          aria-label={t('evLive.elapsed')}
          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700"
        >
          {num(formatElapsed(session.startedAt, now))}
        </span>
      </div>
      <p className="mb-2 text-sm text-gray-500">{subline}</p>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        className="mb-1 h-2 overflow-hidden rounded-full bg-gray-200"
      >
        <div className="h-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${progress}%` }} />
      </div>
      <div className="mb-3 flex justify-between text-xs text-gray-500">
        <span>{soc == null ? '—' : `${num(soc)}%`}</span>
        <span>{t('evLive.targetLine', { percent: num(session.targetPercent) })}</span>
      </div>

      <div className="mb-3 flex gap-4 text-sm">
        <div><b className="block text-lg text-gray-800">{num(kwh)}</b>{t('evLive.kwh')}</div>
        <div>
          <b className="block text-lg text-gray-800">
            {session.suggestedAmount == null ? '—' : money(session.suggestedAmount)}
          </b>
          {t('evLive.soFar')}
        </div>
      </div>

      {session.status === 'ACTIVE' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onStop(session.id)}
          className="min-h-[44px] w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          {t('evLive.stopAndLock')}
        </button>
      )}
      {session.status === 'STARTING' && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-center text-xs text-gray-500">
          {session.statusMessage || t('evLive.waitingToStart')}
        </p>
      )}
      {session.status === 'STOP_REQUESTED' && (
        <button
          type="button"
          disabled
          className="min-h-[44px] w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white opacity-60"
        >
          {t('evLive.stopping')}
        </button>
      )}
    </div>
  );
}
