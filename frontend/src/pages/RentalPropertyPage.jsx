import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home, Plus, Edit2, Trash2, X, Check, User, ShieldOff, Calendar, BookOpen, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import { formatBsDate } from '../utils/nepaliDate';

export default function RentalPropertyPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm">
          <ShieldOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {t('common.accessDenied')}
          </h1>
          <button onClick={() => navigate('/')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700">
            {t('common.goBack')}
          </button>
        </div>
      </div>
    );
  }

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ propertyName: '', tenantName: '', monthlyRent: '', leaseStartDate: '', notes: '' });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [ledgerModal, setLedgerModal] = useState(null); // { property, data }
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => { fetchProperties(); }, []);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/rental-properties/all');
      setProperties(res.data);
    } catch (err) {
      console.error('Failed to fetch properties', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ propertyName: '', tenantName: '', monthlyRent: '', leaseStartDate: '', notes: '' });
    setEditing(null);
    setFormError('');
    setFormSuccess('');
  };

  const openEdit = (property) => {
    setFormData({
      propertyName: property.propertyName || '',
      tenantName: property.tenantName || '',
      monthlyRent: property.monthlyRent || '',
      leaseStartDate: property.leaseStartDate || '',
      notes: property.notes || '',
    });
    setEditing(property);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.propertyName.trim()) {
      setFormError(t('rentalProp.propertyNameRequired'));
      return;
    }
    if (!formData.monthlyRent || parseFloat(formData.monthlyRent) <= 0) {
      setFormError(t('rentalProp.monthlyRentRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        propertyName: formData.propertyName.trim(),
        tenantName: formData.tenantName.trim() || null,
        monthlyRent: parseFloat(formData.monthlyRent),
        leaseStartDate: formData.leaseStartDate || null,
        notes: formData.notes.trim() || null,
      };

      if (editing) {
        await api.put(`/api/rental-properties/${editing.id}`, payload);
        setFormSuccess(t('rentalProp.propertyUpdated'));
      } else {
        await api.post('/api/rental-properties', payload);
        setFormSuccess(t('rentalProp.propertyAdded'));
      }

      fetchProperties();
      setTimeout(() => { setShowForm(false); resetForm(); }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (property) => {
    if (!confirm(`Remove ${property.propertyName}?`)) return;
    setDeletingId(property.id);
    try {
      await api.delete(`/api/rental-properties/${property.id}`);
      fetchProperties();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
    } finally {
      setDeletingId(null);
    }
  };

  const openLedger = async (property) => {
    setLedgerModal({ property, data: null });
    setLedgerLoading(true);
    try {
      const res = await api.get(`/api/rental-properties/${property.id}/ledger`);
      setLedgerModal({ property, data: res.data });
    } catch {
      setLedgerModal({ property, data: { error: true } });
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/entry/rental')} className="p-2 -ml-2 rounded-full hover:bg-blue-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Home className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">
              {t('rentalProp.title')}
            </h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          {t('rentalProp.addProperty')}
        </button>
        <span className="text-sm text-gray-500">
          {properties.filter(p => p.isActive).length} {t('common.active')}
        </span>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editing ? t('rentalProp.editProperty') : t('rentalProp.addNewProperty')}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {formError && <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>}
              {formSuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center gap-1">
                  <Check className="w-4 h-4" />{formSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rentalProp.propertyName')} *
                </label>
                <input type="text" value={formData.propertyName}
                  onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={t('rentalProp.propertyNamePlaceholder')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rentalProp.tenantName')}
                </label>
                <input type="text" value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={t('rentalProp.tenantNamePlaceholder')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rentalProp.monthlyRent')} *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">रु</span>
                  <input type="number" step="0.01" value={formData.monthlyRent}
                    onChange={(e) => setFormData({ ...formData, monthlyRent: e.target.value })}
                    className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    placeholder="15000" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('rentalProp.leaseStartDate')}
                </label>
                <DatePicker
                  value={formData.leaseStartDate}
                  onChange={(v) => setFormData({ ...formData, leaseStartDate: v })}
                  accentColor="blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('common.notes')}
                </label>
                <input type="text" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={t('common.additionalNotes')} />
              </div>

              <button type="submit" disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitting
                  ? t('common.savingEllipsis')
                  : editing
                    ? t('rentalProp.updateProperty')
                    : t('rentalProp.addProperty')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Property List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : properties.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Home className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t('rentalProp.noProperties')}</p>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {properties.map((property) => (
            <div key={property.id} className={`bg-white rounded-xl shadow-sm p-4 ${!property.isActive ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-800">{property.propertyName}</h3>
                    {!property.isActive && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                        {t('common.inactive')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                    {property.tenantName && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4 text-blue-500" />
                        {property.tenantName}
                      </div>
                    )}
                    <div className="flex items-center gap-1 font-bold text-blue-700">
                      <Home className="w-4 h-4" />
                      रु {parseFloat(property.monthlyRent).toLocaleString('en-IN')}/month
                    </div>
                    {property.leaseStartDate && (
                      <div className="flex items-center gap-1 text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {isNepali ? formatBsDate(property.leaseStartDate, true) : property.leaseStartDate}
                      </div>
                    )}
                  </div>
                  {property.notes && <p className="text-xs text-gray-400 mt-1">{property.notes}</p>}
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => openLedger(property)}
                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title={t('rentalProp.paymentHistory')}>
                    <BookOpen className="w-5 h-5" />
                  </button>
                  {property.isActive && (
                    <>
                      <button onClick={() => openEdit(property)} disabled={deletingId === property.id}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-40">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDelete(property)} disabled={deletingId === property.id}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40">
                        {deletingId === property.id
                          ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600" />
                          : <Trash2 className="w-5 h-5" />}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ledger Modal */}
      {ledgerModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b sticky top-0 bg-white rounded-t-xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{ledgerModal.property.propertyName}</h2>
                {ledgerModal.property.tenantName && (
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <User className="w-3 h-3" /> {ledgerModal.property.tenantName}
                  </p>
                )}
              </div>
              <button onClick={() => setLedgerModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {ledgerLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : ledgerModal.data?.error ? (
              <div className="p-6 text-center text-red-500">
                {t('rentalProp.failedLoadHistory')}
              </div>
            ) : ledgerModal.data ? (
              <>
                {/* Summary banner */}
                {(() => {
                  const bal = parseFloat(ledgerModal.data.outstandingBalance);
                  const isOwed = bal < -0.99;
                  const isCredit = bal > 0.99;
                  return (
                    <div className={`mx-4 mt-4 rounded-xl p-4 flex justify-between items-center
                      ${isOwed ? 'bg-red-50 border border-red-200' : isCredit ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                      <div>
                        <p className={`text-sm font-medium ${isOwed ? 'text-red-600' : isCredit ? 'text-green-600' : 'text-gray-600'}`}>
                          {isOwed
                            ? t('rental.outstandingBalance')
                            : isCredit
                              ? t('rental.creditBalance')
                              : t('rentalProp.accountClear')}
                        </p>
                        <p className="text-xs text-gray-400">{ledgerModal.data.totalPayments} {t('rental.paymentsOnRecord')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOwed ? <TrendingDown className="w-5 h-5 text-red-500" /> : isCredit ? <TrendingUp className="w-5 h-5 text-green-500" /> : <Check className="w-5 h-5 text-gray-400" />}
                        <span className={`text-2xl font-black ${isOwed ? 'text-red-700' : isCredit ? 'text-green-700' : 'text-gray-500'}`}>
                          {isOwed ? '−' : isCredit ? '+' : ''} रु {Math.abs(bal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment history */}
                {ledgerModal.data.payments.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">
                    {t('rentalProp.noPaymentRecords')}
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-2 max-h-[55vh] overflow-y-auto">
                    {ledgerModal.data.payments.map((p, i) => {
                      const bal = parseFloat(p.balance);
                      const isPartial = bal < -0.99;
                      const isOver = bal > 0.99;
                      const runBal = parseFloat(p.runningBalance);
                      return (
                        <div key={p.id || i} className="border border-gray-100 rounded-xl p-3">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <p className="font-semibold text-gray-800 text-sm">
                                {p.rentalMonth || p.transactionDate}
                              </p>
                              <p className="text-xs text-gray-400">{p.transactionDate} · {p.paymentMethod} · {p.recordedBy}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-800">रु {parseFloat(p.amountReceived).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                                ${isPartial ? 'bg-amber-100 text-amber-700' : isOver ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                {isPartial ? t('rentalProp.partial') : isOver ? t('rentalProp.over') : t('rentalProp.full')}
                              </span>
                            </div>
                          </div>
                          {/* Balance row */}
                          <div className="flex justify-between items-center text-xs text-gray-500 border-t border-gray-50 pt-1 mt-1">
                            <span>{t('rentalProp.agreed')}: रु {parseFloat(p.monthlyRent).toLocaleString('en-IN')}</span>
                            <span className={`font-medium ${isPartial ? 'text-red-500' : isOver ? 'text-blue-500' : 'text-gray-400'}`}>
                              {isPartial ? `−रु ${Math.abs(bal).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${t('rentalProp.short')}` : isOver ? `+रु ${bal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '✓'}
                            </span>
                            <span className={`font-medium ${runBal < -0.99 ? 'text-red-500' : runBal > 0.99 ? 'text-green-600' : 'text-gray-400'}`}>
                              {t('rentalProp.running')}: {runBal < -0.99 ? `−रु ${Math.abs(runBal).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : runBal > 0.99 ? `+रु ${runBal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '✓'}
                            </span>
                          </div>
                          {p.notes && <p className="text-xs text-gray-400 italic mt-1">"{p.notes}"</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
