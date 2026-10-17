import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banknote, ChevronRight, FileText, ShoppingBag } from 'lucide-react';
import { unitTheme } from '../brand/theme';
import useLocaleFormat from '../hooks/useLocaleFormat';

/**
 * The home screen on a desktop-width screen. It is drawn from the numbers the phone home screen
 * already loads (nothing new is requested): today's cash, waiting orders, waiting loan approvals,
 * and one tile per business.
 */
export default function DesktopHome({ user, businesses, todayCash, newOrders, waitingLoanPayments }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { money } = useLocaleFormat();

  return (
    <div className="min-h-screen bg-gray-100 pb-12">
      <header className="bg-core-800 px-8 pt-24 pb-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight">{t('home.title')}</h1>
        <p className="mt-1 text-core-300">
          {t('home.welcome')}{user.fullName ? ` ${user.fullName}` : ''}
        </p>
      </header>

      <div className="space-y-8 px-8 pt-8">
        <section aria-labelledby="home-today" className="grid grid-cols-3 gap-5">
          <h2 id="home-today" className="sr-only">{t('home.todayHeading')}</h2>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <p className="flex items-center gap-2 text-sm font-bold text-gray-600">
              <Banknote className="h-5 w-5" aria-hidden="true" />
              {t('home.todayCash')}
            </p>
            <p className="mt-2 text-3xl font-bold text-green-700" data-testid="today-cash">
              {todayCash === null ? '—' : money(todayCash)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/online-orders')}
            className="flex min-h-[96px] items-center justify-between gap-4 rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-gray-600">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              {t('home.onlineOrders')}
            </span>
            <span className="flex items-center gap-2">
              {newOrders > 0 && (
                <span className="rounded-full bg-red-600 px-3 py-1 text-sm font-bold text-white">{newOrders}</span>
              )}
              <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/reports/close')}
            className="flex min-h-[96px] items-center justify-between gap-4 rounded-2xl bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-gray-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
              {t('home.dailyClose')}
            </span>
            <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden="true" />
          </button>
        </section>

        <section aria-labelledby="home-businesses">
          <h2 id="home-businesses" className="mb-4 text-xl font-bold text-core-900">{t('home.businessesHeading')}</h2>
          <div className="grid grid-cols-3 gap-5">
            {businesses.map((b) => {
              const Icon = b.icon;
              const badge = b.code === 'loan' && waitingLoanPayments > 0 ? waitingLoanPayments : undefined;
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => navigate(b.path)}
                  className={`${unitTheme(b.unit).tile} relative flex min-h-[128px] items-center gap-5 rounded-2xl px-7 text-left text-white shadow-md transition-transform duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-800 focus-visible:ring-offset-2 active:scale-[0.99]`}
                >
                  <Icon className="h-12 w-12 shrink-0" strokeWidth={2} aria-hidden="true" />
                  <span className="text-xl font-bold leading-tight">{t(b.tKey)}</span>
                  {badge && (
                    <span
                      data-testid="waiting-badge"
                      aria-label={t('loan.waitingForReview')}
                      className="absolute right-3 top-3 flex h-7 min-w-[28px] items-center justify-center rounded-full bg-yellow-400 px-2 text-sm font-bold text-gray-900"
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
