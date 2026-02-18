import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Check,
  X,
  Fuel,
  Zap,
  Sofa,
  Home,
  Banknote,
  Clock,
  AlertCircle
} from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

const BUSINESS_ICONS = {
  petrol: { icon: Fuel, color: 'bg-orange-500' },
  ev: { icon: Zap, color: 'bg-green-500' },
  furniture: { icon: Sofa, color: 'bg-purple-500' },
  rental: { icon: Home, color: 'bg-blue-500' },
  loan: { icon: Banknote, color: 'bg-red-500' },
};

export default function PendingReviewPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Rejection modal state
  const [rejectModal, setRejectModal] = useState({ open: false, transactionId: null });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  const fetchPendingTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/transactions');
      // Filter only pending transactions
      const pending = res.data.filter(t => t.status === 'PENDING_REVIEW');
      setTransactions(pending);
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNepali ? 'डाटा लोड गर्न असफल' : 'Failed to load data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await api.patch(`/api/transactions/${id}/approve`);
      setTransactions(prev => prev.filter(t => t.id !== id));
      setMessage({
        type: 'success',
        text: isNepali ? 'कारोबार स्वीकृत!' : 'Transaction approved!'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNepali ? 'स्वीकृत गर्न असफल' : 'Failed to approve'
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  // Open rejection modal
  const openRejectModal = (id) => {
    setRejectModal({ open: true, transactionId: id });
    setRejectReason('');
  };

  // Close rejection modal
  const closeRejectModal = () => {
    setRejectModal({ open: false, transactionId: null });
    setRejectReason('');
  };

  // Submit rejection with reason
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setMessage({
        type: 'error',
        text: isNepali ? 'कृपया अस्वीकृतिको कारण लेख्नुहोस्' : 'Please enter rejection reason'
      });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    const id = rejectModal.transactionId;
    setActionLoading(id);
    try {
      await api.patch(`/api/transactions/${id}/reject`, { reason: rejectReason });
      setTransactions(prev => prev.filter(t => t.id !== id));
      closeRejectModal();
      setMessage({
        type: 'success',
        text: isNepali ? 'कारोबार अस्वीकृत' : 'Transaction rejected'
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: isNepali ? 'अस्वीकृत गर्न असफल' : 'Failed to reject'
      });
    } finally {
      setActionLoading(null);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    if (isNepali) {
      return date.toLocaleDateString('ne-NP');
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatAmount = (amount) => {
    return `रु ${parseFloat(amount).toLocaleString('en-IN')}`;
  };

  const parseCustomFields = (customFieldsStr) => {
    try {
      return JSON.parse(customFieldsStr);
    } catch {
      return {};
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-yellow-500 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-yellow-600 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Clock className="w-7 h-7 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {isNepali ? 'पेन्डिङ समीक्षा' : 'Pending Review'}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Message */}
      {message.text && (
        <div className={`mx-4 mt-4 px-4 py-3 rounded-xl flex items-center ${
          message.type === 'success'
            ? 'bg-green-100 border border-green-400 text-green-700'
            : 'bg-red-100 border border-red-400 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <Check className="w-5 h-5 mr-2" />
          ) : (
            <AlertCircle className="w-5 h-5 mr-2" />
          )}
          {message.text}
        </div>
      )}

      {/* Pending Count */}
      {!loading && (
        <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
          <span className="text-gray-600">
            {isNepali ? 'पेन्डिङ कारोबार' : 'Pending transactions'}
          </span>
          <span className="bg-yellow-500 text-white font-bold px-3 py-1 rounded-full">
            {transactions.length}
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-yellow-500"></div>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-20">
          <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
          <p className="text-lg text-gray-600">
            {isNepali ? 'सबै समीक्षा पूरा भयो!' : 'All caught up!'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {isNepali ? 'कुनै पेन्डिङ कारोबार छैन' : 'No pending transactions'}
          </p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {transactions.map((t) => {
            const business = BUSINESS_ICONS[t.businessCode] || {};
            const Icon = business.icon || AlertCircle;
            const customFields = parseCustomFields(t.customFields);
            const isProcessing = actionLoading === t.id;

            return (
              <div
                key={t.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden ${
                  isProcessing ? 'opacity-50' : ''
                }`}
              >
                {/* Transaction Header */}
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`${business.color || 'bg-gray-500'} p-2 rounded-lg`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{t.businessName}</p>
                        <p className="text-sm text-gray-500">{formatDate(t.transactionDate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${
                        t.transactionType === 'SALE' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatAmount(t.amount)}
                      </p>
                      <span className="text-xs text-gray-500">
                        {t.transactionType === 'SALE'
                          ? (isNepali ? 'बिक्री' : 'Sale')
                          : (isNepali ? 'खरिद/खर्च' : 'Purchase/Expense')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div className="px-4 py-3 bg-gray-50 text-sm">
                  {t.businessCode === 'petrol' && customFields.fuelType && (
                    <p>
                      <span className="text-gray-500">{isNepali ? 'इन्धन:' : 'Fuel:'}</span>{' '}
                      {customFields.fuelType} - {customFields.liters}L @ रु{customFields.ratePerLiter}/L
                    </p>
                  )}
                  {t.businessCode === 'ev' && customFields.unitsCharged && (
                    <p>
                      <span className="text-gray-500">{isNepali ? 'चार्ज:' : 'Charged:'}</span>{' '}
                      {customFields.unitsCharged} kWh @ रु{customFields.unitRate}/kWh
                    </p>
                  )}
                  {t.businessCode === 'furniture' && customFields.itemName && (
                    <p>
                      <span className="text-gray-500">{isNepali ? 'सामान:' : 'Item:'}</span>{' '}
                      {customFields.itemName} x{customFields.quantity}
                    </p>
                  )}
                  {t.businessCode === 'rental' && customFields.propertyName && (
                    <p>
                      <span className="text-gray-500">{isNepali ? 'सम्पत्ति:' : 'Property:'}</span>{' '}
                      {customFields.propertyName}
                    </p>
                  )}
                  {t.businessCode === 'loan' && customFields.borrowerName && (
                    <p>
                      <span className="text-gray-500">{isNepali ? 'ऋणी:' : 'Borrower:'}</span>{' '}
                      {customFields.borrowerName}
                    </p>
                  )}
                  {t.notes && (
                    <p className="mt-1 text-gray-600 italic">"{t.notes}"</p>
                  )}
                  <p className="mt-1 text-gray-400">
                    {isNepali ? 'प्रविष्टकर्ता:' : 'Entered by:'} {t.enteredByName}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex border-t">
                  <button
                    onClick={() => openRejectModal(t.id)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 py-4 text-red-600 hover:bg-red-50 transition-colors border-r"
                  >
                    <X className="w-5 h-5" />
                    <span className="font-bold">{isNepali ? 'अस्वीकार' : 'Reject'}</span>
                  </button>
                  <button
                    onClick={() => handleApprove(t.id)}
                    disabled={isProcessing}
                    className="flex-1 flex items-center justify-center gap-2 py-4 text-green-600 hover:bg-green-50 transition-colors"
                  >
                    <Check className="w-5 h-5" />
                    <span className="font-bold">{isNepali ? 'स्वीकृत' : 'Approve'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="p-4 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {isNepali ? 'अस्वीकृतिको कारण' : 'Rejection Reason'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {isNepali
                  ? 'कृपया यो कारोबार किन अस्वीकृत भयो भनेर लेख्नुहोस्'
                  : 'Please explain why this transaction is being rejected'}
              </p>
            </div>

            <div className="p-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder={isNepali ? 'कारण लेख्नुहोस्...' : 'Enter reason...'}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                autoFocus
              />
            </div>

            <div className="flex border-t">
              <button
                onClick={closeRejectModal}
                className="flex-1 py-4 text-gray-600 font-bold hover:bg-gray-50 transition-colors border-r"
              >
                {isNepali ? 'रद्द गर्नुहोस्' : 'Cancel'}
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="flex-1 py-4 text-red-600 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                ) : (
                  <>
                    <X className="w-5 h-5" />
                    {isNepali ? 'अस्वीकार गर्नुहोस्' : 'Reject'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
