import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Fuel, Zap, Sofa, Home, Banknote,
  TrendingUp, TrendingDown, BarChart3, Building2,
  Receipt, AlertCircle,
  Star, Droplets, Battery,
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import { formatBsDate } from '../utils/nepaliDate';

const BUSINESS_CONFIG = {
  petrol:    { icon: Fuel,     color: 'bg-orange-500', text: 'text-orange-600', labelEn: 'Petrol Pump', labelNe: 'पेट्रोल पम्प' },
  ev:        { icon: Zap,      color: 'bg-green-500',  text: 'text-green-600',  labelEn: 'EV',          labelNe: 'EV' },
  furniture: { icon: Sofa,     color: 'bg-purple-500', text: 'text-purple-600', labelEn: 'Furniture',   labelNe: 'फर्निचर' },
  rental:    { icon: Home,     color: 'bg-blue-500',   text: 'text-blue-600',   labelEn: 'Rental',      labelNe: 'भाडा' },
  loan:      { icon: Banknote, color: 'bg-red-500',    text: 'text-red-600',    labelEn: 'Loans',       labelNe: 'ऋण' },
};

const fmt = (n) => {
  if (n == null || isNaN(Number(n))) return '—';
  return `रु ${Math.abs(Number(n)).toLocaleString('en-IN')}`;
};

const pctChange = (curr, prev) => {
  if (!prev || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 100);
};

// Date range helpers
function getPeriodRange(period, offset = 0) {
  const now = new Date();
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
  const d = new Date(dateStr + 'T12:00:00');
  return d >= range.start && d <= range.end;
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
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [txnsLoading, setTxnsLoading] = useState(false);

  // Derived insight state
  const [txnsByDay, setTxnsByDay]             = useState([]);
  const [cashBankSplit, setCashBankSplit]     = useState({ cash: 0, bank: 0 });
  const [volumeMetrics, setVolumeMetrics]     = useState({ petrolLiters: 0, dieselLiters: 0, evKwh: 0 });
  const [prevRevenue, setPrevRevenue]         = useState(null);
  const [peakDay, setPeakDay]                 = useState(null);
  const [pendingCount, setPendingCount]       = useState(0);
  const [outstandingBalance, setOutstanding]  = useState(null);

  useEffect(() => {
    fetchData();
    fetchInsights();
    fetchPending();
    fetchOutstanding();
  }, [period, offset]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/analytics/summary?period=${period}&offset=${offset}`);
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

      const currRange = getPeriodRange(period, offset);
      const prevRange = getPeriodRange(period, offset + 1);

      const sales    = all.filter(t => t.status !== 'REJECTED' && t.transactionType === 'SALE');
      const currSales = sales.filter(t => t.transactionDate && inRange(t.transactionDate, currRange));
      const prevSales = sales.filter(t => t.transactionDate && inRange(t.transactionDate, prevRange));

      // Previous period revenue
      const prevTotal = prevSales.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
      setPrevRevenue(prevTotal);

      // Cash / Bank split
      let cash = 0, bank = 0;
      currSales.forEach(t => {
        const pm = (t.customFields?.paymentMethod || t.paymentMethod || '').toLowerCase();
        if (pm === 'cash') cash += parseFloat(t.amount || 0);
        else bank += parseFloat(t.amount || 0);
      });
      setCashBankSplit({ cash, bank });

      // Volume metrics
      let petrolLiters = 0, dieselLiters = 0, evKwh = 0;
      currSales.forEach(t => {
        if (t.businessCode === 'petrol' && t.customFields?.liters) {
          const ft = (t.customFields.fuelType || '').toLowerCase();
          if (ft === 'diesel') dieselLiters += parseFloat(t.customFields.liters);
          else petrolLiters += parseFloat(t.customFields.liters);
        }
        if (t.businessCode === 'ev' && t.customFields?.kWh) {
          evKwh += parseFloat(t.customFields.kWh);
        }
      });
      setVolumeMetrics({ petrolLiters, dieselLiters, evKwh });

      // Day-by-day breakdown (current period only)
      if (period !== 'today') {
        const map = {};
        currSales.forEach(t => {
          const d = t.transactionDate;
          if (!d) return;
          if (!map[d]) map[d] = { date: d, petrol: 0, ev: 0, furniture: 0, rental: 0, loan: 0, total: 0, txnCount: 0 };
          const code = t.businessCode;
          if (map[d][code] !== undefined) map[d][code] += parseFloat(t.amount || 0);
          map[d].total += parseFloat(t.amount || 0);
          map[d].txnCount += 1;
        });
        const sorted = Object.values(map).sort((a, b) => b.date.localeCompare(a.date));
        setTxnsByDay(sorted);
        // Peak day
        const peak = sorted.reduce((best, r) => (!best || r.total > best.total ? r : best), null);
        setPeakDay(peak);
      } else {
        setTxnsByDay([]);
        setPeakDay(null);
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
      const pending = res.data.filter(t => t.status === 'PENDING');
      setPendingCount(pending.length);
    } catch { /* silent */ }
  };

  const fetchOutstanding = async () => {
    try {
      const res = await api.get('/api/rental-properties');
      const active = (res.data || []).filter(p => p.status === 'ACTIVE' || p.isActive);
      if (active.length === 0) { setOutstanding(0); return; }
      const ledgers = await Promise.all(
        active.map(p => api.get(`/api/rental-properties/${p.id}/ledger`).catch(() => null))
      );
      const total = ledgers.reduce((sum, r) => {
        const bal = r?.data?.outstandingBalance;
        return sum + (bal ? parseFloat(bal) : 0);
      }, 0);
      setOutstanding(total);
    } catch { /* silent */ }
  };

  // Compute the actual date range for current offset to show in nav
  const currRange = getPeriodRange(period, offset);
  const periodLabel = (() => {
    if (offset === 0) {
      return { today: isNepali ? 'आज' : 'Today', week: isNepali ? 'यो हप्ता' : 'This Week', month: isNepali ? 'यो महिना' : 'This Month' }[period];
    }
    const { start, end } = currRange;
    const fmtD = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: start.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
    if (period === 'today') return fmtD(start);
    if (period === 'month') return start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `${fmtD(start)} – ${fmtD(end)}`;
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
  const cashPct = (cashBankSplit.cash + cashBankSplit.bank) > 0
    ? Math.round((cashBankSplit.cash / (cashBankSplit.cash + cashBankSplit.bank)) * 100)
    : 0;

  const bizRows = data?.businesses
    ? Object.entries(BUSINESS_CONFIG)
        .map(([code, cfg]) => ({ code, cfg, biz: data.businesses[code] }))
        .filter(({ biz }) => biz)
        .sort((a, b) => Number(b.biz.revenue || 0) - Number(a.biz.revenue || 0))
    : [];

  const maxRev = bizRows.reduce((m, { biz }) => Math.max(m, Number(biz.revenue || 0)), 0);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <BarChart3 className="w-6 h-6 ml-3" />
            <h1 className="text-xl font-bold ml-2">{isNepali ? 'डासबोर्ड' : 'Dashboard'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <button
                onClick={() => navigate('/pending-review')}
                className="flex items-center gap-1.5 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1.5 rounded-full"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {pendingCount} {isNepali ? 'पेन्डिङ' : 'pending'}
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* Period Selector */}
      <div className="bg-white border-b">
        {isStaff ? (
          <p className="text-center text-sm text-gray-500 py-3">{isNepali ? 'आजको सारांश' : "Today's Summary"}</p>
        ) : (
          <>
            <div className="flex gap-2 px-4 pt-3 pb-2">
              {['today', 'week', 'month'].map(p => (
                <button key={p} onClick={() => { setPeriod(p); setOffset(0); }}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm transition-colors ${
                    period === p ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {{ today: isNepali ? 'आज' : 'Today', week: isNepali ? 'हप्ता' : 'Week', month: isNepali ? 'महिना' : 'Month' }[p]}
                </button>
              ))}
            </div>
            {/* Period navigation arrows */}
            <div className="flex items-center justify-between px-4 pb-3">
              <button onClick={() => setOffset(o => o + 1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 active:text-indigo-700 transition-colors py-1 px-2 -mx-2 rounded-lg">
                <ChevronLeft className="w-4 h-4" />
                {isNepali ? 'अघिल्लो' : 'Prev'}
              </button>
              <span className="text-sm font-semibold text-gray-800">{periodLabel}</span>
              <button onClick={() => setOffset(o => Math.max(0, o - 1))}
                disabled={offset === 0}
                className={`flex items-center gap-1 text-sm transition-colors py-1 px-2 -mx-2 rounded-lg ${
                  offset === 0 ? 'text-gray-300 cursor-default' : 'text-gray-500 hover:text-indigo-600 active:text-indigo-700'
                }`}>
                {isNepali ? 'अर्को' : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : error ? (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center text-sm">{error}</div>
      ) : !data ? null : (
        <div className="p-4 space-y-4">

          {/* ── Revenue hero card ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 pt-4 pb-5 text-white">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs opacity-75">{isNepali ? 'कुल आम्दानी' : 'Total Revenue'} · {periodLabel}</p>
                  <p className="text-3xl font-black mt-1">{fmt(totalRevenue)}</p>
                </div>
                {change !== null && (
                  <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold mt-1 ${
                    change >= 0 ? 'bg-green-400/30 text-green-100' : 'bg-red-400/30 text-red-100'
                  }`}>
                    {change >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {change >= 0 ? '+' : ''}{change}% {isNepali ? 'बनाम' : 'vs'} {prevPeriodLabel}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs opacity-85">
                <span className="flex items-center gap-1">
                  <Receipt className="w-3.5 h-3.5" />
                  {txnCount} {isNepali ? 'कारोबार' : 'txns'}
                </span>
                {totalExpenses > 0 && (
                  <span className="flex items-center gap-1">
                    <TrendingDown className="w-3.5 h-3.5" />
                    {fmt(totalExpenses)} {isNepali ? 'खर्च' : 'expenses'}
                  </span>
                )}
                {canViewProfit && totalProfit != null && (
                  <span className={`flex items-center gap-1 font-bold ${totalProfit >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    <TrendingUp className="w-3.5 h-3.5" />
                    {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)} {isNepali ? 'नाफा' : 'profit'}
                  </span>
                )}
              </div>
            </div>

            {/* Cash vs Bank split */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                <span className="font-semibold text-gray-700">{isNepali ? 'भुक्तानी विधि' : 'Payment Split'}</span>
                <span>{cashPct}% {isNepali ? 'नगद' : 'cash'} · {100 - cashPct}% {isNepali ? 'डिजिटल' : 'digital'}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${cashPct}%` }} />
                <div className="h-full bg-blue-400 transition-all" style={{ width: `${100 - cashPct}%` }} />
              </div>
              <div className="flex justify-between mt-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-gray-600">{isNepali ? 'नगद' : 'Cash'} {fmt(cashBankSplit.cash)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-xs text-gray-600">{isNepali ? 'डिजिटल' : 'Digital/Bank'} {fmt(cashBankSplit.bank)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Volume metrics (petrol + diesel + EV) ── */}
          {(volumeMetrics.petrolLiters > 0 || volumeMetrics.dieselLiters > 0 || volumeMetrics.evKwh > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {volumeMetrics.petrolLiters > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900">{volumeMetrics.petrolLiters.toFixed(1)}L</p>
                    <p className="text-[10px] text-gray-400">{isNepali ? 'पेट्रोल बिक्री' : 'Petrol Sold'}</p>
                  </div>
                </div>
              )}
              {volumeMetrics.dieselLiters > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Droplets className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900">{volumeMetrics.dieselLiters.toFixed(1)}L</p>
                    <p className="text-[10px] text-gray-400">{isNepali ? 'डिजेल बिक्री' : 'Diesel Sold'}</p>
                  </div>
                </div>
              )}
              {volumeMetrics.evKwh > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Battery className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-lg font-black text-gray-900">{volumeMetrics.evKwh.toFixed(1)} kWh</p>
                    <p className="text-[10px] text-gray-400">{isNepali ? 'EV चार्ज' : 'EV Charged'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Peak day callout (week/month) ── */}
          {peakDay && period !== 'today' && (
            <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Star className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">{isNepali ? 'सबैभन्दा राम्रो दिन' : 'Best Day'} · {periodLabel}</p>
                <p className="font-bold text-gray-800">{formatBsDate(peakDay.date, isNepali)}</p>
              </div>
              <div className="text-right">
                <p className="font-black text-gray-900">{fmt(peakDay.total)}</p>
                <p className="text-[10px] text-gray-400">{peakDay.txnCount} {isNepali ? 'कारोबार' : 'txns'}</p>
              </div>
            </div>
          )}

          {/* ── Business Performance ── */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-bold text-gray-800">{isNepali ? 'व्यापार प्रदर्शन' : 'Business Performance'}</h2>
            </div>
            {bizRows.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">{isNepali ? 'यस अवधिमा कुनै डाटा छैन' : 'No data for this period'}</p>
            ) : (
              <div className="divide-y">
                {bizRows.map(({ code, cfg, biz }) => {
                  const rev    = Number(biz.revenue  || 0);
                  const exp    = Number(biz.expenses || 0);
                  const cnt    = biz.count || 0;
                  const profit = biz.profit != null ? Number(biz.profit) : null;
                  const pct    = maxRev > 0 ? (rev / maxRev) * 100 : 0;
                  const Icon   = cfg.icon;
                  const revShare = totalRevenue > 0 ? Math.round((rev / totalRevenue) * 100) : 0;
                  return (
                    <div key={code} className="px-4 py-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`${cfg.color} w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{isNepali ? cfg.labelNe : cfg.labelEn}</p>
                            <p className="text-[10px] text-gray-400">
                              {cnt} {isNepali ? 'कारोबार' : 'txns'} · {revShare}% {isNepali ? 'हिस्सा' : 'share'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-sm">{fmt(rev)}</p>
                          {canViewProfit && code !== 'loan' && profit != null && (
                            <p className={`text-xs font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {profit >= 0 ? '+' : ''}{fmt(profit)} {isNepali ? 'नाफा' : 'profit'}
                            </p>
                          )}
                          {canViewProfit && code === 'loan' && (
                            <p className="text-[10px] text-gray-400 italic">{isNepali ? 'पोर्टफोलियो हेर्नुहोस्' : 'see portfolio'}</p>
                          )}
                          {!canViewProfit && exp > 0 && (
                            <p className="text-xs text-red-400">-{fmt(exp)}</p>
                          )}
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${cfg.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {canViewProfit && totalProfit != null && bizRows.length > 0 && (
              <div className="px-4 py-3 border-t bg-indigo-50 flex items-center justify-between">
                <p className="font-bold text-gray-700 text-sm">{isNepali ? 'कुल नाफा' : 'Total Net Profit'}</p>
                <p className={`text-lg font-black ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalProfit >= 0 ? '+' : ''}{fmt(totalProfit)}
                </p>
              </div>
            )}
          </div>

          {/* ── Daily Breakdown cards ── */}
          {period !== 'today' && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-800">{isNepali ? 'दैनिक विवरण' : 'Daily Breakdown'}</h2>
                {txnsLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" />}
              </div>
              {txnsByDay.length === 0 && !txnsLoading ? (
                <p className="text-center text-gray-400 text-sm py-6">{isNepali ? 'डाटा उपलब्ध छैन' : 'No data'}</p>
              ) : (
                <div className="divide-y">
                  {txnsByDay.map(row => {
                    const isPeak = peakDay?.date === row.date;
                    const activeBiz = Object.entries(BUSINESS_CONFIG).filter(([code]) => row[code] > 0);
                    return (
                      <div key={row.date} className={`px-4 py-3 ${isPeak ? 'bg-yellow-50' : ''}`}>
                        {/* Top row: date + total */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{formatBsDate(row.date, isNepali)}</p>
                            {isPeak && (
                              <span className="text-[10px] text-yellow-600 font-bold">★ {isNepali ? 'सर्वोत्तम दिन' : 'Best day'}</span>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-gray-900">{fmt(row.total)}</p>
                            <p className="text-[10px] text-gray-400">{row.txnCount} {isNepali ? 'कारोबार' : 'txns'}</p>
                          </div>
                        </div>
                        {/* Proportional colour bar */}
                        {row.total > 0 && (
                          <div className="h-1.5 rounded-full overflow-hidden flex mb-2">
                            {activeBiz.map(([code, cfg]) => (
                              <div key={code} className={`h-full ${cfg.color}`}
                                style={{ width: `${(row[code] / row.total) * 100}%` }} />
                            ))}
                          </div>
                        )}
                        {/* Business pills */}
                        <div className="flex flex-wrap gap-1.5">
                          {activeBiz.map(([code, cfg]) => (
                            <span key={code} className="flex items-center gap-1 text-[11px] text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">
                              <span className={`w-2 h-2 rounded-full ${cfg.color} flex-shrink-0`} />
                              {isNepali ? cfg.labelNe : cfg.labelEn} {fmt(row[code])}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {/* Period total footer */}
                  {txnsByDay.length > 1 && (
                    <div className="px-4 py-3 bg-indigo-50 flex items-center justify-between">
                      <p className="font-bold text-gray-700 text-sm">{isNepali ? 'कुल जम्मा' : 'Period Total'}</p>
                      <p className="font-black text-indigo-700">{fmt(txnsByDay.reduce((s, r) => s + r.total, 0))}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Rental Health ── */}
          {data.rentalHealth && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-gray-800">{isNepali ? 'भाडा स्वास्थ्य' : 'Rental Health'}</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-2xl font-black text-blue-700">
                      {data.rentalHealth.occupiedCount}
                      <span className="text-sm text-blue-400">/{data.rentalHealth.totalProperties}</span>
                    </p>
                    <p className="text-[10px] text-blue-600 mt-0.5">{isNepali ? 'व्यस्त' : 'Occupied'}</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="font-black text-blue-700 text-sm leading-tight">{fmt(data.rentalHealth.monthlyRecurring)}</p>
                    <p className="text-[10px] text-blue-600 mt-0.5">{isNepali ? 'मासिक' : 'Monthly'}</p>
                  </div>
                  <div className={`rounded-xl p-3 text-center ${outstandingBalance > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <p className={`font-black text-sm leading-tight ${outstandingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                      {outstandingBalance != null ? fmt(outstandingBalance) : '—'}
                    </p>
                    <p className={`text-[10px] mt-0.5 ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {isNepali ? 'बाँकी' : 'Outstanding'}
                    </p>
                  </div>
                </div>
                {data.rentalHealth.totalProperties > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>{isNepali ? 'अधिभोग दर' : 'Occupancy Rate'}</span>
                      <span className="font-semibold text-blue-600">
                        {Math.round((data.rentalHealth.occupiedCount / data.rentalHealth.totalProperties) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((data.rentalHealth.occupiedCount / data.rentalHealth.totalProperties) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Loan Portfolio ── */}
          {canViewProfit && data.loanPortfolio && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-red-500" />
                <h2 className="font-bold text-gray-800">{isNepali ? 'ऋण पोर्टफोलियो' : 'Loan Portfolio'}</h2>
                <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">
                  {data.loanPortfolio.activeLoans} {isNepali ? 'सक्रिय' : 'active'}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-red-50 rounded-xl p-3">
                    <p className="text-xs text-red-500 mb-0.5">{isNepali ? 'कुल सावाँ' : 'Principal Outstanding'}</p>
                    <p className="font-black text-red-700">{fmt(data.loanPortfolio.totalPrincipal)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3">
                    <p className="text-xs text-orange-500 mb-0.5">{isNepali ? 'जम्मा ब्याज' : 'Accrued Interest'}</p>
                    <p className="font-black text-orange-700">{fmt(data.loanPortfolio.totalAccruedInterest)}</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-3 col-span-2">
                    <p className="text-xs text-green-500 mb-0.5">{isNepali ? 'कुल भुक्तानी' : 'Total Repaid'}</p>
                    <p className="font-black text-green-700">{fmt(data.loanPortfolio.totalRepaid)}</p>
                  </div>
                </div>
                {Number(data.loanPortfolio.totalPrincipal) > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>{isNepali ? 'भुक्तानी प्रगति' : 'Repayment Progress'}</span>
                      <span className="font-semibold text-indigo-600">
                        {Math.min(100, Math.round((Number(data.loanPortfolio.totalRepaid) / Number(data.loanPortfolio.totalPrincipal)) * 100))}%
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, Math.round((Number(data.loanPortfolio.totalRepaid) / Number(data.loanPortfolio.totalPrincipal)) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
