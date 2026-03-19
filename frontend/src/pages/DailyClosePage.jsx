import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
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
  Home,
  AlertTriangle,
  Droplet,
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { formatBsDate } from '../utils/nepaliDate';

const BUSINESS_ICONS = {
  petrol: { icon: Fuel, color: 'bg-orange-500' },
  ev: { icon: Zap, color: 'bg-green-500' },
  furniture: { icon: Sofa, color: 'bg-purple-500' },
  rental: { icon: Home, color: 'bg-blue-500' },
  loan: { icon: Banknote, color: 'bg-red-500' },
};

const BUSINESS_CONFIG = {
  petrol:    { icon: Fuel,     color: 'bg-orange-500', label: 'Petrol Pump', labelNe: 'पेट्रोल पम्प' },
  ev:        { icon: Zap,      color: 'bg-green-500',  label: 'EV',          labelNe: 'EV' },
  furniture: { icon: Sofa,     color: 'bg-purple-500', label: 'Furniture',   labelNe: 'फर्निचर' },
  rental:    { icon: Home,     color: 'bg-blue-500',   label: 'Rental',      labelNe: 'भाडा' },
  loan:      { icon: Banknote, color: 'bg-red-500',    label: 'Loan',        labelNe: 'ऋण' },
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
    case 'loan':
      return cf.bankName ? `Loan — ${cf.bankName}` : 'Loan';
    default:
      return txn.businessName || txn.businessCode;
  }
}

export default function DailyClosePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const canViewProfit = user.role === 'ADMIN' || user.role === 'MANAGER';
  const { toasts, showToast, removeToast } = useToast();

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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

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
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const isClosed = summary?.isClosed;
  const report = summary?.closedReport;

  // ── Tab bar (rendered inside each header) ────────────────────────────────

  const renderTabBar = (tab1Label) => (
    <div className="flex mt-3 border-t border-white/20">
      {[
        { key: 'close', label: tab1Label },
        { key: 'report', label: t('reports.title') },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={`flex-1 py-2 text-sm font-bold transition-colors ${
            activeTab === tab.key
              ? 'text-white border-b-2 border-white'
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // ── Report tab content ────────────────────────────────────────────────────

  const renderReportTab = () => (
    <div className="p-4 space-y-4">
      {/* Income / Expense */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-1">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">{t('reports.income')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{fmt(totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-red-600 mb-1">
            <TrendingDown className="w-4 h-4" />
            <span className="text-sm font-medium">{t('reports.expense')}</span>
          </div>
          <p className="text-2xl font-bold text-gray-800">{fmt(totalExpense)}</p>
        </div>
      </div>

      {/* Net + Cash/Bank split */}
      <div className={`rounded-xl p-4 shadow-sm text-white ${netAmount >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm opacity-80">{t('reports.netAmount')}</p>
            <p className="text-3xl font-bold">{netAmount >= 0 ? '+' : '−'}{fmt(netAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-80">{t('reports.transactions')}</p>
            <p className="text-2xl font-bold">{reportTxns.length}</p>
          </div>
        </div>
        {(totalCash > 0 || totalBank > 0) && (
          <div className="flex gap-3 border-t border-white/20 pt-3">
            <div className="flex items-center gap-1.5 flex-1">
              <Banknote className="w-4 h-4 opacity-80" />
              <div>
                <p className="text-xs opacity-70">{t('common.cash')}</p>
                <p className="text-sm font-bold">{fmt(totalCash)}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-1">
              <Building2 className="w-4 h-4 opacity-80" />
              <div>
                <p className="text-xs opacity-70">{t('common.bank')}</p>
                <p className="text-sm font-bold">{fmt(totalBank)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Business breakdown */}
      {businessBreakdown.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-bold text-gray-800">{t('dashboard.businessBreakdown')}</h2>
          </div>
          <div className="divide-y">
            {businessBreakdown.map(b => {
              const Icon = b.icon;
              return (
                <button
                  key={b.code}
                  onClick={() => navigate('/records', { state: { filter: b.code } })}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className={`${b.color} p-2 rounded-lg`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800 text-sm">{isNepali ? b.labelNe : b.label}</p>
                    <p className="text-xs text-gray-400">{b.count} {t('reports.transactions')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${b.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {b.net >= 0 ? '+' : '−'}{fmt(b.net)}
                    </p>
                    {b.expense > 0 && (
                      <p className="text-xs text-gray-400">+{fmt(b.income)} / −{fmt(b.expense)}</p>
                    )}
                  </div>
                  <span className="text-gray-300 ml-1">›</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">{t('reports.todayTransactions')}</h2>
          <span className="text-xs text-gray-400">{sortedReportTxns.length} {t('reports.transactions')}</span>
        </div>
        {sortedReportTxns.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">{t('reports.noData')}</p>
        ) : (
          <div className="divide-y">
            <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium">
              <span className="col-span-6">{t('common.description')}</span>
              <span className="col-span-3 text-center">{t('common.paymentMethod')}</span>
              <span className="col-span-3 text-right">{t('common.amount')}</span>
            </div>
            {sortedReportTxns.map((txn) => {
              const config = BUSINESS_CONFIG[txn.businessCode] || {};
              const Icon = config.icon || Banknote;
              const isSale = txn.transactionType === 'SALE';
              const pm = txn.customFields?.paymentMethod;
              return (
                <div key={txn.id} className="grid grid-cols-12 gap-1 items-center px-4 py-2.5">
                  <div className="col-span-6 flex items-center gap-2 min-w-0">
                    <div className={`${config.color || 'bg-gray-400'} p-1.5 rounded-md flex-shrink-0`}>
                      <Icon className="w-3 h-3 text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{txnLabel(txn, t)}</p>
                      <p className="text-[10px] text-gray-400 truncate">{txn.enteredByName}</p>
                    </div>
                  </div>
                  <div className="col-span-3 flex justify-center">
                    {pm ? (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        pm.toUpperCase() === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {pm.toUpperCase() === 'CASH' ? t('common.cash') : t('common.bank')}
                      </span>
                    ) : (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        isSale ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {isSale ? t('transactionType.sale') : t('transactionType.purchase')}
                      </span>
                    )}
                  </div>
                  <p className={`col-span-3 text-xs font-bold text-right ${isSale ? 'text-green-600' : 'text-red-600'}`}>
                    {isSale ? '+' : '−'}{fmt(txn.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Profit Summary — admin/manager only */}
      {canViewProfit && (() => {
        const petrol = fuelProfitData?.petrol;
        const diesel = fuelProfitData?.diesel;
        const ev = evProfitData;
        const rows = [
          petrol?.count > 0 && {
            key: 'petrol', label: t('petrol.petrol'),
            iconBg: 'bg-red-100', iconColor: 'text-red-600', Icon: Fuel,
            revenue: petrol.totalRevenue, profit: petrol.totalProfit,
            margin: petrol.margin, tracked: petrol.trackedCount,
            detail: `${petrol.count} txns · ${petrol.totalLiters.toFixed(0)}L`,
          },
          diesel?.count > 0 && {
            key: 'diesel', label: t('petrol.diesel'),
            iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600', Icon: Droplet,
            revenue: diesel.totalRevenue, profit: diesel.totalProfit,
            margin: diesel.margin, tracked: diesel.trackedCount,
            detail: `${diesel.count} txns · ${diesel.totalLiters.toFixed(0)}L`,
          },
          ev?.count > 0 && {
            key: 'ev', label: 'EV',
            iconBg: 'bg-green-100', iconColor: 'text-green-600', Icon: Zap,
            revenue: ev.totalRevenue, profit: ev.totalProfit,
            margin: ev.margin, tracked: ev.trackedCount,
            detail: `${ev.count} txns`,
          },
        ].filter(Boolean);

        if (rows.length === 0) return null;

        const combinedProfit = rows.filter(r => r.tracked > 0).reduce((s, r) => s + r.profit, 0);

        return (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{t('reports.profitTitle')}</h2>
              <span className={`text-lg font-bold ${combinedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {combinedProfit >= 0 ? '+' : '−'}{fmt(combinedProfit)}
              </span>
            </div>
            <div className="divide-y">
              {rows.map(({ key, label, iconBg, iconColor, Icon, revenue, profit, margin, tracked, detail }) => (
                <div key={key} className="px-4 py-3 flex items-center gap-3">
                  <div className={`${iconBg} p-1.5 rounded-md flex-shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-700">{fmt(revenue)}</p>
                    {tracked > 0 ? (
                      <p className={`text-xs font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? '+' : '−'}{fmt(profit)} · {margin}%
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">{t('reports.noPurchaseRate').split('—')[0].trim()}</p>
                    )}
                  </div>
                </div>
              ))}
              <div className={`px-4 py-3 flex items-center justify-between ${combinedProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`font-bold text-sm ${combinedProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {t('reports.totalProfit')}
                </p>
                <p className={`text-2xl font-bold ${combinedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {combinedProfit >= 0 ? '+' : '−'}{fmt(combinedProfit)}
                </p>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // =========================================================================
  // CLOSED VIEW
  // =========================================================================
  if (isClosed && report) {
    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-green-700 transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div className="ml-3">
                <h1 className="text-xl font-bold">{t('dailyClose.dayClosed')}</h1>
                <p className="text-green-100 text-sm">{formatDateLabel(businessDate)}, {businessDate}</p>
              </div>
            </div>
            <LanguageToggle />
          </div>
          {renderTabBar(t('dailyClose.summary'))}
        </header>

        {activeTab === 'report' ? renderReportTab() : (
          <div className="p-4 space-y-4">
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
      <header className="bg-indigo-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="ml-3">
              <h1 className="text-xl font-bold">{t('dailyClose.closeDay')}</h1>
              <p className="text-indigo-200 text-sm">{formatDateLabel(businessDate)}, {businessDate}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
        {renderTabBar(t('dailyClose.closeDay'))}
      </header>

      {activeTab === 'report' ? renderReportTab() : (
        <div className="p-4 space-y-4">

          {summary && (
            <SalesBreakdown report={summary} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />
          )}

          <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <div>
                <p className="text-sm opacity-80">{t('dailyClose.totalSales')}</p>
                <p className="text-3xl font-bold mt-1">{formatAmount(systemTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">{t('dailyClose.transactions')}</p>
                <p className="text-2xl font-bold">{summary?.transactionCount || 0}</p>
              </div>
            </div>
            <div className="border-t border-indigo-400 pt-3 flex gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Banknote className="w-5 h-5 opacity-80" />
                <div>
                  <p className="text-xs opacity-70">{t('common.cash')}</p>
                  <p className="text-lg font-bold">{formatAmount(cashSalesTotal)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Building2 className="w-5 h-5 opacity-80" />
                <div>
                  <p className="text-xs opacity-70">{t('common.bank')}</p>
                  <p className="text-lg font-bold">{formatAmount(bankSalesTotal)}</p>
                </div>
              </div>
            </div>
            {lastReport && (() => {
              const lastTotal = parseFloat(lastReport.totalSystemSales) || 0;
              const diff = systemTotal - lastTotal;
              const pct = lastTotal > 0 ? ((diff / lastTotal) * 100).toFixed(1) : null;
              return (
                <div className="border-t border-indigo-400 pt-2 mt-2 flex items-center justify-between text-xs opacity-80">
                  <span>{t('dailyClose.lastClose')} · {formatBsDate(lastReport.reportDate, isNepali)}</span>
                  <span className="flex items-center gap-1 font-bold">
                    {formatAmount(lastTotal)}
                    {pct !== null && (
                      <span className={diff >= 0 ? 'text-green-300' : 'text-red-300'}>
                        {diff >= 0 ? ' ▲' : ' ▼'}{Math.abs(pct)}%
                      </span>
                    )}
                  </span>
                </div>
              );
            })()}
          </div>

          {transactions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowTxnReview(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2 font-bold text-gray-700">
                  <CheckCircle2 className="w-5 h-5 text-indigo-500" />
                  {t('reports.reviewTransactions')}
                  <span className="text-sm font-normal text-gray-400">({transactions.length})</span>
                </span>
                <span className="text-gray-400 text-sm">{showTxnReview ? '▲' : '▼'}</span>
              </button>
              {showTxnReview && (
                <div className="border-t max-h-72 overflow-y-auto">
                  <TransactionList
                    transactions={transactions}
                    isAdmin={isAdmin}
                    formatAmount={formatAmount}
                    parseCustomFields={parseCustomFields}
                    onEdit={openEditModal}
                  />
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Banknote className="w-6 h-6 text-green-600" />
                {t('dailyClose.countCash')}
              </label>
              {cashSalesTotal > 0 && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg font-medium">
                  {t('common.cash')}: <span className="text-indigo-700 font-bold">{formatAmount(cashSalesTotal)}</span>
                </span>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">रु</span>
              <input
                type="number"
                inputMode="decimal"
                value={cashCounted}
                onChange={(e) => setCashCounted(e.target.value)}
                placeholder={t('dailyClose.enterCashAmount')}
                className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors"
              />
            </div>
          </div>

          {cashCounted !== '' && (
            <div className={`rounded-xl overflow-hidden shadow-sm ${
              isMatch ? 'bg-green-500' : discrepancy > 0 ? 'bg-blue-500' : 'bg-red-500'
            } text-white`}>
              <div className="px-4 pt-4 pb-2 space-y-2">
                <div className="flex justify-between items-center text-sm opacity-90">
                  <span>{t('dailyClose.totalSales')} ({t('common.cash')})</span>
                  <span className="font-bold">{formatAmount(cashSalesTotal)}</span>
                </div>
                <div className="flex justify-between items-center text-sm opacity-90">
                  <span>{t('dailyClose.cashCounted')}</span>
                  <span className="font-bold">{formatAmount(parseFloat(cashCounted) || 0)}</span>
                </div>
              </div>
              <div className={`mx-3 mb-3 mt-1 rounded-lg px-4 py-3 flex items-center justify-between ${
                isMatch ? 'bg-green-600' : discrepancy > 0 ? 'bg-blue-600' : 'bg-red-600'
              }`}>
                <div className="flex items-center gap-2">
                  {isMatch
                    ? <CheckCircle2 className="w-7 h-7" />
                    : discrepancy > 0
                      ? <TrendingUp className="w-7 h-7" />
                      : <TrendingDown className="w-7 h-7" />}
                  <span className="text-lg font-bold">
                    {isMatch
                      ? t('dailyClose.cashMatches')
                      : discrepancy > 0
                        ? t('dailyClose.overLabel')
                        : t('dailyClose.shortLabel')}
                  </span>
                </div>
                <span className="text-3xl font-black">
                  {isMatch
                    ? '✓'
                    : `${discrepancy > 0 ? '+' : '−'}${formatAmount(Math.abs(discrepancy))}`}
                </span>
              </div>
            </div>
          )}

          {hasDiscrepancy && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                {discrepancy > 0 ? t('dailyClose.reasonForOver') : t('dailyClose.reasonForShort')}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('dailyClose.writeReason')}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors text-lg"
              />
            </div>
          )}

          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting || !cashCounted}
            className={`w-full py-4 rounded-xl text-white text-xl font-bold shadow-lg transition-all active:scale-95 ${
              isSubmitting || !cashCounted
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {t('dailyClose.closeDay')}
          </button>
        </div>
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
// Sub-component: Sales Breakdown Cards
// =============================================================================

function SalesBreakdown({ report, formatAmount, formatLiters, formatUnits }) {
  const { t } = useTranslation();
  const items = [
    { icon: Fuel, color: 'bg-orange-500', label: t('dailyClose.petrolShort'), amount: report.petrolSales, detail: formatLiters(report.petrolLiters) },
    { icon: Fuel, color: 'bg-gray-700', label: t('dailyClose.dieselShort'), amount: report.dieselSales, detail: formatLiters(report.dieselLiters) },
    { icon: Zap, color: 'bg-green-500', label: t('dailyClose.evShort'), amount: report.evSales, detail: formatUnits(report.evUnits) },
    { icon: Home, color: 'bg-blue-500', label: t('dailyClose.rent'), amount: report.rentalSales, detail: null },
    { icon: Package, color: 'bg-purple-500', label: t('dailyClose.other'), amount: report.otherSales, detail: null },
  ];

  const hasData = items.some(i => parseFloat(i.amount) > 0);
  if (!hasData) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, idx) => {
        const Icon = item.icon;
        const amount = parseFloat(item.amount) || 0;
        if (amount === 0) return null;
        return (
          <div key={idx} className="bg-white rounded-xl shadow-sm p-3">
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
    <div className="bg-white rounded-xl shadow-sm p-4">
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
      <h2 className="font-bold text-gray-800 text-lg">
        {t('dailyClose.transactions')}
        <span className="text-sm font-normal text-gray-500 ml-2">({transactions.length})</span>
      </h2>
      {transactions.map((txn) => {
        const business = BUSINESS_ICONS[txn.businessCode] || {};
        const Icon = business.icon || Package;
        const customFields = parseCustomFields(txn.customFields);

        return (
          <div key={txn.id} className="bg-white rounded-xl shadow-sm p-4">
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
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
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
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.amountLabel')}</label>
            <input type="number" inputMode="decimal" value={editForm.amount} onChange={(e) => updateField('amount', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.typeLabel')}</label>
            <select value={editForm.transactionType} onChange={(e) => updateField('transactionType', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
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
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.litersLabel')}</label>
                  <input type="number" inputMode="decimal" value={editForm.liters || ''} onChange={(e) => updateField('liters', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.rateLabel')}</label>
                  <input type="number" inputMode="decimal" value={editForm.ratePerLiter || ''} onChange={(e) => updateField('ratePerLiter', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.paymentLabel')}</label>
                <select value={editForm.paymentMethod || 'CASH'} onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
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
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.endPercent')}</label>
                  <input type="number" value={editForm.endPercent ?? ''} onChange={(e) => updateField('endPercent', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.ratePercent')}</label>
                <input type="number" value={editForm.ratePerPercent ?? ''} onChange={(e) => updateField('ratePerPercent', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.paymentLabel')}</label>
                <select value={editForm.paymentMethod || 'CASH'} onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
                  <option value="CASH">{t('common.cash')}</option>
                  <option value="BANK">{t('common.bank')}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.notesLabel')}</label>
            <textarea value={editForm.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('dailyClose.refNo')}</label>
            <input type="text" value={editForm.referenceNumber || ''} onChange={(e) => updateField('referenceNumber', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
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
            className="flex-1 py-4 text-indigo-600 font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div> : t('dailyClose.saveLabel')}
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
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <h3 className="font-bold text-gray-800 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-indigo-600" />
        {t('dailyClose.verifyReport')}
      </h3>
      <textarea value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)}
        placeholder={t('dailyClose.notesOptional')} rows={2}
        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none resize-none" />
      <button onClick={onVerify} disabled={verifying}
        className={`w-full py-3 rounded-xl text-white font-bold transition-all active:scale-95 ${verifying ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
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
