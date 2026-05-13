import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap, Check, Banknote, Building2, Car, Settings, Pencil, X } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/SearchableSelect';
import useBusinessDate from '../hooks/useBusinessDate';
import { ToastContainer } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function EVEntryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';
  const canEditNeaRate = user.role === 'ADMIN' || user.role === 'MANAGER';
  const { businessDate } = useBusinessDate();
  const { toasts, showToast, removeToast } = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [vehicleLoadError, setVehicleLoadError] = useState(false);

  const [neaRate, setNeaRate] = useState('');
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);

  const [values, setValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    vehicleId: '',
    startPercent: '',
    endPercent: '',
    paymentMethod: 'CASH',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (businessDate) {
      setValues(prev => ({ ...prev, transactionDate: businessDate }));
    }
  }, [businessDate]);

  useEffect(() => {
    api.get('/api/ev-vehicles')
      .then(res => setVehicles(res.data))
      .catch(() => setVehicleLoadError(true));
    // Load NEA rate from backend; fall back to localStorage if backend fails
    const cachedRate = localStorage.getItem('ev_nea_rate') || '';
    api.get('/api/settings/nea_rate', { skipAuthRedirect: true })
      .then(res => {
        const val = res.data.value || cachedRate;
        if (val) {
          setNeaRate(val);
          setRateInput(val);
          localStorage.setItem('ev_nea_rate', val);
        } else {
          setEditingRate(canEditNeaRate);
        }
      })
      .catch(() => {
        // Backend unavailable — use cached value from localStorage
        if (cachedRate) {
          setNeaRate(cachedRate);
          setRateInput(cachedRate);
        } else {
          setEditingRate(canEditNeaRate);
        }
      });
  }, []);

  const selectedVehicle = vehicles.find(v => v.id === values.vehicleId);

  const startPct = values.startPercent !== '' ? parseFloat(values.startPercent) : NaN;
  const endPct = values.endPercent !== '' ? parseFloat(values.endPercent) : NaN;
  const percentCharged = (!isNaN(startPct) && !isNaN(endPct)) ? Math.max(0, endPct - startPct) : 0;
  const percentRate = selectedVehicle ? parseFloat(selectedVehicle.ratePerPercent) : 0;
  const calculatedAmount = (percentCharged * percentRate).toFixed(2);

  // Profit calculation using battery capacity from vehicle
  const batteryKw = selectedVehicle ? parseFloat(selectedVehicle.batteryCapacityKw) : 0;
  const estimatedKwh = batteryKw > 0 ? (percentCharged / 100) * batteryKw : 0;
  const neaRateVal = neaRate !== '' ? parseFloat(neaRate) : NaN;
  const hasProfit = !isNaN(neaRateVal) && neaRateVal > 0 && estimatedKwh > 0;
  const neaCost = hasProfit ? estimatedKwh * neaRateVal : 0;
  const profit = hasProfit ? parseFloat(calculatedAmount) - neaCost : 0;
  const profitMargin = hasProfit && parseFloat(calculatedAmount) > 0
    ? ((profit / parseFloat(calculatedAmount)) * 100).toFixed(1) : '0.0';

  const saveNeaRate = async () => {
    const val = rateInput.trim();
    if (!val || parseFloat(val) <= 0) return;
    // Always save to localStorage immediately so the rate is never lost
    localStorage.setItem('ev_nea_rate', val);
    setNeaRate(val);
    setEditingRate(false);
    // Also persist to backend (best-effort, never causes logout)
    setRateSaving(true);
    try {
      await api.put('/api/settings/nea_rate', { value: val }, { skipAuthRedirect: true });
    } catch (err) {
      // Backend save failed — rate is still saved in localStorage
    } finally {
      setRateSaving(false);
    }
  };

  const cancelEditRate = () => {
    setRateInput(neaRate);
    setEditingRate(false);
  };

  const handleChange = (fieldKey, value) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!values.transactionDate) newErrors.transactionDate = 'Date is required';
    if (!values.vehicleId) newErrors.vehicleId = t('ev.selectVehicle');
    if (!values.startPercent && values.startPercent !== '0') {
      newErrors.startPercent = t('ev.startPctRequired');
    }
    if (!values.endPercent) {
      newErrors.endPercent = t('ev.endPctRequired');
    }
    const start = parseFloat(values.startPercent);
    const end = parseFloat(values.endPercent);
    if (!isNaN(start) && (start < 0 || start > 100)) {
      newErrors.startPercent = t('ev.mustBe0to100');
    }
    if (!isNaN(end) && (end < 0 || end > 100)) {
      newErrors.endPercent = t('ev.mustBe0to100');
    }
    if (!isNaN(start) && !isNaN(end) && end <= start) {
      newErrors.endPercent = t('ev.endMustBeGreater');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const customFields = {
        chargingMode: 'PERCENTAGE',
        vehicleId: values.vehicleId,
        vehicleName: selectedVehicle?.vehicleName,
        batteryCapacityKw: batteryKw,
        startPercent: parseFloat(values.startPercent),
        endPercent: parseFloat(values.endPercent),
        ratePerPercent: percentRate,
        percentCharged,
        estimatedKwh: parseFloat(estimatedKwh.toFixed(3)),
        paymentMethod: values.paymentMethod,
        ...(hasProfit && {
          neaRatePerUnit: neaRateVal,
          neaCost: parseFloat(neaCost.toFixed(2)),
          profit: parseFloat(profit.toFixed(2)),
          profitMargin: parseFloat(profitMargin),
        }),
      };

      const payload = {
        businessCode: 'ev',
        transactionType: 'SALE',
        transactionDate: values.transactionDate,
        amount: parseFloat(calculatedAmount),
        notes: values.notes,
        customFields,
      };

      await api.post('/api/transactions', payload);
      showToast(t('ev.savedSuccess'), 'success');

      setValues({
        transactionDate: businessDate,
        vehicleId: '',
        startPercent: '',
        endPercent: '',
        paymentMethod: 'CASH',
        notes: '',
      });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-green-500 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-green-600 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Zap className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('ev.title')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/ev-vehicles')}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-green-600 transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{t('ev.manageVehicles')}</span>
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>

      {/* NEA Rate Banner */}
      <div className="mx-4 mt-4 bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-600 font-semibold">⚡ {t('ev.neaRatePerUnit')}</p>
            {editingRate ? (
              <div className="flex items-center gap-2 mt-1">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">रु</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    autoFocus
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveNeaRate(); if (e.key === 'Escape') cancelEditRate(); }}
                    placeholder="0.00"
                    className="pl-8 pr-12 py-2 text-xl font-bold border-2 border-green-400 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/kWh</span>
                </div>
                <button onClick={saveNeaRate} disabled={rateSaving} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                  <Check className="w-4 h-4" />
                </button>
                {neaRate && (
                  <button onClick={cancelEditRate} className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <p className="text-2xl font-black text-gray-900">
                रु {parseFloat(neaRate).toFixed(2)} <span className="text-sm font-normal text-gray-400">/kWh</span>
              </p>
            )}
          </div>
          {!editingRate && canEditNeaRate && (
            <button
              onClick={() => { setRateInput(neaRate); setEditingRate(true); }}
              className="flex items-center gap-1 text-sm text-green-600 font-medium px-3 py-2 rounded-lg hover:bg-green-50"
            >
              <Pencil className="w-4 h-4" />
              {t('common.update')}
            </button>
          )}
        </div>
        {!neaRate && !editingRate && (
          <p className="text-xs text-amber-500 mt-1">{t('ev.enterRateForProfit')}</p>
        )}
      </div>

      {/* Vehicle load error */}
      {vehicleLoadError && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {t('ev.failedToLoadVehicles')}
        </div>
      )}

      {/* No vehicles warning */}
      {!vehicleLoadError && vehicles.length === 0 && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl text-sm">
          {isAdmin ? t('ev.noVehiclesAdmin') : t('ev.noVehiclesStaff')}
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
            accentColor="green"
          />
        </div>

        {/* Vehicle Dropdown */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('ev.selectVehicle')} <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            value={values.vehicleId}
            onChange={(val) => handleChange('vehicleId', val)}
            options={vehicles.map(v => ({
              value: v.id,
              label: v.vehicleName,
              subtitle: `${v.batteryCapacityKw}KW, ${v.seatingCapacity} ${t('ev.seats')} - रु ${v.ratePerPercent}/%`,
            }))}
            placeholder={t('ev.selectVehiclePlaceholder')}
            error={errors.vehicleId}
            accentColor="green"
          />
          {errors.vehicleId && <p className="text-red-500 text-sm mt-1">{errors.vehicleId}</p>}
        </div>

        {/* Selected Vehicle Info */}
        {selectedVehicle && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
            <Car className="w-8 h-8 text-green-600" />
            <div>
              <p className="font-bold text-green-800">{selectedVehicle.vehicleName}</p>
              <p className="text-sm text-green-600">
                {selectedVehicle.batteryCapacityKw} KW | {selectedVehicle.seatingCapacity} {t('ev.seats')} | रु {selectedVehicle.ratePerPercent}/{t('ev.perPercent')}
              </p>
            </div>
          </div>
        )}

        {/* Start Percent */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('ev.startBatteryPct')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="numeric"
              value={values.startPercent}
              onChange={(e) => handleChange('startPercent', e.target.value)}
              placeholder="0"
              className={`w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.startPercent ? 'border-red-500' : 'border-gray-300'}`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">%</span>
          </div>
          {errors.startPercent && <p className="text-red-500 text-sm mt-1">{errors.startPercent}</p>}
        </div>

        {/* End Percent */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {t('ev.endBatteryPct')} <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="numeric"
              value={values.endPercent}
              onChange={(e) => handleChange('endPercent', e.target.value)}
              placeholder="100"
              className={`w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.endPercent ? 'border-red-500' : 'border-gray-300'}`}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">%</span>
          </div>
          {errors.endPercent && <p className="text-red-500 text-sm mt-1">{errors.endPercent}</p>}
        </div>

        {/* Charging Summary - Calculated */}
        {(values.startPercent !== '' && values.endPercent !== '' && selectedVehicle) && (
          <div className="bg-gray-100 rounded-xl p-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500">{t('ev.percentCharged')}</p>
              <p className="text-xl font-bold text-gray-800">{percentCharged}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t('ev.estimatedKwh')}</p>
              <p className="text-xl font-bold text-gray-800">{estimatedKwh.toFixed(2)} kWh</p>
            </div>
            <div className="col-span-2 text-xs text-gray-400 -mt-1">
              {percentCharged}% of {batteryKw} kWh battery = {estimatedKwh.toFixed(2)} kWh
            </div>
          </div>
        )}

        {/* Total Amount */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
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
            {t('common.notes')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
          </label>
          <textarea
            value={values.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            placeholder={t('common.additionalNotes')}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
