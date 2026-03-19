import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sofa, Check } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import useBusinessDate from '../hooks/useBusinessDate';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function FurnitureEntryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { businessDate } = useBusinessDate();
  const { toasts, showToast, removeToast } = useToast();

  const [values, setValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    transactionType: 'SALE',
    itemName: '',
    quantity: '1',
    unitPrice: '',
    customerName: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (businessDate) {
      setValues(prev => ({ ...prev, transactionDate: businessDate }));
    }
  }, [businessDate]);

  // Calculate total amount
  const calculatedAmount = values.quantity && values.unitPrice
    ? (parseInt(values.quantity) * parseFloat(values.unitPrice)).toFixed(2)
    : '0.00';

  const handleChange = (fieldKey, value) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!values.transactionDate) newErrors.transactionDate = t('furniture.dateRequired');
    if (!values.transactionType) newErrors.transactionType = t('furniture.typeRequired');
    if (!values.itemName || values.itemName.trim() === '') {
      newErrors.itemName = t('furniture.itemNameRequired');
    }
    if (!values.quantity || parseInt(values.quantity) < 1) {
      newErrors.quantity = t('furniture.quantityMin');
    }
    if (!values.unitPrice || parseFloat(values.unitPrice) <= 0) {
      newErrors.unitPrice = t('furniture.priceMustBePositive');
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
        businessCode: 'furniture',
        transactionType: values.transactionType,
        transactionDate: values.transactionDate,
        amount: parseFloat(calculatedAmount),
        notes: values.notes,
        customFields: {
          itemName: values.itemName,
          quantity: parseInt(values.quantity),
          unitPrice: parseFloat(values.unitPrice),
          customerName: values.customerName || null,
        },
      };

      await api.post('/api/transactions', payload);
      showToast(t('furniture.savedSuccess'), 'success');

      setValues({
        transactionDate: businessDate,
        transactionType: 'SALE',
        itemName: '',
        quantity: '1',
        unitPrice: '',
        customerName: '',
        notes: '',
      });
    } catch (err) {
      showToast(err.response?.data?.message || t('common.failedToSave'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-amber-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-amber-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Sofa className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('furniture.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Date */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.date')} <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={values.transactionDate}
            onChange={(e) => handleChange('transactionDate', e.target.value)}
            className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.transactionDate ? 'border-red-500' : 'border-gray-300'}`}
          />
        </div>

        {/* Transaction Type */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('furniture.transactionType')} <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'SALE', tKey: 'transactionType.sale', icon: '💰' },
              { value: 'PURCHASE', tKey: 'transactionType.purchase', icon: '🛒' },
            ].map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => handleChange('transactionType', type.value)}
                className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  values.transactionType === type.value
                    ? 'bg-amber-600 text-white border-amber-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-amber-400'
                }`}
              >
                <span>{type.icon}</span>
                {t(type.tKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Item Name */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('furniture.itemName')} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={values.itemName}
            onChange={(e) => handleChange('itemName', e.target.value)}
            placeholder={t('furnitureInv.itemNamePlaceholder')}
            className={`w-full px-4 py-4 text-lg border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.itemName ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.itemName && <p className="text-red-500 text-sm mt-1">{errors.itemName}</p>}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.quantity')} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            inputMode="numeric"
            value={values.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
            className={`w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.quantity ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.quantity && <p className="text-red-500 text-sm mt-1">{errors.quantity}</p>}
        </div>

        {/* Unit Price */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.unitPrice')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={values.unitPrice}
              onChange={(e) => handleChange('unitPrice', e.target.value)}
              placeholder="0.00"
              className={`w-full pl-12 pr-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 ${errors.unitPrice ? 'border-red-500' : 'border-gray-300'}`}
            />
          </div>
          {errors.unitPrice && <p className="text-red-500 text-sm mt-1">{errors.unitPrice}</p>}
        </div>

        {/* Calculated Amount */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">{t('common.totalAmount')}</p>
          <p className="text-3xl font-bold">रु {parseFloat(calculatedAmount).toLocaleString('en-IN')}</p>
        </div>

        {/* Customer Name */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('furniture.customerSupplier')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
          </label>
          <input
            type="text"
            value={values.customerName}
            onChange={(e) => handleChange('customerName', e.target.value)}
            placeholder={t('common.name')}
            className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.notes')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
          </label>
          <textarea
            value={values.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            placeholder={t('common.additionalNotes')}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-5 text-xl font-bold rounded-xl transition-all transform ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-700 active:scale-95 shadow-lg'
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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
