import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Zap, Check, Banknote, Building2, Car, Settings } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/SearchableSelect';

export default function EVEntryPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  const [chargingMode, setChargingMode] = useState('METER');
  const [vehicles, setVehicles] = useState([]);

  const [values, setValues] = useState({
    transactionDate: new Date().toISOString().split('T')[0],
    chargerType: 'DC_FAST',
    openingMeter: '',
    closingMeter: '',
    unitRate: '',
    // Percentage mode fields
    vehicleId: '',
    startPercent: '',
    endPercent: '',
    // Common
    paymentMethod: 'CASH',
    neaBillRef: '',
    notes: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    api.get('/api/ev-vehicles').then(res => {
      setVehicles(res.data);
    }).catch(() => {});
  }, []);

  // Selected vehicle info
  const selectedVehicle = vehicles.find(v => v.id === values.vehicleId);

  // Calculate units and amount for METER mode
  const unitsCharged = values.openingMeter && values.closingMeter
    ? Math.max(0, parseFloat(values.closingMeter) - parseFloat(values.openingMeter))
    : 0;
  const meterAmount = unitsCharged && values.unitRate
    ? (unitsCharged * parseFloat(values.unitRate)).toFixed(2)
    : '0.00';

  // Calculate amount for PERCENTAGE mode
  const startPct = values.startPercent !== '' ? parseFloat(values.startPercent) : NaN;
  const endPct = values.endPercent !== '' ? parseFloat(values.endPercent) : NaN;
  const percentCharged = (!isNaN(startPct) && !isNaN(endPct))
    ? Math.max(0, endPct - startPct)
    : 0;
  const percentRate = selectedVehicle ? parseFloat(selectedVehicle.ratePerPercent) : 0;
  const percentAmount = (percentCharged * percentRate).toFixed(2);

  const calculatedAmount = chargingMode === 'PERCENTAGE' ? percentAmount : meterAmount;

  const handleChange = (fieldKey, value) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
    if (errors[fieldKey]) {
      setErrors(prev => ({ ...prev, [fieldKey]: null }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!values.transactionDate) newErrors.transactionDate = 'Date is required';

    if (chargingMode === 'PERCENTAGE') {
      if (!values.vehicleId) newErrors.vehicleId = isNepali ? 'गाडी छान्नुहोस्' : 'Select a vehicle';
      if (!values.startPercent && values.startPercent !== '0') {
        newErrors.startPercent = isNepali ? 'सुरुको % आवश्यक छ' : 'Start % is required';
      }
      if (!values.endPercent) {
        newErrors.endPercent = isNepali ? 'अन्तिम % आवश्यक छ' : 'End % is required';
      }
      const start = parseFloat(values.startPercent);
      const end = parseFloat(values.endPercent);
      if (!isNaN(start) && (start < 0 || start > 100)) {
        newErrors.startPercent = isNepali ? '0-100 बीचमा हुनुपर्छ' : 'Must be between 0-100';
      }
      if (!isNaN(end) && (end < 0 || end > 100)) {
        newErrors.endPercent = isNepali ? '0-100 बीचमा हुनुपर्छ' : 'Must be between 0-100';
      }
      if (!isNaN(start) && !isNaN(end) && end <= start) {
        newErrors.endPercent = isNepali ? 'अन्तिम % सुरुको भन्दा ठूलो हुनुपर्छ' : 'End % must be greater than start %';
      }
    } else {
      if (!values.chargerType) newErrors.chargerType = 'Charger type is required';
      if (!values.openingMeter || parseFloat(values.openingMeter) < 0) {
        newErrors.openingMeter = 'Opening meter reading is required';
      }
      if (!values.closingMeter || parseFloat(values.closingMeter) < 0) {
        newErrors.closingMeter = 'Closing meter reading is required';
      }
      if (values.openingMeter && values.closingMeter &&
          parseFloat(values.closingMeter) < parseFloat(values.openingMeter)) {
        newErrors.closingMeter = 'Closing meter must be greater than opening';
      }
      if (!values.unitRate || parseFloat(values.unitRate) <= 0) {
        newErrors.unitRate = 'Unit rate must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      let customFields;
      if (chargingMode === 'PERCENTAGE') {
        customFields = {
          chargingMode: 'PERCENTAGE',
          vehicleId: values.vehicleId,
          vehicleName: selectedVehicle?.vehicleName,
          batteryCapacityKw: selectedVehicle?.batteryCapacityKw,
          startPercent: parseFloat(values.startPercent),
          endPercent: parseFloat(values.endPercent),
          ratePerPercent: percentRate,
          percentCharged: percentCharged,
          paymentMethod: values.paymentMethod,
        };
      } else {
        customFields = {
          chargingMode: 'METER',
          chargerType: values.chargerType,
          openingMeter: parseFloat(values.openingMeter),
          closingMeter: parseFloat(values.closingMeter),
          unitRate: parseFloat(values.unitRate),
          unitsCharged: unitsCharged,
          paymentMethod: values.paymentMethod,
          neaBillRef: values.neaBillRef || null,
        };
      }

      const payload = {
        businessCode: 'ev',
        transactionType: 'SALE',
        transactionDate: values.transactionDate,
        amount: parseFloat(calculatedAmount),
        notes: values.notes,
        customFields,
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(isNepali ? 'सफलतापूर्वक सेभ भयो!' : 'Saved successfully!');

      setTimeout(() => {
        setValues({
          transactionDate: new Date().toISOString().split('T')[0],
          chargerType: 'DC_FAST',
          openingMeter: '',
          closingMeter: '',
          unitRate: '',
          vehicleId: '',
          startPercent: '',
          endPercent: '',
          paymentMethod: 'CASH',
          neaBillRef: '',
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
              {isNepali ? 'EV चार्जिंग' : 'EV Charging'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => navigate('/ev-vehicles')}
                className="p-2 rounded-full hover:bg-green-600 transition-colors"
                title={isNepali ? 'गाडी व्यवस्थापन' : 'Manage Vehicles'}
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <LanguageToggle />
          </div>
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

      {/* Mode Toggle */}
      <div className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-2 bg-gray-200 rounded-xl p-1">
          <button
            type="button"
            onClick={() => setChargingMode('METER')}
            className={`py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              chargingMode === 'METER'
                ? 'bg-white text-green-700 shadow'
                : 'text-gray-500'
            }`}
          >
            <Zap className="w-4 h-4" />
            {isNepali ? 'मिटर रिडिङ' : 'Meter Reading'}
          </button>
          <button
            type="button"
            onClick={() => setChargingMode('PERCENTAGE')}
            className={`py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
              chargingMode === 'PERCENTAGE'
                ? 'bg-white text-green-700 shadow'
                : 'text-gray-500'
            }`}
          >
            <Car className="w-4 h-4" />
            {isNepali ? 'प्रतिशत आधारित' : 'Percentage Based'}
          </button>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Date */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'मिति' : 'Date'} <span className="text-red-500">*</span>
          </label>
          <DatePicker
            value={values.transactionDate}
            onChange={(val) => handleChange('transactionDate', val)}
            error={errors.transactionDate}
            accentColor="green"
          />
        </div>

        {chargingMode === 'PERCENTAGE' ? (
          <>
            {/* Vehicle Dropdown */}
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isNepali ? 'गाडी छान्नुहोस्' : 'Select Vehicle'} <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={values.vehicleId}
                onChange={(val) => handleChange('vehicleId', val)}
                options={vehicles.map(v => ({
                  value: v.id,
                  label: v.vehicleName,
                  subtitle: `${v.batteryCapacityKw}KW, ${v.seatingCapacity} ${isNepali ? 'सीट' : 'seats'} - रु ${v.ratePerPercent}/%`,
                }))}
                placeholder={isNepali ? '-- गाडी छान्नुहोस् --' : '-- Select Vehicle --'}
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
                    {selectedVehicle.batteryCapacityKw} KW | {selectedVehicle.seatingCapacity} {isNepali ? 'सीट' : 'seats'} | रु {selectedVehicle.ratePerPercent}/{isNepali ? 'प्रतिशत' : '%'}
                  </p>
                </div>
              </div>
            )}

            {/* Start Percent */}
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isNepali ? 'सुरुको ब्याट्री %' : 'Start Battery %'} <span className="text-red-500">*</span>
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
                {isNepali ? 'अन्तिम ब्याट्री %' : 'End Battery %'} <span className="text-red-500">*</span>
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

            {/* Percent Charged - Calculated */}
            <div className="bg-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-600">{isNepali ? 'चार्ज प्रतिशत' : 'Percent Charged'}</p>
              {(values.startPercent !== '' && values.endPercent !== '' && selectedVehicle) ? (
                <p className="text-2xl font-bold text-gray-800">{percentCharged}% @ रु {percentRate}/%</p>
              ) : (
                <p className="text-2xl font-bold text-gray-400">{isNepali ? 'गाडी र % भर्नुहोस्' : 'Select vehicle & enter %'}</p>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Charger Type */}
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isNepali ? 'चार्जर प्रकार' : 'Charger Type'} <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'DC_FAST', labelEn: 'DC Fast', labelNe: 'DC फास्ट', icon: '⚡' },
                  { value: 'AC_SLOW', labelEn: 'AC Slow', labelNe: 'AC स्लो', icon: '🔌' },
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => handleChange('chargerType', type.value)}
                    className={`py-4 text-lg font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                      values.chargerType === type.value
                        ? 'bg-green-500 text-white border-green-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-green-400'
                    }`}
                  >
                    <span>{type.icon}</span>
                    {isNepali ? type.labelNe : type.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Opening Meter */}
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isNepali ? 'सुरुको मिटर रिडिङ' : 'Opening Meter'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={values.openingMeter}
                  onChange={(e) => handleChange('openingMeter', e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.openingMeter ? 'border-red-500' : 'border-gray-300'}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">kWh</span>
              </div>
              {errors.openingMeter && <p className="text-red-500 text-sm mt-1">{errors.openingMeter}</p>}
            </div>

            {/* Closing Meter */}
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isNepali ? 'अन्तिम मिटर रिडिङ' : 'Closing Meter'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={values.closingMeter}
                  onChange={(e) => handleChange('closingMeter', e.target.value)}
                  placeholder="0.00"
                  className={`w-full px-4 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.closingMeter ? 'border-red-500' : 'border-gray-300'}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">kWh</span>
              </div>
              {errors.closingMeter && <p className="text-red-500 text-sm mt-1">{errors.closingMeter}</p>}
            </div>

            {/* Units Charged - Calculated */}
            <div className="bg-gray-200 rounded-xl p-4">
              <p className="text-sm text-gray-600">{isNepali ? 'चार्ज युनिट' : 'Units Charged'}</p>
              <p className="text-2xl font-bold text-gray-800">{unitsCharged.toFixed(2)} kWh</p>
            </div>

            {/* Unit Rate */}
            <div>
              <label className="block text-lg font-medium text-gray-700 mb-2">
                {isNepali ? 'प्रति युनिट दर' : 'Rate per Unit'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-gray-500">रु</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={values.unitRate}
                  onChange={(e) => handleChange('unitRate', e.target.value)}
                  placeholder="0.00"
                  className={`w-full pl-12 pr-16 py-4 text-2xl font-bold text-center border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 ${errors.unitRate ? 'border-red-500' : 'border-gray-300'}`}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">/kWh</span>
              </div>
              {errors.unitRate && <p className="text-red-500 text-sm mt-1">{errors.unitRate}</p>}
            </div>
          </>
        )}

        {/* Calculated Amount */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-4 text-white">
          <p className="text-sm opacity-80">{isNepali ? 'कुल रकम' : 'Total Amount'}</p>
          <p className="text-3xl font-bold">रु {parseFloat(calculatedAmount).toLocaleString('en-IN')}</p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'भुक्तानी विधि' : 'Payment Method'} <span className="text-red-500">*</span>
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
              {isNepali ? 'नगद' : 'Cash'}
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
              {isNepali ? 'बैंक' : 'Bank'}
            </button>
          </div>
        </div>

        {/* NEA Bill Reference (meter mode only) */}
        {chargingMode === 'METER' && (
          <div>
            <label className="block text-lg font-medium text-gray-700 mb-2">
              {isNepali ? 'NEA बिल सन्दर्भ' : 'NEA Bill Reference'} <span className="text-gray-400 text-sm">({isNepali ? 'ऐच्छिक' : 'optional'})</span>
            </label>
            <input
              type="text"
              value={values.neaBillRef}
              onChange={(e) => handleChange('neaBillRef', e.target.value)}
              placeholder="NEA-2026-001"
              className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'टिप्पणी' : 'Notes'} <span className="text-gray-400 text-sm">({isNepali ? 'ऐच्छिक' : 'optional'})</span>
          </label>
          <textarea
            value={values.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
            placeholder={isNepali ? 'थप जानकारी...' : 'Additional notes...'}
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
    </div>
  );
}
