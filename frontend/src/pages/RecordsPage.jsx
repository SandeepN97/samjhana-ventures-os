import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search, Filter, Fuel, Zap, Sofa, Home, Banknote, Droplet } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

const BUSINESS_ICONS = {
  petrol: { icon: Fuel, color: 'bg-red-500', label: 'Petrol', labelNe: 'पेट्रोल' },
  diesel: { icon: Droplet, color: 'bg-yellow-600', label: 'Diesel', labelNe: 'डिजेल' },
  ev: { icon: Zap, color: 'bg-green-500', label: 'EV', labelNe: 'EV' },
  furniture: { icon: Sofa, color: 'bg-purple-500', label: 'Furniture', labelNe: 'फर्निचर' },
  rental: { icon: Home, color: 'bg-blue-500', label: 'Rental', labelNe: 'भाडा' },
  loan: { icon: Banknote, color: 'bg-red-500', label: 'Loan', labelNe: 'ऋण' },
};

export default function RecordsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [filter]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let url = '/api/transactions';
      // For petrol/diesel, fetch all petrol transactions (filter by fuelType happens client-side)
      if (filter === 'petrol' || filter === 'diesel') {
        url = '/api/transactions?businessCode=petrol';
      } else if (filter !== 'all') {
        url = `/api/transactions?businessCode=${filter}`;
      }
      const res = await api.get(url);
      // Parse customFields JSON string to object for each transaction
      const parsed = res.data.map(txn => ({
        ...txn,
        customFields: txn.customFields ? (typeof txn.customFields === 'string' ? JSON.parse(txn.customFields) : txn.customFields) : null
      }));
      setTransactions(parsed);
    } catch (err) {
      setError(t('records.failedToLoad'));
    } finally {
      setLoading(false);
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

  const filteredTransactions = transactions.filter(txn => {
    // Filter by fuel type for petrol/diesel
    if (filter === 'petrol') {
      if (txn.businessCode !== 'petrol' || txn.customFields?.fuelType !== 'petrol') return false;
    } else if (filter === 'diesel') {
      if (txn.businessCode !== 'petrol' || txn.customFields?.fuelType !== 'diesel') return false;
    }

    // Search filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      txn.businessName?.toLowerCase().includes(search) ||
      txn.notes?.toLowerCase().includes(search) ||
      txn.enteredByName?.toLowerCase().includes(search)
    );
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      PENDING_REVIEW: t('status.pendingReview'),
      APPROVED: t('status.approved'),
      REJECTED: t('status.rejected'),
    };
    return labels[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
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
            <h1 className="text-xl font-bold ml-3">
              {t('records.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('common.search')}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-3 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            label={t('records.all')}
          />
          {Object.entries(BUSINESS_ICONS).map(([code, { label, labelNe }]) => (
            <FilterButton
              key={code}
              active={filter === code}
              onClick={() => setFilter(code)}
              label={isNepali ? labelNe : label}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="mx-4 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg">{t('records.noRecords')}</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filteredTransactions.map((txn) => {
            // For petrol transactions, use fuel type specific icon/color
            let business = BUSINESS_ICONS[txn.businessCode] || {};
            if (txn.businessCode === 'petrol' && txn.customFields?.fuelType) {
              business = BUSINESS_ICONS[txn.customFields.fuelType] || business;
            }
            const Icon = business.icon || Filter;
            const fuelType = txn.customFields?.fuelType;
            const liters = txn.customFields?.liters;
            const ratePerLiter = txn.customFields?.ratePerLiter;

            return (
              <div
                key={txn.id}
                className="bg-white rounded-xl shadow-sm p-4 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`${business.color || 'bg-gray-500'} p-2 rounded-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">
                        {txn.businessCode === 'petrol' && fuelType
                          ? (fuelType === 'petrol' ? t('petrol.petrol') : t('petrol.diesel'))
                          : txn.businessName}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(txn.transactionDate)}</p>
                      {/* Show fuel details for petrol/diesel */}
                      {txn.businessCode === 'petrol' && liters && ratePerLiter && (
                        <p className="text-sm text-gray-600 mt-1">
                          {parseFloat(liters).toFixed(2)} {t('records.litersShort')} × रु {parseFloat(ratePerLiter).toFixed(2)}
                          {txn.customFields?.paymentMethod && (
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              txn.customFields.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {txn.customFields.paymentMethod === 'CASH' ? t('common.cash') : t('common.bank')}
                            </span>
                          )}
                        </p>
                      )}
                      {/* Show EV details */}
                      {txn.businessCode === 'ev' && txn.customFields?.unitsCharged && (
                        <p className="text-sm text-gray-600 mt-1">
                          {parseFloat(txn.customFields.unitsCharged).toFixed(2)} kWh × रु {parseFloat(txn.customFields.unitRate).toFixed(2)}
                          {txn.customFields?.paymentMethod && (
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              txn.customFields.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {txn.customFields.paymentMethod === 'CASH' ? t('common.cash') : t('common.bank')}
                            </span>
                          )}
                        </p>
                      )}
                      {txn.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">{txn.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${txn.transactionType === 'SALE' ? 'text-green-600' : 'text-red-600'}`}>
                      {txn.transactionType === 'SALE' ? '+' : '-'}{formatAmount(txn.amount)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(txn.status)}`}>
                      {getStatusLabel(txn.status)}
                    </span>
                  </div>
                </div>
                {/* Rejection reason for rejected transactions */}
                {txn.status === 'REJECTED' && txn.reviewNotes && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-600 font-medium">
                      {t('records.rejectionReason')}
                    </p>
                    <p className="text-sm text-red-700 mt-1">{txn.reviewNotes}</p>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                  <span>{t('records.enteredBy')} {txn.enteredByName}</span>
                  <span>{txn.transactionType === 'SALE' ? t('transactionType.sale') : t('transactionType.purchase')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
