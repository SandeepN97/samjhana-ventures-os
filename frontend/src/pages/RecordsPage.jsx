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
  const { i18n } = useTranslation();
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
      const parsed = res.data.map(t => ({
        ...t,
        customFields: t.customFields ? (typeof t.customFields === 'string' ? JSON.parse(t.customFields) : t.customFields) : null
      }));
      setTransactions(parsed);
    } catch (err) {
      setError(isNepali ? 'डाटा लोड गर्न असफल' : 'Failed to load data');
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

  const filteredTransactions = transactions.filter(t => {
    // Filter by fuel type for petrol/diesel
    if (filter === 'petrol') {
      if (t.businessCode !== 'petrol' || t.customFields?.fuelType !== 'petrol') return false;
    } else if (filter === 'diesel') {
      if (t.businessCode !== 'petrol' || t.customFields?.fuelType !== 'diesel') return false;
    }

    // Search filter
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      t.businessName?.toLowerCase().includes(search) ||
      t.notes?.toLowerCase().includes(search) ||
      t.enteredByName?.toLowerCase().includes(search)
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
      PENDING_REVIEW: isNepali ? 'पेन्डिङ' : 'Pending',
      APPROVED: isNepali ? 'स्वीकृत' : 'Approved',
      REJECTED: isNepali ? 'अस्वीकृत' : 'Rejected',
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
              {isNepali ? 'रेकर्डहरू' : 'Records'}
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
            placeholder={isNepali ? 'खोज्नुहोस्...' : 'Search...'}
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
            label={isNepali ? 'सबै' : 'All'}
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
          <p className="text-lg">{isNepali ? 'कुनै रेकर्ड छैन' : 'No records found'}</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filteredTransactions.map((t) => {
            // For petrol transactions, use fuel type specific icon/color
            let business = BUSINESS_ICONS[t.businessCode] || {};
            if (t.businessCode === 'petrol' && t.customFields?.fuelType) {
              business = BUSINESS_ICONS[t.customFields.fuelType] || business;
            }
            const Icon = business.icon || Filter;
            const fuelType = t.customFields?.fuelType;
            const liters = t.customFields?.liters;
            const ratePerLiter = t.customFields?.ratePerLiter;

            return (
              <div
                key={t.id}
                className="bg-white rounded-xl shadow-sm p-4 active:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`${business.color || 'bg-gray-500'} p-2 rounded-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-800">
                        {t.businessCode === 'petrol' && fuelType
                          ? (isNepali
                              ? (fuelType === 'petrol' ? 'पेट्रोल' : 'डिजेल')
                              : (fuelType === 'petrol' ? 'Petrol' : 'Diesel'))
                          : t.businessName}
                      </p>
                      <p className="text-sm text-gray-500">{formatDate(t.transactionDate)}</p>
                      {/* Show fuel details for petrol/diesel */}
                      {t.businessCode === 'petrol' && liters && ratePerLiter && (
                        <p className="text-sm text-gray-600 mt-1">
                          {parseFloat(liters).toFixed(2)} {isNepali ? 'लि.' : 'L'} × रु {parseFloat(ratePerLiter).toFixed(2)}
                          {t.customFields?.paymentMethod && (
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              t.customFields.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {t.customFields.paymentMethod === 'CASH' ? (isNepali ? 'नगद' : 'Cash') : (isNepali ? 'बैंक' : 'Bank')}
                            </span>
                          )}
                        </p>
                      )}
                      {/* Show EV details */}
                      {t.businessCode === 'ev' && t.customFields?.unitsCharged && (
                        <p className="text-sm text-gray-600 mt-1">
                          {parseFloat(t.customFields.unitsCharged).toFixed(2)} kWh × रु {parseFloat(t.customFields.unitRate).toFixed(2)}
                          {t.customFields?.paymentMethod && (
                            <span className={`ml-2 text-xs px-2 py-0.5 rounded ${
                              t.customFields.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {t.customFields.paymentMethod === 'CASH' ? (isNepali ? 'नगद' : 'Cash') : (isNepali ? 'बैंक' : 'Bank')}
                            </span>
                          )}
                        </p>
                      )}
                      {t.notes && (
                        <p className="text-sm text-gray-500 mt-1 italic">{t.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${t.transactionType === 'SALE' ? 'text-green-600' : 'text-red-600'}`}>
                      {t.transactionType === 'SALE' ? '+' : '-'}{formatAmount(t.amount)}
                    </p>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(t.status)}`}>
                      {getStatusLabel(t.status)}
                    </span>
                  </div>
                </div>
                {/* Rejection reason for rejected transactions */}
                {t.status === 'REJECTED' && t.reviewNotes && (
                  <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs text-red-600 font-medium">
                      {isNepali ? 'अस्वीकृतिको कारण:' : 'Rejection reason:'}
                    </p>
                    <p className="text-sm text-red-700 mt-1">{t.reviewNotes}</p>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                  <span>{isNepali ? 'प्रविष्टकर्ता:' : 'By:'} {t.enteredByName}</span>
                  <span>{t.transactionType === 'SALE' ? (isNepali ? 'बिक्री' : 'Sale') : (isNepali ? 'खरिद' : 'Purchase')}</span>
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
