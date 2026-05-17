import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Home, User, TrendingDown, TrendingUp, Check,
  ChevronDown, ChevronUp, Calendar, Banknote, Building2,
} from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import { formatBsDate } from '../utils/nepaliDate';

const fmt = (n) => parseFloat(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function RentalTenantsPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({}); // propertyId → true/false
  const [ledgers, setLedgers] = useState({});    // propertyId → ledger data
  const [ledgerLoading, setLedgerLoading] = useState({}); // propertyId → bool

  useEffect(() => {
    api.get('/api/rental-properties')
      .then(res => setProperties(res.data.filter(p => p.isActive)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleTenant = async (property) => {
    const id = property.id;
    const nowOpen = !expanded[id];
    setExpanded(prev => ({ ...prev, [id]: nowOpen }));

    if (nowOpen && !ledgers[id]) {
      setLedgerLoading(prev => ({ ...prev, [id]: true }));
      try {
        const res = await api.get(`/api/rental-properties/${id}/ledger`);
        setLedgers(prev => ({ ...prev, [id]: res.data }));
      } catch {
        setLedgers(prev => ({ ...prev, [id]: { error: true } }));
      } finally {
        setLedgerLoading(prev => ({ ...prev, [id]: false }));
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return isNepali ? formatBsDate(dateStr, true) : dateStr;
  };

  // Total outstanding across all tenants
  const totalOwed = Object.values(ledgers).reduce((sum, l) => {
    const bal = parseFloat(l.outstandingBalance || 0);
    return bal < -0.99 ? sum + Math.abs(bal) : sum;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/entry/rental')}
              className="p-2 -ml-2 rounded-full hover:bg-blue-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <User className="w-6 h-6 ml-2" />
            <h1 className="text-xl font-bold ml-2">{t('rental.tenants')}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Summary bar */}
      {!loading && properties.length > 0 && (
        <div className="bg-white border-b px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-gray-500">
            {properties.length} {t('rental.activeProperties')}
          </span>
          {totalOwed > 0 && (
            <span className="text-sm font-semibold text-red-600">
              {t('rental.totalOutstanding')}: रु {fmt(totalOwed)}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Home className="w-16 h-16 mx-auto mb-4 opacity-40" />
          <p>{t('rentalProp.noProperties')}</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {properties.map(property => {
            const id = property.id;
            const isOpen = !!expanded[id];
            const ledger = ledgers[id];
            const isLoadingLedger = !!ledgerLoading[id];
            const bal = ledger ? parseFloat(ledger.outstandingBalance) : null;
            const isOwed   = bal !== null && bal < -0.99;
            const isCredit = bal !== null && bal > 0.99;

            return (
              <div key={id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Tenant card header — tap to expand */}
                <button
                  onClick={() => toggleTenant(property)}
                  className="w-full text-left p-4 flex items-start justify-between gap-3 active:bg-gray-50"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="bg-blue-100 rounded-full p-2 flex-shrink-0">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-800 truncate">{property.tenantName || t('rental.noTenant')}</p>
                      <p className="text-sm text-gray-500 truncate">{property.propertyName}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="text-sm font-semibold text-blue-700">
                          रु {fmt(property.monthlyRent)}/{t('rental.month')}
                        </span>
                        {property.leaseStartDate && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(property.leaseStartDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {/* Balance badge */}
                    {bal !== null ? (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-bold
                        ${isOwed ? 'bg-red-100 text-red-700' : isCredit ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {isOwed ? <TrendingDown className="w-4 h-4" /> : isCredit ? <TrendingUp className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        {isOwed
                          ? `−रु ${fmt(Math.abs(bal))}`
                          : isCredit
                            ? `+रु ${fmt(bal)}`
                            : t('rentalProp.accountClear')}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 pt-1">{t('rental.tapToView')}</div>
                    )}
                    {ledger && (
                      <span className="text-xs text-gray-400">
                        {ledger.totalPayments} {t('rental.paymentsOnRecord')}
                      </span>
                    )}
                    {isOpen
                      ? <ChevronUp className="w-4 h-4 text-gray-400 mt-1" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 mt-1" />}
                  </div>
                </button>

                {/* Expanded: payment history */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {isLoadingLedger ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                      </div>
                    ) : ledger?.error ? (
                      <p className="text-center text-red-500 text-sm py-6">{t('rentalProp.failedLoadHistory')}</p>
                    ) : ledger?.payments?.length === 0 ? (
                      <p className="text-center text-gray-400 text-sm py-6">{t('rentalProp.noPaymentRecords')}</p>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {/* Column headers */}
                        <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-gray-50 text-xs text-gray-400 font-medium">
                          <span>{t('common.date')}</span>
                          <span>{t('rental.rentalMonth')}</span>
                          <span className="text-right">{t('rental.paid')}</span>
                          <span className="text-right">{t('rental.balance')}</span>
                        </div>

                        {ledger.payments.map((p, i) => {
                          const pBal = parseFloat(p.balance);
                          const rBal = parseFloat(p.runningBalance);
                          const isPartial = pBal < -0.99;
                          const isOver    = pBal > 0.99;

                          return (
                            <div key={p.id || i} className="px-4 py-3">
                              <div className="grid grid-cols-4 gap-2 items-center">
                                {/* Date */}
                                <div>
                                  <p className="text-sm text-gray-700">{formatDate(p.transactionDate)}</p>
                                  <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                                    {p.paymentMethod === 'CASH'
                                      ? <Banknote className="w-3 h-3" />
                                      : <Building2 className="w-3 h-3" />}
                                    {p.paymentMethod === 'CASH' ? t('common.cash') : t('common.bank')}
                                  </p>
                                </div>

                                {/* Rental month */}
                                <div>
                                  <p className="text-sm text-gray-700">{formatDate(p.rentalMonth) || '—'}</p>
                                  <p className="text-xs text-gray-400">{p.recordedBy}</p>
                                </div>

                                {/* Amount paid */}
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-gray-800">रु {fmt(p.amountReceived)}</p>
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                                    ${isPartial ? 'bg-amber-100 text-amber-700' : isOver ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                    {isPartial ? t('rentalProp.partial') : isOver ? t('rentalProp.over') : t('rentalProp.full')}
                                  </span>
                                </div>

                                {/* Running balance */}
                                <div className="text-right">
                                  <p className={`text-sm font-bold ${rBal < -0.99 ? 'text-red-600' : rBal > 0.99 ? 'text-green-600' : 'text-gray-400'}`}>
                                    {rBal < -0.99
                                      ? `−रु ${fmt(Math.abs(rBal))}`
                                      : rBal > 0.99
                                        ? `+रु ${fmt(rBal)}`
                                        : '✓'}
                                  </p>
                                  {isPartial && (
                                    <p className="text-xs text-red-400">−रु {fmt(Math.abs(pBal))} {t('rentalProp.short')}</p>
                                  )}
                                </div>
                              </div>

                              {p.notes && (
                                <p className="text-xs text-gray-400 italic mt-1.5 pl-0">"{p.notes}"</p>
                              )}
                            </div>
                          );
                        })}

                        {/* Footer: agreed rent */}
                        <div className="px-4 py-2 bg-gray-50 flex justify-between text-xs text-gray-500">
                          <span>{t('rentalProp.agreed')}: रु {fmt(property.monthlyRent)}/{t('rental.month')}</span>
                          {bal !== null && (
                            <span className={`font-semibold ${isOwed ? 'text-red-600' : isCredit ? 'text-green-600' : 'text-gray-400'}`}>
                              {isOwed
                                ? `${t('rental.outstandingBalance')}: −रु ${fmt(Math.abs(bal))}`
                                : isCredit
                                  ? `${t('rental.creditBalance')}: +रु ${fmt(bal)}`
                                  : t('rentalProp.accountClear')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
