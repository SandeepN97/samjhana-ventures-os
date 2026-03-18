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
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

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

      const summaryRes = await api.get(`/api/daily-reports/today-summary?date=${bDate}`);
      setSummary(summaryRes.data);

      // If this date is closed, also fetch transactions
      if (summaryRes.data.isClosed) {
        fetchTransactions(bDate);
      }
    } catch (err) {
      console.error('Failed to load page', err);
      setError(t('dailyClose.failedToLoad'));
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
      setError(t('dailyClose.enterCashFirst'));
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
        setError(t('dailyClose.alreadyClosed'));
        loadPage();
      } else {
        setError(t('dailyClose.failedToClose'));
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
      setEditError(err.response?.data?.message || t('dailyClose.failedToSave'));
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

    if (dateStr === todayStr) return t('common.today');
    if (dateStr === tomorrowStr) return t('dailyClose.tomorrow');
    if (dateStr === yesterdayStr) return t('common.yesterday');
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
                  {t('dailyClose.dayClosed')}
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
                {t('dailyClose.dayHasBeenClosed')}
              </p>
              <p className="text-sm text-green-600">
                {t('dailyClose.closedBy')} {report.closedBy}
              </p>
            </div>
          </div>

          {/* Sales breakdown */}
          <SalesBreakdown report={report} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />

          {/* Cash verification result */}
          <CashSummaryCard report={report} formatAmount={formatAmount} />

          {report.notes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-800 font-medium">{t('dailyClose.notes')}</p>
              <p className="text-yellow-700 mt-1">{report.notes}</p>
            </div>
          )}

          {/* Transaction List */}
          <TransactionList
            transactions={transactions}
            isAdmin={isAdmin}
            formatAmount={formatAmount}
            parseCustomFields={parseCustomFields}
            onEdit={openEditModal}
          />

          {/* Verification Section */}
          <VerificationSection
            report={report}
            isAdmin={isAdmin}
            verifyNotes={verifyNotes}
            setVerifyNotes={setVerifyNotes}
            verifying={verifying}
            onVerify={handleVerify}
          />

        </div>

        {/* Edit Transaction Modal */}
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
                {t('dailyClose.closeDay')}
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
          <SalesBreakdown report={summary} formatAmount={formatAmount} formatLiters={formatLiters} formatUnits={formatUnits} />
        )}

        {/* Total System Sales */}
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
        </div>

        {/* Cash Counting Input */}
        <div className="bg-white rounded-xl shadow-sm p-4">
          <label className="block text-lg font-bold text-gray-800 mb-3">
            <Banknote className="w-6 h-6 inline-block mr-2 text-green-600" />
            {t('dailyClose.countCash')}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl font-bold">रु</span>
            <input
              type="number"
              inputMode="decimal"
              value={cashCounted}
              onChange={(e) => { setCashCounted(e.target.value); setError(''); }}
              placeholder={t('dailyClose.enterCashAmount')}
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
                    <p className="font-bold text-green-800">{t('dailyClose.cashMatches')}</p>
                    <p className="text-sm text-green-600">{t('dailyClose.countedCashMatchesSales')}</p>
                  </div>
                </div>
              ) : discrepancy > 0 ? (
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-8 h-8 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-blue-800">{t('dailyClose.overLabel')}</p>
                    <p className="text-2xl font-bold text-blue-600">+{formatAmount(discrepancy)}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <TrendingDown className="w-8 h-8 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-red-800">{t('dailyClose.shortLabel')}</p>
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
                ? t('dailyClose.reasonForOver')
                : t('dailyClose.reasonForShort')}
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
            ? t('dailyClose.closing')
            : t('dailyClose.closeDay')}
        </button>

      </div>
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

