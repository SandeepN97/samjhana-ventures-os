import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home, Check, Banknote, Building2, Settings, User, TrendingUp, TrendingDown, CheckCircle2, Calendar } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/SearchableSelect';
import useBusinessDate from '../hooks/useBusinessDate';
import { formatBsDate, adToBs, BS_MONTHS_NE, toNepaliDigits } from '../utils/nepaliDate';

export default function RentalEntryPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';
  const { businessDate } = useBusinessDate();

  const [properties, setProperties] = useState([]);
  const [values, setValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    propertyId: '',
    rentalMonth: new Date().toISOString().slice(0, 7),
    amountReceived: '',
    paymentMethod: 'CASH',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (businessDate) setValues(prev => ({ ...prev, transactionDate: businessDate }));
  }, [businessDate]);

  useEffect(() => {
    api.get('/api/rental-properties').then(res => setProperties(res.data)).catch(() => {});
  }, []);

  const selectedProperty = properties.find(p => p.id === values.propertyId);
  const monthlyRent = selectedProperty ? parseFloat(selectedProperty.monthlyRent) : 0;
  const received = values.amountReceived !== '' ? parseFloat(values.amountReceived) : NaN;
  const hasComparison = selectedProperty && !isNaN(received) && received >= 0;
  const balance = hasComparison ? received - monthlyRent : 0;
  const isFullPayment = hasComparison && Math.abs(balance) < 1;
  const isPartial = hasComparison && balance < -0.99;
  const isOver = hasComparison && balance > 0.99;

  const handleChange = (key, value) => {
    setValues(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!values.transactionDate) newErrors.transactionDate = 'Date is required';
    if (!values.propertyId) newErrors.propertyId = isNepali ? 'सम्पत्ति छान्नुहोस्' : 'Select a property';
    if (!values.rentalMonth) newErrors.rentalMonth = isNepali ? 'महिना छान्नुहोस्' : 'Rental month is required';
    if (!values.amountReceived || parseFloat(values.amountReceived) <= 0) {
      newErrors.amountReceived = isNepali ? 'भुक्तानी रकम आवश्यक छ' : 'Amount received is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const payload = {
        businessCode: 'rental',
        transactionType: 'SALE',
        transactionDate: values.transactionDate,
        amount: parseFloat(values.amountReceived),
        notes: values.notes || null,
        customFields: {
          propertyId: values.propertyId,
          propertyName: selectedProperty.propertyName,
          tenantName: selectedProperty.tenantName || null,
          monthlyRent: monthlyRent,
          amountReceived: parseFloat(values.amountReceived),
          balance: parseFloat(balance.toFixed(2)),
          rentalMonth: values.rentalMonth,
          paymentMethod: values.paymentMethod,
          paymentType: isFullPayment ? 'FULL' : isPartial ? 'PARTIAL' : 'OVER',
          recordedBy: user.username,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(isNepali ? 'भुक्तानी सफलतापूर्वक सेभ भयो!' : 'Payment recorded successfully!');

      setTimeout(() => {
        setValues({
          transactionDate: businessDate,
          propertyId: '',
          rentalMonth: new Date().toISOString().slice(0, 7),
          amountReceived: '',
          paymentMethod: 'CASH',
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
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-blue-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Home className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">{isNepali ? 'भाडा भुक्तानी' : 'Rental Payment'}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/rental-properties')}
                className="p-2 rounded-full hover:bg-blue-700 transition-colors"
                title={isNepali ? 'सम्पत्ति व्यवस्थापन' : 'Manage Properties'}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>

      {successMessage && (
        <div className="mx-4 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl flex items-center">
          <Check className="w-5 h-5 mr-2" />{successMessage}
        </div>
      )}
      {errors.submit && (
        <div className="mx-4 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
          {errors.submit}
        </div>
      )}

      {properties.length === 0 && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
          {isAdmin
            ? (isNepali ? 'पहिले सम्पत्ति थप्नुहोस्।' : 'No properties set up yet. Add properties first.')
            : (isNepali ? 'कुनै सम्पत्ति छैन। Admin लाई सम्पर्क गर्नुहोस्।' : 'No properties available. Contact admin.')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Date */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'मिति' : 'Date'} <span className="text-red-500">*</span>
          </label>
          <DatePicker value={values.transactionDate} onChange={(val) => handleChange('transactionDate', val)} error={errors.transactionDate} accentColor="blue" />
        </div>

        {/* Property Select */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'सम्पत्ति छान्नुहोस्' : 'Select Property'} <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            value={values.propertyId}
            onChange={(val) => handleChange('propertyId', val)}
            options={properties.map(p => ({
              value: p.id,
              label: p.propertyName,
              subtitle: `${p.tenantName ? p.tenantName + ' · ' : ''}रु ${parseFloat(p.monthlyRent).toLocaleString('en-IN')}/month`,
            }))}
            placeholder={isNepali ? '-- सम्पत्ति छान्नुहोस् --' : '-- Select Property --'}
            error={errors.propertyId}
            accentColor="blue"
          />
          {errors.propertyId && <p className="text-red-500 text-sm mt-1">{errors.propertyId}</p>}
        </div>

        {/* Selected Property Info Card */}
        {selectedProperty && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-blue-800">{selectedProperty.propertyName}</p>
                {selectedProperty.tenantName && (
                  <p className="text-sm text-blue-600 flex items-center gap-1">
                    <User className="w-3 h-3" /> {selectedProperty.tenantName}
                  </p>
                )}
                {selectedProperty.leaseStartDate && (
                  <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    {isNepali
                      ? formatBsDate(selectedProperty.leaseStartDate, true)
                      : selectedProperty.leaseStartDate}
                  </p>
                )}
              </div>
            </div>
            <div className="border-t border-blue-200 pt-2 flex justify-between items-center">
              <span className="text-sm text-blue-600">{isNepali ? 'मासिक भाडा (सम्झौता)' : 'Agreed Monthly Rent'}</span>
              <span className="text-xl font-black text-blue-800">रु {monthlyRent.toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}

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
          {isNepali && values.rentalMonth && (() => {
            try {
              const bs = adToBs(new Date(values.rentalMonth + '-15T12:00:00'));
              return (
                <p className="text-sm text-blue-600 mt-1">
                  ≈ {BS_MONTHS_NE[bs.month]} {toNepaliDigits(bs.year)}
                </p>
              );
            } catch { return null; }
          })()}
          {errors.rentalMonth && <p className="text-red-500 text-sm mt-1">{errors.rentalMonth}</p>}
        </div>

        {/* Amount Received */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'प्राप्त रकम' : 'Amount Received'} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={values.amountReceived}
              onChange={(e) => handleChange('amountReceived', e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.amountReceived ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>
          {errors.amountReceived && <p className="text-red-500 text-sm mt-1">{errors.amountReceived}</p>}
        </div>

        {/* Payment Status Card */}
        {hasComparison && (
          <div className={`rounded-xl overflow-hidden border ${isFullPayment ? 'border-green-200' : isPartial ? 'border-amber-200' : 'border-blue-200'}`}>
            {/* Total received */}
            <div className={`p-4 text-white flex justify-between items-center ${isFullPayment ? 'bg-gradient-to-r from-green-500 to-green-600' : isPartial ? 'bg-gradient-to-r from-amber-500 to-amber-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}>
              <div>
                <p className="text-sm opacity-80">{isNepali ? 'प्राप्त रकम' : 'Amount Received'}</p>
                <p className="text-3xl font-bold">रु {received.toLocaleString('en-IN')}</p>
              </div>
              {isFullPayment
                ? <CheckCircle2 className="w-10 h-10 opacity-70" />
                : isPartial
                  ? <TrendingDown className="w-10 h-10 opacity-70" />
                  : <TrendingUp className="w-10 h-10 opacity-70" />}
            </div>
            {/* Balance row */}
            <div className={`px-4 py-3 flex justify-between items-center ${isFullPayment ? 'bg-green-50' : isPartial ? 'bg-amber-50' : 'bg-blue-50'}`}>
              <div>
                <p className={`font-bold text-sm ${isFullPayment ? 'text-green-700' : isPartial ? 'text-amber-700' : 'text-blue-700'}`}>
                  {isFullPayment
                    ? (isNepali ? 'पूर्ण भुक्तानी ✓' : 'Full Payment ✓')
                    : isPartial
                      ? (isNepali ? 'आंशिक भुक्तानी — बाँकी' : 'Partial Payment — Balance Due')
                      : (isNepali ? 'बढी भुक्तानी — फिर्ता' : 'Overpaid — Change Due')}
                </p>
                <p className={`text-xs ${isFullPayment ? 'text-green-500' : isPartial ? 'text-amber-500' : 'text-blue-400'}`}>
                  {isNepali ? 'सम्झौता भाडा' : 'Agreed rent'}: रु {monthlyRent.toLocaleString('en-IN')}
                </p>
              </div>
              {!isFullPayment && (
                <p className={`text-xl font-bold ${isPartial ? 'text-amber-600' : 'text-blue-600'}`}>
                  {isPartial ? '−' : '+'} रु {Math.abs(balance).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'भुक्तानी विधि' : 'Payment Method'} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => handleChange('paymentMethod', 'CASH')}
              className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${values.paymentMethod === 'CASH' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'}`}>
              <Banknote className="w-5 h-5" />
              {isNepali ? 'नगद' : 'Cash'}
            </button>
            <button type="button" onClick={() => handleChange('paymentMethod', 'BANK')}
              className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${values.paymentMethod === 'BANK' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
              <Building2 className="w-5 h-5" />
              {isNepali ? 'बैंक' : 'Bank'}
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'टिप्पणी' : 'Notes'} <span className="text-gray-400 text-sm">({isNepali ? 'ऐच्छिक' : 'optional'})</span>
          </label>
          <textarea value={values.notes} onChange={(e) => handleChange('notes', e.target.value)} rows={2}
            placeholder={isNepali ? 'थप जानकारी...' : 'Additional notes...'}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Submit */}
        <button type="submit" disabled={isLoading}
          className={`w-full py-5 text-xl font-bold rounded-xl transition-all transform ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 active:scale-95 shadow-lg'} text-white`}>
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
    </div>
  );
}
