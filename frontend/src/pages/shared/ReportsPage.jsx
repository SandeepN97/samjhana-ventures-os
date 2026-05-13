import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, TrendingUp, TrendingDown, Fuel, Zap, Sofa, Home, Banknote,
  ClipboardCheck, Droplet, Banknote as Cash, Building2,
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import { formatBsDate } from '../utils/nepaliDate';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

const BUSINESS_CONFIG = {
  petrol:    { icon: Fuel,     color: 'bg-orange-500', label: 'Petrol',    labelNe: 'पेट्रोल' },
  ev:        { icon: Zap,      color: 'bg-green-500',  label: 'EV',        labelNe: 'EV' },
  furniture: { icon: Sofa,     color: 'bg-purple-500', label: 'Furniture', labelNe: 'फर्निचर' },
  rental:    { icon: Home,     color: 'bg-blue-500',   label: 'Rental',    labelNe: 'भाडा' },
  loan:      { icon: Banknote, color: 'bg-red-500',    label: 'Loan',      labelNe: 'ऋण' },
};

const fmt = (n) => `रु ${Math.abs(Number(n)).toLocaleString('en-IN')}`;

function txnLabel(txn, t) {
  const cf = txn.customFields;
  switch (txn.businessCode) {
    case 'petrol': {
      const ft = cf?.fuelType === 'diesel' ? t('petrol.diesel') : t('petrol.petrol');
      if (cf?.liters) return `${ft} — ${parseFloat(cf.liters).toFixed(2)}L @ रु${parseFloat(cf.ratePerLiter || 0).toFixed(2)}`;
      return ft;
    }
    case 'ev':
      return cf?.unitsCharged
        ? `EV — ${parseFloat(cf.unitsCharged).toFixed(2)} kWh`
        : 'EV Charging';
    case 'rental':
      return cf?.propertyName
        ? `${cf.propertyName}${cf.tenantName ? ` (${cf.tenantName})` : ''}`
        : txn.businessName || 'Rental';
    case 'furniture':
      return cf?.customerName ? `${t('furniture.order')} — ${cf.customerName}` : t('furniture.order');
    case 'loan':
      return cf?.bankName ? `Loan — ${cf.bankName}` : 'Loan';
    default:
      return txn.businessName || txn.businessCode;
  }
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = user.role === 'STAFF';
  const canViewProfit = user.role === 'ADMIN' || user.role === 'MANAGER';
  const { toasts, showToast, removeToast } = useToast();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTransactions(); }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/transactions');
      const valid = res.data
        .filter(t => t.status !== 'REJECTED')
        .map(t => ({
          ...t,
          customFields: t.customFields
            ? (typeof t.customFields === 'string' ? JSON.parse(t.customFields) : t.customFields)
            : null,
        }));
      setTransactions(valid);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoading(false);
    }
  };

  // Always today
  const todayStr = new Date().toISOString().split('T')[0];
  const todayTxns = transactions.filter(t => t.transactionDate === todayStr);

  const totalIncome  = todayTxns.filter(t => t.transactionType === 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalExpense = todayTxns.filter(t => t.transactionType !== 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
  const netAmount    = totalIncome - totalExpense;

  const totalCash = todayTxns
    .filter(t => t.transactionType === 'SALE' && t.customFields?.paymentMethod?.toUpperCase() === 'CASH')
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalBank = todayTxns
    .filter(t => t.transactionType === 'SALE' && t.customFields?.paymentMethod?.toUpperCase() === 'BANK')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  // Business breakdown (sales only)
  const businessBreakdown = Object.entries(BUSINESS_CONFIG).map(([code, config]) => {
    const bTxns = todayTxns.filter(t => t.businessCode === code);
    const income  = bTxns.filter(t => t.transactionType === 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
    const expense = bTxns.filter(t => t.transactionType !== 'SALE').reduce((s, t) => s + parseFloat(t.amount), 0);
    return { code, ...config, income, expense, net: income - expense, count: bTxns.length };
  }).filter(b => b.count > 0);

  // Petrol / Diesel profit (admin/manager)
  const fuelProfitData = canViewProfit ? (() => {
    const calc = (fuelType) => {
      const sales = todayTxns.filter(t =>
        t.businessCode === 'petrol' && t.transactionType === 'SALE' && t.customFields?.fuelType === fuelType
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

  // EV profit (admin/manager)
  const evProfitData = canViewProfit ? (() => {
    const evTxns = todayTxns.filter(t => t.businessCode === 'ev' && t.transactionType === 'SALE');
    const tracked = evTxns.filter(t => t.customFields?.profit != null);
    const totalProfit = tracked.reduce((s, t) => s + parseFloat(t.customFields.profit), 0);
    const totalRevenue = evTxns.reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalNeaCost = tracked.reduce((s, t) => s + parseFloat(t.customFields.neaCost || 0), 0);
    const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    return { totalProfit, totalRevenue, totalNeaCost, margin, count: evTxns.length, trackedCount: tracked.length };
  })() : null;

  // Sorted transactions for the table (sales first, newest first)
  const sortedTxns = [...todayTxns].sort((a, b) => {
    if (a.transactionType !== b.transactionType)
      return a.transactionType === 'SALE' ? -1 : 1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  const dateLabel = formatBsDate(todayStr, isNepali);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="ml-3">
              <h1 className="text-xl font-bold leading-tight">{t('reports.title')}</h1>
              <p className="text-xs text-indigo-200 mt-0.5">{dateLabel}</p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Close Today */}
      <div className="px-4 pt-3">
        <button
          onClick={() => navigate('/reports/close')}
          className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-md active:scale-95 transition-all"
        >
          <ClipboardCheck className="w-6 h-6" />
          {t('reports.closeTodayReport')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="p-4 space-y-4">

          {/* Summary row */}
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
                <p className="text-2xl font-bold">{todayTxns.length}</p>
              </div>
            </div>
            {(totalCash > 0 || totalBank > 0) && (
              <div className="flex gap-3 border-t border-white/20 pt-3">
                <div className="flex items-center gap-1.5 flex-1">
                  <Cash className="w-4 h-4 opacity-80" />
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

          {/* Today's transaction table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">{t('reports.todayTransactions')}</h2>
              <span className="text-xs text-gray-400">{sortedTxns.length} {t('reports.transactions')}</span>
            </div>
            {sortedTxns.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">{t('reports.noData')}</p>
            ) : (
              <div className="divide-y">
                {/* Header row */}
                <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium">
                  <span className="col-span-6">{t('common.description')}</span>
                  <span className="col-span-3 text-center">{t('common.paymentMethod')}</span>
                  <span className="col-span-3 text-right">{t('common.amount')}</span>
                </div>
                {sortedTxns.map((txn) => {
                  const config = BUSINESS_CONFIG[txn.businessCode] || {};
                  const Icon = config.icon || Banknote;
                  const isSale = txn.transactionType === 'SALE';
                  const pm = txn.customFields?.paymentMethod;

                  return (
                    <div key={txn.id} className="grid grid-cols-12 gap-1 items-center px-4 py-2.5">
                      {/* Description */}
                      <div className="col-span-6 flex items-center gap-2 min-w-0">
                        <div className={`${config.color || 'bg-gray-400'} p-1.5 rounded-md flex-shrink-0`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{txnLabel(txn, t)}</p>
                          <p className="text-[10px] text-gray-400 truncate">{txn.enteredByName}</p>
                        </div>
                      </div>
                      {/* Payment method */}
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
                      {/* Amount */}
                      <p className={`col-span-3 text-xs font-bold text-right ${isSale ? 'text-green-600' : 'text-red-600'}`}>
                        {isSale ? '+' : '−'}{fmt(txn.amount)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Profit Summary — admin/manager (merged card) */}
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

            const combinedProfit = rows
              .filter(r => r.tracked > 0)
              .reduce((s, r) => s + r.profit, 0);

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
      )}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
