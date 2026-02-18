import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home, Check, CreditCard, Settings } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

export default function RentalEntryPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  // Mode: 'payment' (staff & admin) or 'manage' (admin only)
  const [mode, setMode] = useState('payment');

  // Payment form state (for staff - simplified)
  const [paymentValues, setPaymentValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    propertyName: '',
    tenantName: '',
    rentalMonth: new Date().toISOString().slice(0, 7),
    rentAmount: '',
    notes: '',
  });

  // Full form state (for admin - full control)
  const [values, setValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    transactionType: 'INCOME',
    propertyName: '',
    tenantName: '',
    rentalMonth: new Date().toISOString().slice(0, 7),
    rentAmount: '',
    depositAmount: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Calculate total amount (admin mode)
  const totalAmount = (parseFloat(values.rentAmount) || 0) + (parseFloat(values.depositAmount) || 0);

  const handlePaymentChange = (fieldKey, value) => {
    setPaymentValues(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const handleChange = (fieldKey, value) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const validatePayment = () => {
    const newErrors = {};
    if (!paymentValues.transactionDate) newErrors.transactionDate = 'Date is required';
    if (!paymentValues.propertyName || paymentValues.propertyName.trim() === '') {
      newErrors.propertyName = 'Property name is required';
    }
    if (!paymentValues.rentalMonth) {
      newErrors.rentalMonth = 'Rental month is required';
    }
    if (!paymentValues.rentAmount || parseFloat(paymentValues.rentAmount) <= 0) {
      newErrors.rentAmount = 'Amount must be greater than 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validate = () => {
    const newErrors = {};
    if (!values.transactionDate) newErrors.transactionDate = 'Date is required';
    if (!values.transactionType) newErrors.transactionType = 'Transaction type is required';
    if (!values.propertyName || values.propertyName.trim() === '') {
      newErrors.propertyName = 'Property name is required';
    }
    if (!values.rentalMonth) {
      newErrors.rentalMonth = 'Rental month is required';
    }
    if (!values.rentAmount || parseFloat(values.rentAmount) <= 0) {
      newErrors.rentAmount = 'Rent amount must be greater than 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Staff payment submission (simplified - rent received only)
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!validatePayment()) return;

    setIsLoading(true);
    try {
      const payload = {
        businessCode: 'rental',
        transactionType: 'SALE', // Always income for staff
        transactionDate: paymentValues.transactionDate,
        amount: parseFloat(paymentValues.rentAmount),
        notes: paymentValues.notes,
        customFields: {
          propertyName: paymentValues.propertyName,
          tenantName: paymentValues.tenantName || null,
          rentalMonth: paymentValues.rentalMonth,
          rentAmount: parseFloat(paymentValues.rentAmount),
          paymentType: 'RENT_PAYMENT',
          recordedBy: user.username,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(isNepali ? 'भुक्तानी सफलतापूर्वक सेभ भयो!' : 'Payment recorded successfully!');

      setTimeout(() => {
        setPaymentValues({
          transactionDate: new Date().toISOString().split('T')[0],
          propertyName: '',
          tenantName: '',
          rentalMonth: new Date().toISOString().slice(0, 7),
          rentAmount: '',
          notes: '',
        });
        setSuccessMessage('');
      }, 2000);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Failed to save. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  // Admin full submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload = {
        businessCode: 'rental',
        transactionType: values.transactionType === 'INCOME' ? 'SALE' : 'EXPENSE',
        transactionDate: values.transactionDate,
        amount: totalAmount,
        notes: values.notes,
        customFields: {
          propertyName: values.propertyName,
          tenantName: values.tenantName || null,
          rentalMonth: values.rentalMonth,
          rentAmount: parseFloat(values.rentAmount),
          depositAmount: values.depositAmount ? parseFloat(values.depositAmount) : null,
          paymentType: values.transactionType,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(isNepali ? 'सफलतापूर्वक सेभ भयो!' : 'Saved successfully!');

      setTimeout(() => {
        setValues({
          transactionDate: new Date().toISOString().split('T')[0],
          transactionType: 'INCOME',
          propertyName: '',
          tenantName: '',
          rentalMonth: new Date().toISOString().slice(0, 7),
          rentAmount: '',
          depositAmount: '',
          notes: '',
        });
        setSuccessMessage('');
      }, 2000);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Failed to save. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-blue-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Home className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {isNepali ? 'भाडा' : 'Rental'}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Mode Toggle - Admin Only */}
      {isAdmin && (
        <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-1 flex">
          <button
            onClick={() => setMode('payment')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${
              mode === 'payment'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <CreditCard className="w-5 h-5" />
            {isNepali ? 'भुक्तानी थप्नुहोस्' : 'Add Payment'}
          </button>
          <button
            onClick={() => setMode('manage')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-colors ${
              mode === 'manage'
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Settings className="w-5 h-5" />
            {isNepali ? 'व्यवस्थापन' : 'Manage'}
          </button>
        </div>
      )}

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

      {/* Staff Payment Form OR Admin Payment Form */}
      {(mode === 'payment' || !isAdmin) && (
        <form onSubmit={handlePaymentSubmit} className="p-4 space-y-5">
          {/* Info banner for staff */}
          {!isAdmin && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm">
              {isNepali
                ? 'तपाईं भाडा भुक्तानी मात्र रेकर्ड गर्न सक्नुहुन्छ।'
                : 'You can only record rent payments received.'}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'मिति' : 'Date'} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={paymentValues.transactionDate}
              onChange={(e) => handlePaymentChange('transactionDate', e.target.value)}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.transactionDate ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Property Name */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'सम्पत्ति / कोठा' : 'Property / Room'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={paymentValues.propertyName}
              onChange={(e) => handlePaymentChange('propertyName', e.target.value)}
              placeholder={isNepali ? 'जस्तै: कोठा नं. १०१' : 'e.g., Room No. 101'}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.propertyName ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.propertyName && <p className="text-red-500 text-sm mt-1">{errors.propertyName}</p>}
          </div>

          {/* Tenant Name */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'भाडावालको नाम' : 'Tenant Name'}
            </label>
            <input
              type="text"
              value={paymentValues.tenantName}
              onChange={(e) => handlePaymentChange('tenantName', e.target.value)}
              placeholder={isNepali ? 'नाम लेख्नुहोस्' : 'Enter tenant name'}
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Rental Month */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'भाडा महिना' : 'Rental Month'} <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={paymentValues.rentalMonth}
              onChange={(e) => handlePaymentChange('rentalMonth', e.target.value)}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.rentalMonth ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.rentalMonth && <p className="text-red-500 text-sm mt-1">{errors.rentalMonth}</p>}
          </div>

          {/* Rent Amount */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'भुक्तानी रकम' : 'Payment Amount'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={paymentValues.rentAmount}
                onChange={(e) => handlePaymentChange('rentAmount', e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.rentAmount ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {errors.rentAmount && <p className="text-red-500 text-sm mt-1">{errors.rentAmount}</p>}
          </div>

          {/* Total Display */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-80">{isNepali ? 'भुक्तानी रकम' : 'Payment Amount'}</p>
            <p className="text-3xl font-bold">रु {(parseFloat(paymentValues.rentAmount) || 0).toLocaleString('en-IN')}</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'टिप्पणी' : 'Notes'}
            </label>
            <textarea
              value={paymentValues.notes}
              onChange={(e) => handlePaymentChange('notes', e.target.value)}
              rows={2}
              placeholder={isNepali ? 'थप जानकारी...' : 'Additional notes...'}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-5 text-xl font-bold rounded-xl transition-all transform ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-lg'
            } text-white`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {isNepali ? 'सेभ हुँदैछ...' : 'Saving...'}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Check className="w-6 h-6 mr-2" />
                {isNepali ? 'भुक्तानी सेभ गर्नुहोस्' : 'Save Payment'}
              </span>
            )}
          </button>
        </form>
      )}

      {/* Admin Manage Form - Full Control */}
      {isAdmin && mode === 'manage' && (
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Date */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'मिति' : 'Date'} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={values.transactionDate}
              onChange={(e) => handleChange('transactionDate', e.target.value)}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.transactionDate ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>

          {/* Transaction Type */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'कारोबार प्रकार' : 'Transaction Type'} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'INCOME', labelEn: 'Rent Received', labelNe: 'भाडा प्राप्त', icon: '💵' },
                { value: 'EXPENSE', labelEn: 'Maintenance', labelNe: 'मर्मत खर्च', icon: '🔧' },
              ].map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleChange('transactionType', type.value)}
                  className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    values.transactionType === type.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <span>{type.icon}</span>
                  {isNepali ? type.labelNe : type.labelEn}
                </button>
              ))}
            </div>
          </div>

          {/* Property Name */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'सम्पत्ति नाम' : 'Property Name'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={values.propertyName}
              onChange={(e) => handleChange('propertyName', e.target.value)}
              placeholder={isNepali ? 'जस्तै: कोठा नं. १०१' : 'e.g., Room No. 101'}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.propertyName ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.propertyName && <p className="text-red-500 text-sm mt-1">{errors.propertyName}</p>}
          </div>

          {/* Tenant Name */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'भाडावालको नाम' : 'Tenant Name'}
            </label>
            <input
              type="text"
              value={values.tenantName}
              onChange={(e) => handleChange('tenantName', e.target.value)}
              placeholder={isNepali ? 'नाम लेख्नुहोस्' : 'Enter tenant name'}
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Rental Month */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'भाडा महिना' : 'Rental Month'} <span className="text-red-500">*</span>
            </label>
            <input
              type="month"
              value={values.rentalMonth}
              onChange={(e) => handleChange('rentalMonth', e.target.value)}
              className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.rentalMonth ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.rentalMonth && <p className="text-red-500 text-sm mt-1">{errors.rentalMonth}</p>}
          </div>

          {/* Rent Amount */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'भाडा रकम' : 'Rent Amount'} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={values.rentAmount}
                onChange={(e) => handleChange('rentAmount', e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.rentAmount ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {errors.rentAmount && <p className="text-red-500 text-sm mt-1">{errors.rentAmount}</p>}
          </div>

          {/* Deposit Amount */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'धरौटी रकम' : 'Deposit Amount'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                value={values.depositAmount}
                onChange={(e) => handleChange('depositAmount', e.target.value)}
                placeholder="0.00"
                className="w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Calculated Total */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-80">{isNepali ? 'कुल रकम' : 'Total Amount'}</p>
            <p className="text-3xl font-bold">रु {totalAmount.toLocaleString('en-IN')}</p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'टिप्पणी' : 'Notes'}
            </label>
            <textarea
              value={values.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              placeholder={isNepali ? 'थप जानकारी...' : 'Additional notes...'}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-5 text-xl font-bold rounded-xl transition-all transform ${
              isLoading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-95 shadow-lg'
            } text-white`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {isNepali ? 'सेभ हुँदैछ...' : 'Saving...'}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Check className="w-6 h-6 mr-2" />
                {isNepali ? 'सेभ गर्नुहोस्' : 'Save Entry'}
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
