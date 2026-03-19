import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Truck, Check, Fuel, Droplet, ShieldOff } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function FuelOrderPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  const { toasts, showToast, removeToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [values, setValues] = useState({
    orderDate: new Date().toISOString().split('T')[0],
    fuelType: 'petrol',
    liters: '',
    ratePerLiter: '',
    supplierName: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Redirect non-admins
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm">
          <ShieldOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {t('fuelOrder.accessDenied')}
          </h1>
          <p className="text-gray-500 mb-4">
            {t('fuelOrder.noPermission')}
          </p>
          <button
            onClick={() => navigate('/entry/petrol')}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700"
          >
            {t('common.goBack')}
          </button>
        </div>
      </div>
    );
  }

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/transactions?businessCode=petrol');
      // Filter only PURCHASE transactions and parse customFields
      const purchases = res.data
        .filter(t => t.transactionType === 'PURCHASE')
        .map(t => ({
          ...t,
          customFields: t.customFields ? (typeof t.customFields === 'string' ? JSON.parse(t.customFields) : t.customFields) : null
        }))
        .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate));
      setOrders(purchases);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  const calculatedAmount = values.liters && values.ratePerLiter
    ? (parseFloat(values.liters) * parseFloat(values.ratePerLiter)).toFixed(2)
    : '0.00';

  const handleChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!values.orderDate) newErrors.orderDate = 'Date is required';
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

    setIsSubmitting(true);
    try {
      const payload = {
        businessCode: 'petrol',
        transactionType: 'PURCHASE',
        transactionDate: values.orderDate,
        amount: parseFloat(calculatedAmount),
        notes: values.supplierName
          ? `${values.supplierName}${values.notes ? ' - ' + values.notes : ''}`
          : values.notes,
        customFields: {
          fuelType: values.fuelType,
          liters: parseFloat(values.liters),
          ratePerLiter: parseFloat(values.ratePerLiter),
          supplierName: values.supplierName,
          orderType: 'FUEL_ORDER',
        },
      };

      await api.post('/api/transactions', payload);
      showToast(t('fuelOrder.orderSaved'), 'success');

      // Reset form and refresh orders
      setValues(prev => ({
        orderDate: new Date().toISOString().split('T')[0],
        fuelType: prev.fuelType,
        liters: '',
        ratePerLiter: '',
        supplierName: '',
        notes: '',
      }));
      fetchOrders();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save order', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (isNepali) {
      return date.toLocaleDateString('ne-NP');
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatAmount = (amount) => {
    return `रु ${parseFloat(amount).toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-orange-500 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/entry/petrol')}
              className="p-2 -ml-2 rounded-full hover:bg-orange-600 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Truck className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('fuelOrder.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* New Order Form */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          {t('fuelOrder.addNewOrder')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fuelOrder.orderDate')} <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={values.orderDate}
              onChange={(val) => handleChange('orderDate', val)}
              error={errors.orderDate}
              accentColor="orange"
            />
          </div>

          {/* Fuel Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fuelOrder.fuelType')} <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange('fuelType', 'petrol')}
                className={`py-3 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  values.fuelType === 'petrol'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-red-400'
                }`}
              >
                <Fuel className="w-5 h-5" />
                {t('fuelOrder.petrol')}
              </button>
              <button
                type="button"
                onClick={() => handleChange('fuelType', 'diesel')}
                className={`py-3 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                  values.fuelType === 'diesel'
                    ? 'bg-yellow-500 text-white border-yellow-500'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-400'
                }`}
              >
                <Droplet className="w-5 h-5" />
                {t('fuelOrder.diesel')}
              </button>
            </div>
          </div>

          {/* Liters */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fuelOrder.liters')} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={values.liters}
              onChange={(e) => handleChange('liters', e.target.value)}
              placeholder={t('fuelOrder.enterLiters')}
              className={`w-full px-4 py-3 text-xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.liters ? 'border-red-500' : 'border-gray-300'}`}
            />
            {errors.liters && <p className="text-red-500 text-sm mt-1">{errors.liters}</p>}
          </div>

          {/* Rate per Liter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fuelOrder.ratePerLiter')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-gray-500">रु</span>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={values.ratePerLiter}
                onChange={(e) => handleChange('ratePerLiter', e.target.value)}
                placeholder="0.00"
                className={`w-full pl-12 pr-4 py-3 text-xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.ratePerLiter ? 'border-red-500' : 'border-gray-300'}`}
              />
            </div>
            {errors.ratePerLiter && <p className="text-red-500 text-sm mt-1">{errors.ratePerLiter}</p>}
          </div>

          {/* Supplier Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fuelOrder.supplier')} ({t('common.optional')})
            </label>
            <input
              type="text"
              value={values.supplierName}
              onChange={(e) => handleChange('supplierName', e.target.value)}
              placeholder={t('fuelOrder.supplierName')}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('fuelOrder.notes')} ({t('common.optional')})
            </label>
            <textarea
              value={values.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
              placeholder={t('fuelOrder.additionalNotes')}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Total Amount */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-80">{t('fuelOrder.totalAmount')}</p>
            <p className="text-2xl font-bold">रु {parseFloat(calculatedAmount).toLocaleString('en-IN')}</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-4 text-lg font-bold rounded-xl transition-all ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 active:scale-95'
            } text-white`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {t('fuelOrder.saving')}
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <Check className="w-5 h-5 mr-2" />
                {t('fuelOrder.saveOrder')}
              </span>
            )}
          </button>
        </form>
      </div>

      {/* Order History */}
      <div className="mx-4 mt-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3">
          {t('fuelOrder.orderHistory')}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('fuelOrder.noOrders')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const isPetrol = order.customFields?.fuelType === 'petrol';
              return (
                <div
                  key={order.id}
                  className="bg-white rounded-xl shadow-sm p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`${isPetrol ? 'bg-red-500' : 'bg-yellow-500'} p-2 rounded-lg`}>
                        {isPetrol ? <Fuel className="w-5 h-5 text-white" /> : <Droplet className="w-5 h-5 text-white" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">
                          {isPetrol ? t('fuelOrder.petrol') : t('fuelOrder.diesel')}
                        </p>
                        <p className="text-sm text-gray-500">{formatDate(order.transactionDate)}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {order.customFields?.liters?.toFixed(2)} {t('fuelOrder.litersShort')} × रु {order.customFields?.ratePerLiter?.toFixed(2)}
                        </p>
                        {order.notes && (
                          <p className="text-sm text-gray-500 mt-1 italic">{order.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">
                        -{formatAmount(order.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
