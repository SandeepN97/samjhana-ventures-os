import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Landmark, Check, Plus, CreditCard, TrendingDown, Building2, X, ShieldOff } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/SearchableSelect';

export default function LoanEntryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  if (user.role === 'STAFF') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm">
          <ShieldOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {t('common.accessDenied')}
          </h1>
          <p className="text-gray-500 mb-6">
            {t('loan.accessDeniedMsg')}
          </p>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('loan.goHome')}
          </button>
        </div>
      </div>
    );
  }

  const [mode, setMode] = useState('summary'); // 'summary', 'add_loan', 'make_payment'
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errors, setErrors] = useState({});

  // Form for adding new loan
  const [newLoan, setNewLoan] = useState({
    bankName: '',
    loanAmount: '',
    interestRate: '',
    startDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Form for making payment
  const [payment, setPayment] = useState({
    loanId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    principalAmount: '',
    interestAmount: '',
    notes: '',
  });

  useEffect(() => {
    fetchLoans();
  }, []);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/transactions?businessCode=loan');

      // Process transactions to calculate loan balances
      const loanMap = new Map();

      res.data.forEach(t => {
        // Parse customFields if it's a string
        const customFields = typeof t.customFields === 'string'
          ? JSON.parse(t.customFields)
          : t.customFields;

        if (customFields?.loanType === 'NEW_LOAN') {
          // This is a new loan from bank
          const loanId = t.id;
          if (!loanMap.has(loanId)) {
            loanMap.set(loanId, {
              id: loanId,
              bankName: customFields.bankName,
              originalAmount: parseFloat(customFields.loanAmount || t.amount),
              interestRate: customFields.interestRate || 0,
              startDate: t.transactionDate,
              totalPaid: 0,
              principalPaid: 0,
              interestPaid: 0,
              payments: [],
              status: t.status,
            });
          }
        } else if (customFields?.loanType === 'PAYMENT' && customFields?.loanId) {
          // This is a payment to a loan
          const loanId = customFields.loanId;
          if (loanMap.has(loanId)) {
            const loan = loanMap.get(loanId);
            loan.principalPaid += parseFloat(customFields.principalAmount || 0);
            loan.interestPaid += parseFloat(customFields.interestAmount || 0);
            loan.totalPaid += parseFloat(t.amount);
            loan.payments.push({
              date: t.transactionDate,
              principal: customFields.principalAmount,
              interest: customFields.interestAmount,
              total: t.amount,
            });
          }
        }
      });

      // Convert map to array and calculate remaining
      const loansArray = Array.from(loanMap.values()).map(loan => ({
        ...loan,
        remaining: loan.originalAmount - loan.principalPaid,
      })).filter(loan => loan.status !== 'REJECTED');

      setLoans(loansArray);
    } catch (err) {
      console.error('Failed to fetch loans', err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalBorrowed = loans.reduce((sum, l) => sum + l.originalAmount, 0);
  const totalPaid = loans.reduce((sum, l) => sum + l.principalPaid, 0);
  const totalInterestPaid = loans.reduce((sum, l) => sum + l.interestPaid, 0);
  const totalRemaining = loans.reduce((sum, l) => sum + l.remaining, 0);

  const handleNewLoanChange = (field, value) => {
    setNewLoan(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const handlePaymentChange = (field, value) => {
    setPayment(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const validateNewLoan = () => {
    const newErrors = {};
    if (!newLoan.bankName.trim()) newErrors.bankName = 'Bank name is required';
    if (!newLoan.loanAmount || parseFloat(newLoan.loanAmount) <= 0) {
      newErrors.loanAmount = 'Loan amount must be greater than 0';
    }
    if (!newLoan.startDate) newErrors.startDate = 'Start date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePayment = () => {
    const newErrors = {};
    if (!payment.loanId) newErrors.loanId = 'Please select a loan';
    if (!payment.principalAmount || parseFloat(payment.principalAmount) <= 0) {
      newErrors.principalAmount = 'Principal amount must be greater than 0';
    }
    if (!payment.paymentDate) newErrors.paymentDate = 'Payment date is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddLoan = async (e) => {
    e.preventDefault();
    if (!validateNewLoan()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        businessCode: 'loan',
        transactionType: 'EXPENSE', // Money coming IN from bank
        transactionDate: newLoan.startDate,
        amount: parseFloat(newLoan.loanAmount),
        notes: newLoan.notes,
        customFields: {
          loanType: 'NEW_LOAN',
          bankName: newLoan.bankName,
          loanAmount: parseFloat(newLoan.loanAmount),
          interestRate: newLoan.interestRate ? parseFloat(newLoan.interestRate) : null,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(t('loan.loanAdded'));
      setNewLoan({
        bankName: '',
        loanAmount: '',
        interestRate: '',
        startDate: new Date().toISOString().split('T')[0],
        notes: '',
      });
      fetchLoans();
      setTimeout(() => {
        setSuccessMessage('');
        setMode('summary');
      }, 1500);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Failed to save' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMakePayment = async (e) => {
    e.preventDefault();
    if (!validatePayment()) return;

    const principalAmt = parseFloat(payment.principalAmount) || 0;
    const interestAmt = parseFloat(payment.interestAmount) || 0;
    const totalPayment = principalAmt + interestAmt;

    setIsSubmitting(true);
    try {
      const payload = {
        businessCode: 'loan',
        transactionType: 'SALE', // Money going OUT to bank
        transactionDate: payment.paymentDate,
        amount: totalPayment,
        notes: payment.notes,
        customFields: {
          loanType: 'PAYMENT',
          loanId: payment.loanId,
          principalAmount: principalAmt,
          interestAmount: interestAmt,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(t('rental.savedSuccess'));
      setPayment({
        loanId: '',
        paymentDate: new Date().toISOString().split('T')[0],
        principalAmount: '',
        interestAmount: '',
        notes: '',
      });
      fetchLoans();
      setTimeout(() => {
        setSuccessMessage('');
        setMode('summary');
      }, 1500);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Failed to save' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatAmount = (amount) => {
    return `रु ${parseFloat(amount || 0).toLocaleString('en-IN')}`;
  };

  const selectedLoan = loans.find(l => l.id === payment.loanId);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-red-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => mode === 'summary' ? navigate('/') : setMode('summary')}
              className="p-2 -ml-2 rounded-full hover:bg-red-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Landmark className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('business.loan')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Success Message */}
      {successMessage && (
        <div className="mx-4 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl flex items-center">
          <Check className="w-5 h-5 mr-2" />
          {successMessage}
        </div>
      )}

      {/* Error Message */}
      {errors.submit && (
        <div className="mx-4 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
          {errors.submit}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
        </div>
      ) : mode === 'summary' ? (
        /* ============ SUMMARY VIEW ============ */
        <div className="p-4 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-red-500">
              <p className="text-xs text-gray-500">{t('loan.totalBorrowed')}</p>
              <p className="text-xl font-bold text-gray-800">{formatAmount(totalBorrowed)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-green-500">
              <p className="text-xs text-gray-500">{t('loan.principalPaid')}</p>
              <p className="text-xl font-bold text-green-600">{formatAmount(totalPaid)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-yellow-500">
              <p className="text-xs text-gray-500">{t('loan.interestPaid')}</p>
              <p className="text-xl font-bold text-yellow-600">{formatAmount(totalInterestPaid)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-blue-500">
              <p className="text-xs text-gray-500">{t('loan.remainingBalance')}</p>
              <p className="text-xl font-bold text-blue-600">{formatAmount(totalRemaining)}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('add_loan')}
              className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              {t('loan.addLoan')}
            </button>
            <button
              onClick={() => setMode('make_payment')}
              disabled={loans.length === 0}
              className={`py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${
                loans.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              {t('loan.makePayment')}
            </button>
          </div>

          {/* Active Loans List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h2 className="font-bold text-gray-800">
                {t('loan.activeLoans')} ({loans.length})
              </h2>
            </div>
            {loans.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Landmark className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>{t('loan.noLoans')}</p>
                <p className="text-sm mt-1">{t('loan.addLoanToStart')}</p>
              </div>
            ) : (
              <div className="divide-y">
                {loans.map((loan) => {
                  const paidPercent = loan.originalAmount > 0
                    ? Math.min(100, (loan.principalPaid / loan.originalAmount) * 100)
                    : 0;
                  return (
                    <div key={loan.id} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-red-500" />
                          <div>
                            <p className="font-bold text-gray-800">{loan.bankName}</p>
                            <p className="text-xs text-gray-500">
                              {t('loan.started')} {new Date(loan.startDate).toLocaleDateString()}
                              {loan.interestRate > 0 && ` • ${loan.interestRate}%`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{t('loan.remaining')}</p>
                          <p className="text-lg font-bold text-red-600">{formatAmount(loan.remaining)}</p>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{formatAmount(loan.principalPaid)} {t('loan.paid')}</span>
                          <span>{formatAmount(loan.originalAmount)}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${paidPercent}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-400 mt-1 text-right">
                          {paidPercent.toFixed(1)}% {t('loan.complete')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : mode === 'add_loan' ? (
        /* ============ ADD LOAN FORM ============ */
        <form onSubmit={handleAddLoan} className="p-4 space-y-5">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <Landmark className="w-8 h-8 text-red-500" />
            <div>
              <p className="font-bold text-red-800">{t('loan.addNewBankLoan')}</p>
              <p className="text-sm text-red-600">{t('loan.loanTakenByBusiness')}</p>
            </div>
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.bankName')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newLoan.bankName}
              onChange={(e) => handleNewLoanChange('bankName', e.target.value)}
              placeholder={t('loan.bankNamePlaceholder')}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${errors.bankName ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.bankName && <p className="text-red-500 text-sm mt-1">{errors.bankName}</p>}
          </div>

          {/* Loan Amount */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.loanAmount')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={newLoan.loanAmount}
                onChange={(e) => handleNewLoanChange('loanAmount', e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 ${errors.loanAmount ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {errors.loanAmount && <p className="text-red-500 text-sm mt-1">{errors.loanAmount}</p>}
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.interestRate')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={newLoan.interestRate}
                onChange={(e) => handleNewLoanChange('interestRate', e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-4 text-xl text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.loanDate')} <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={newLoan.startDate}
              onChange={(val) => handleNewLoanChange('startDate', val)}
              error={errors.startDate}
              accentColor="red"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('common.notes')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
            </label>
            <textarea
              value={newLoan.notes}
              onChange={(e) => handleNewLoanChange('notes', e.target.value)}
              rows={2}
              placeholder={t('common.additionalNotes')}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-5 text-xl font-bold rounded-xl transition-all ${
              isSubmitting ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700 active:scale-95'
            } text-white`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('common.savingEllipsis')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Check className="w-6 h-6 mr-2" />
                {t('loan.addLoan')}
              </span>
            )}
          </button>
        </form>
      ) : (
        /* ============ MAKE PAYMENT FORM ============ */
        <form onSubmit={handleMakePayment} className="p-4 space-y-5">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-green-500" />
            <div>
              <p className="font-bold text-green-800">{t('loan.loanPayment')}</p>
              <p className="text-sm text-green-600">{t('loan.recordPaymentToBank')}</p>
            </div>
          </div>

          {/* Select Loan */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.selectLoan')} <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={payment.loanId}
              onChange={(val) => handlePaymentChange('loanId', val)}
              options={loans.map(loan => ({
                value: loan.id,
                label: loan.bankName,
                subtitle: `${t('loan.remaining')}: ${formatAmount(loan.remaining)}`,
              }))}
              placeholder={t('loan.selectLoanPlaceholder')}
              error={errors.loanId}
              accentColor="green"
            />
            {errors.loanId && <p className="text-red-500 text-sm mt-1">{errors.loanId}</p>}
          </div>

          {/* Show selected loan info */}
          {selectedLoan && (
            <div className="bg-gray-100 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-500">{t('loan.originalLoan')}</p>
                  <p className="font-bold">{formatAmount(selectedLoan.originalAmount)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{t('loan.remaining')}</p>
                  <p className="font-bold text-red-600">{formatAmount(selectedLoan.remaining)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Date */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.paymentDate')} <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={payment.paymentDate}
              onChange={(val) => handlePaymentChange('paymentDate', val)}
              error={errors.paymentDate}
              accentColor="green"
            />
          </div>

          {/* Principal Amount */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.principalAmount')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={payment.principalAmount}
                onChange={(e) => handlePaymentChange('principalAmount', e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.principalAmount ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {errors.principalAmount && <p className="text-red-500 text-sm mt-1">{errors.principalAmount}</p>}
          </div>

          {/* Interest Amount */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('loan.interestAmount')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={payment.interestAmount}
                onChange={(e) => handlePaymentChange('interestAmount', e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-4 text-xl text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Total Payment Display */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-80">{t('loan.totalPayment')}</p>
            <p className="text-3xl font-bold">
              {formatAmount((parseFloat(payment.principalAmount) || 0) + (parseFloat(payment.interestAmount) || 0))}
            </p>
            <p className="text-xs opacity-70 mt-1">
              {t('loan.principalAmount')}: {formatAmount(payment.principalAmount || 0)} + {t('loan.interestAmount')}: {formatAmount(payment.interestAmount || 0)}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {t('common.notes')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
            </label>
            <textarea
              value={payment.notes}
              onChange={(e) => handlePaymentChange('notes', e.target.value)}
              rows={2}
              placeholder={t('common.additionalNotes')}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-5 text-xl font-bold rounded-xl transition-all ${
              isSubmitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700 active:scale-95'
            } text-white`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {t('common.savingEllipsis')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Check className="w-6 h-6 mr-2" />
                {t('rental.savePayment')}
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
