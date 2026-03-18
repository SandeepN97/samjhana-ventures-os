import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Fuel,
  Zap,
  Sofa,
  Home,
  Banknote,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Building2,
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

const BUSINESS_CONFIG = {
  petrol:    { icon: Fuel,     color: 'bg-orange-500', labelEn: 'Petrol',    labelNe: 'पेट्रोल' },
  ev:        { icon: Zap,      color: 'bg-green-500',  labelEn: 'EV',        labelNe: 'EV' },
  furniture: { icon: Sofa,     color: 'bg-purple-500', labelEn: 'Furniture', labelNe: 'फर्निचर' },
  rental:    { icon: Home,     color: 'bg-blue-500',   labelEn: 'Rental',    labelNe: 'भाडा' },
  loan:      { icon: Banknote, color: 'bg-red-500',    labelEn: 'Loans',     labelNe: 'ऋण' },
};

const formatAmount = (amount) => {
  if (amount == null) return '—';
  return `रु ${Math.abs(Number(amount)).toLocaleString('en-IN')}`;
};

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isStaff = user.role === 'STAFF';
  const canViewProfit = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [period, setPeriod] = useState(isStaff ? 'today' : 'week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/analytics/summary?period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch analytics', err);
      setError(isNepali ? 'डाटा लोड गर्न सकिएन' : 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return isNepali ? 'आज' : 'Today';
      case 'week':  return isNepali ? 'यो हप्ता' : 'This Week';
      case 'month': return isNepali ? 'यो महिना' : 'This Month';
      default: return '';
    }
  };

  const totalRevenue = data ? Number(data.totalRevenue) : 0;
  const totalExpenses = data ? Number(data.totalExpenses) : 0;
  const totalProfit = data ? (data.totalProfit != null ? Number(data.totalProfit) : null) : null;
  const txnCount = data ? data.transactionCount : 0;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2 ml-3">
              <BarChart3 className="w-6 h-6" />
              <h1 className="text-xl font-bold">
                {isNepali ? 'विश्लेषण' : 'Analytics'}
              </h1>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Period Selector */}
      <div className="px-4 py-3 bg-white border-b">
        {isStaff ? (
          <div className="text-center">
            <span className="inline-block bg-indigo-600 text-white py-3 px-8 rounded-xl font-bold">
              {isNepali ? 'आजको विश्लेषण' : "Today's Analytics"}
            </span>
            <p className="text-xs text-gray-500 mt-2">
              {isNepali
                ? 'साप्ताहिक र मासिक विश्लेषण हेर्न एडमिनलाई सम्पर्क गर्नुहोस्'
                : 'Contact admin to view weekly and monthly analytics'}
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
                {p === 'today' && (isNepali ? 'आज' : 'Today')}
                {p === 'week'  && (isNepali ? 'हप्ता' : 'Week')}
                {p === 'month' && (isNepali ? 'महिना' : 'Month')}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center">
          {error}
        </div>
      ) : !data ? null : (
        <div className="p-4 space-y-4">

          {/* Revenue Overview Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-4 text-white">
              <p className="text-sm opacity-80">
                {isNepali ? 'आम्दानी' : 'Revenue'} — {getPeriodLabel()}
              </p>
              <p className="text-3xl font-bold mt-1">{formatAmount(totalRevenue)}</p>
              <p className="text-sm opacity-80 mt-1">
                {txnCount} {isNepali ? 'कारोबार' : 'transactions'}
              </p>
            </div>
            <div className="px-4 py-3 flex gap-6">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-xs text-gray-500">{isNepali ? 'खर्च' : 'Expenses'}</p>
                  <p className="font-semibold text-red-600">{formatAmount(totalExpenses)}</p>
                </div>
              </div>
              {canViewProfit && totalProfit != null && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-xs text-gray-500">{isNepali ? 'नाफा' : 'Net Profit'}</p>
                    <p className={`font-semibold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalProfit >= 0 ? '+' : ''}{formatAmount(totalProfit)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Business Breakdown Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-bold text-gray-800">
                {isNepali ? 'व्यापार विवरण' : 'Business Breakdown'}
              </h2>
            </div>
            {data.businesses && Object.keys(data.businesses).length > 0 ? (
              <div className="divide-y">
                {Object.entries(BUSINESS_CONFIG).map(([code, config]) => {
                  const biz = data.businesses[code];
                  if (!biz) return null;
                  const rev = Number(biz.revenue || 0);
                  const exp = Number(biz.expenses || 0);
                  const cnt = biz.count || 0;
                  const Icon = config.icon;
                  return (
                    <div key={code} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`${config.color} p-2 rounded-lg`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-800">
                            {isNepali ? config.labelNe : config.labelEn}
                          </p>
                          <p className="text-xs text-gray-400">
                            {cnt} {isNepali ? 'कारोबार' : 'txns'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">{formatAmount(rev)}</p>
                        {exp > 0 && (
                          <p className="text-xs text-red-500">-{formatAmount(exp)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                {isNepali ? 'यस अवधिमा कुनै डाटा छैन' : 'No data for this period'}
              </div>
            )}
          </div>

          {/* Profit Breakdown — ADMIN/MANAGER only */}
          {canViewProfit && data.businesses && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <h2 className="font-bold text-gray-800">
                  {isNepali ? 'नाफा विवरण' : 'Profit Breakdown'}
                </h2>
              </div>
              <div className="divide-y">
                {Object.entries(BUSINESS_CONFIG).map(([code, config]) => {
                  const biz = data.businesses[code];
                  if (!biz) return null;
                  const profit = biz.profit != null ? Number(biz.profit) : null;
                  const Icon = config.icon;
                  return (
                    <div key={code} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`${config.color} p-2 rounded-lg`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <p className="font-medium text-gray-800">
                          {isNepali ? config.labelNe : config.labelEn}
                        </p>
                      </div>
                      <div className="text-right">
                        {code === 'loan' ? (
                          <p className="text-sm text-gray-400 italic">
                            {isNepali ? 'पोर्टफोलियो हेर्नुहोस्' : 'see portfolio'}
                          </p>
                        ) : profit != null ? (
                          <p className={`font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profit >= 0 ? '+' : ''}{formatAmount(profit)}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 italic">
                            {isNepali ? 'ट्र्याक गरिएको छैन' : 'not tracked'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {totalProfit != null && (
                <div className="px-4 py-3 border-t bg-green-50 flex items-center justify-between">
                  <p className="font-bold text-gray-800">
                    {isNepali ? 'कुल नाफा' : 'Total Profit'}
                  </p>
                  <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalProfit >= 0 ? '+' : ''}{formatAmount(totalProfit)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loan Portfolio — ADMIN/MANAGER only */}
          {canViewProfit && data.loanPortfolio && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <Banknote className="w-5 h-5 text-red-500" />
                <h2 className="font-bold text-gray-800">
                  {isNepali ? 'ऋण पोर्टफोलियो' : 'Loan Portfolio'}
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">{isNepali ? 'सक्रिय ऋण' : 'Active Loans'}</p>
                  <p className="font-bold text-gray-800">{data.loanPortfolio.activeLoans}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">{isNepali ? 'कुल सावाँ' : 'Principal Outstanding'}</p>
                  <p className="font-bold text-gray-800">{formatAmount(data.loanPortfolio.totalPrincipal)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">{isNepali ? 'जम्मा ब्याज' : 'Accrued Interest'}</p>
                  <p className="font-bold text-orange-600">{formatAmount(data.loanPortfolio.totalAccruedInterest)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">{isNepali ? 'कुल भुक्तानी' : 'Total Repaid'}</p>
                  <p className="font-bold text-green-600">{formatAmount(data.loanPortfolio.totalRepaid)}</p>
                </div>
                {/* Repayment Progress Bar */}
                {Number(data.loanPortfolio.totalPrincipal) > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{isNepali ? 'भुक्तानी प्रगति' : 'Repayment Progress'}</span>
                      <span>
                        {Math.min(100, Math.round(
                          (Number(data.loanPortfolio.totalRepaid) /
                           Number(data.loanPortfolio.totalPrincipal)) * 100
                        ))}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(
                            (Number(data.loanPortfolio.totalRepaid) /
                             Number(data.loanPortfolio.totalPrincipal)) * 100
                          ))}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rental Health — visible to all */}
          {data.rentalHealth && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-500" />
                <h2 className="font-bold text-gray-800">
                  {isNepali ? 'भाडा स्वास्थ्य' : 'Rental Health'}
                </h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">{isNepali ? 'व्यस्त कोठाहरू' : 'Occupied'}</p>
                  <p className="font-bold text-gray-800">
                    {data.rentalHealth.occupiedCount}/{data.rentalHealth.totalProperties}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-gray-600">{isNepali ? 'मासिक आवर्ती' : 'Monthly Recurring'}</p>
                  <p className="font-bold text-blue-600">{formatAmount(data.rentalHealth.monthlyRecurring)}</p>
                </div>
                {/* Occupancy Progress Bar */}
                {data.rentalHealth.totalProperties > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{isNepali ? 'अधिभोग दर' : 'Occupancy Rate'}</span>
                      <span>
                        {Math.round(
                          (data.rentalHealth.occupiedCount / data.rentalHealth.totalProperties) * 100
                        )}%
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round(
                            (data.rentalHealth.occupiedCount / data.rentalHealth.totalProperties) * 100
                          ))}%`
                        }}
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
