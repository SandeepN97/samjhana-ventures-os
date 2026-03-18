import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Home, Plus, Edit2, Trash2, X, Check, User, ShieldOff, Calendar } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import { formatBsDate } from '../utils/nepaliDate';

export default function RentalPropertyPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center max-w-sm">
          <ShieldOff className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {isNepali ? 'पहुँच अस्वीकृत' : 'Access Denied'}
          </h1>
          <button onClick={() => navigate('/')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700">
            {isNepali ? 'फिर्ता जानुहोस्' : 'Go Back'}
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
      setFormError(isNepali ? 'सम्पत्तिको नाम आवश्यक छ' : 'Property name is required');
      return;
    }
    if (!formData.monthlyRent || parseFloat(formData.monthlyRent) <= 0) {
      setFormError(isNepali ? 'मासिक भाडा आवश्यक छ' : 'Monthly rent is required');
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
        setFormSuccess(isNepali ? 'सम्पत्ति अपडेट भयो!' : 'Property updated!');
      } else {
        await api.post('/api/rental-properties', payload);
        setFormSuccess(isNepali ? 'सम्पत्ति थपियो!' : 'Property added!');
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
    if (!confirm(isNepali ? `${property.propertyName} लाई हटाउने?` : `Remove ${property.propertyName}?`)) return;
    try {
      await api.delete(`/api/rental-properties/${property.id}`);
      fetchProperties();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove');
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
              {isNepali ? 'सम्पत्ति व्यवस्थापन' : 'Property Management'}
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
          {isNepali ? 'नयाँ सम्पत्ति' : 'Add Property'}
        </button>
        <span className="text-sm text-gray-500">
          {properties.filter(p => p.isActive).length} {isNepali ? 'सक्रिय' : 'active'}
        </span>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editing
                  ? (isNepali ? 'सम्पत्ति सम्पादन' : 'Edit Property')
                  : (isNepali ? 'नयाँ सम्पत्ति थप्नुहोस्' : 'Add New Property')}
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
                  {isNepali ? 'सम्पत्तिको नाम' : 'Property Name'} *
                </label>
                <input type="text" value={formData.propertyName}
                  onChange={(e) => setFormData({ ...formData, propertyName: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={isNepali ? 'जस्तै: कोठा नं. १०१' : 'e.g., Room No. 101 / Shop Floor 2'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isNepali ? 'भाडावालको नाम' : 'Tenant Name'}
                </label>
                <input type="text" value={formData.tenantName}
                  onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={isNepali ? 'भाडावालको नाम' : 'Tenant full name'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isNepali ? 'मासिक भाडा (रु)' : 'Monthly Rent (Rs)'} *
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
                  {isNepali ? 'भाडा सुरु मिति' : 'Lease Start Date'}
                </label>
                <DatePicker
                  value={formData.leaseStartDate}
                  onChange={(v) => setFormData({ ...formData, leaseStartDate: v })}
                  accentColor="blue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isNepali ? 'टिप्पणी' : 'Notes'}
                </label>
                <input type="text" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={isNepali ? 'थप जानकारी...' : 'Optional notes...'} />
              </div>

              <button type="submit" disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {submitting
                  ? (isNepali ? 'सेभ हुँदैछ...' : 'Saving...')
                  : editing
                    ? (isNepali ? 'अपडेट गर्नुहोस्' : 'Update Property')
                    : (isNepali ? 'सम्पत्ति थप्नुहोस्' : 'Add Property')}
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
          <p className="text-lg">{isNepali ? 'कुनै सम्पत्ति छैन' : 'No properties found'}</p>
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
                        {isNepali ? 'निष्क्रिय' : 'Inactive'}
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
                {property.isActive && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(property)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(property)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
