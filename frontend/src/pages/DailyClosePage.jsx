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
  Calendar,
  ChevronRight,
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

const BUSINESS_ICONS = {
  petrol: { icon: Fuel, color: 'bg-orange-500' },
  ev: { icon: Zap, color: 'bg-green-500' },
  furniture: { icon: Sofa, color: 'bg-purple-500' },
  rental: { icon: Home, color: 'bg-blue-500' },
  loan: { icon: Banknote, color: 'bg-red-500' },
};

export default function DailyClosePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  const [businessDate, setBusinessDate] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cashCounted, setCashCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Transaction list & edit state
  const [transactions, setTransactions] = useState([]);
  const [editModal, setEditModal] = useState({ open: false, transaction: null });
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Verification state
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Recent reports
  const [recentReports, setRecentReports] = useState([]);

  useEffect(() => {
    loadPage();
  }, []);

  const loadPage = async () => {
    setLoading(true);
    try {
      // Get business date first
      const bdRes = await api.get('/api/daily-reports/business-date');
      const bDate = bdRes.data.date;
      setBusinessDate(bDate);

      // Fetch summary for business date and recent reports in parallel
      const [summaryRes, recentRes] = await Promise.all([
        api.get(`/api/daily-reports/today-summary?date=${bDate}`),
        api.get('/api/daily-reports/recent'),
      ]);

      setSummary(summaryRes.data);
      setRecentReports(Array.isArray(recentRes.data) ? recentRes.data : []);

      // If this date is closed, also fetch transactions
      if (summaryRes.data.isClosed) {
        fetchTransactions(bDate);
      }
    } catch (err) {
      console.error('Failed to load page', err);
      setError(isNepali ? 'डाटा लोड गर्न सकिएन' : 'Failed to load data');
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
      setError(isNepali ? 'कृपया नगद रकम प्रविष्ट गर्नुहोस्' : 'Please enter the cash amount');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      await api.post('/api/daily-reports/close', {
        date: businessDate,
        cashCounted: parseFloat(cashCounted),
        notes: notes || null,
      });
      loadPage();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(isNepali ? 'यो दिनको रिपोर्ट पहिले नै बन्द गरिएको छ' : "This day's report has already been closed");
        loadPage();
      } else {
        setError(isNepali ? 'बन्द गर्न सकिएन' : 'Failed to close report');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit transaction
  const openEditModal = (t) => {
    const customFields = parseCustomFields(t.customFields);
    setEditError('');
    setEditForm({
      amount: t.amount,
      transactionType: t.transactionType,
      notes: t.notes || '',
      referenceNumber: t.referenceNumber || '',
      ...customFields,
    });
    setEditModal({ open: true, transaction: t });
  };

  const handleEditSave = async () => {
    const t = editModal.transaction;
    setEditSaving(true);
    setEditError('');
    try {
      const { amount, transactionType, notes: editNotes, referenceNumber, ...customFields } = editForm;
      await api.put(`/api/transactions/${t.id}`, {
        amount: parseFloat(amount),
        transactionType,
        notes: editNotes,
        referenceNumber,
        transactionDate: t.transactionDate,
        customFields,
      });
      setEditModal({ open: false, transaction: null });
      loadPage();
    } catch (err) {
      setEditError(err.response?.data?.message || (isNepali ? 'सेभ गर्न सकिएन' : 'Failed to save changes'));
    } finally {
      setEditSaving(false);
    }
  };

  // Verify report
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
      return JSON.parse(json);
    } catch {
      return {};
    }
  };

  const formatDateLabel = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateStr === todayStr) return isNepali ? 'आज' : 'Today';
    if (dateStr === tomorrowStr) return isNepali ? 'भोलि' : 'Tomorrow';
    if (dateStr === yesterdayStr) return isNepali ? 'हिजो' : 'Yesterday';
    return d.toLocaleDateString(isNepali ? 'ne-NP' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

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

  // =========================================================================
  // CLOSED VIEW — report is done for this business date
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
                <h1 className="text-xl font-bold">
                  {isNepali ? 'दिन बन्द भयो' : 'Day Closed'}
                </h1>
                <p className="text-green-100 text-sm">{formatDateLabel(businessDate)}, {businessDate}</p>
              </div>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div className="p-4 space-y-4">
          {/* Closed confirmation */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <Lock className="w-8 h-8 text-green-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-green-800">
                {isNepali ? 'दिन बन्द गरिएको छ' : 'Day has been closed'}
              </p>
              <p className="text-sm text-green-600">
                {isNepali ? 'बन्द गर्ने:' : 'By:'} {report.closedBy}
              </p>
            </div>
          </div>

          {/* Sales breakdown */}
          <SalesBreakdown report={report} isNepali={isNepali} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />

          {/* Cash verification result */}
          <CashSummaryCard report={report} isNepali={isNepali} formatAmount={formatAmount} />

          {report.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-800 font-medium">{isNepali ? 'टिप्पणी:' : 'Notes:'}</p>
              <p className="text-yellow-700 mt-1">{report.notes}</p>
            </div>
          )}

          {/* Transaction List */}
          <TransactionList
            transactions={transactions}
            isNepali={isNepali}
            isAdmin={isAdmin}
            formatAmount={formatAmount}
            parseCustomFields={parseCustomFields}
            onEdit={openEditModal}
          />

          {/* Verification Section */}
          <VerificationSection
            report={report}
            isNepali={isNepali}
            isAdmin={isAdmin}
            verifyNotes={verifyNotes}
            setVerifyNotes={setVerifyNotes}
            verifying={verifying}
            onVerify={handleVerify}
          />

          {/* Recent Reports */}
          <RecentReports
            reports={recentReports}
            currentDate={businessDate}
            isNepali={isNepali}
            formatAmount={formatAmount}
            formatDateLabel={formatDateLabel}
          />
        </div>

        {/* Edit Transaction Modal */}
        {editModal.open && (
          <EditTransactionModal
            transaction={editModal.transaction}
            editForm={editForm}
            setEditForm={setEditForm}
            isNepali={isNepali}
            saving={editSaving}
            error={editError}
            onSave={handleEditSave}
            onClose={() => { setEditModal({ open: false, transaction: null }); setEditError(''); }}
          />
        )}
      </div>
    );
  }

  // =========================================================================
  // OPEN VIEW — active close-out form for business date
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
              <h1 className="text-xl font-bold">
                {isNepali ? 'दिन बन्द गर्नुहोस्' : 'Close Day'}
              </h1>
              <p className="text-indigo-200 text-sm">{formatDateLabel(businessDate)}, {businessDate}</p>
            </div>
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
                    <p className="text-2xl font-bold text-blue-600">+{formatAmount(discrepancy)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <TrendingDown className="w-8 h-8 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800">{isNepali ? 'घटी (Short)' : 'SHORT'}</p>
                    <p className="text-2xl font-bold text-red-600">-{formatAmount(Math.abs(discrepancy))}</p>
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
            : (isNepali ? 'दिन बन्द गर्नुहोस्' : 'Close Day')}
        </button>

        {/* Recent Reports */}
        <RecentReports
          reports={recentReports}
          currentDate={businessDate}
          isNepali={isNepali}
          formatAmount={formatAmount}
          formatDateLabel={formatDateLabel}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Sub-component: Sales Breakdown Cards
// =============================================================================

function SalesBreakdown({ report, isNepali, formatAmount, formatLiters, formatUnits }) {
  const items = [
    { icon: Fuel, color: 'bg-orange-500', label: isNepali ? 'पेट्रोल' : 'Petrol', amount: report.petrolSales, detail: formatLiters(report.petrolLiters) },
    { icon: Fuel, color: 'bg-gray-700', label: isNepali ? 'डिजेल' : 'Diesel', amount: report.dieselSales, detail: formatLiters(report.dieselLiters) },
    { icon: Zap, color: 'bg-green-500', label: isNepali ? 'EV' : 'EV', amount: report.evSales, detail: formatUnits(report.evUnits) },
    { icon: Home, color: 'bg-blue-500', label: isNepali ? 'भाडा' : 'Rent', amount: report.rentalSales, detail: null },
    { icon: Package, color: 'bg-purple-500', label: isNepali ? 'अन्य' : 'Other', amount: report.otherSales, detail: null },
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

function CashSummaryCard({ report, isNepali, formatAmount }) {
  const disc = parseFloat(report.discrepancy) || 0;
  const isExact = Math.abs(disc) <= 0.5;
  const isOver = disc > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-600 text-sm">{isNepali ? 'कुल बिक्री' : 'Total Sales'}</span>
        <span className="font-bold">{formatAmount(report.totalSystemSales)}</span>
      </div>
      <div className="flex justify-between items-center mb-2 pl-3 text-sm">
        <span className="text-gray-400 flex items-center gap-1"><Banknote className="w-3 h-3" /> {isNepali ? 'नगद' : 'Cash'}</span>
        <span className="font-bold text-green-700">{formatAmount(report.totalCashSales)}</span>
      </div>
      <div className="flex justify-between items-center mb-3 pl-3 text-sm">
        <span className="text-gray-400 flex items-center gap-1"><Building2 className="w-3 h-3" /> {isNepali ? 'बैंक' : 'Bank'}</span>
        <span className="font-bold text-blue-700">{formatAmount(report.totalBankSales)}</span>
      </div>
      <div className="border-t pt-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-600 text-sm">{isNepali ? 'गनिएको नगद' : 'Cash Counted'}</span>
          <span className="font-bold">{formatAmount(report.cashCounted)}</span>
        </div>
        <div className={`flex justify-between items-center rounded-lg px-3 py-2 ${isExact ? 'bg-green-50' : isOver ? 'bg-blue-50' : 'bg-red-50'}`}>
          <span className={`font-bold flex items-center gap-1 text-sm ${isExact ? 'text-green-700' : isOver ? 'text-blue-700' : 'text-red-700'}`}>
            {isExact
              ? <><CheckCircle2 className="w-4 h-4" /> {isNepali ? 'मिल्यो' : 'Match'}</>
              : isOver
                ? <><TrendingUp className="w-4 h-4" /> {isNepali ? 'बढी' : 'OVER'}</>
                : <><TrendingDown className="w-4 h-4" /> {isNepali ? 'घटी' : 'SHORT'}</>}
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

function TransactionList({ transactions, isNepali, isAdmin, formatAmount, parseCustomFields, onEdit }) {
  if (transactions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="font-bold text-gray-800 text-lg">
        {isNepali ? 'कारोबार' : 'Transactions'}
        <span className="text-sm font-normal text-gray-500 ml-2">({transactions.length})</span>
      </h2>
      {transactions.map((t) => {
        const business = BUSINESS_ICONS[t.businessCode] || {};
        const Icon = business.icon || Package;
        const customFields = parseCustomFields(t.customFields);

        return (
          <div key={t.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`${business.color || 'bg-gray-500'} p-2 rounded-lg flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800">{t.businessName}</p>
                  <p className="text-sm text-gray-500">
                    {t.transactionType === 'SALE' ? (isNepali ? 'बिक्री' : 'Sale') : t.transactionType}
                  </p>
                  {t.businessCode === 'petrol' && customFields.fuelType && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-1">
                      <span>{customFields.fuelType}</span>
                      <span>· {customFields.liters}L</span>
                      <span>@ रु{customFields.ratePerLiter}/L</span>
                      {customFields.paymentMethod && <span>· {customFields.paymentMethod}</span>}
                    </div>
                  )}
                  {t.businessCode === 'ev' && customFields.chargingMode === 'PERCENTAGE' && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-1">
                      <span>{customFields.vehicleName}</span>
                      <span>· {customFields.startPercent}%→{customFields.endPercent}%</span>
                      <span>· रु{customFields.ratePerPercent}/%</span>
                      {customFields.estimatedKwh && <span>· ~{customFields.estimatedKwh} kWh</span>}
                      {customFields.paymentMethod && <span>· {customFields.paymentMethod}</span>}
                    </div>
                  )}
                  {t.businessCode === 'rental' && customFields.propertyName && (
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-1">
                      <span>{customFields.propertyName}</span>
                      {customFields.tenantName && <span>· {customFields.tenantName}</span>}
                      {customFields.rentalMonth && <span>· {customFields.rentalMonth}</span>}
                      {customFields.paymentType && <span>· {customFields.paymentType}</span>}
                      {customFields.paymentMethod && <span>· {customFields.paymentMethod}</span>}
                    </div>
                  )}
                  {t.notes && <p className="text-xs text-gray-400 mt-1 italic">"{t.notes}"</p>}
                  <p className="text-xs text-gray-400 mt-1">{isNepali ? 'द्वारा:' : 'By:'} {t.enteredByName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-lg font-bold ${t.transactionType === 'SALE' ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(t.amount)}
                </p>
                {isAdmin && (
                  <button
                    onClick={() => onEdit(t)}
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

function EditTransactionModal({ transaction, editForm, setEditForm, isNepali, saving, error, onSave, onClose }) {
  const businessCode = transaction.businessCode;
  const updateField = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-800">{isNepali ? 'सम्पादन' : 'Edit Transaction'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'रकम' : 'Amount'}</label>
            <input type="number" inputMode="decimal" value={editForm.amount} onChange={(e) => updateField('amount', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'प्रकार' : 'Type'}</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'इन्धन' : 'Fuel Type'}</label>
                <select value={editForm.fuelType || 'petrol'} onChange={(e) => updateField('fuelType', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'लिटर' : 'Liters'}</label>
                  <input type="number" inputMode="decimal" value={editForm.liters || ''} onChange={(e) => updateField('liters', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'दर/L' : 'Rate/L'}</label>
                  <input type="number" inputMode="decimal" value={editForm.ratePerLiter || ''} onChange={(e) => updateField('ratePerLiter', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'भुक्तानी' : 'Payment'}</label>
                <select value={editForm.paymentMethod || 'CASH'} onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
                  <option value="CASH">{isNepali ? 'नगद' : 'Cash'}</option>
                  <option value="BANK">{isNepali ? 'बैंक' : 'Bank'}</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'सुरु %' : 'Start %'}</label>
                  <input type="number" value={editForm.startPercent ?? ''} onChange={(e) => updateField('startPercent', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'अन्तिम %' : 'End %'}</label>
                  <input type="number" value={editForm.endPercent ?? ''} onChange={(e) => updateField('endPercent', e.target.value)}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'दर/%' : 'Rate/%'}</label>
                <input type="number" value={editForm.ratePerPercent ?? ''} onChange={(e) => updateField('ratePerPercent', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'भुक्तानी' : 'Payment'}</label>
                <select value={editForm.paymentMethod || 'CASH'} onChange={(e) => updateField('paymentMethod', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none">
                  <option value="CASH">{isNepali ? 'नगद' : 'Cash'}</option>
                  <option value="BANK">{isNepali ? 'बैंक' : 'Bank'}</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'टिप्पणी' : 'Notes'}</label>
            <textarea value={editForm.notes || ''} onChange={(e) => updateField('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'सन्दर्भ नं.' : 'Ref No.'}</label>
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
            {isNepali ? 'रद्द' : 'Cancel'}
          </button>
          <button onClick={onSave} disabled={saving}
            className="flex-1 py-4 text-indigo-600 font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div> : (isNepali ? 'सेभ' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Sub-component: Verification Section
// =============================================================================

function VerificationSection({ report, isNepali, isAdmin, verifyNotes, setVerifyNotes, verifying, onVerify }) {
  const isVerified = report.verificationStatus === 'VERIFIED';

  if (isVerified) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-6 h-6 text-green-600" />
          <p className="font-bold text-green-800">{isNepali ? 'प्रमाणित' : 'Verified'}</p>
        </div>
        <p className="text-sm text-green-700">{isNepali ? 'द्वारा:' : 'By:'} {report.verifiedBy}</p>
        {report.verifiedAt && <p className="text-xs text-green-600 mt-1">{new Date(report.verifiedAt).toLocaleString()}</p>}
        {report.verificationNotes && <p className="text-sm text-green-700 mt-2 italic">"{report.verificationNotes}"</p>}
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
        <Clock className="w-6 h-6 text-yellow-600 flex-shrink-0" />
        <p className="text-yellow-800 font-medium">{isNepali ? 'प्रशासक प्रमाणीकरणको प्रतीक्षामा' : 'Awaiting admin verification'}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <h3 className="font-bold text-gray-800 flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-indigo-600" />
        {isNepali ? 'रिपोर्ट प्रमाणित गर्नुहोस्' : 'Verify Report'}
      </h3>
      <textarea value={verifyNotes} onChange={(e) => setVerifyNotes(e.target.value)}
        placeholder={isNepali ? 'टिप्पणी (ऐच्छिक)...' : 'Notes (optional)...'} rows={2}
        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-500 outline-none resize-none" />
      <button onClick={onVerify} disabled={verifying}
        className={`w-full py-3 rounded-xl text-white font-bold transition-all active:scale-95 ${verifying ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
        {verifying ? (isNepali ? 'प्रमाणित गर्दै...' : 'Verifying...') : (isNepali ? 'प्रमाणित गर्नुहोस्' : 'Verify Report')}
      </button>
    </div>
  );
}

// =============================================================================
// Sub-component: Recent Reports (This Week / This Month)
// =============================================================================

function RecentReports({ reports, currentDate, isNepali, formatAmount, formatDateLabel }) {
  if (reports.length === 0) return null;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const thisWeek = reports.filter(r => r.reportDate >= weekStartStr);
  const earlier = reports.filter(r => r.reportDate < weekStartStr);

  const weekTotal = thisWeek.reduce((sum, r) => sum + (parseFloat(r.totalSystemSales) || 0), 0);
  const monthTotal = reports.reduce((sum, r) => sum + (parseFloat(r.totalSystemSales) || 0), 0);

  return (
    <div className="space-y-4">
      {/* This Week */}
      {thisWeek.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              {isNepali ? 'यो हप्ता' : 'This Week'}
            </h2>
            <span className="text-sm font-bold text-indigo-600">{formatAmount(weekTotal)}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {thisWeek.map(r => (
              <ReportRow key={r.id} report={r} currentDate={currentDate} isNepali={isNepali} formatAmount={formatAmount} formatDateLabel={formatDateLabel} />
            ))}
          </div>
        </div>
      )}

      {/* Earlier This Month */}
      {earlier.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-500" />
              {isNepali ? 'यो महिना (पहिलेको)' : 'Earlier This Month'}
            </h2>
            <span className="text-sm font-bold text-gray-600">{formatAmount(monthTotal)}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm divide-y">
            {earlier.map(r => (
              <ReportRow key={r.id} report={r} currentDate={currentDate} isNepali={isNepali} formatAmount={formatAmount} formatDateLabel={formatDateLabel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportRow({ report, currentDate, isNepali, formatAmount, formatDateLabel }) {
  const isCurrentDay = report.reportDate === currentDate;
  const isVerified = report.verificationStatus === 'VERIFIED';

  return (
    <div className={`px-4 py-3 flex items-center justify-between ${isCurrentDay ? 'bg-indigo-50' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${isCurrentDay ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          {new Date(report.reportDate + 'T00:00:00').getDate()}
        </div>
        <div>
          <p className="font-medium text-gray-800 text-sm">{formatDateLabel(report.reportDate)}</p>
          <p className="text-xs text-gray-400">{report.closedBy}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-right">
          <p className="font-bold text-gray-800">{formatAmount(report.totalSystemSales)}</p>
          {parseFloat(report.discrepancy) !== 0 && Math.abs(parseFloat(report.discrepancy)) > 0.5 && (
            <p className={`text-xs font-medium ${parseFloat(report.discrepancy) > 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {parseFloat(report.discrepancy) > 0 ? '+' : ''}{formatAmount(report.discrepancy)}
            </p>
          )}
        </div>
        {isVerified ? (
          <ShieldCheck className="w-5 h-5 text-green-500" />
        ) : (
          <Clock className="w-5 h-5 text-yellow-400" />
        )}
      </div>
    </div>
  );
}