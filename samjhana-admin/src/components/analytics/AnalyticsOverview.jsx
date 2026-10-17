import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Receipt,
} from 'lucide-react';
import { toNepaliDigits } from '../../utils/nepaliDate';

const DAY_MS = 24 * 60 * 60 * 1000;

function money(value, isNepali) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  const amount = Number(value);
  const digits = Math.abs(amount).toLocaleString('en-IN');
  return `${amount < 0 ? '−' : ''}रु ${isNepali ? toNepaliDigits(digits) : digits}`;
}

function shortMoney(value, isNepali) {
  const amount = Number(value || 0);
  let label;
  if (amount >= 100000) label = `${(amount / 100000).toFixed(amount >= 1000000 ? 0 : 1)}L`;
  else if (amount >= 1000) label = `${Math.round(amount / 1000)}k`;
  else label = Math.round(amount).toLocaleString('en-IN');
  return `रु ${isNepali ? toNepaliDigits(label) : label}`;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildChartRows(rows, range, period, isNepali) {
  if (period === 'today' || !range?.start || !range?.end) return [];

  const totals = new Map(rows.map((row) => [row.date, Number(row.total || 0)]));
  const days = [];
  for (let cursor = new Date(range.start); cursor <= range.end; cursor = new Date(cursor.getTime() + DAY_MS)) {
    days.push({ date: new Date(cursor), total: totals.get(dateKey(cursor)) || 0 });
  }

  if (period === 'week' || days.length <= 10) {
    const weekdays = isNepali
      ? ['आइत', 'सोम', 'मंगल', 'बुध', 'बिही', 'शुक्र', 'शनि']
      : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days.map((day) => ({
      ...day,
      label: weekdays[day.date.getDay()],
    }));
  }

  const grouped = [];
  for (let index = 0; index < days.length; index += 7) {
    const slice = days.slice(index, index + 7);
    const start = slice[0].date.getDate();
    const end = slice[slice.length - 1].date.getDate();
    const label = `${start}–${end}`;
    grouped.push({
      date: slice[0].date,
      label: isNepali ? toNepaliDigits(label) : label,
      total: slice.reduce((sum, day) => sum + day.total, 0),
    });
  }
  return grouped;
}

function TrendCopy({ change, previousLabel, isNepali }) {
  if (change == null) return null;
  const positive = change >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  const amount = isNepali ? toNepaliDigits(Math.abs(change)) : Math.abs(change);

  return (
    <p className={`mt-2 flex items-start gap-1 text-[10px] font-bold leading-4 sm:mt-3 sm:items-center sm:gap-1.5 sm:text-sm md:text-xl md:leading-7 xl:text-sm xl:leading-normal ${positive ? 'text-ev-700' : 'text-loans-700'}`}>
      <Icon className="mt-0.5 h-3 w-3 shrink-0 sm:mt-0 sm:h-4 sm:w-4 md:h-6 md:w-6 xl:h-4 xl:w-4" aria-hidden="true" />
      {isNepali
        ? `${previousLabel} भन्दा ${amount}% ${positive ? 'बढी' : 'कम'} आम्दानी`
        : `${amount}% ${positive ? 'more' : 'less'} money in than ${previousLabel.toLowerCase()}`}
    </p>
  );
}

function MoneySummary({
  totalRevenue,
  totalExpenses,
  totalProfit,
  transactionCount,
  canViewProfit,
  change,
  previousLabel,
  isNepali,
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] ring-1 ring-core-200/80">
      <div className={`grid md:min-h-[230px] xl:min-h-0 ${canViewProfit ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <div className="border-r border-core-200 p-3 sm:p-6 md:p-8 xl:p-6">
          <p className="text-xs font-bold text-core-500 sm:text-sm md:text-xl xl:text-sm">{isNepali ? 'भित्र आएको पैसा' : 'Money in'}</p>
          <p className="mt-1 whitespace-nowrap text-lg font-bold tracking-[-0.03em] text-core-950 sm:mt-2 sm:text-4xl md:text-[42px] xl:text-4xl">
            {money(totalRevenue, isNepali)}
          </p>
          <p className="mt-2 hidden items-center gap-1.5 text-xs font-medium text-core-500 xl:flex">
            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
            {isNepali ? toNepaliDigits(transactionCount) : transactionCount} {isNepali ? 'रेकर्ड' : transactionCount === 1 ? 'record' : 'records'}
          </p>
          <TrendCopy change={change} previousLabel={previousLabel} isNepali={isNepali} />
        </div>

        <div className={`${canViewProfit ? 'border-r border-core-200' : ''} p-3 sm:p-6 md:p-8 xl:p-6`}>
          <p className="text-xs font-bold text-core-500 sm:text-sm md:text-xl xl:text-sm">{isNepali ? 'बाहिर गएको पैसा' : 'Money out'}</p>
          <p className="mt-1 whitespace-nowrap text-lg font-bold tracking-[-0.02em] text-core-950 sm:mt-2 sm:text-4xl md:text-[42px] xl:text-3xl">
            {money(totalExpenses, isNepali)}
          </p>
          <p className="mt-2 text-[10px] leading-4 text-core-500 sm:text-xs md:text-base md:leading-6 xl:text-xs xl:leading-4">{isNepali ? 'रेकर्ड गरिएको खर्च' : 'Recorded expenses'}</p>
        </div>

        {canViewProfit ? (
          <div className="p-3 sm:p-6 md:p-8 xl:p-6">
            <p className="text-xs font-bold text-core-500 sm:text-sm md:text-xl xl:text-sm">{isNepali ? 'कुल नाफा' : 'Gross profit'}</p>
            <p className={`mt-1 whitespace-nowrap text-xl font-bold tracking-[-0.035em] sm:mt-2 sm:text-[40px] md:text-5xl xl:text-[40px] ${totalProfit < 0 ? 'text-loans-700' : 'text-ev-700'}`}>
              {money(totalProfit, isNepali)}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-core-500 sm:text-xs md:text-base md:leading-6 xl:text-xs xl:leading-4">{isNepali ? 'बिक्रीबाट प्रत्यक्ष लागत घटाएपछि' : 'Sales minus known direct costs'}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ReviewAction({ count, onOpen, isNepali }) {
  if (count <= 0) {
    return (
      <div className="flex min-h-[88px] items-center gap-4 rounded-2xl bg-ev-50 px-5 py-4 text-ev-950 ring-1 ring-inset ring-ev-200">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ev-600 text-white">
          <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
        </span>
        <div>
          <p className="font-bold">{isNepali ? 'सबै समीक्षा सकियो' : 'Everything is reviewed'}</p>
          <p className="mt-0.5 text-sm text-ev-800">{isNepali ? 'अहिले तपाईंको स्वीकृति चाहिने केही छैन।' : 'Nothing is waiting for your approval.'}</p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex min-h-[76px] w-full items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-left text-amber-950 ring-1 ring-inset ring-amber-300 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 sm:min-h-[96px] sm:gap-4 sm:px-5 sm:py-4 md:min-h-[138px] md:gap-5 md:px-7 md:py-5 xl:min-h-[96px] xl:gap-4 xl:px-5 xl:py-4"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm sm:h-12 sm:w-12 md:h-16 md:w-16 xl:h-12 xl:w-12">
        <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8 xl:h-6 xl:w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-core-950 sm:text-xl md:text-3xl xl:text-xl">
          {isNepali ? `${toNepaliDigits(count)} पेन्डिङ समीक्षा` : `${count} pending ${count === 1 ? 'review' : 'reviews'}`}
        </span>
        <span className="mt-1 block text-sm font-semibold text-core-500 md:text-xl xl:text-sm">
          {isNepali ? 'तपाईंको स्वीकृति पर्खिरहेको छ' : 'Waiting for your approval'}
        </span>
      </span>
      <ChevronRight className="h-6 w-6 shrink-0 text-core-500 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

function RevenueChart({ rows, period, change, previousLabel, loading, isNepali }) {
  const max = rows.reduce((largest, row) => Math.max(largest, row.total), 0);
  const hasData = max > 0;
  const title = period === 'month'
    ? (isNepali ? 'आम्दानी · यो महिना' : 'Revenue · this month')
    : (isNepali ? 'आम्दानी · ७ दिन' : 'Revenue · 7 days');

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] ring-1 ring-core-200/80">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
        <div>
          <h2 className="text-xl font-black tracking-[-0.025em] text-core-950 sm:text-2xl md:text-4xl xl:text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-core-500 md:text-xl xl:text-sm">
            {period === 'month'
              ? (isNepali ? 'सात दिनको समूहमा जम्मा आम्दानी' : 'Money in grouped into seven-day periods')
              : (isNepali ? 'हरेक दिन भित्र आएको पैसा' : 'Money recorded each day')}
          </p>
        </div>
        {change != null ? (
          <div className={`flex items-center gap-1.5 text-sm font-bold md:text-xl xl:text-sm ${change >= 0 ? 'text-ev-700' : 'text-loans-700'}`}>
            {change >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
            <span>{isNepali ? toNepaliDigits(Math.abs(change)) : Math.abs(change)}%</span>
            <span className="font-medium text-core-500">{isNepali ? previousLabel : `vs ${previousLabel.toLowerCase()}`}</span>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="px-5 pb-6 sm:px-6" aria-label={isNepali ? 'चार्ट अपडेट हुँदैछ' : 'Updating revenue chart'}>
          <div className="flex h-64 animate-pulse items-end gap-2 rounded-xl bg-core-50 px-3 pb-8 pt-6">
            {[42, 58, 48, 74, 63, 82, 68].map((height) => (
              <div key={height} className="flex-1 rounded-t-lg bg-core-200" style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
      ) : hasData ? (
        <div className="px-4 pb-5 sm:px-6 sm:pb-6">
          <ol className="flex h-44 items-end gap-2 border-b border-core-200 px-1 pt-6 sm:h-72 sm:gap-3 sm:pt-8" aria-label={title}>
            {rows.map((row) => {
              const height = Math.max(8, Math.round((row.total / max) * 100));
              return (
                <li key={`${dateKey(row.date)}-${row.label}`} className="flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                  <span className="mb-2 truncate text-[10px] font-bold tabular-nums text-core-700 sm:text-xs">
                    {shortMoney(row.total, isNepali)}
                  </span>
                  <div
                    className="mx-auto w-full max-w-16 rounded-t-lg bg-blue-500 transition-[height] duration-500 ease-out motion-reduce:transition-none"
                    style={{ height: `${height}%` }}
                    role="img"
                    aria-label={`${row.label}: ${money(row.total, isNepali)}`}
                  />
                  <span className="mt-2 truncate text-xs font-bold text-core-500 sm:text-sm">{row.label}</span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : (
        <div className="px-5 pb-6 sm:px-6">
          <div className="flex min-h-52 flex-col items-center justify-center rounded-xl bg-core-50 px-6 text-center">
            <BarChart3 className="h-8 w-8 text-core-300" aria-hidden="true" />
            <p className="mt-3 font-bold text-core-700">{isNepali ? 'यस अवधिमा आम्दानी रेकर्ड छैन' : 'No revenue recorded for this period'}</p>
            <p className="mt-1 max-w-sm text-sm text-core-500">{isNepali ? 'रेकर्ड थपिएपछि दैनिक तुलना यहाँ देखिन्छ।' : 'The daily comparison will appear here after entries are recorded.'}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function BusinessSources({ rows, totalRevenue, onSelect, isNepali }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] ring-1 ring-core-200/80">
      <div className="px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <h2 className="text-xl font-black tracking-[-0.025em] text-core-950 sm:text-2xl md:text-4xl xl:text-2xl">
          {isNepali ? 'पैसा कहाँबाट आयो?' : 'Where did the money come from?'}
        </h2>
        <p className="mt-1 text-sm text-core-500 md:text-xl xl:text-sm">{isNepali ? 'विवरण हेर्न व्यवसाय छान्नुहोस्' : 'Tap a business to see details'}</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 pb-8 text-center sm:px-6">
          <div className="rounded-xl bg-core-50 px-6 py-10">
            <p className="font-bold text-core-700">{isNepali ? 'आम्दानीको रेकर्ड छैन' : 'No business income recorded'}</p>
            <p className="mt-1 text-sm text-core-500">{isNepali ? 'यस अवधिमा व्यवसायको आम्दानी थपिएको छैन।' : 'No business has recorded income for this period.'}</p>
          </div>
        </div>
      ) : (
        <ol className="mx-4 mb-4 overflow-hidden rounded-xl border border-core-200 sm:mx-6 sm:mb-6">
          {rows.map(({ code, cfg, biz }, index) => {
            const Icon = cfg.icon;
            const revenue = Number(biz.revenue || 0);
            const share = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0;
            return (
              <li key={code} className="border-b border-core-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(code)}
                  className="group flex min-h-[68px] w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-core-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core-600 sm:min-h-[76px] sm:px-4 md:min-h-[92px] md:text-xl xl:min-h-[76px] xl:text-base"
                >
                  <span className="w-5 shrink-0 text-center text-sm font-black tabular-nums text-core-400">
                    {isNepali ? toNepaliDigits(index + 1) : index + 1}
                  </span>
                  <span className={`${cfg.color} flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-tight text-core-900">{isNepali ? cfg.labelNe : cfg.labelEn}</span>
                    <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-xs text-core-500">
                      <span>{isNepali ? `${toNepaliDigits(share)}% कुल आम्दानी` : `${share}% of money in`}</span>
                      <span className="font-bold tabular-nums text-core-950 sm:hidden">{money(revenue, isNepali)}</span>
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-right text-sm font-bold tabular-nums text-core-950 sm:block sm:text-base">{money(revenue, isNepali)}</span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-core-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default function AnalyticsOverview({
  totalRevenue,
  totalExpenses,
  totalProfit,
  transactionCount,
  canViewProfit,
  change,
  previousLabel,
  pendingCount,
  onOpenPending,
  txnsByDay,
  range,
  period,
  txnsLoading,
  businessRows,
  onSelectBusiness,
  isNepali,
}) {
  const chartRows = buildChartRows(txnsByDay, range, period, isNepali);

  return (
    <div className="space-y-4 sm:space-y-5">
      <MoneySummary
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        totalProfit={totalProfit}
        transactionCount={transactionCount}
        canViewProfit={canViewProfit}
        change={change}
        previousLabel={previousLabel}
        isNepali={isNepali}
      />
      <ReviewAction count={pendingCount} onOpen={onOpenPending} isNepali={isNepali} />
      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <RevenueChart
          rows={chartRows}
          period={period}
          change={change}
          previousLabel={previousLabel}
          loading={txnsLoading}
          isNepali={isNepali}
        />
        <BusinessSources
          rows={businessRows}
          totalRevenue={totalRevenue}
          onSelect={onSelectBusiness}
          isNepali={isNepali}
        />
      </div>
    </div>
  );
}
