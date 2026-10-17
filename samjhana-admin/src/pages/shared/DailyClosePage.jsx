import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Fuel,
  Zap,
  Package,
  CheckCircle2,
  Lock,
  Banknote,
  Building2,
  TrendingUp,
  TrendingDown,
  Pencil,
  X,
  ShieldCheck,
  Clock,
  Sofa,
  Hexagon,
  Home,
  AlertTriangle,
  Droplet,
  ChevronRight,
  CalendarDays,
} from 'lucide-react';
import api from '../../utils/api';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { formatBsDate } from '../../utils/nepaliDate';
import { PageHeader } from '../../components/brand';
import { addDays, nepalToday } from '../../utils/businessDay';
import useDesktop from '../../hooks/useDesktop';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import ChipSlider from '../../components/ChipSlider';

const BUSINESS_ICONS = {
  petrol: { icon: Fuel, color: 'bg-petrol-500' },
  ev: { icon: Zap, color: 'bg-ev-500' },
  furniture: { icon: Sofa, color: 'bg-furniture-500' },
  beekeeping: { icon: Hexagon, color: 'bg-beekeeping-500' },
  rental: { icon: Home, color: 'bg-rental-500' },
  loan: { icon: Banknote, color: 'bg-loans-500' },
};

const BUSINESS_CONFIG = {
  petrol:    { icon: Fuel,     color: 'bg-petrol-500', label: 'Petrol Pump', labelNe: 'पेट्रोल पम्प' },
  ev:        { icon: Zap,      color: 'bg-ev-500',  label: 'EV',          labelNe: 'EV' },
  furniture: { icon: Sofa,     color: 'bg-furniture-500', label: 'Furniture',   labelNe: 'फर्निचर' },
  beekeeping: { icon: Hexagon, color: 'bg-beekeeping-500', label: 'Beekeeping',  labelNe: 'मौरीपालन' },
  rental:    { icon: Home,     color: 'bg-rental-500',   label: 'Rental',      labelNe: 'भाडा' },
  loan:      { icon: Banknote, color: 'bg-loans-500',    label: 'Loan',        labelNe: 'ऋण' },
};

const fmt = (n) => `रु ${Math.abs(Number(n)).toLocaleString('en-IN')}`;

function txnLabel(txn, t) {
  const cf = txn.customFields;
  if (!cf) return txn.businessName || txn.businessCode;
  switch (txn.businessCode) {
    case 'petrol': {
      const ft = cf.fuelType?.toLowerCase() === 'diesel' ? t('petrol.diesel') : t('petrol.petrol');
      if (cf.liters) return `${ft} — ${parseFloat(cf.liters).toFixed(2)}L @ रु${parseFloat(cf.ratePerLiter || 0).toFixed(2)}`;
      return ft;
    }
    case 'ev':
      return cf.unitsCharged
        ? `EV — ${parseFloat(cf.unitsCharged).toFixed(2)} kWh`
        : 'EV Charging';
    case 'rental':
      return cf.propertyName
        ? `${cf.propertyName}${cf.tenantName ? ` (${cf.tenantName})` : ''}`
        : txn.businessName || 'Rental';
    case 'furniture':
      return cf.customerName ? `${t('furniture.order')} — ${cf.customerName}` : t('furniture.order');
    case 'beekeeping': {
      const first = Array.isArray(cf.items) && cf.items[0]?.itemName;
      const more = Array.isArray(cf.items) && cf.items.length > 1 ? ` +${cf.items.length - 1}` : '';
      const what = first ? `${first}${more}` : t('business.beekeeping');
      return cf.customerName ? `${what} — ${cf.customerName}` : what;
    }
    case 'loan':
      return cf.bankName ? `Loan — ${cf.bankName}` : 'Loan';
    default:
      return txn.businessName || txn.businessCode;
  }
}

/** "09:30" from the time a transaction was saved (the server keeps Nepal local time). */
const txnTime = (createdAt) => {
  const match = /T(\d{2}):(\d{2})/.exec(createdAt || '');
  return match ? `${match[1]}:${match[2]}` : '';
};

/** The small line under a transaction's name: who entered it, plus detail that does not fit the name. */
function txnSubline(txn, t) {
  const cf = txn.customFields || {};
  const parts = [];
  if (txn.businessCode === 'ev' && cf.chargingMode === 'PERCENTAGE') {
    if (cf.vehicleName) parts.push(cf.vehicleName);
    parts.push(`${cf.startPercent}%→${cf.endPercent}%`);
  }
  if (txn.businessCode === 'rental') {
    if (cf.rentalMonth) parts.push(cf.rentalMonth);
    if (cf.paymentType) parts.push(cf.paymentType);
  }
  parts.push(`${t('dailyClose.byLabel')} ${txn.enteredByName}`);
  return parts.join(' · ');
}

const PAYMENT_TONE = {
  cash: 'bg-green-100 text-green-800',
  bank: 'bg-blue-100 text-blue-800',
  out: 'bg-red-100 text-red-800',
};

/**
 * One transaction on one compact line: time, business tile, what it was, its payment tag, a signed
 * amount, and (for admins) the edit button. Used by the review list and the Reports ledger.
 * `txn.customFields` must already be parsed.
 */
function TxnRow({ txn, t, num, format, onEdit }) {
  const business = BUSINESS_CONFIG[txn.businessCode] || {};
  const Icon = business.icon || Banknote;
  const isSale = txn.transactionType === 'SALE';
  const pm = txn.customFields?.paymentMethod;
  const payment = pm
    ? { label: pm.toUpperCase() === 'CASH' ? t('common.cash') : t('common.bank'), tone: pm.toUpperCase() === 'CASH' ? 'cash' : 'bank' }
    : isSale
      ? { label: t('transactionType.sale'), tone: 'cash' }
      : { label: t('transactionType.purchase'), tone: 'out' };

  return (
    <li className={`flex min-h-[64px] items-center gap-3 px-4 py-2 sm:px-5 ${isSale ? '' : 'bg-red-50/40'}`}>
      <span className="w-11 shrink-0 text-sm tabular-nums text-gray-600">{num(txnTime(txn.createdAt))}</span>
      <div className={`${business.color || 'bg-gray-400'} grid h-8 w-8 shrink-0 place-items-center rounded-lg`}>
        <Icon className="h-4 w-4 text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold text-gray-800">{txnLabel(txn, t)}</p>
        <p className="truncate text-xs text-gray-600">{txnSubline(txn, t)}</p>
        {txn.notes && <p className="truncate text-xs italic text-gray-600">"{txn.notes}"</p>}
      </div>
      {/* On a phone the payment tag sits under the amount; on desktop it is its own column */}
      <div className="flex shrink-0 flex-col items-end gap-1 lg:contents">
        <p className={`order-1 w-24 text-right text-sm font-bold tabular-nums lg:order-2 lg:w-28 ${isSale ? 'text-green-700' : 'text-red-700'}`}>
          {isSale ? '+' : '−'}{format(txn.amount)}
        </p>
        <div className="order-2 flex justify-end lg:order-1 lg:w-28 lg:justify-center">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PAYMENT_TONE[payment.tone]}`}>{payment.label}</span>
        </div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          aria-label={t('dailyClose.editTransaction')}
          className="order-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-core-50 hover:text-core-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500"
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

export default function DailyClosePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const canViewProfit = user.role === 'ADMIN' || user.role === 'MANAGER';
  const { toasts, showToast, removeToast } = useToast();
  const desktop = useDesktop();
  const { num } = useLocaleFormat();

  const [activeTab, setActiveTab] = useState('close');
  const [businessDate, setBusinessDate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cashCounted, setCashCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Transaction list & edit state
  const [transactions, setTransactions] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, transaction: null });
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Verification state
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Confirm modal
  const [showConfirm, setShowConfirm] = useState(false);

  // Transaction review toggle (open view)
  const [showTxnReview, setShowTxnReview] = useState(false);
  // Desktop shows the first few transactions and a button for the rest
  const [showAllTxns, setShowAllTxns] = useState(false);
  // Reports tab: which transactions the ledger shows (all, sale, purchase, cash, bank)
  const [reportFilter, setReportFilter] = useState('all');

  // Last close for comparison
  const [lastReport, setLastReport] = useState(null);

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    setLoading(true);
    try {
      const bdRes = await api.get('/api/daily-reports/business-date');
      const bDate = bdRes.data.date;
      setBusinessDate(bDate);

      const [summaryRes, recentRes] = await Promise.all([
        api.get(`/api/daily-reports/today-summary?date=${bDate}`),
        api.get('/api/daily-reports/recent'),
      ]);
      setSummary(summaryRes.data);

      const recent = Array.isArray(recentRes.data) ? recentRes.data : [];
      const prev = recent.find(r => r.reportDate !== bDate) || null;
      setLastReport(prev);

      fetchTransactions(bDate);
    } catch (err) {
      console.error('Failed to load page', err);
      showToast(t('dailyClose.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (date) => {
    try {
      const res = await api.get(`/api/daily-reports/${date}/transactions`);
      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    }
  };

  const handleSubmit = async () => {
    if (!cashCounted || parseFloat(cashCounted) < 0) {
      showToast(t('dailyClose.enterCashFirst'), 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/daily-reports/close', {
        date: businessDate,
        cashCounted: parseFloat(cashCounted),
        notes: notes || null,
      });
      setShowConfirm(false);
      loadPage();
    } catch (err) {
      if (err.response?.status === 409) {
        showToast(t('dailyClose.alreadyClosed'), 'error');
        loadPage();
      } else {
        showToast(t('dailyClose.failedToClose'), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (txn) => {
    const customFields = parseCustomFields(txn.customFields);
    setEditError('');
    setEditForm({
      amount: txn.amount,
      transactionType: txn.transactionType,
      notes: txn.notes || '',
      referenceNumber: txn.referenceNumber || '',
      ...customFields,
    });
    setEditModal({ open: true, transaction: txn });
  };

  const handleEditSave = async () => {
    const txn = editModal.transaction;
    setEditSaving(true);
    setEditError('');
    try {
      const { amount, transactionType, notes: editNotes, referenceNumber, ...customFields } = editForm;
      await api.put(`/api/transactions/${txn.id}`, {
        amount: parseFloat(amount),
        transactionType,
        notes: editNotes,
        referenceNumber,
        transactionDate: txn.transactionDate,
        customFields,
      });
      setEditModal({ open: false, transaction: null });
      loadPage();
    } catch (err) {
      setEditError(err.response?.data?.message || t('dailyClose.failedToSave'));
    } finally {
      setEditSaving(false);
    }
  };

  const handleVerify = async () => {
    setVerifying(true);
    try {
      await api.patch(`/api/daily-reports/${businessDate}/verify`, {
        notes: verifyNotes || null,
      });
      loadPage();
    } catch (err) {
      console.error('Failed to verify report', err);
    } finally {
      setVerifying(false);
    }
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return `रु ${Math.abs(num).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const formatLiters = (liters) => {
    const num = parseFloat(liters) || 0;
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
  };

  const formatUnits = (units) => {
    const num = parseFloat(units) || 0;
    return `${num.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`;
  };

  const parseCustomFields = (json) => {
    if (!json) return {};
    try {
      return typeof json === 'string' ? JSON.parse(json) : json;
    } catch {
      return {};
    }
  };

  const formatDateLabel = (dateStr) => {
    const todayStr = nepalToday();
    const yesterdayStr = addDays(todayStr, -1);
    const tomorrowStr = addDays(todayStr, 1);

    if (dateStr === todayStr) return t('common.today');
    if (dateStr === tomorrowStr) return t('dailyClose.tomorrow');
    if (dateStr === yesterdayStr) return t('common.yesterday');
    return formatBsDate(dateStr, isNepali);
  };

  // ── Report tab computed data ──────────────────────────────────────────────

  const reportTxns = transactions.map(txn => ({
    ...txn,
    customFields: parseCustomFields(txn.customFields),
  }));

  const totalIncome  = reportTxns.filter(t => t.transactionType === 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpense = reportTxns.filter(t => t.transactionType !== 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
  const netAmount    = totalIncome - totalExpense;

  const totalCash = reportTxns
    .filter(t => t.transactionType === 'SALE' && t.customFields?.paymentMethod?.toUpperCase() === 'CASH')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalBank = reportTxns
    .filter(t => t.transactionType === 'SALE' && t.customFields?.paymentMethod?.toUpperCase() === 'BANK')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  const businessBreakdown = Object.entries(BUSINESS_CONFIG).map(([code, config]) => {
    const bTxns = reportTxns.filter(t => t.businessCode === code);
    const income  = bTxns.filter(t => t.transactionType === 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expense = bTxns.filter(t => t.transactionType !== 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
    return { code, ...config, income, expense, net: income - expense, count: bTxns.length };
  }).filter(b => b.count > 0);

  const fuelProfitData = canViewProfit ? (() => {
    const calc = (fuelType) => {
      const sales = reportTxns.filter(t =>
        t.businessCode === 'petrol' && t.transactionType === 'SALE' &&
        t.customFields?.fuelType?.toLowerCase() === fuelType
      );
      const tracked = sales.filter(t => t.customFields?.purchaseRate != null && t.customFields?.liters != null);
      const totalRevenue = sales.reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalCost = tracked.reduce((s, t) => s + parseFloat(t.customFields.purchaseRate) * parseFloat(t.customFields.liters), 0);
      const trackedRevenue = tracked.reduce((s, t) => s + parseFloat(t.amount), 0);
      const totalProfit = trackedRevenue - totalCost;
      const totalLiters = tracked.reduce((s, t) => s + parseFloat(t.customFields.liters), 0);
      const margin = trackedRevenue > 0 ? ((totalProfit / trackedRevenue) * 100).toFixed(1) : '0.0';
      return { totalRevenue, totalCost, totalProfit, totalLiters, margin, count: sales.length, trackedCount: tracked.length };
    };
    return { petrol: calc('petrol'), diesel: calc('diesel') };
  })() : null;

  const evProfitData = canViewProfit ? (() => {
    const evTxns = reportTxns.filter(t => t.businessCode === 'ev' && t.transactionType === 'SALE');
    const tracked = evTxns.filter(t => t.customFields?.profit != null);
    const totalProfit = tracked.reduce((s, t) => s + parseFloat(t.customFields.profit), 0);
    const totalRevenue = evTxns.reduce((s, t) => s + parseFloat(t.amount), 0);
    const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    return { totalProfit, totalRevenue, margin, count: evTxns.length, trackedCount: tracked.length };
  })() : null;

  const sortedReportTxns = [...reportTxns].sort((a, b) => {
    if (a.transactionType !== b.transactionType)
      return a.transactionType === 'SALE' ? -1 : 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  // Reports ledger: filter chips and the totals of what is shown
  const isSaleTxn = (txn) => txn.transactionType === 'SALE';
  const payOf = (txn) => (txn.customFields?.paymentMethod || '').toUpperCase();
  const REPORT_FILTERS = {
    all: () => true,
    sale: isSaleTxn,
    purchase: (txn) => !isSaleTxn(txn),
    cash: (txn) => payOf(txn) === 'CASH',
    bank: (txn) => payOf(txn) === 'BANK',
  };
  const shownReportTxns = sortedReportTxns.filter(REPORT_FILTERS[reportFilter] || REPORT_FILTERS.all);
  const shownIncome = shownReportTxns.filter(isSaleTxn).reduce((sum, txn) => sum + parseFloat(txn.amount), 0);
  const shownExpense = shownReportTxns.filter((txn) => !isSaleTxn(txn)).reduce((sum, txn) => sum + parseFloat(txn.amount), 0);
  const shownNet = shownIncome - shownExpense;

  // ── Derived close-view values ─────────────────────────────────────────────

  const cashNum = parseFloat(cashCounted) || 0;
  const cashSalesTotal = summary ? parseFloat(summary.totalCashSales) || 0 : 0;
  const bankSalesTotal = summary ? parseFloat(summary.totalBankSales) || 0 : 0;
  const systemTotal = summary ? parseFloat(summary.totalSystemSales) || 0 : 0;
  const discrepancy = cashNum - cashSalesTotal;
  const hasDiscrepancy = cashCounted !== '' && Math.abs(discrepancy) > 0.5;
  const isMatch = cashCounted !== '' && Math.abs(discrepancy) <= 0.5;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-core-600"></div>
      </div>
    );
  }

  const isClosed = summary?.isClosed;
  const report = summary?.closedReport;

  // ── Day context and tab switch ──────────────────────────────────────────

  const renderTabBar = (tab1Label, tone = 'dark') => (
    <div
      className={tone === 'light'
        ? 'mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1'
        : 'mt-3 flex gap-2 lg:max-w-sm'}
      role="group"
      aria-label={t('reports.title')}
    >
      {[
        { key: 'close', label: tab1Label },
        { key: 'report', label: t('reports.title') },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          aria-pressed={activeTab === tab.key}
          className={`min-h-[44px] flex-1 rounded-lg px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 ${tone === 'light'
            ? `focus-visible:ring-core-500 focus-visible:ring-offset-2 ${activeTab === tab.key
              ? 'bg-core-800 text-white shadow-sm'
              : 'text-core-600 hover:bg-white hover:text-core-900'}`
            : `focus-visible:ring-white ${activeTab === tab.key
              ? 'bg-white text-core-800'
              : 'bg-white/10 text-white/80 hover:bg-white/20'}`
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const renderDayControls = (tab1Label) => (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-label={t('dailyClose.title')}>
      <div className="flex items-center gap-3" role="group" aria-label={t('common.date')}>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-core-100 text-core-700">
          <CalendarDays className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-core-900">{formatDateLabel(businessDate)}</p>
          <p className="truncate text-sm text-gray-600">{formatBsDate(businessDate, isNepali)}</p>
        </div>
        <time dateTime={businessDate} className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold tabular-nums text-gray-600">
          {businessDate}
        </time>
      </div>
      {renderTabBar(tab1Label, 'light')}
    </section>
  );

  // ── Report tab content ────────────────────────────────────────────────────

  const renderProfitPanel = () => {
    if (!canViewProfit) return null;
    const petrol = fuelProfitData?.petrol;
    const diesel = fuelProfitData?.diesel;
    const ev = evProfitData;
    const rows = [
      petrol?.count > 0 && {
        key: 'petrol', label: t('petrol.petrol'),
        iconBg: 'bg-red-100', iconColor: 'text-red-600', Icon: Fuel,
        revenue: petrol.totalRevenue, profit: petrol.totalProfit,
        margin: petrol.margin, tracked: petrol.trackedCount,
        detail: `${t('reports.saleCount', { count: petrol.count, formattedCount: num(petrol.count) })} · ${petrol.totalLiters.toFixed(0)}L`,
      },
      diesel?.count > 0 && {
        key: 'diesel', label: t('petrol.diesel'),
        iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', Icon: Droplet,
        revenue: diesel.totalRevenue, profit: diesel.totalProfit,
        margin: diesel.margin, tracked: diesel.trackedCount,
        detail: `${t('reports.saleCount', { count: diesel.count, formattedCount: num(diesel.count) })} · ${diesel.totalLiters.toFixed(0)}L`,
      },
      ev?.count > 0 && {
        key: 'ev', label: 'EV',
        iconBg: 'bg-green-100', iconColor: 'text-green-600', Icon: Zap,
        revenue: ev.totalRevenue, profit: ev.totalProfit,
        margin: ev.margin, tracked: ev.trackedCount,
        detail: t('reports.saleCount', { count: ev.count, formattedCount: num(ev.count) }),
      },
    ].filter(Boolean);

    if (rows.length === 0) return null;

    const combinedProfit = rows.filter(r => r.tracked > 0).reduce((sum, r) => sum + r.profit, 0);
    const profitTone = combinedProfit >= 0 ? 'text-green-700' : 'text-red-700';

    return (
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" aria-labelledby="rep-profit">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="rep-profit" className="text-base font-bold text-core-900">{t('reports.profitTitle')}</h2>
          <span className={`text-lg font-bold tabular-nums ${profitTone}`}>
            {combinedProfit >= 0 ? '+' : '−'}{fmt(combinedProfit)}
          </span>
        </div>
        <div className="divide-y divide-slate-100">
          {rows.map(({ key, label, iconBg, iconColor, Icon, revenue, profit, margin, tracked, detail }) => (
            <div key={key} className="flex items-center gap-3 px-5 py-3">
              <div className={`${iconBg} grid h-8 w-8 shrink-0 place-items-center rounded-lg`}>
                <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-600">{detail}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-gray-700">{fmt(revenue)}</p>
                {tracked > 0 ? (
                  <p className={`text-xs font-bold tabular-nums ${profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {profit >= 0 ? '+' : '−'}{fmt(profit)} · {margin}%
                  </p>
                ) : (
                  <p className="text-xs italic text-gray-600">{t('reports.noPurchaseRate').split('—')[0].trim()}</p>
                )}
              </div>
            </div>
          ))}
          <div className={`flex items-center justify-between px-5 py-3 ${combinedProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className={`text-sm font-bold ${combinedProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {t('reports.totalProfit')}
            </p>
            <p className={`text-2xl font-extrabold tabular-nums ${profitTone}`}>
              {combinedProfit >= 0 ? '+' : '−'}{fmt(combinedProfit)}
            </p>
          </div>
        </div>
      </section>
    );
  };

  const renderReportTab = () => (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:max-w-6xl lg:grid lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)] lg:items-start lg:gap-6 lg:pb-10">

      {/* The day's result, then the businesses and the profit: on desktop this column stays in view on the right */}
      <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1 lg:sticky lg:top-4 lg:gap-6">
        {desktop && renderDayControls(t('dailyClose.closeDay'))}
        <section className="rounded-2xl bg-core-800 p-5 text-white shadow-sm" aria-labelledby="rep-result">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="rep-result" className="text-sm font-semibold text-core-300">{t('reports.netAmount')}</h2>
              <p className={`mt-1 text-4xl font-extrabold leading-none tabular-nums ${netAmount >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {netAmount >= 0 ? '+' : '−'}{fmt(netAmount)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-core-300">{t('reports.transactions')}</p>
              <p className="text-2xl font-extrabold leading-tight tabular-nums">{num(reportTxns.length)}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/20 pt-4">
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-core-300"><TrendingUp className="h-4 w-4 text-green-300" aria-hidden="true" />{t('reports.income')}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums">{fmt(totalIncome)}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-xs text-core-300"><TrendingDown className="h-4 w-4 text-red-300" aria-hidden="true" />{t('reports.expense')}</dt>
              <dd className="mt-0.5 text-lg font-bold tabular-nums">{fmt(totalExpense)}</dd>
            </div>
            {(totalCash > 0 || totalBank > 0) && (
              <>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-core-300"><Banknote className="h-4 w-4" aria-hidden="true" />{t('common.cash')}</dt>
                  <dd className="mt-0.5 text-lg font-bold tabular-nums">{fmt(totalCash)}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-core-300"><Building2 className="h-4 w-4" aria-hidden="true" />{t('common.bank')}</dt>
                  <dd className="mt-0.5 text-lg font-bold tabular-nums">{fmt(totalBank)}</dd>
                </div>
              </>
            )}
          </dl>
          {(totalCash > 0 || totalBank > 0) && (
            <div className="mt-4">
              <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" role="img"
                aria-label={`${t('common.cash')} ${Math.round((totalCash / (totalCash + totalBank)) * 100)}%, ${t('common.bank')} ${Math.round((totalBank / (totalCash + totalBank)) * 100)}%`}>
                <div className="bg-ev-400" style={{ width: `${(totalCash / (totalCash + totalBank)) * 100}%` }} />
                <div className="bg-rental-400" style={{ width: `${(totalBank / (totalCash + totalBank)) * 100}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-core-300">
                <span>{t('common.cash')} {num(Math.round((totalCash / (totalCash + totalBank)) * 100))}%</span>
                <span>{t('common.bank')} {num(Math.round((totalBank / (totalCash + totalBank)) * 100))}%</span>
              </div>
            </div>
          )}
        </section>

        {businessBreakdown.length > 0 && (
          <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" aria-labelledby="rep-biz">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 id="rep-biz" className="text-base font-bold text-core-900">{t('dashboard.businessBreakdown')}</h2>
              <span className="text-xs text-gray-600">{t('reports.openInRecords')}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {businessBreakdown.map(b => {
                const Icon = b.icon;
                return (
                  <button
                    key={b.code}
                    type="button"
                    onClick={() => navigate('/records', { state: { filter: b.code } })}
                    className="flex min-h-[56px] w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core-500"
                  >
                    <div className={`${b.color} grid h-8 w-8 shrink-0 place-items-center rounded-lg`}>
                      <Icon className="h-4 w-4 text-white" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800">{isNepali ? b.labelNe : b.label}</p>
                      <p className="text-xs text-gray-600">
                        {t('reports.transactionCount', { count: b.count, formattedCount: num(b.count) })}
                        {totalIncome > 0 && ` · ${t('reports.shareOfIncome', { pct: num(Math.round((b.income / totalIncome) * 100)) })}`}
                      </p>
                      {totalIncome > 0 && (
                        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100" aria-hidden="true">
                          <div className={`h-full rounded-full ${b.color}`} style={{ width: `${Math.round((b.income / totalIncome) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold tabular-nums ${b.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {b.net >= 0 ? '+' : '−'}{fmt(b.net)}
                      </p>
                      {b.expense > 0 && (
                        <p className="text-xs tabular-nums text-gray-600">+{fmt(b.income)} / −{fmt(b.expense)}</p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {renderProfitPanel()}
      </div>

      {/* Every transaction of the day */}
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 lg:col-start-1 lg:row-start-1" aria-labelledby="rep-txns">
        <div className="px-5 pb-4 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="rep-txns" className="text-lg font-bold text-core-900">{t('reports.todayTransactions')}</h2>
            <span className="text-sm text-gray-600">{t('reports.transactionCount', { count: sortedReportTxns.length, formattedCount: num(sortedReportTxns.length) })}</span>
          </div>
          {sortedReportTxns.length > 0 && (
            <ChipSlider
              className="mt-3.5"
              label={t('reports.filterLabel')}
              value={reportFilter}
              onChange={setReportFilter}
              items={[
                { value: 'all', label: t('records.all'), count: num(sortedReportTxns.length) },
                { value: 'sale', label: t('transactionType.sale'), icon: TrendingUp, count: num(sortedReportTxns.filter(REPORT_FILTERS.sale).length) },
                { value: 'purchase', label: t('transactionType.purchase'), icon: TrendingDown, count: num(sortedReportTxns.filter(REPORT_FILTERS.purchase).length) },
                { value: 'cash', label: t('common.cash'), icon: Banknote },
                { value: 'bank', label: t('common.bank'), icon: Building2 },
              ]}
            />
          )}
        </div>
        {sortedReportTxns.length === 0 || shownReportTxns.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-600">{t('reports.noData')}</p>
        ) : (
          <div>
            <div className="flex items-center gap-3 border-t border-slate-100 bg-gray-50 px-4 py-2 text-[13px] font-semibold text-gray-600 sm:px-5">
              <span className="w-11 shrink-0">{t('reports.colTime')}</span>
              <span className="w-8 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{t('common.description')}</span>
              <span className="hidden w-28 shrink-0 text-center lg:block">{t('common.paymentMethod')}</span>
              <span className="w-24 shrink-0 text-right lg:w-28">{t('common.amount')}</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {shownReportTxns.map((txn) => (
                <TxnRow key={txn.id} txn={txn} t={t} num={num} format={fmt} />
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-x-7 gap-y-2 border-t border-gray-200 bg-gray-50 px-5 py-4 text-sm text-gray-600">
              <span>{t('reports.income')} <b className="ml-1.5 tabular-nums text-gray-800">{fmt(shownIncome)}</b></span>
              <span>{t('reports.expense')} <b className="ml-1.5 tabular-nums text-gray-800">{fmt(shownExpense)}</b></span>
              <span>{t('reports.netAmount')} <b className={`ml-1.5 tabular-nums ${shownNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>{shownNet >= 0 ? '+' : '−'}{fmt(shownNet)}</b></span>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  // =========================================================================
  // CLOSED VIEW
  // =========================================================================
  if (isClosed && report) {
    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        <PageHeader
          unit="core"
          title={t('dailyClose.dayClosed')}
          subtitle={`${formatDateLabel(businessDate)}, ${businessDate} · ${formatBsDate(businessDate, isNepali)}`}
        >
          {renderTabBar(t('dailyClose.summary'))}
        </PageHeader>

        {activeTab === 'report' ? renderReportTab() : (
          <div className="mx-auto w-full max-w-5xl p-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
              <Lock className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-800">{t('dailyClose.dayHasBeenClosed')}</p>
                <p className="text-sm text-green-600">{t('dailyClose.closedBy')} {report.closedBy}</p>
              </div>
            </div>

            <SalesBreakdown report={report} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />
            <CashSummaryCard report={report} formatAmount={formatAmount} />

            {report.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <p className="text-sm text-yellow-800 font-medium">{t('dailyClose.notes')}</p>
                <p className="text-yellow-700 mt-1">{report.notes}</p>
              </div>
            )}

            <TransactionList
              transactions={transactions}
              isAdmin={isAdmin}
              formatAmount={formatAmount}
              parseCustomFields={parseCustomFields}
              onEdit={openEditModal}
            />

            <VerificationSection
              report={report}
              isAdmin={isAdmin}
              verifyNotes={verifyNotes}
              setVerifyNotes={setVerifyNotes}
              verifying={verifying}
              onVerify={handleVerify}
            />
          </div>
        )}

        {editModal.open && (
          <EditTransactionModal
            transaction={editModal.transaction}
            editForm={editForm}
            setEditForm={setEditForm}
            saving={editSaving}
            error={editError}
            onSave={handleEditSave}
            onClose={() => { setEditModal({ open: false, transaction: null }); setEditError(''); }}
          />
        )}
        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    );
  }

  // =========================================================================
  // OPEN VIEW
  // =========================================================================
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {!desktop && (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4">
          {renderDayControls(t('dailyClose.closeDay'))}
        </div>
      )}

      {activeTab === 'report' ? renderReportTab() : (
        <>
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 pb-44 lg:max-w-6xl lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(380px,1fr)] lg:items-start lg:gap-6 lg:pb-10">
            {/* How the day went */}
            <div className="flex flex-col gap-4 lg:gap-6">
              <SalesSummary
                desktop={desktop}
                summary={summary}
                systemTotal={systemTotal}
                cashSalesTotal={cashSalesTotal}
                bankSalesTotal={bankSalesTotal}
                lastReport={lastReport}
                isNepali={isNepali}
                num={num}
                formatAmount={formatAmount}
                formatLiters={formatLiters}
                formatUnits={formatUnits}
              />

              {transactions.length > 0 && (
                <ReviewPanel
                  desktop={desktop}
                  transactions={transactions}
                  open={showTxnReview}
                  onToggle={() => setShowTxnReview((v) => !v)}
                  showAll={showAllTxns}
                  onToggleAll={() => setShowAllTxns((v) => !v)}
                  isAdmin={isAdmin}
                  num={num}
                  formatAmount={formatAmount}
                  parseCustomFields={parseCustomFields}
                  onEdit={openEditModal}
                />
              )}
            </div>

            {/* Closing the day: stays in view beside the summary on desktop */}
            <div className="space-y-3 lg:sticky lg:top-4">
              {desktop && renderDayControls(t('dailyClose.closeDay'))}
              <ClosePanel
                desktop={desktop}
                cashCounted={cashCounted}
                setCashCounted={setCashCounted}
                cashSalesTotal={cashSalesTotal}
                discrepancy={discrepancy}
                isMatch={isMatch}
                hasDiscrepancy={hasDiscrepancy}
                notes={notes}
                setNotes={setNotes}
                formatAmount={formatAmount}
                closeButton={(
                  <CloseButton
                    disabled={isSubmitting || !cashCounted}
                    needsCash={!cashCounted}
                    businessDate={businessDate}
                    transactionCount={summary?.transactionCount || 0}
                    systemTotal={systemTotal}
                    num={num}
                    formatAmount={formatAmount}
                    onClose={() => setShowConfirm(true)}
                  />
                )}
              />
            </div>
          </div>
        </>
      )}

      {showConfirm && (
        <ConfirmCloseModal
          businessDate={businessDate}
          formatDateLabel={formatDateLabel}
          systemTotal={systemTotal}
          cashSalesTotal={cashSalesTotal}
          bankSalesTotal={bankSalesTotal}
          cashCounted={cashCounted}
          discrepancy={discrepancy}
          isMatch={isMatch}
          transactionCount={summary?.transactionCount || 0}
          notes={notes}
          isSubmitting={isSubmitting}
          formatAmount={formatAmount}
          onConfirm={handleSubmit}
          onCancel={() => setShowConfirm(false)}
        />
      )}
      {editModal.open && (
        <EditTransactionModal
          transaction={editModal.transaction}
          editForm={editForm}
          setEditForm={setEditForm}
          saving={editSaving}
          error={editError}
          onSave={handleEditSave}
          onClose={() => { setEditModal({ open: false, transaction: null }); setEditError(''); }}
        />
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

// =============================================================================
// Open day: sales summary, review list, closing panel
// =============================================================================

const CASH_RESULT = {
  match: 'bg-green-50 text-green-800 ring-green-200',
  over: 'bg-blue-50 text-blue-800 ring-blue-200',
  short: 'bg-red-50 text-red-800 ring-red-200',
};

/** "Last close" line: the previous total and how today compares. */
function LastCloseLine({ lastReport, systemTotal, isNepali, formatAmount, tone }) {
  const { t } = useTranslation();
  if (!lastReport) return null;
  const lastTotal = parseFloat(lastReport.totalSystemSales) || 0;
  const diff = systemTotal - lastTotal;
  const pct = lastTotal > 0 ? ((diff / lastTotal) * 100).toFixed(1) : null;
  const dark = tone === 'dark';
  return (
    <div className={`flex flex-wrap items-center justify-between gap-x-3 text-xs ${dark ? 'text-core-300' : 'text-gray-600'}`}>
      <span>{t('dailyClose.lastClose')} · {formatBsDate(lastReport.reportDate, isNepali)}</span>
      <span className={`flex items-center gap-1 font-bold ${dark ? 'text-white' : 'text-gray-700'}`}>
        {formatAmount(lastTotal)}
        {pct !== null && (
          <span className={diff >= 0 ? (dark ? 'text-green-300' : 'text-green-700') : (dark ? 'text-red-300' : 'text-red-700')}>
            {diff >= 0 ? ' ▲' : ' ▼'}{Math.abs(pct)}%
          </span>
        )}
      </span>
    </div>
  );
}

/** Colour bar showing each business's share of the day's sales. */
function ShareBar({ rows, total, className = '' }) {
  if (total <= 0) return null;
  return (
    <div className={`flex h-3 gap-0.5 overflow-hidden rounded-full ${className}`} role="img"
      aria-label={rows.map((r) => `${r.label} ${r.share.toFixed(1)}%`).join(', ')}>
      {rows.map((r) => (
        <div key={r.label} className={r.color} style={{ width: `${r.share}%` }} />
      ))}
    </div>
  );
}

function SalesSummary({ desktop, summary, systemTotal, cashSalesTotal, bankSalesTotal, lastReport, isNepali, num, formatAmount, formatLiters, formatUnits }) {
  const { t } = useTranslation();
  const items = summary ? businessItems(summary, t, formatLiters, formatUnits) : [];
  const rows = items
    .map((item) => ({ ...item, amount: parseFloat(item.amount) || 0 }))
    .filter((item) => item.amount > 0)
    .map((item) => ({ ...item, share: systemTotal > 0 ? (item.amount / systemTotal) * 100 : 0 }));
  const count = summary?.transactionCount || 0;

  const cashBank = (
    <div className={desktop ? 'flex flex-wrap gap-3 border-t border-gray-200 pt-4' : 'mt-3.5 flex gap-4 border-t border-white/20 pt-3'}>
      <div className={`flex flex-1 items-center gap-3 ${desktop ? 'min-w-[200px] rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-inset ring-gray-200' : ''}`}>
        <Banknote className={`h-5 w-5 shrink-0 ${desktop ? 'text-green-700' : 'text-core-300'}`} aria-hidden="true" />
        <div>
          <p className={`text-xs ${desktop ? 'text-gray-600' : 'text-core-300'}`}>{t('common.cash')}</p>
          <p className={`font-bold tabular-nums ${desktop ? 'text-lg text-gray-800' : 'text-base'}`}>{formatAmount(cashSalesTotal)}</p>
        </div>
      </div>
      <div className={`flex flex-1 items-center gap-3 ${desktop ? 'min-w-[200px] rounded-xl bg-gray-50 px-4 py-3 ring-1 ring-inset ring-gray-200' : ''}`}>
        <Building2 className={`h-5 w-5 shrink-0 ${desktop ? 'text-blue-700' : 'text-core-300'}`} aria-hidden="true" />
        <div>
          <p className={`text-xs ${desktop ? 'text-gray-600' : 'text-core-300'}`}>{t('common.bank')}</p>
          <p className={`font-bold tabular-nums ${desktop ? 'text-lg text-gray-800' : 'text-base'}`}>{formatAmount(bankSalesTotal)}</p>
        </div>
      </div>
    </div>
  );

  if (desktop) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="eod-sales-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 id="eod-sales-heading" className="text-base font-bold text-core-900">{t('dailyClose.totalSales')}</h2>
            <p className="mt-2 text-4xl font-extrabold leading-none tabular-nums text-core-900">{formatAmount(systemTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">{t('dailyClose.transactions')}</p>
            <p className="text-3xl font-extrabold leading-tight tabular-nums text-core-900">{num(count)}</p>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <ShareBar rows={rows} total={systemTotal} className="mt-5" />
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-[13px] font-semibold text-gray-600">
                  <th scope="col" className="pb-2 pt-3 font-semibold">{t('dailyClose.colBusiness')}</th>
                  <th scope="col" className="pb-2 pt-3 text-right font-semibold">{t('dailyClose.colQuantity')}</th>
                  <th scope="col" className="pb-2 pt-3 text-right font-semibold">{t('dailyClose.colAmount')}</th>
                  <th scope="col" className="pb-2 pt-3 text-right font-semibold">{t('dailyClose.colShare')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const Icon = r.icon;
                  return (
                    <tr key={r.label} className="border-t border-gray-200">
                      <td className="py-3">
                        <span className="inline-flex items-center gap-2.5 font-semibold text-gray-800">
                          <span className={`grid h-7 w-7 place-items-center rounded-lg ${r.color}`}><Icon className="h-4 w-4 text-white" aria-hidden="true" /></span>
                          {r.label}
                        </span>
                      </td>
                      <td className="py-3 text-right tabular-nums text-gray-600">{r.detail || '—'}</td>
                      <td className="py-3 text-right font-bold tabular-nums text-gray-800">{formatAmount(r.amount)}</td>
                      <td className="py-3 text-right tabular-nums text-gray-600">{r.share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        <div className="mt-2">{cashBank}</div>
        <div className="mt-3.5"><LastCloseLine lastReport={lastReport} systemTotal={systemTotal} isNepali={isNepali} formatAmount={formatAmount} tone="light" /></div>
      </section>
    );
  }

  return (
    <>
      <div className="rounded-2xl bg-core-800 p-5 text-white shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-core-300">{t('dailyClose.totalSales')}</p>
            <p className="mt-0.5 text-3xl font-extrabold leading-tight tabular-nums">{formatAmount(systemTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-core-300">{t('dailyClose.transactions')}</p>
            <p className="text-2xl font-extrabold leading-tight tabular-nums">{num(count)}</p>
          </div>
        </div>
        {cashBank}
        <div className="mt-3"><LastCloseLine lastReport={lastReport} systemTotal={systemTotal} isNepali={isNepali} formatAmount={formatAmount} tone="dark" /></div>
      </div>

      {rows.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200" aria-labelledby="eod-biz-heading">
          <h2 id="eod-biz-heading" className="text-base font-bold text-core-900">{t('dashboard.businessBreakdown')}</h2>
          <ShareBar rows={rows} total={systemTotal} className="mt-3 h-2.5" />
          <ul className="mt-3">
            {rows.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.label} className="flex items-center gap-2.5 border-t border-gray-200 py-3 first:border-t-0 first:pt-1">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${r.color}`}><Icon className="h-4 w-4 text-white" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                    <p className="text-xs text-gray-600">{r.detail ? `${r.detail} · ` : ''}{r.share.toFixed(1)}%</p>
                  </div>
                  <p className="text-[15px] font-bold tabular-nums text-gray-800">{formatAmount(r.amount)}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

const REVIEW_PREVIEW = 5;

function ReviewPanel({ desktop, transactions, open, onToggle, showAll, onToggleAll, isAdmin, num, formatAmount, parseCustomFields, onEdit }) {
  const { t } = useTranslation();
  const count = transactions.length;
  const list = (limit) => (
    <ul className="divide-y divide-slate-100">
      {(limit ? transactions.slice(0, limit) : transactions).map((txn) => (
        <TxnRow
          key={txn.id}
          txn={{ ...txn, customFields: parseCustomFields(txn.customFields) }}
          t={t}
          num={num}
          format={formatAmount}
          onEdit={isAdmin ? () => onEdit(txn) : undefined}
        />
      ))}
    </ul>
  );

  if (desktop) {
    return (
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200" aria-labelledby="eod-review-heading">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <h2 id="eod-review-heading" className="flex items-center gap-2 text-base font-bold text-core-900">
            <CheckCircle2 className="h-5 w-5 text-core-500" aria-hidden="true" />
            {t('reports.reviewTransactions')}
            <span className="font-normal text-gray-500">({num(count)})</span>
          </h2>
          <span className="text-sm text-gray-600">{t('dailyClose.reviewHint')}</span>
        </div>
        {list(showAll ? undefined : REVIEW_PREVIEW)}
        {count > REVIEW_PREVIEW && (
          <button
            type="button"
            onClick={onToggleAll}
            className="flex min-h-[48px] w-full items-center justify-center border-t border-slate-100 bg-gray-50 text-sm font-bold text-core-700 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core-500"
          >
            {showAll ? t('dailyClose.showFewer') : t('dailyClose.showAllTransactions', { formattedCount: num(count) })}
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50"
      >
        <span className="flex items-center gap-2 font-bold text-gray-700">
          <CheckCircle2 className="h-5 w-5 text-core-500" aria-hidden="true" />
          {t('reports.reviewTransactions')}
          <span className="text-sm font-normal text-gray-500">({num(count)})</span>
        </span>
        <span className="text-sm text-gray-500" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="max-h-72 overflow-y-auto border-t border-slate-100">{list(undefined)}</div>}
    </div>
  );
}

function CloseButton({ disabled, needsCash, businessDate, transactionCount, systemTotal, num, formatAmount, onClose }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={disabled}
        aria-describedby={needsCash ? 'close-day-hint' : undefined}
        className={`min-h-[56px] w-full rounded-xl text-lg font-extrabold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-800 focus-visible:ring-offset-2 ${
          disabled ? 'cursor-not-allowed bg-gray-400' : 'bg-green-700 hover:bg-green-800'
        }`}
      >
        {t('dailyClose.closeTheDay')}
      </button>
      <p id="close-day-hint" className="text-center text-xs text-gray-600 tabular-nums">
        {needsCash
          ? t('dailyClose.enterCashAmount')
          : t('dailyClose.closesSummary', {
            count: transactionCount,
            formattedCount: num(transactionCount),
            date: businessDate,
            total: formatAmount(systemTotal),
          })}
      </p>
    </div>
  );
}

function ClosePanel({ desktop, cashCounted, setCashCounted, cashSalesTotal, discrepancy, isMatch, hasDiscrepancy, notes, setNotes, formatAmount, closeButton }) {
  const { t } = useTranslation();
  const state = isMatch ? 'match' : discrepancy > 0 ? 'over' : 'short';

  const body = (
    <>
      <div>
        <label htmlFor="eod-cash" className="mb-2.5 flex items-center gap-2 text-[15px] font-bold text-core-900">
          <Banknote className="h-5 w-5 text-green-700" aria-hidden="true" />
          {t('dailyClose.countCash')}
        </label>
        <div className="flex min-h-[60px] items-center gap-3 rounded-xl bg-white px-4 ring-2 ring-inset ring-gray-300 focus-within:ring-core-800">
          <span className="text-xl font-bold text-gray-500">रु</span>
          <input
            id="eod-cash"
            type="number"
            inputMode="decimal"
            value={cashCounted}
            onChange={(e) => setCashCounted(e.target.value)}
            placeholder={t('dailyClose.enterCashAmount')}
            className="min-w-0 flex-1 border-0 bg-transparent py-3 text-3xl font-extrabold tabular-nums text-core-900 outline-none placeholder:text-lg placeholder:font-semibold placeholder:text-gray-400"
          />
        </div>
        <div className="mt-2.5 flex justify-between gap-3 text-sm text-gray-600">
          <span>{t('dailyClose.expectedCash')}</span>
          <span className="font-bold tabular-nums text-gray-800">{formatAmount(cashSalesTotal)}</span>
        </div>
      </div>

      {cashCounted !== '' && (
        <div role="status" className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 ring-1 ring-inset ${CASH_RESULT[state]}`}>
          <span className="flex items-center gap-2.5 text-lg font-extrabold">
            {state === 'match'
              ? <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              : state === 'over'
                ? <TrendingUp className="h-6 w-6" aria-hidden="true" />
                : <TrendingDown className="h-6 w-6" aria-hidden="true" />}
            {state === 'match'
              ? t('dailyClose.cashMatches')
              : state === 'over'
                ? t('dailyClose.overLabel')
                : t('dailyClose.shortLabel')}
          </span>
          <span className="text-2xl font-extrabold tabular-nums">
            {state === 'match' ? '✓' : `${discrepancy > 0 ? '+' : '−'}${formatAmount(Math.abs(discrepancy))}`}
          </span>
        </div>
      )}

      {hasDiscrepancy && (
        <div>
          <label htmlFor="eod-reason" className="mb-2 block text-sm font-bold text-gray-700">
            {discrepancy > 0 ? t('dailyClose.reasonForOver') : t('dailyClose.reasonForShort')}
          </label>
          <textarea
            id="eod-reason"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('dailyClose.writeReason')}
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-base outline-none transition-colors focus:border-core-500 focus:ring-2 focus:ring-core-500"
          />
        </div>
      )}
    </>
  );

  if (desktop) {
    return (
      <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" aria-labelledby="eod-close-heading">
        <h2 id="eod-close-heading" className="text-lg font-bold text-core-900">{t('dailyClose.closeTheDay')}</h2>
        {body}
        {closeButton}
      </section>
    );
  }

  return (
    <>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        {body}
      </div>
      {/* The close button stays at the bottom of the screen, so closing never needs a scroll */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-8px_16px_rgba(15,23,42,0.06)]">
        <div className="mx-auto w-full max-w-5xl">{closeButton}</div>
      </div>
    </>
  );
}

// =============================================================================
// Sub-component: Sales Breakdown Cards
// =============================================================================

/** The businesses a day's sales are split into, with the colour that identifies each. */
function businessItems(report, t, formatLiters, formatUnits) {
  return [
    { icon: Fuel, color: 'bg-petrol-500', label: t('dailyClose.petrolShort'), amount: report.petrolSales, detail: formatLiters(report.petrolLiters) },
    { icon: Fuel, color: 'bg-gray-700', label: t('dailyClose.dieselShort'), amount: report.dieselSales, detail: formatLiters(report.dieselLiters) },
    { icon: Zap, color: 'bg-ev-500', label: t('dailyClose.evShort'), amount: report.evSales, detail: formatUnits(report.evUnits) },
    { icon: Home, color: 'bg-rental-500', label: t('dailyClose.rent'), amount: report.rentalSales, detail: null },
    { icon: Package, color: 'bg-purple-500', label: t('dailyClose.other'), amount: report.otherSales, detail: null },
  ];
}

function SalesBreakdown({ report, formatAmount, formatLiters, formatUnits }) {
  const { t } = useTranslation();
  const items = businessItems(report, t, formatLiters, formatUnits);

  const hasData = items.some(i => parseFloat(i.amount) > 0);
  if (!hasData) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const amount = parseFloat(item.amount) || 0;
        if (amount === 0) return null;
        return (
          <div key={idx} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className={`${item.color} p-1.5 rounded-lg`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-600">{item.label}</span>
            </div>
            <p className="text-lg font-bold text-gray-800">{formatAmount(amount)}</p>
            {item.detail && <p className="text-xs text-gray-400">{item.detail}</p>}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Sub-component: Cash Summary Card (closed report)
// =============================================================================

function CashSummaryCard({ report, formatAmount }) {
  const { t } = useTranslation();
  const disc = parseFloat(report.discrepancy) || 0;
  const isExact = Math.abs(disc) <= 0.5;
  const isOver = disc > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-600 text-sm">{t('dailyClose.totalSales')}</span>
        <span className="font-bold">{formatAmount(report.totalSystemSales)}</span>
      </div>
      <div className="flex justify-between items-center mb-2 pl-3 text-sm">
        <span className="text-gray-400 flex items-center gap-1"><Banknote className="w-3 h-3" /> {t('common.cash')}</span>
        <span className="font-bold text-green-700">{formatAmount(report.totalCashSales)}</span>
      </div>
      <div className="flex justify-between items-center mb-3 pl-3 text-sm">
        <span className="text-gray-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> {t('common.bank')}</span>
        <span className="font-bold text-blue-700">{formatAmount(report.totalBankSales)}</span>
      </div>
      <div className="border-t pt-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600 text-sm">{t('dailyClose.cashCounted')}</span>
          <span className="font-bold">{formatAmount(report.cashCounted)}</span>
        </div>
        <div className={`flex justify-between items-center rounded-lg px-3 py-2 ${isExact ? 'bg-green-50' : isOver ? 'bg-blue-50' : 'bg-red-50'}`}>
          <span className={`font-bold flex items-center gap-1 text-sm ${isExact ? 'text-green-700' : isOver ? 'text-blue-700' : 'text-red-700'}`}>
            {isExact
              ? <><CheckCircle2 className="w-4 h-4" /> {t('dailyClose.matchLabel')}</>
              : isOver
                ? <><TrendingUp className="w-4 h-4" /> {t('dailyClose.overShort')}</>
                : <><TrendingDown className="w-4 h-4" /> {t('dailyClose.shortShortLabel')}</>}
          </span>
          <span className={`font-bold ${isExact ? 'text-green-600' : isOver ? 'text-blue-700' : 'text-red-700'}`}>
            {isExact ? 'रु 0' : `${isOver ? '+' : '-'}${formatAmount(Math.abs(disc))}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-component: Transaction List
// =============================================================================

function TransactionList({ transactions, isAdmin, formatAmount, parseCustomFields, onEdit }) {
  const { t } = useTranslation();
  if (transactions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-core-900">
        {t('dailyClose.transactions')}
        <span className="text-sm font-normal text-gray-500 ml-2">({transactions.length})</span>
      </h2>
      {transactions.map((txn) => {
        const business = BUSINESS_ICONS[txn.businessCode] || {};
        const Icon = business.icon || Package;
        const customFields = parseCustomFields(txn.customFields);

        return (
          <div key={txn.id} className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`${business.color || 'bg-gray-500'} p-2 rounded-lg flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{txn.businessName}</p>
                  <p className="text-sm text-gray-500">
                    {txn.transactionType === 'SALE' ? t('dailyClose.saleLabel') : txn.transactionType}
                  </p>
                  {txn.businessCode === 'petrol' && customFields.fuelType && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-1">
                      <span>{customFields.fuelType}</span>
                      <span>· {customFields.liters}L</span>
                      <span>@ रु{customFields.ratePerLiter}/L</span>
                      {customFields.paymentMethod && <span>· {customFields.paymentMethod}</span>}
                    </div>
                  )}
                  {txn.businessCode === 'ev' && customFields.chargingMode === 'PERCENTAGE' && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-1">
                      <span>{customFields.vehicleName}</span>
                      <span>· {customFields.startPercent}%→{customFields.endPercent}%</span>
                      <span>· रु{customFields.ratePerPercent}/%</span>
                      {customFields.estimatedKwh && <span>· ~{customFields.estimatedKwh} kWh</span>}
                      {customFields.paymentMethod && <span>· {customFields.paymentMethod}</span>}
                    </div>
                  )}
                  {txn.businessCode === 'rental' && customFields.propertyName && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-1">
                      <span>{customFields.propertyName}</span>
                      {customFields.tenantName && <span>· {customFields.tenantName}</span>}
                      {customFields.rentalMonth && <span>· {customFields.rentalMonth}</span>}
                      {customFields.paymentType && <span>· {customFields.paymentType}</span>}
                      {customFields.paymentMethod && <span>· {customFields.paymentMethod}</span>}
                    </div>
                  )}
                  {txn.notes && <p className="text-xs text-gray-400 mt-1 italic">"{txn.notes}"</p>}
                  <p className="text-xs text-gray-400 mt-1">{t('dailyClose.byLabel')} {txn.enteredByName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold ${txn.transactionType === 'SALE' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(txn.amount)}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => onEdit(txn)}
                    className="flex h-11 w-11 items-center justify-center text-gray-500 hover:text-core-700 hover:bg-core-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// Sub-component: Edit Transaction Modal
// =============================================================================

function EditTransactionModal({ transaction, editForm, setEditForm, saving, error, onSave, onClose }) {
  const { t } = useTranslation();
  const businessCode = transaction.businessCode;
  const updateField = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">{t('dailyClose.editTransaction')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center hover:bg-gray-100 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500"><X className="w-5 h-5 text-gray-500" aria-hidden="true" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.amountLabel')}</label>
            <input type="number" inputMode="decimal" value={editForm.amount} onChange={(e) => updateField('amount', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.typeLabel')}</label>
            <select value={editForm.transactionType} onChange={(e) => updateField('transactionType', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none">
              <option value="SALE">Sale</option>
              <option value="PURCHASE">Purchase</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="PAYMENT">Payment</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </div>

          {businessCode === 'petrol' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.fuelType')}</label>
                <select value={editForm.fuelType || 'petrol'} onChange={(e) => updateField('fuelType', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none">
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.litersLabel')}</label>
                  <input type="number" inputMode="decimal" value={editForm.liters || ''} onChange={(e) => updateField('liters', e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.rateLabel')}</label>
                  <input type="number" inputMode="decimal" value={editForm.ratePerLiter || ''} onChange={(e) => updateField('ratePerLiter', e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.paymentLabel')}</label>
                <select value={editForm.paymentMethod || 'CASH'} onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none">
                  <option value="CASH">{t('common.cash')}</option>
                  <option value="BANK">{t('common.bank')}</option>
                </select>
              </div>
            </>
          )}

          {businessCode === 'ev' && (
            <>
              {editForm.vehicleName && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
                  ⚡ {editForm.vehicleName}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.startPercent')}</label>
                  <input type="number" value={editForm.startPercent ?? ''} onChange={(e) => updateField('startPercent', e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.endPercent')}</label>
                  <input type="number" value={editForm.endPercent ?? ''} onChange={(e) => updateField('endPercent', e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.ratePercent')}</label>
                <input type="number" value={editForm.ratePerPercent ?? ''} onChange={(e) => updateField('ratePerPercent', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.paymentLabel')}</label>
                <select value={editForm.paymentMethod || 'CASH'} onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none">
                  <option value="CASH">{t('common.cash')}</option>
                  <option value="BANK">{t('common.bank')}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.notesLabel')}</label>
            <textarea value={editForm.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2}
              className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.refNo')}</label>
            <input type="text" value={editForm.referenceNumber || ''} onChange={(e) => updateField('referenceNumber', e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none" />
          </div>
        </div>

        {error && (
          <div className="mx-4 mb-2 bg-red-100 border border-red-300 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex border-t sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-50 transition-colors border-r">
            {t('dailyClose.cancelLabel')}
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-4 min-h-[56px] text-core-700 font-bold hover:bg-core-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-core-600"></div> : t('dailyClose.saveLabel')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-component: Verification Section
// =============================================================================

function VerificationSection({ report, isAdmin, verifyNotes, setVerifyNotes, verifying, onVerify }) {
  const { t } = useTranslation();
  const isVerified = report.verificationStatus === 'VERIFIED';

  if (isVerified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-6 h-6 text-green-600" />
          <p className="font-bold text-green-800">{t('dailyClose.verified')}</p>
        </div>
        <p className="text-sm text-green-700">{t('dailyClose.byLabel')} {report.verifiedBy}</p>
        {report.verifiedAt && <p className="text-xs text-green-600 mt-1">{new Date(report.verifiedAt).toLocaleString()}</p>}
        {report.verificationNotes && <p className="text-sm text-green-700 mt-2 italic">"{report.verificationNotes}"</p>}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
        <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0" />
        <p className="text-yellow-800 font-medium">{t('dailyClose.awaitingVerification')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-4 space-y-3">
      <h3 className="text-base font-bold text-core-900 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-core-600" />
        {t('dailyClose.verifyReport')}
      </h3>
      <textarea value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)}
        placeholder={t('dailyClose.notesOptional')} rows={2}
        className="w-full min-h-[44px] px-3 py-2 text-base border border-gray-300 rounded-xl focus:border-core-500 focus:ring-2 focus:ring-core-500 outline-none resize-none" />
      <button onClick={onVerify} disabled={verifying}
        className={`w-full min-h-[48px] py-3 rounded-xl text-white font-bold transition-all active:scale-95 ${verifying ? 'bg-gray-400' : 'bg-core-800 hover:bg-core-700'}`}>
        {verifying ? t('dailyClose.verifying') : t('dailyClose.verifyReport')}
      </button>
    </div>
  );
}

// =============================================================================
// Sub-component: Confirm Close Modal
// =============================================================================

function ConfirmCloseModal({
  businessDate, formatDateLabel, systemTotal, cashSalesTotal, bankSalesTotal,
  cashCounted, discrepancy, isMatch, transactionCount, notes,
  isSubmitting, formatAmount, onConfirm, onCancel,
}) {
  const { t } = useTranslation();
  const cashNum = parseFloat(cashCounted) || 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="p-5 border-b flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
          <h2 className="text-lg font-bold text-gray-800">{t('dailyClose.confirmTitle')}</h2>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('common.date')}</span>
            <span className="font-bold text-gray-800">{formatDateLabel(businessDate)}, {businessDate}</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('dailyClose.transactions')}</span>
            <span className="font-bold text-gray-800">{transactionCount}</span>
          </div>

          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">{t('dailyClose.totalSales')}</span>
            <span className="font-bold text-gray-800">{formatAmount(systemTotal)}</span>
          </div>
          <div className="flex justify-between text-sm pl-3">
            <span className="text-gray-400">↳ {t('common.cash')}</span>
            <span className="font-medium text-green-700">{formatAmount(cashSalesTotal)}</span>
          </div>
          {bankSalesTotal > 0 && (
            <div className="flex justify-between text-sm pl-3">
              <span className="text-gray-400">↳ {t('common.bank')}</span>
              <span className="font-medium text-blue-700">{formatAmount(bankSalesTotal)}</span>
            </div>
          )}

          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-gray-500">{t('dailyClose.cashCounted')}</span>
            <span className="font-bold text-gray-800">{formatAmount(cashNum)}</span>
          </div>

          <div className={`flex justify-between items-center rounded-xl px-3 py-2 ${isMatch ? 'bg-green-50' : discrepancy > 0 ? 'bg-blue-50' : 'bg-red-50'}`}>
            <span className={`text-sm font-bold ${isMatch ? 'text-green-700' : discrepancy > 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {isMatch ? t('dailyClose.matchLabel') : discrepancy > 0 ? t('dailyClose.overLabel') : t('dailyClose.shortLabel')}
            </span>
            <span className={`font-bold ${isMatch ? 'text-green-600' : discrepancy > 0 ? 'text-blue-700' : 'text-red-700'}`}>
              {isMatch ? 'रु 0' : `${discrepancy > 0 ? '+' : ''}${formatAmount(discrepancy)}`}
            </span>
          </div>

          {notes && (
            <p className="text-xs text-gray-500 italic border-t pt-2">"{notes}"</p>
          )}
        </div>

        <div className="flex border-t">
          <button
            onClick={onCancel}
            className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-50 transition-colors border-r rounded-bl-2xl"
          >
            {t('dailyClose.cancelLabel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex-1 py-4 text-white font-bold bg-green-600 hover:bg-green-700 transition-colors rounded-br-2xl flex items-center justify-center gap-2"
          >
            {isSubmitting
              ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
              : <><Lock className="w-4 h-4" /> {t('dailyClose.confirmClose')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
