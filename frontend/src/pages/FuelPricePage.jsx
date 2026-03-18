import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Fuel, Check, History, Plus, Eye, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

export default function FuelPricePage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [currentPrices, setCurrentPrices] = useState({ petrol: null, diesel: null });
  const [priceHistory, setPriceHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');
  const [fetchingNoc, setFetchingNoc] = useState(false);

  const [formValues, setFormValues] = useState({
    effectiveDate: new Date().toISOString().split('T')[0],
    petrolPrice: '',
    dieselPrice: '',
  });

  useEffect(() => {
    fetchCurrentPrices();
    fetchPriceHistory();
  }, []);

  const fetchCurrentPrices = async () => {
    try {
      // Add timestamp to prevent caching
      const res = await api.get(`/api/fuel-prices/current?_t=${Date.now()}`);
      console.log('Fetched prices:', res.data);
      setCurrentPrices({
        petrol: res.data.petrol?.pricePerLiter || null,
        diesel: res.data.diesel?.pricePerLiter || null,
      });
      // Pre-fill form with current prices
      if (res.data.petrol || res.data.diesel) {
        setFormValues(prev => ({
          ...prev,
          petrolPrice: res.data.petrol?.pricePerLiter || '',
          dieselPrice: res.data.diesel?.pricePerLiter || '',
        }));
      }
    } catch (err) {
      console.error('Failed to fetch current prices', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPriceHistory = async () => {
    try {
      const res = await api.get('/api/fuel-prices');
      setPriceHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch price history', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formValues.petrolPrice && !formValues.dieselPrice) {
      setError(t('fuelPrice.atLeastOneRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        effectiveDate: formValues.effectiveDate,
      };
      if (formValues.petrolPrice) {
        payload.petrolPrice = parseFloat(formValues.petrolPrice);
      }
      if (formValues.dieselPrice) {
        payload.dieselPrice = parseFloat(formValues.dieselPrice);
      }

      await api.post('/api/fuel-prices/bulk', payload);
      setSuccessMessage(t('fuelPrice.pricesUpdated'));
      fetchCurrentPrices();
      fetchPriceHistory();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t('fuelPrice.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleFetchNoc = async () => {
    setFetchingNoc(true);
    setError('');
    try {
      await api.post('/api/fuel-prices/fetch-noc');
      setSuccessMessage(t('fuelPrice.nocPricesUpdated'));
      fetchCurrentPrices();
      fetchPriceHistory();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || t('fuelPrice.nocFetchFailed'));
    } finally {
      setFetchingNoc(false);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(isNepali ? 'ne-NP' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
            <Fuel className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('fuelPrice.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Current Prices Display */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-md border-l-4 border-red-500 min-w-0">
            <p className="text-sm font-bold text-red-600 truncate">⛽ {t('fuelPrice.petrol')}</p>
            <p className="text-3xl font-black text-gray-900 mt-2 break-words leading-tight">
              {currentPrices.petrol
                ? `रु ${parseFloat(currentPrices.petrol).toFixed(2)}`
                : t('fuelPrice.notSet')}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{t('fuelPrice.perLiter')}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-md border-l-4 border-yellow-500 min-w-0">
            <p className="text-sm font-bold text-yellow-600 truncate">🛢️ {t('fuelPrice.diesel')}</p>
            <p className="text-3xl font-black text-gray-900 mt-2 break-words leading-tight">
              {currentPrices.diesel
                ? `रु ${parseFloat(currentPrices.diesel).toFixed(2)}`
                : t('fuelPrice.notSet')}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{t('fuelPrice.perLiter')}</p>
          </div>
        </div>
      </div>

      {/* Fetch NOC Prices Button - Admin Only */}
      {isAdmin && (
        <div className="px-4 mt-2">
          <button
            onClick={handleFetchNoc}
            disabled={fetchingNoc}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
              fetchingNoc
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 active:scale-95 text-white'
            }`}
          >
            <RefreshCw className={`w-5 h-5 ${fetchingNoc ? 'animate-spin' : ''}`} />
            {fetchingNoc
              ? t('fuelPrice.fetchingNoc')
              : t('fuelPrice.fetchNocPrices')}
          </button>
        </div>
      )}

      {/* Staff View-Only Notice */}
      {!isAdmin && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl flex items-center">
          <Eye className="w-5 h-5 mr-2 flex-shrink-0" />
          <span className="text-sm">
            {t('fuelPrice.viewOnlyNotice')}
          </span>
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
      {error && (
        <div className="mx-4 mt-2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Update Form - Admin Only */}
      {isAdmin && (
        <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('fuelPrice.updatePrices')}
            </h2>

            {/* Effective Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fuelPrice.effectiveDate')}
              </label>
              <input
                type="date"
                value={formValues.effectiveDate}
                onChange={(e) => setFormValues(prev => ({ ...prev, effectiveDate: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Petrol Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fuelPrice.petrolPrice')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">रु</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={formValues.petrolPrice}
                  onChange={(e) => setFormValues(prev => ({ ...prev, petrolPrice: e.target.value }))}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-4 text-xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Diesel Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('fuelPrice.dieselPrice')}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">रु</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={formValues.dieselPrice}
                  onChange={(e) => setFormValues(prev => ({ ...prev, dieselPrice: e.target.value }))}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-4 text-xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={saving}
              className={`w-full py-4 text-lg font-bold rounded-xl transition-all ${
                saving
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600 active:scale-95'
              } text-white`}
            >
              {saving ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  {t('fuelPrice.saving')}
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <Check className="w-5 h-5 mr-2" />
                  {t('fuelPrice.savePrices')}
                </span>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Price History */}
      <div className="px-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-4 shadow-sm"
        >
          <span className="flex items-center gap-2 font-bold text-gray-700">
            <History className="w-5 h-5" />
            {t('fuelPrice.priceHistory')}
          </span>
          <span className="text-gray-400">{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          <div className="mt-2 bg-white rounded-xl shadow-sm overflow-hidden">
            {priceHistory.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {t('fuelPrice.noHistory')}
              </div>
            ) : (
              <div className="divide-y">
                {priceHistory.slice(0, 20).map((price) => (
                  <div key={price.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold mr-2 ${
                        price.fuelType === 'PETROL'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {price.fuelType === 'PETROL'
                          ? t('fuelPrice.petrol')
                          : t('fuelPrice.diesel')}
                      </span>
                      {price.updatedByName === 'NOC Auto-Update' && (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium mr-2 bg-green-100 text-green-700">
                          NOC
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {formatDate(price.effectiveDate)}
                      </span>
                    </div>
                    <span className="font-bold text-gray-800">
                      रु {parseFloat(price.pricePerLiter).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
