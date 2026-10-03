import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../hooks/useLocaleFormat';
import { BUSINESS_TIME_ZONE } from '../utils/businessDay';

const MINUTE_MS = 60_000;

/**
 * The current date and time in Nepal (12-hour clock), whatever timezone the device is in.
 * Read-only: the server stamps every session itself, so staff have nothing to set here.
 * It re-renders on each minute boundary so the shown minute is never stale.
 */
export default function NepalDateTime({ id }) {
  const { t } = useTranslation();
  const { isNepali } = useLocaleFormat();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, MINUTE_MS - (Date.now() % MINUTE_MS) + 50);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  const text = new Intl.DateTimeFormat(isNepali ? 'ne-NP' : 'en-NP', {
    timeZone: BUSINESS_TIME_ZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
    hourCycle: 'h12',
  }).format(now);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-lg font-medium text-gray-700">
        {t('common.dateTime')}
      </label>
      <div className="relative">
        <CalendarClock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          id={id}
          type="text"
          readOnly
          aria-label={t('common.currentDateTime')}
          value={text}
          className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-base text-gray-900"
        />
      </div>
    </div>
  );
}
