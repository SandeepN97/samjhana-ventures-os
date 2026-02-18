import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Fuel,
  Zap,
  Package,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Banknote,
  Building2,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

export default function DailyClosePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cashCounted, setCashCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/daily-reports/today-summary');
      setSummary(res.data);
      if (res.data.isClosed) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error('Failed to fetch summary', err);
      setError(isNepali ? 'डाटा लोड गर्न सकिएन' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!cashCounted || parseFloat(cashCounted) < 0) {
      setError(isNepali ? 'कृपया नगद रकम प्रविष्ट गर्नुहोस्' : 'Please enter the cash amount');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/api/daily-reports/close', {
        cashCounted: parseFloat(cashCounted),
        notes: notes || null,
      });
      setSubmitted(true);
      fetchSummary();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(isNepali ? 'आजको रिपोर्ट पहिले नै बन्द गरिएको छ' : "Today's report has already been closed");
        fetchSummary();
      } else {
        setError(isNepali ? 'बन्द गर्न सकिएन' : 'Failed to close report');
      }
    } finally {
      setIsSubmitting(false);
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

  const cashNum = parseFloat(cashCounted) || 0;
  const systemTotal = summary ? parseFloat(summary.totalSystemSales) || 0 : 0;
  const cashSalesTotal = summary ? parseFloat(summary.totalCashSales) || 0 : 0;
  const bankSalesTotal = summary ? parseFloat(summary.totalBankSales) || 0 : 0;
  // Compare cash counted against cash sales only (not bank)
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

  // Already closed — show read-only report
  if (submitted && summary?.isClosed && summary?.closedReport) {
    const report = summary.closedReport;
    return (
      <div className="min-h-screen bg-gray-100 pb-20">
        <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button onClick={() => navigate('/reports')} className="p-2 -ml-2 rounded-full hover:bg-green-700 transition-colors">
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold ml-3">
                {isNepali ? 'आजको रिपोर्ट बन्द भयो' : "Today's Report Closed"}
              </h1>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* Closed confirmation */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <Lock className="w-12 h-12 mx-auto text-green-600 mb-3" />
            <p className="text-lg font-bold text-green-800">
              {isNepali ? 'आजको दिन बन्द गरिएको छ' : "Today's day has been closed"}
            </p>
            <p className="text-sm text-green-600 mt-1">
              {isNepali ? 'बन्द गर्ने:' : 'Closed by:'} {report.closedBy}
            </p>
          </div>

          {/* Sales breakdown */}
          <SalesBreakdown report={report} isNepali={isNepali} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />

          {/* Cash verification result */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-gray-600 font-medium">{isNepali ? 'कुल बिक्री' : 'Total Sales'}</span>
              <span className="font-bold text-lg">{formatAmount(report.totalSystemSales)}</span>
            </div>
            <div className="flex justify-between items-center mb-3 pl-4 text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Banknote className="w-4 h-4" /> {isNepali ? 'नगद बिक्री' : 'Cash Sales'}</span>
              <span className="font-bold text-green-700">{formatAmount(report.totalCashSales)}</span>
            </div>
            <div className="flex justify-between items-center mb-3 pl-4 text-sm">
              <span className="text-gray-500 flex items-center gap-1"><Building2 className="w-4 h-4" /> {isNepali ? 'बैंक बिक्री' : 'Bank Sales'}</span>
              <span className="font-bold text-blue-700">{formatAmount(report.totalBankSales)}</span>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-600 font-medium">{isNepali ? 'गनिएको नगद' : 'Cash Counted'}</span>
                <span className="font-bold text-lg">{formatAmount(report.cashCounted)}</span>
              </div>
              {(() => {
                const disc = parseFloat(report.discrepancy) || 0;
                const isExact = Math.abs(disc) <= 0.5;
                if (isExact) {
                  return (
                    <div className="flex justify-between items-center bg-green-50 rounded-lg px-3 py-2">
                      <span className="text-green-700 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        {isNepali ? 'मिल्यो' : 'Exact Match'}
                      </span>
                      <span className="font-bold text-green-600">रु 0</span>
                    </div>
                  );
                }
                const isOver = disc > 0;
                return (
                  <div className={`flex justify-between items-center rounded-lg px-3 py-2 ${isOver ? 'bg-blue-50' : 'bg-red-50'}`}>
                    <span className={`font-bold flex items-center gap-1 ${isOver ? 'text-blue-700' : 'text-red-700'}`}>
                      {isOver
                        ? <><TrendingUp className="w-4 h-4" /> {isNepali ? 'बढी (Over)' : 'OVER'}</>
                        : <><TrendingDown className="w-4 h-4" /> {isNepali ? 'घटी (Short)' : 'SHORT'}</>}
                    </span>
                    <span className={`font-bold text-lg ${isOver ? 'text-blue-700' : 'text-red-700'}`}>
                      {isOver ? '+' : '-'}{formatAmount(Math.abs(disc))}
                    </span>
                  </div>
                );
              })()}
            </div>
          </div>

          {report.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-800 font-medium">{isNepali ? 'टिप्पणी:' : 'Notes:'}</p>
              <p className="text-yellow-700 mt-1">{report.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active close-out form
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-indigo-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/reports')} className="p-2 -ml-2 rounded-full hover:bg-indigo-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-bold ml-3">
              {isNepali ? 'आजको रिपोर्ट बन्द गर्नुहोस्' : "Close Today's Report"}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Sales Breakdown */}
        {summary && (
          <SalesBreakdown report={summary} isNepali={isNepali} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />
        )}

        {/* Total System Sales */}
        <div className="bg-indigo-600 text-white rounded-xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div>
              <p className="text-sm opacity-80">{isNepali ? 'कुल बिक्री' : 'Total Sales'}</p>
              <p className="text-3xl font-bold mt-1">{formatAmount(systemTotal)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">{isNepali ? 'कारोबार' : 'Transactions'}</p>
              <p className="text-2xl font-bold">{summary?.transactionCount || 0}</p>
            </div>
          </div>
          <div className="border-t border-indigo-400 pt-3 flex gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Banknote className="w-5 h-5 opacity-80" />
              <div>
                <p className="text-xs opacity-70">{isNepali ? 'नगद' : 'Cash'}</p>
                <p className="text-lg font-bold">{formatAmount(cashSalesTotal)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-1">
              <Building2 className="w-5 h-5 opacity-80" />
              <div>
                <p className="text-xs opacity-70">{isNepali ? 'बैंक' : 'Bank'}</p>
                <p className="text-lg font-bold">{formatAmount(bankSalesTotal)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cash Counting Input */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-lg font-bold text-gray-800 mb-3">
            <Banknote className="w-6 h-6 inline-block mr-2 text-green-600" />
            {isNepali ? 'नगद गन्नुहोस्' : 'Count Your Cash'}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">रु</span>
            <input
              type="number"
              inputMode="decimal"
              value={cashCounted}
              onChange={(e) => { setCashCounted(e.target.value); setError(''); }}
              placeholder={isNepali ? 'नगद रकम प्रविष्ट गर्नुहोस्' : 'Enter cash amount'}
              className="w-full pl-12 pr-4 py-4 text-2xl font-bold border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors"
            />
          </div>

          {/* Short / Over indicator */}
          {cashCounted !== '' && (
            <div className={`mt-4 p-4 rounded-xl ${isMatch
              ? 'bg-green-50 border border-green-200'
              : discrepancy > 0
                ? 'bg-blue-50 border border-blue-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {isMatch ? (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-800">{isNepali ? 'मिल्यो!' : 'Cash matches!'}</p>
                    <p className="text-sm text-green-600">{isNepali ? 'गनिएको नगद र नगद बिक्री बराबर छ' : 'Counted cash matches cash sales'}</p>
                  </div>
                </div>
              ) : discrepancy > 0 ? (
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-blue-800">{isNepali ? 'बढी (Over)' : 'OVER'}</p>
                    <p className="text-2xl font-bold text-blue-600">
                      +{formatAmount(discrepancy)}
                    </p>
                    <p className="text-sm text-blue-500">
                      {isNepali ? 'नगद बिक्रीभन्दा बढी नगद छ' : 'More cash than expected from cash sales'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <TrendingDown className="w-8 h-8 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800">{isNepali ? 'घटी (Short)' : 'SHORT'}</p>
                    <p className="text-2xl font-bold text-red-600">
                      -{formatAmount(Math.abs(discrepancy))}
                    </p>
                    <p className="text-sm text-red-500">
                      {isNepali ? 'नगद बिक्रीभन्दा कम नगद छ' : 'Less cash than expected from cash sales'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        {hasDiscrepancy && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              {discrepancy > 0
                ? (isNepali ? 'बढीको कारण (ऐच्छिक)' : 'Reason for Over (optional)')
                : (isNepali ? 'घटीको कारण (ऐच्छिक)' : 'Reason for Short (optional)')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isNepali ? 'कारण लेख्नुहोस्...' : 'Write reason...'}
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-colors text-lg"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-center font-medium">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !cashCounted}
          className={`w-full py-4 rounded-xl text-white text-xl font-bold shadow-lg transition-all active:scale-95 ${
            isSubmitting || !cashCounted
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isSubmitting
            ? (isNepali ? 'बन्द गर्दै...' : 'Closing...')
            : (isNepali ? 'आजको दिन बन्द गर्नुहोस्' : 'Close Today')}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-component: Sales Breakdown Cards
// =============================================================================

function SalesBreakdown({ report, isNepali, formatAmount, formatLiters, formatUnits }) {
  const items = [
    {
      icon: Fuel,
      color: 'bg-orange-500',
      label: isNepali ? 'पेट्रोल बिक्री' : 'Petrol Sales',
      amount: report.petrolSales,
      detail: formatLiters(report.petrolLiters),
    },
    {
      icon: Fuel,
      color: 'bg-gray-700',
      label: isNepali ? 'डिजेल बिक्री' : 'Diesel Sales',
      amount: report.dieselSales,
      detail: formatLiters(report.dieselLiters),
    },
    {
      icon: Zap,
      color: 'bg-green-500',
      label: isNepali ? 'EV चार्जिंग' : 'EV Charging',
      amount: report.evSales,
      detail: formatUnits(report.evUnits),
    },
    {
      icon: Package,
      color: 'bg-purple-500',
      label: isNepali ? 'अन्य बिक्री' : 'Other Sales',
      amount: report.otherSales,
      detail: null,
    },
  ];

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-gray-800 text-lg">
        {isNepali ? 'आजको बिक्री विवरण' : "Today's Sales Breakdown"}
      </h2>
      {items.map((item, idx) => {
        const Icon = item.icon;
        const amount = parseFloat(item.amount) || 0;
        if (amount === 0 && !item.detail) return null;
        return (
          <div key={idx} className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`${item.color} p-2.5 rounded-lg`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-gray-800">{item.label}</p>
                {item.detail && (
                  <p className="text-sm text-gray-500">{item.detail}</p>
                )}
              </div>
            </div>
            <p className="text-xl font-bold text-gray-800">{formatAmount(amount)}</p>
          </div>
        );
      })}
    </div>
  );
}
