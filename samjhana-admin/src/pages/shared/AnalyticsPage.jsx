import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft, ChevronRight, Calendar,
  Fuel, Zap, Sofa, Hexagon, Home, Banknote,
  AlertCircle,
} from 'lucide-react';
import api from '../../utils/api';
import BusinessDrillSheet from '../../components/BusinessDrillSheet';
import BottomNav from '../../components/BottomNav';
import LedgerPageHeader from '../../components/LedgerPageHeader';
import AnalyticsOverview from '../../components/analytics/AnalyticsOverview';
import { adToBs, bsToAd, getBsMonthDays, BS_MONTHS_NE, BS_MONTHS_EN, toNepaliDigits } from '../../utils/nepaliDate';
import { nepalTodayDate, toDateStr } from '../../utils/businessDay';

const BUSINESS_CONFIG = {
  petrol:    { icon: Fuel,     color: 'bg-petrol-500', text: 'text-petrol-600', labelEn: 'Petrol Pump', labelNe: 'पेट्रोल पम्प' },
  ev:        { icon: Zap,      color: 'bg-ev-500',  text: 'text-ev-600',  labelEn: 'EV',          labelNe: 'EV' },
  furniture: { icon: Sofa,     color: 'bg-furniture-500', text: 'text-furniture-600', labelEn: 'Furniture',   labelNe: 'फर्निचर' },
  beekeeping: { icon: Hexagon, color: 'bg-beekeeping-500', text: 'text-beekeeping-600', labelEn: 'Beekeeping', labelNe: 'मौरीपालन' },
  rental:    { icon: Home,     color: 'bg-rental-500',   text: 'text-rental-600',   labelEn: 'Rental',      labelNe: 'भाडा' },
  loan:      { icon: Banknote, color: 'bg-loans-500',    text: 'text-loans-600',    labelEn: 'Loans',       labelNe: 'ऋण' },
};

const MONEY_IN_TYPES = new Set(['SALE', 'INCOME', 'PAYMENT']);

const pctChange = (curr, prev) => {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
};

// Date range helpers
// Periods follow Nepal's calendar, the one sales are filed under (see utils/businessDay).
function getPeriodRange(period, offset = 0) {
  const now = nepalTodayDate();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') {
    const d = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    return { start: d, end: d };
  }
  if (period === 'week') {
    const end = new Date(today.getTime() - offset * 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { start, end };
  }
  // month
  const monthOffset = now.getMonth() - offset;
  const year = now.getFullYear() + Math.floor(monthOffset / 12);
  const month = ((monthOffset % 12) + 12) % 12;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start, end };
}

function inRange(dateStr, range) {
  const date = String(dateStr).slice(0, 10);
  return date >= toDateStr(range.start) && date <= toDateStr(range.end);
}

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = user.role === 'STAFF';
  const canViewProfit = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [period, setPeriod]           = useState(isStaff ? 'today' : 'week');
  const [offset, setOffset]           = useState(0);
  // Custom week range (null = use rolling 7-day offset)
  const [weekStart, setWeekStart]     = useState(null);
  const [weekEnd, setWeekEnd]         = useState(null);
  const [weekPickStep, setWeekPickStep] = useState(0); // 0 = picking start, 1 = picking end
  const [showPicker, setShowPicker]   = useState(false);
  // AD view (English mode calendar / month grid)
  const [pickerYear, setPickerYear]   = useState(() => nepalTodayDate().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(() => nepalTodayDate().getMonth());
  // BS view (Nepali mode calendar / month grid)
  const [pickerBsView, setPickerBsView] = useState(() => { const bs = adToBs(nepalTodayDate()); return { year: bs.year, month: bs.month }; });
  // Week picker hover preview
  const [hovDay, setHovDay]           = useState(null);
  const pickerRef                     = useRef(null);
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [txnsLoading, setTxnsLoading] = useState(false);

  // Derived insight state
  const [txnsByDay, setTxnsByDay]             = useState([]);
  const [prevRevenue, setPrevRevenue]         = useState(null);
  const [pendingCount, setPendingCount]       = useState(0);
  const [periodTxns, setPeriodTxns]           = useState([]);
  const [selectedBiz, setSelectedBiz]         = useState(null);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  // Sync picker view to the currently displayed period when picker opens
  const openPicker = () => {
    const ref = (period === 'week' && weekStart) ? weekStart : getPeriodRange(period, offset).start;
    setPickerYear(ref.getFullYear());
    setPickerMonth(ref.getMonth());
    const bs = adToBs(ref);
    setPickerBsView({ year: bs.year, month: bs.month });
    if (period === 'week') setWeekPickStep(0); // always restart range selection
    setShowPicker(true);
  };

  // Compute offset from a selected AD date (days from today)
  const selectDay = (adDate) => {
    const today = nepalTodayDate();
    const sel   = new Date(adDate); sel.setHours(0,0,0,0);
    const diff  = Math.round((today - sel) / 86400000);
    setOffset(Math.max(0, diff));
    setShowPicker(false);
  };
  // Week range picker: two-step (start → end)
  const handleWeekDayClick = (adDate) => {
    const d = new Date(adDate); d.setHours(0,0,0,0);
    if (weekPickStep === 0) {
      setWeekStart(d);
      setWeekEnd(null);
      setWeekPickStep(1);
    } else {
      // second click — swap if needed, then close
      const start = weekStart;
      const end   = d;
      if (end < start) { setWeekStart(end); setWeekEnd(start); }
      else             { setWeekStart(start); setWeekEnd(end); }
      setWeekPickStep(0);
      setShowPicker(false);
    }
  };
  // Month offset from an AD year/month
  const selectMonth = (year, month) => {
    const now = nepalTodayDate();
    const diff = (now.getFullYear() - year) * 12 + (now.getMonth() - month);
    setOffset(Math.max(0, diff));
    setShowPicker(false);
  };
  // Month offset from a BS year/month
  const selectBsMonth = (bsYear, bsMonth) => {
    const adStart = bsToAd(bsYear, bsMonth, 1);
    selectMonth(adStart.getFullYear(), adStart.getMonth());
  };

  useEffect(() => {
    fetchData();
    fetchInsights();
    fetchPending();
  }, [period, offset, weekStart, weekEnd]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fmtDate = toDateStr;   // not toISOString(): that shifts Nepal's midnight to the previous day
      const url = (period === 'week' && weekStart && weekEnd)
        ? `/api/analytics/summary?period=week&startDate=${fmtDate(weekStart)}&endDate=${fmtDate(weekEnd)}`
        : `/api/analytics/summary?period=${period}&offset=${offset}`;
      const res = await api.get(url);
      setData(res.data);
    } catch {
      setError(isNepali ? 'डाटा लोड गर्न सकिएन' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsights = async () => {
    setTxnsLoading(true);
    try {
      const res = await api.get('/api/transactions');
      const all = res.data.map(t => ({
        ...t,
        customFields: t.customFields
          ? (typeof t.customFields === 'string' ? JSON.parse(t.customFields) : t.customFields)
          : null,
      }));

      const currRange = (period === 'week' && weekStart && weekEnd)
        ? { start: weekStart, end: weekEnd }
        : getPeriodRange(period, offset);
      const prevRange = (period === 'week' && weekStart && weekEnd)
        ? (() => { const ms = weekEnd - weekStart + 86400000; return { start: new Date(weekStart - ms), end: new Date(weekEnd - ms) }; })()
        : getPeriodRange(period, offset + 1);

      const notRejected = all.filter(t => t.status !== 'REJECTED');
      const currPeriodTxns = notRejected.filter(t => t.transactionDate && inRange(t.transactionDate, currRange));
      setPeriodTxns(currPeriodTxns);

      const moneyIn = notRejected.filter(t => MONEY_IN_TYPES.has(t.transactionType));
      const currMoneyIn = moneyIn.filter(t => t.transactionDate && inRange(t.transactionDate, currRange));
      const prevMoneyIn = moneyIn.filter(t => t.transactionDate && inRange(t.transactionDate, prevRange));

      // Previous period revenue
      const prevTotal = prevMoneyIn.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      setPrevRevenue(prevTotal);

      // Day-by-day breakdown (current period only)
      if (period !== 'today') {
        const map = {};
        currMoneyIn.forEach(t => {
          const d = t.transactionDate;
          if (!d) return;
          if (!map[d]) map[d] = { date: d, petrol: 0, ev: 0, furniture: 0, beekeeping: 0, rental: 0, loan: 0, total: 0, txnCount: 0 };
          const code = t.businessCode;
          if (map[d][code] !== undefined) map[d][code] += parseFloat(t.amount || 0);
          map[d].total += parseFloat(t.amount || 0);
          map[d].txnCount += 1;
        });
        const sorted = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
        setTxnsByDay(sorted);
      } else {
        setTxnsByDay([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setTxnsLoading(false);
    }
  };

  const fetchPending = async () => {
    try {
      const res = await api.get('/api/transactions');
      const pending = res.data.filter(t => t.status === 'PENDING_REVIEW');
      setPendingCount(pending.length);
    } catch { /* silent */ }
  };

  // Effective date range (custom week range or period/offset)
  const currRange = (period === 'week' && weekStart && weekEnd)
    ? { start: weekStart, end: weekEnd }
    : getPeriodRange(period, offset);

  const periodLabel = (() => {
    const MONTHS = isNepali ? BS_MONTHS_NE : BS_MONTHS_EN;
    const fmtBs = (d) => {
      const bs = adToBs(d);
      const str = `${bs.day} ${MONTHS[bs.month]}`;
      return isNepali ? toNepaliDigits(str) : str;
    };
    const fmtRange = (start, end) => {
      const bsStart = adToBs(start);
      const bsEnd   = adToBs(end);
      const sameYear = bsStart.year === bsEnd.year;
      const startStr = sameYear ? fmtBs(start) : `${fmtBs(start)} ${bsStart.year}`;
      const endStr   = `${fmtBs(end)} ${bsEnd.year}`;
      return isNepali ? toNepaliDigits(`${startStr} – ${endStr}`) : `${startStr} – ${endStr}`;
    };

    if (period === 'week') {
      if (weekStart && weekEnd) return fmtRange(weekStart, weekEnd);
      return fmtRange(currRange.start, currRange.end);
    }
    if (offset === 0) {
      return { today: isNepali ? 'आज' : 'Today', month: isNepali ? 'यो महिना' : 'This Month' }[period];
    }
    const { start, end } = currRange;
    if (period === 'today') {
      const bs = adToBs(start);
      const str = `${bs.day} ${MONTHS[bs.month]} ${bs.year}`;
      return isNepali ? toNepaliDigits(str) : str;
    }
    if (period === 'month') {
      const bs = adToBs(start);
      const str = `${MONTHS[bs.month]} ${bs.year}`;
      return isNepali ? toNepaliDigits(str) : str;
    }
    return fmtRange(start, end);
  })();

  const prevPeriodLabel = {
    today: isNepali ? 'हिजो' : 'Yesterday',
    week:  isNepali ? 'गत हप्ता' : 'Last Week',
    month: isNepali ? 'गत महिना' : 'Last Month',
  }[period];

  const totalRevenue  = data ? Number(data.totalRevenue)  : 0;
  const totalExpenses = data ? Number(data.totalExpenses) : 0;
  const totalProfit   = data ? (data.totalProfit != null ? Number(data.totalProfit) : null) : null;
  const txnCount      = data ? data.transactionCount : 0;

  const change = pctChange(totalRevenue, prevRevenue);

  const bizRows = data?.businesses
    ? Object.entries(BUSINESS_CONFIG)
        .map(([code, cfg]) => ({ code, cfg, biz: data.businesses[code] }))
        .filter(({ biz }) => Number(biz?.revenue || 0) > 0)
        .sort((a, b) => Number(b.biz.revenue || 0) - Number(a.biz.revenue || 0))
    : [];

  return (
    <div className="min-h-screen bg-gray-100 pb-20 font-['Red_Hat_Text',sans-serif] text-core-900 selection:bg-core-200 xl:pb-0">
      <LedgerPageHeader title={isNepali ? 'व्यापार सारांश' : 'Business Summary'} hideWhenSidebarShows />

      {/* Period Selector */}
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-5 lg:px-8">
        <section
          className="relative rounded-2xl bg-white shadow-sm ring-1 ring-core-200/80"
          aria-label={isNepali ? 'समय अवधि' : 'Time period'}
        >
        {isStaff ? (
          <p className="px-4 py-3 text-center text-sm text-core-500">{isNepali ? 'आजको सारांश' : "Today's Summary"}</p>
        ) : (
          <>
            <div className="mx-auto flex max-w-3xl gap-2 px-4 pb-2 pt-3 md:max-w-[795px] md:px-0 xl:max-w-3xl xl:px-4">
              {['today', 'week', 'month'].map(p => (
                <button key={p} onClick={() => { setPeriod(p); setOffset(0); setShowPicker(false); if (p !== 'week') { setWeekStart(null); setWeekEnd(null); } }}
                  className={`min-h-[44px] flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 md:min-h-[56px] md:text-xl xl:min-h-[44px] xl:text-sm ${
                    period === p ? 'bg-blue-600 text-white shadow-sm' : 'bg-core-100 text-core-600 hover:bg-core-200'
                  }`}>
                  {{ today: isNepali ? 'आज' : 'Today', week: isNepali ? 'हप्ता' : 'Week', month: isNepali ? 'महिना' : 'Month' }[p]}
                </button>
              ))}
            </div>

            {/* Period navigation + picker trigger */}
            <div className="relative mx-auto max-w-3xl md:max-w-[795px] xl:max-w-3xl" ref={pickerRef}>
              <div className="flex items-center justify-between px-4 pb-3">
                <button
                  disabled={period === 'week' && weekStart && weekEnd}
                  onClick={() => setOffset(o => o + 1)}
                  className={`flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 ${
                    period === 'week' && weekStart && weekEnd
                      ? 'text-gray-300 cursor-default'
                      : 'text-gray-500 hover:text-core-600 active:text-core-700'
                  }`}>
                  <ChevronLeft className="w-4 h-4" />
                  {isNepali ? 'अघिल्लो' : 'Prev'}
                </button>

                {/* Tappable period label — opens picker */}
                <button onClick={openPicker}
                  className="flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-core-800 transition-colors hover:bg-core-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
                  <Calendar className="w-3.5 h-3.5" />
                  {periodLabel}
                </button>

                <button onClick={() => setOffset(o => Math.max(0, o - 1))}
                  disabled={offset === 0 || (period === 'week' && weekStart && weekEnd)}
                  className={`flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 ${
                    offset === 0 || (period === 'week' && weekStart && weekEnd) ? 'text-gray-300 cursor-default' : 'text-gray-500 hover:text-core-600 active:text-core-700'
                  }`}>
                  {isNepali ? 'अर्को' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* ── Period Picker Dropdown ── */}
              {showPicker && (
                <div className="absolute left-4 right-4 z-50 mb-2 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-core-200 sm:left-1/2 sm:right-auto sm:w-96 sm:-translate-x-1/2">

                  {/* ── MONTH PICKER ── */}
                  {period === 'month' && (() => {
                    const now = nepalTodayDate();
                    const todayBs = adToBs(now);
                    if (isNepali) {
                      // BS month grid
                      const minBsYear = todayBs.year - 5;
                      const maxBsYear = todayBs.year;
                      const selStart = getPeriodRange('month', offset).start;
                      const selBs = adToBs(selStart);
                      return (
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <button type="button" aria-label={isNepali ? 'अघिल्लो वर्ष' : 'Previous year'} onClick={() => setPickerBsView(v => ({ ...v, year: Math.max(minBsYear, v.year - 1) }))}
                              disabled={pickerBsView.year <= minBsYear}
                              className={`flex h-11 w-11 items-center justify-center rounded-lg ${pickerBsView.year <= minBsYear ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <span className="font-bold text-gray-800">{toNepaliDigits(pickerBsView.year)}</span>
                            <button type="button" aria-label={isNepali ? 'अर्को वर्ष' : 'Next year'} onClick={() => setPickerBsView(v => ({ ...v, year: Math.min(maxBsYear, v.year + 1) }))}
                              disabled={pickerBsView.year >= maxBsYear}
                              className={`flex h-11 w-11 items-center justify-center rounded-lg ${pickerBsView.year >= maxBsYear ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                              <ChevronRight className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {BS_MONTHS_NE.map((m, i) => {
                              const isFuture = pickerBsView.year === todayBs.year && i > todayBs.month;
                              const isSelected = selBs.year === pickerBsView.year && selBs.month === i;
                              return (
                                <button key={m} type="button" disabled={isFuture} aria-pressed={isSelected}
                                  onClick={() => selectBsMonth(pickerBsView.year, i)}
                                  className={`min-h-[44px] rounded-xl px-1 py-2 text-sm font-medium transition-colors ${
                                    isSelected ? 'bg-core-600 text-white' :
                                    isFuture   ? 'text-gray-300 cursor-default' :
                                                 'bg-gray-100 text-gray-700 hover:bg-core-100 hover:text-core-700'
                                  }`}>
                                  {m}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    // AD month grid
                    const minYear = now.getFullYear() - 5;
                    const maxYear = now.getFullYear();
                    const selStart = getPeriodRange('month', offset).start;
                    return (
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <button type="button" aria-label={isNepali ? 'अघिल्लो वर्ष' : 'Previous year'} onClick={() => setPickerYear(y => Math.max(minYear, y - 1))}
                            disabled={pickerYear <= minYear}
                            className={`flex h-11 w-11 items-center justify-center rounded-lg ${pickerYear <= minYear ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <span className="font-bold text-gray-800">{pickerYear}</span>
                          <button type="button" aria-label={isNepali ? 'अर्को वर्ष' : 'Next year'} onClick={() => setPickerYear(y => Math.min(maxYear, y + 1))}
                            disabled={pickerYear >= maxYear}
                            className={`flex h-11 w-11 items-center justify-center rounded-lg ${pickerYear >= maxYear ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => {
                            const isFuture = pickerYear === now.getFullYear() && i > now.getMonth();
                            const isSelected = selStart.getFullYear() === pickerYear && selStart.getMonth() === i;
                            return (
                              <button key={m} type="button" disabled={isFuture} aria-pressed={isSelected}
                                onClick={() => selectMonth(pickerYear, i)}
                                className={`min-h-[44px] rounded-xl px-1 py-2 text-sm font-medium transition-colors ${
                                  isSelected ? 'bg-core-600 text-white' :
                                  isFuture   ? 'text-gray-300 cursor-default' :
                                               'bg-gray-100 text-gray-700 hover:bg-core-100 hover:text-core-700'
                                }`}>
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── DAY / WEEK CALENDAR PICKER ── */}
                  {(period === 'today' || period === 'week') && (() => {
                    const now = nepalTodayDate();
                    const isWeek = period === 'week';

                    // For week: show selected range (weekStart..weekEnd) or partial (weekStart..hovDay)
                    const selRange = isWeek
                      ? (weekStart && weekEnd ? { start: weekStart, end: weekEnd } : null)
                      : getPeriodRange('today', offset);

                    // Hover range: for week step 1 (end selection), preview from weekStart to hovDay
                    const hoverRange = isWeek && weekPickStep === 1 && weekStart && hovDay
                      ? (hovDay >= weekStart ? { start: weekStart, end: hovDay } : { start: hovDay, end: weekStart })
                      : null;

                    const onDayClick = (adDate) => isWeek ? handleWeekDayClick(adDate) : selectDay(adDate);

                    // Day cell style
                    const dayStyle = (adDate, isFuture) => {
                      if (isFuture) return 'text-gray-300 cursor-default';
                      const inSel   = selRange && adDate >= selRange.start && adDate <= selRange.end;
                      const inHov   = hoverRange && adDate >= hoverRange.start && adDate <= hoverRange.end;
                      const isStart = isWeek && weekStart && adDate.getTime() === weekStart.getTime();
                      const isToday = adDate.getTime() === now.getTime();
                      if (inSel || isStart) return 'bg-core-600 text-white';
                      if (inHov)            return 'bg-core-100 text-core-800';
                      if (isToday)          return 'ring-1 ring-core-400 text-core-700 font-semibold';
                      return 'text-gray-700';
                    };

                    // Instruction / range label for week picker
                    const AD_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    const fmtAdShort = d => `${d.getDate()} ${AD_SHORT[d.getMonth()]}`;
                    const fmtBsShort = d => { const bs = adToBs(d); return toNepaliDigits(`${bs.day} ${BS_MONTHS_EN[bs.month]}`); };

                    const weekHint = (() => {
                      if (!isWeek) return null;
                      if (weekPickStep === 0) return isNepali ? '📅 सुरु मिति छान्नुहोस्' : '📅 Select start date';
                      if (!weekStart) return null;
                      const startLabel = isNepali ? fmtBsShort(weekStart) : fmtAdShort(weekStart);
                      const endLabel = hovDay
                        ? (isNepali ? fmtBsShort(hovDay) : fmtAdShort(hovDay))
                        : (isNepali ? 'अन्त्य मिति छान्नुहोस्' : 'Select end date');
                      return `${startLabel} → ${endLabel}`;
                    })();

                    if (isNepali) {
                      // BS calendar
                      const { year: bsY, month: bsM } = pickerBsView;
                      const daysInMonth = getBsMonthDays(bsY, bsM);
                      const firstAd = bsToAd(bsY, bsM, 1);
                      const pad = Array(firstAd.getDay()).fill(null);
                      const atMax = (() => { const tb = adToBs(now); return bsY === tb.year && bsM === tb.month; })();
                      const prevBs = () => setPickerBsView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
                      const nextBs = () => { if (!atMax) setPickerBsView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }); };
                      return (
                        <div className="p-3" onMouseLeave={() => setHovDay(null)}>
                          {isWeek && weekHint && (
                            <div className={`text-center text-xs font-medium mb-2 px-2 py-1.5 rounded-lg ${weekPickStep === 1 ? 'bg-core-50 text-core-700' : 'text-gray-500'}`}>{weekHint}</div>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <button type="button" aria-label={isNepali ? 'अघिल्लो महिना' : 'Previous month'} onClick={prevBs} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                            <span className="font-bold text-gray-800 text-sm">{BS_MONTHS_NE[bsM]} {toNepaliDigits(bsY)}</span>
                            <button type="button" aria-label={isNepali ? 'अर्को महिना' : 'Next month'} onClick={nextBs} disabled={atMax} className={`flex h-11 w-11 items-center justify-center rounded-lg ${atMax ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                          </div>
                          <div className="grid grid-cols-7 mb-1">
                            {['आइत','सोम','मंग','बुध','बिही','शुक्र','शनि'].map((d, i) => <div key={i} className="text-center text-[10px] text-gray-400 font-medium py-0.5 truncate">{d}</div>)}
                          </div>
                          <div className="grid grid-cols-7 gap-0.5">
                            {pad.map((_, i) => <div key={`p${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(bsDay => {
                              const adDate = bsToAd(bsY, bsM, bsDay);
                              const isFuture = adDate > now;
                              return (
                                <button key={bsDay} type="button" disabled={isFuture}
                                  aria-label={`${BS_MONTHS_NE[bsM]} ${toNepaliDigits(bsDay)}, ${toNepaliDigits(bsY)}`}
                                  onClick={() => onDayClick(adDate)}
                                  onMouseEnter={() => isWeek && !isFuture && setHovDay(adDate)}
                                  className={`flex min-h-[44px] w-full items-center justify-center rounded-lg text-xs font-medium transition-colors ${dayStyle(adDate, isFuture)}`}>
                                  {toNepaliDigits(bsDay)}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                            {isWeek
                              ? <>
                                  <button type="button" onClick={() => { setWeekStart(null); setWeekEnd(null); setWeekPickStep(0); setOffset(0); setShowPicker(false); }} className="min-h-[44px] flex-1 rounded-lg px-2 text-center text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800">यो हप्ता</button>
                                  {weekPickStep === 1 && <button type="button" onClick={() => { setWeekPickStep(0); setWeekStart(null); setWeekEnd(null); }} className="min-h-[44px] flex-1 rounded-lg px-2 text-center text-xs text-red-500 hover:bg-red-50 hover:text-red-700">रद्द</button>}
                                </>
                              : <button type="button" onClick={() => onDayClick(now)} className="min-h-[44px] flex-1 rounded-lg px-2 text-center text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800">आज</button>
                            }
                          </div>
                        </div>
                      );
                    }

                    // AD calendar
                    const firstDay = new Date(pickerYear, pickerMonth, 1);
                    const lastDay  = new Date(pickerYear, pickerMonth + 1, 0);
                    const pad = Array(firstDay.getDay()).fill(null);
                    const days = Array.from({ length: lastDay.getDate() }, (_, i) => new Date(pickerYear, pickerMonth, i + 1));
                    const atMax = pickerYear === now.getFullYear() && pickerMonth === now.getMonth();
                    const prevAd = () => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); };
                    const nextAd = () => { if (!atMax) { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); } };
                    const AD_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                    return (
                      <div className="p-3" onMouseLeave={() => setHovDay(null)}>
                        {isWeek && weekHint && (
                          <div className={`text-center text-xs font-medium mb-2 px-2 py-1.5 rounded-lg ${weekPickStep === 1 ? 'bg-core-50 text-core-700' : 'text-gray-500'}`}>{weekHint}</div>
                        )}
                        <div className="flex items-center justify-between mb-2">
                          <button type="button" aria-label="Previous month" onClick={prevAd} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" aria-hidden="true" /></button>
                          <span className="font-bold text-gray-800 text-sm">{AD_MONTHS[pickerMonth]} {pickerYear}</span>
                          <button type="button" aria-label="Next month" onClick={nextAd} disabled={atMax} className={`flex h-11 w-11 items-center justify-center rounded-lg ${atMax ? 'text-gray-300' : 'text-gray-600 hover:bg-gray-100'}`}><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
                        </div>
                        <div className="grid grid-cols-7 mb-1">
                          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d, i) => <div key={i} className="text-center text-xs text-gray-400 font-medium py-0.5">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-0.5">
                          {pad.map((_, i) => <div key={`p${i}`} />)}
                          {days.map(day => {
                            const isFuture = day > now;
                            return (
                              <button key={day.getDate()} type="button" disabled={isFuture}
                                aria-label={`${AD_MONTHS[pickerMonth]} ${day.getDate()}, ${pickerYear}`}
                                onClick={() => onDayClick(day)}
                                onMouseEnter={() => isWeek && !isFuture && setHovDay(day)}
                                className={`flex min-h-[44px] w-full items-center justify-center rounded-lg text-xs font-medium transition-colors ${dayStyle(day, isFuture)}`}>
                                {day.getDate()}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                          {isWeek
                            ? <>
                                <button type="button" onClick={() => { setWeekStart(null); setWeekEnd(null); setWeekPickStep(0); setOffset(0); setShowPicker(false); }} className="min-h-[44px] flex-1 rounded-lg px-2 text-center text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800">This week</button>
                                {weekPickStep === 1 && <button type="button" onClick={() => { setWeekPickStep(0); setWeekStart(null); setWeekEnd(null); }} className="min-h-[44px] flex-1 rounded-lg px-2 text-center text-xs text-red-500 hover:bg-red-50 hover:text-red-700">Cancel</button>}
                              </>
                            : <button type="button" onClick={() => onDayClick(now)} className="min-h-[44px] flex-1 rounded-lg px-2 text-center text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800">Today</button>
                          }
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </>
        )}
        </section>
      </div>

      {loading ? (
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8" aria-label={isNepali ? 'सारांश लोड हुँदैछ' : 'Loading business summary'}>
          <div className="animate-pulse space-y-5">
            <div className="h-64 rounded-2xl bg-core-200" />
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="h-80 rounded-2xl bg-core-200" />
              <div className="h-64 rounded-2xl bg-core-200" />
            </div>
          </div>
        </div>
      ) : error ? (
        <div className="mx-auto max-w-2xl px-4 py-10 text-center">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-red-200">
            <AlertCircle className="mx-auto h-7 w-7 text-red-600" />
            <h2 className="mt-3 text-lg font-bold text-core-900">{isNepali ? 'सारांश देखाउन सकिएन' : 'We could not show the summary'}</h2>
            <p className="mt-1 text-sm text-core-600">{error}</p>
            <button
              type="button"
              onClick={() => { fetchData(); fetchInsights(); fetchPending(); }}
              className="mt-5 min-h-[44px] rounded-xl bg-core-800 px-5 text-sm font-bold text-white transition-colors hover:bg-core-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2"
            >
              {isNepali ? 'फेरि प्रयास गर्नुहोस्' : 'Try again'}
            </button>
          </div>
        </div>
      ) : !data ? null : (
        <main className="mx-auto max-w-7xl px-4 py-5 md:px-5 lg:px-8 lg:py-8">
          <AnalyticsOverview
            totalRevenue={totalRevenue}
            totalExpenses={totalExpenses}
            totalProfit={totalProfit}
            transactionCount={txnCount}
            canViewProfit={canViewProfit}
            change={change}
            previousLabel={prevPeriodLabel}
            pendingCount={pendingCount}
            onOpenPending={() => navigate('/pending')}
            txnsByDay={txnsByDay}
            range={currRange}
            period={period}
            txnsLoading={txnsLoading}
            businessRows={bizRows}
            onSelectBusiness={setSelectedBiz}
            isNepali={isNepali}
          />

        </main>
      )}

      <div className="xl:hidden">
        <BottomNav active="analytics" />
      </div>

      {/* ── Business drill-down sheet ── */}
      <BusinessDrillSheet
        bizCode={selectedBiz}
        bizConfig={BUSINESS_CONFIG}
        txns={periodTxns}
        onClose={() => setSelectedBiz(null)}
        periodLabel={periodLabel}
        isNepali={isNepali}
        canViewProfit={canViewProfit}
      />
    </div>
  );
}
