import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, Fuel, Zap, Sofa, Home, Banknote, ClipboardCheck } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

const BUSINESS_CONFIG = {
  petrol: { icon: Fuel, color: 'bg-orange-500', label: 'Petrol', labelNe: 'पेट्रोल' },
  ev: { icon: Zap, color: 'bg-green-500', label: 'EV', labelNe: 'EV' },
  furniture: { icon: Sofa, color: 'bg-purple-500', label: 'Furniture', labelNe: 'फर्निचर' },
  rental: { icon: Home, color: 'bg-blue-500', label: 'Rental', labelNe: 'भाडा' },
  loan: { icon: Banknote, color: 'bg-red-500', label: 'Loan', labelNe: 'ऋण' },
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = user.role === 'STAFF';
  const canViewProfit = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  // Staff can only see today's report
  const [period, setPeriod] = useState('today');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/transactions');
      // Filter out REJECTED transactions - they should not be counted in reports
      const validTransactions = res.data.filter(t => t.status !== 'REJECTED');
      setTransactions(validTransactions);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoading(false);
    }
  };

  const filterByPeriod = (txns) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Staff can only see today's data
    const effectivePeriod = isStaff ? 'today' : period;

    return txns.filter(t => {
      const txDate = new Date(t.transactionDate);
      switch (effectivePeriod) {
        case 'today':
          return txDate >= today;
        case 'week':
          return txDate >= weekAgo;
        case 'month':
          return txDate >= monthStart;
        default:
          return true;
      }
    });
  };

  const filteredTxns = filterByPeriod(transactions);

  // Calculate summary
  const totalIncome = filteredTxns
    .filter(t => t.transactionType === 'SALE')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalExpense = filteredTxns
    .filter(t => t.transactionType !== 'SALE')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const netAmount = totalIncome - totalExpense;

  // Business breakdown
  const businessBreakdown = Object.entries(BUSINESS_CONFIG).map(([code, config]) => {
    const businessTxns = filteredTxns.filter(t => t.businessCode === code);
    const income = businessTxns
      .filter(t => t.transactionType === 'SALE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = businessTxns
      .filter(t => t.transactionType !== 'SALE')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return {
      code,
      ...config,
      income,
      expense,
      net: income - expense,
      count: businessTxns.length,
    };
  }).filter(b => b.count > 0);

  // EV profit summary — only computed/shown for ADMIN and SON
  const evProfitData = canViewProfit ? (() => {
    const evTxns = filteredTxns.filter(t => t.businessCode === 'ev' && t.transactionType === 'SALE');
    const txnsWithProfit = evTxns.filter(t => t.customFields?.profit != null);
    const totalProfit = txnsWithProfit.reduce((sum, t) => sum + parseFloat(t.customFields.profit), 0);
    const totalRevenue = evTxns.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalNeaCost = txnsWithProfit.reduce((sum, t) => sum + parseFloat(t.customFields.neaCost || 0), 0);
    const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';
    return { totalProfit, totalRevenue, totalNeaCost, margin, count: evTxns.length, trackedCount: txnsWithProfit.length };
  })() : null;

  const formatAmount = (amount) => {
    return `रु ${Math.abs(amount).toLocaleString('en-IN')}`;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return t('common.today');
      case 'week': return t('common.thisWeek');
      case 'month': return t('common.thisMonth');
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold ml-3">
              {t('reports.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Period Selector */}
      <div className="px-4 py-3 bg-white border-b">
        {isStaff ? (
          /* Staff can only view today's report */
          <div className="text-center">
            <span className="inline-block bg-indigo-600 text-white py-3 px-8 rounded-xl font-bold">
              {t('reports.todayReport')}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              {t('reports.contactAdminWeekly')}
            </p>
          </div>
        ) : (
          <div className="flex gap-2">
            {['today', 'week', 'month'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 py-3 rounded-xl font-bold transition-colors ${
                  period === p
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {p === 'today' && t('reports.today')}
                {p === 'week' && t('reports.week')}
                {p === 'month' && t('reports.month')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Close Today Button */}
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Total Income */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {t('reports.income')}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {formatAmount(totalIncome)}
              </p>
            </div>

            {/* Total Expense */}
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-red-600 mb-2">
                <TrendingDown className="w-5 h-5" />
                <span className="text-sm font-medium">
                  {t('reports.expense')}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {formatAmount(totalExpense)}
              </p>
            </div>
          </div>

          {/* Net Amount */}
          <div className={`rounded-xl p-4 shadow-sm ${netAmount >= 0 ? 'bg-green-500' : 'bg-red-500'} text-white`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">
                  {t('reports.netAmount')} ({getPeriodLabel()})
                </p>
                <p className="text-3xl font-bold">
                  {netAmount >= 0 ? '+' : '-'}{formatAmount(netAmount)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-80">{t('reports.transactions')}</p>
                <p className="text-2xl font-bold">{filteredTxns.length}</p>
              </div>
            </div>
          </div>

          {/* EV Profit Summary — admin/manager only */}
          {canViewProfit && evProfitData && evProfitData.count > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-green-50 flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                <h2 className="font-bold text-green-800">{t('reports.evProfit')}</h2>
              </div>
              <div className="divide-y">
                <div className="flex justify-between items-center px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-500">{t('reports.evRevenue')}</p>
                    <p className="text-xs text-gray-400">{evProfitData.count} {t('reports.transactions')}</p>
                  </div>
                  <p className="text-lg font-semibold text-gray-800">{formatAmount(evProfitData.totalRevenue)}</p>
                </div>
                <div className="flex justify-between items-center px-4 py-3">
                  <div>
                    <p className="text-sm text-gray-500">{t('reports.evNeaCost')}</p>
                    <p className="text-xs text-gray-400">{evProfitData.trackedCount} {t('reports.evTracked')}</p>
                  </div>
                  <p className="text-lg font-semibold text-red-500">− {formatAmount(evProfitData.totalNeaCost)}</p>
                </div>
                <div className={`flex justify-between items-center px-4 py-3 ${evProfitData.totalProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div>
                    <p className={`text-sm font-bold ${evProfitData.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {t('reports.evNetProfit')}
                    </p>
                    <p className={`text-xs ${evProfitData.totalProfit >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                      {evProfitData.margin}% {t('ev.margin')}
                    </p>
                  </div>
                  <p className={`text-2xl font-bold ${evProfitData.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {evProfitData.totalProfit >= 0 ? '+' : '−'}{formatAmount(evProfitData.totalProfit)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Business Breakdown */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-bold text-gray-800">
                {t('dashboard.businessBreakdown')}
              </h2>
            </div>
            {businessBreakdown.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {t('reports.noData')}
              </div>
            ) : (
              <div className="divide-y">
                {businessBreakdown.map((business) => {
                  const Icon = business.icon;
                  return (
                    <div key={business.code} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={`${business.color} p-2 rounded-lg`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">
                              {isNepali ? business.labelNe : business.label}
                            </p>
                            <p className="text-xs text-gray-500">
                              {business.count} {t('reports.transactions')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${business.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {business.net >= 0 ? '+' : '-'}{formatAmount(business.net)}
                          </p>
                        </div>
                      </div>
                      {business.expense > 0 && (
                        <div className="flex gap-4 text-sm">
                          <span className="text-green-600">+{formatAmount(business.income)}</span>
                          <span className="text-red-600">−{formatAmount(business.expense)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
