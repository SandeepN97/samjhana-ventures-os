import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Fuel, Check, Settings, Truck, Banknote, Building2 } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import useBusinessDate from '../hooks/useBusinessDate';

export default function PetrolEntryPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const { businessDate } = useBusinessDate();

  const [values, setValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    fuelType: 'petrol',
    liters: '',
    ratePerLiter: '',
    paymentMethod: 'CASH',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Current fuel prices from database
  const [fuelPrices, setFuelPrices] = useState({ petrol: null, diesel: null });
  const [pricesLoaded, setPricesLoaded] = useState(false);

  // Set business date when loaded
  useEffect(() => {
    if (businessDate) {
      setValues(prev => ({ ...prev, transactionDate: businessDate }));
    }
  }, [businessDate]);

  // Fetch current fuel prices on mount and when navigating back to this page
  useEffect(() => {
    fetchCurrentPrices();
  }, [location.key]);

  // Auto-fill rate when fuel type or prices change
  useEffect(() => {
    if (pricesLoaded && fuelPrices[values.fuelType]) {
      setValues(prev => ({
        ...prev,
        ratePerLiter: fuelPrices[values.fuelType].toString(),
      }));
    }
  }, [values.fuelType, pricesLoaded, fuelPrices]);

  const fetchCurrentPrices = useCallback(async () => {
    try {
      // Add timestamp to prevent caching
      const res = await api.get(`/api/fuel-prices/current?_t=${Date.now()}`);
      const prices = {
        petrol: res.data.petrol?.pricePerLiter || null,
        diesel: res.data.diesel?.pricePerLiter || null,
      };
      setFuelPrices(prices);
      setPricesLoaded(true);
    } catch (err) {
      console.error('Failed to fetch fuel prices', err);
      setPricesLoaded(true);
    }
  }, []);

  // Calculate amount
  const calculatedAmount = values.liters && values.ratePerLiter
    ? (parseFloat(values.liters) * parseFloat(values.ratePerLiter)).toFixed(2)
    : '0.00';

  const handleChange = (fieldKey, value) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const handleFuelTypeChange = (type) => {
    setValues(prev => ({
      ...prev,
      fuelType: type,
      // Auto-fill rate if available
      ratePerLiter: fuelPrices[type] ? fuelPrices[type].toString() : prev.ratePerLiter,
    }));
  };

  const validate = () => {
    const newErrors = {};
    if (!values.transactionDate) newErrors.transactionDate = 'Date is required';
    if (!values.fuelType) newErrors.fuelType = 'Fuel type is required';
    if (!values.liters || parseFloat(values.liters) <= 0) {
      newErrors.liters = 'Liters must be greater than 0';
    }
    if (!values.ratePerLiter || parseFloat(values.ratePerLiter) <= 0) {
      newErrors.ratePerLiter = 'Rate must be greater than 0';
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
        businessCode: 'petrol',
        transactionType: 'SALE',
        transactionDate: values.transactionDate,
        amount: parseFloat(calculatedAmount),
        notes: values.notes,
        customFields: {
          fuelType: values.fuelType,
          liters: parseFloat(values.liters),
          ratePerLiter: parseFloat(values.ratePerLiter),
          paymentMethod: values.paymentMethod,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(t('petrol.savedSuccess'));

      // Reset form after short delay
      setTimeout(() => {
        setValues(prev => ({
          transactionDate: businessDate,
          fuelType: prev.fuelType,
          transactionType: 'SALE',
          liters: '',
          ratePerLiter: fuelPrices[prev.fuelType] ? fuelPrices[prev.fuelType].toString() : '',
          paymentMethod: 'CASH',
          notes: '',
        }));
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
      <header className="bg-orange-500 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-orange-600 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Fuel className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('petrol.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Today's Prices Banner */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-md p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-sm text-red-500 font-semibold">⛽ {t('petrol.petrol')}</p>
              <p className="text-2xl font-black text-gray-900">
                {fuelPrices.petrol ? `रु ${parseFloat(fuelPrices.petrol).toFixed(2)}` : '--'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-yellow-500 font-semibold">🛢️ {t('petrol.diesel')}</p>
              <p className="text-2xl font-black text-gray-900">
                {fuelPrices.diesel ? `रु ${parseFloat(fuelPrices.diesel).toFixed(2)}` : '--'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/fuel-orders')}
                className="flex items-center gap-1 text-sm text-blue-600 font-medium px-3 py-2 rounded-lg hover:bg-blue-50"
              >
                <Truck className="w-4 h-4" />
                {'Orders'}
              </button>
            )}
            <button
              onClick={() => navigate('/fuel-prices')}
              className="flex items-center gap-1 text-sm text-orange-600 font-medium px-3 py-2 rounded-lg hover:bg-orange-50"
            >
              <Settings className="w-4 h-4" />
              {'Prices'}
            </button>
          </div>
        </div>
      </div>

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

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Date */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.date')} <span className="text-red-500">*</span>
          </label>
          <DatePicker
            value={values.transactionDate}
            onChange={(val) => handleChange('transactionDate', val)}
            error={errors.transactionDate}
            accentColor="orange"
          />
          {errors.transactionDate && <p className="text-red-500 text-sm mt-1">{errors.transactionDate}</p>}
        </div>

        {/* Fuel Type */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('petrol.fuelType')} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'petrol', tKey: 'petrol.petrol', color: 'red' },
              { value: 'diesel', tKey: 'petrol.diesel', color: 'yellow' },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleFuelTypeChange(type.value)}
                className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex flex-col items-center ${
                  values.fuelType === type.value
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                }`}
              >
                <span>{t(type.tKey)}</span>
                {fuelPrices[type.value] && (
                  <span className={`text-xs ${values.fuelType === type.value ? 'text-white/80' : 'text-gray-500'}`}>
                    रु {parseFloat(fuelPrices[type.value]).toFixed(2)}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Liters */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('petrol.litersLabel')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={values.liters}
            onChange={(e) => handleChange('liters', e.target.value)}
            placeholder={t('petrol.enterLiters')}
            className={`w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.liters ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.liters && <p className="text-red-500 text-sm mt-1">{errors.liters}</p>}
        </div>

        {/* Rate per Liter */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('petrol.rateLabel')} <span className="text-red-500">*</span>
            {fuelPrices[values.fuelType] && (
              <span className="text-sm text-green-600 ml-2">
                ({t('petrol.todayRate')})
              </span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={values.ratePerLiter}
              onChange={(e) => handleChange('ratePerLiter', e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.ratePerLiter ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>
          {errors.ratePerLiter && <p className="text-red-500 text-sm mt-1">{errors.ratePerLiter}</p>}
        </div>

        {/* Calculated Amount - Read Only */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">{t('common.totalAmount')}</p>
          <p className="text-3xl font-bold">रु {parseFloat(calculatedAmount).toLocaleString('en-IN')}</p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.paymentMethod')} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleChange('paymentMethod', 'CASH')}
              className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                values.paymentMethod === 'CASH'
                  ? 'bg-green-500 text-white border-green-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
              }`}
            >
              <Banknote className="w-5 h-5" />
              {t('common.cash')}
            </button>
            <button
              type="button"
              onClick={() => handleChange('paymentMethod', 'BANK')}
              className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                values.paymentMethod === 'BANK'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              <Building2 className="w-5 h-5" />
              {t('common.bank')}
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.notes')} ({t('common.optional')})
          </label>
          <textarea
            value={values.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            placeholder={t('common.additionalNotes')}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
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
              {t('common.savingEllipsis')}
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <Check className="w-6 h-6 mr-2" />
              {t('common.saveEntry')}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
