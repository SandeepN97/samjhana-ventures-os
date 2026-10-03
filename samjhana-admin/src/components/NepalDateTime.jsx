import React, { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../hooks/useLocaleFormat';
import { BUSINESS_TIME_ZONE, nepalToday } from '../utils/businessDay';
import { adToBs, toNepaliDigits, BS_MONTHS_NE } from '../utils/nepaliDate';

const MINUTE_MS = 60_000;

/**
 * The current date and time in Nepal (12-hour clock; BS date in Nepali, AD date in English), whatever timezone the device is in.
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

  const locale = isNepali ? 'ne-NP' : 'en-NP';
  const nepalDay = nepalToday(now);
  // Noon on the Nepal calendar day keeps weekday and BS conversion independent of the device zone.
  const noon = new Date(`${nepalDay}T12:00:00`);
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: BUSINESS_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h12',
  })
    .format(now)
    .replace(/\u202f/g, ' ');

  let date;
  if (isNepali) {
    const bs = adToBs(noon);
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(noon);
    date = `${toNepaliDigits(bs.year)} ${BS_MONTHS_NE[bs.month]} ${toNepaliDigits(bs.day)}, ${weekday}`;
  } else {
    date = new Intl.DateTimeFormat(locale, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(noon);
  }

  return (
    <div id={id} role="group" aria-label={t('common.currentDateTime')}>
      <p className="mb-2 text-lg font-medium text-gray-700">{t('common.dateTime')}</p>
      <div className="flex min-h-[44px] items-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 px-3 py-3">
        <CalendarClock className="h-6 w-6 shrink-0 text-gray-400" aria-hidden="true" />
        <div>
          <p className="text-2xl font-semibold leading-tight text-gray-900" data-testid="nepal-time">{time}</p>
          <p className="text-base text-gray-700" data-testid="nepal-date">{date}</p>
          <p className="text-xs text-gray-500">{t('common.nepalTime')}</p>
        </div>
      </div>
    </div>
  );
}
