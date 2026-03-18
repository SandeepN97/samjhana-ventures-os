import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Users, UserPlus, Edit2, Trash2, X, Check, Search, Phone, MapPin } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

export default function FurnitureCustomerPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);

  const [formData, setFormData] = useState({
    name: '', nameNepali: '', phone: '', address: '', notes: '',
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/furniture/customers');
      setCustomers(res.data);
    } catch (err) {
      console.error('Failed to fetch customers', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', nameNepali: '', phone: '', address: '', notes: '' });
    setEditingCustomer(null);
    setFormError('');
    setFormSuccess('');
  };

  const openEditForm = (customer) => {
    setFormData({
      name: customer.name || '',
      nameNepali: customer.nameNepali || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
    });
    setEditingCustomer(customer);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.name.trim()) {
      setFormError(isNepali ? 'ग्राहकको नाम आवश्यक छ' : 'Customer name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCustomer) {
        await api.put(`/api/furniture/customers/${editingCustomer.id}`, formData);
        setFormSuccess(isNepali ? 'ग्राहक अपडेट भयो!' : 'Customer updated!');
      } else {
        await api.post('/api/furniture/customers', formData);
        setFormSuccess(isNepali ? 'ग्राहक थपियो!' : 'Customer added!');
      }

      fetchCustomers();
      setTimeout(() => { setShowForm(false); resetForm(); }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || (isNepali ? 'सेभ गर्न सकिएन' : 'Failed to save'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!confirm(isNepali ? `${customer.name} हटाउने?` : `Remove ${customer.name}?`)) return;
    try {
      await api.delete(`/api/furniture/customers/${customer.id}`);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || (isNepali ? 'हटाउन सकिएन' : 'Failed to remove'));
    }
  };

  const viewCustomerDetail = async (customer) => {
    setSelectedCustomer(customer);
    try {
      const res = await api.get(`/api/furniture/orders?search=${encodeURIComponent(customer.name)}`);
      setCustomerOrders(res.data);
    } catch (err) {
      setCustomerOrders([]);
    }
  };

  const filteredCustomers = customers.filter(c => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(searchTerm);
  });

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `रु ${num.toLocaleString('en-IN')}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/entry/furniture')} className="p-2 -ml-2 rounded-full hover:bg-green-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Users className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">{isNepali ? 'ग्राहकहरू' : 'Customers'}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Actions */}
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700"
        >
          <UserPlus className="w-5 h-5" />
          {isNepali ? 'नयाँ ग्राहक' : 'Add Customer'}
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isNepali ? 'नाम वा फोन खोज्नुहोस्...' : 'Search name or phone...'}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500" />
        </div>
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">{selectedCustomer.name}</h2>
              <button onClick={() => setSelectedCustomer(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              {selectedCustomer.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Phone className="w-4 h-4" /> {selectedCustomer.phone}
                </div>
              )}
              {selectedCustomer.address && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <MapPin className="w-4 h-4" /> {selectedCustomer.address}
                </div>
              )}
              {selectedCustomer.notes && (
                <p className="text-sm text-gray-500 mb-4">{selectedCustomer.notes}</p>
              )}

              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
                {isNepali ? 'खरिद इतिहास' : 'Purchase History'}
              </h3>
              {customerOrders.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customerOrders.map(order => (
                    <div key={order.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{order.transactionDate}</span>
                        <span className="font-bold">{formatCurrency(order.amount)}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        order.deliveryStatus === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                        order.deliveryStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.deliveryStatus === 'DELIVERED' ? (isNepali ? 'डेलिभर' : 'Delivered') :
                         order.deliveryStatus === 'IN_PROGRESS' ? (isNepali ? 'प्रगतिमा' : 'In Progress') :
                         (isNepali ? 'बाँकी' : 'Pending')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">{isNepali ? 'कुनै खरिद छैन' : 'No purchases yet'}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editingCustomer ? (isNepali ? 'ग्राहक सम्पादन' : 'Edit Customer') : (isNepali ? 'नयाँ ग्राहक थप्नुहोस्' : 'Add New Customer')}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {formError && <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>}
              {formSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center"><Check className="w-4 h-4 mr-1" />{formSuccess}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'नाम' : 'Name'} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder={isNepali ? 'ग्राहकको नाम' : 'Customer name'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'नेपाली नाम' : 'Name (Nepali)'}</label>
                <input type="text" value={formData.nameNepali} onChange={(e) => setFormData({ ...formData, nameNepali: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'फोन' : 'Phone'}</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                  placeholder={isNepali ? 'फोन नम्बर' : 'Phone number'} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'ठेगाना' : 'Address'}</label>
                <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'टिप्पणी' : 'Notes'}</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-green-500 resize-none" />
              </div>

              <button type="submit" disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}>
                {submitting ? (isNepali ? 'सेभ हुँदैछ...' : 'Saving...') :
                  editingCustomer ? (isNepali ? 'अपडेट गर्नुहोस्' : 'Update Customer') : (isNepali ? 'ग्राहक थप्नुहोस्' : 'Add Customer')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600"></div>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{isNepali ? 'कुनै ग्राहक छैन' : 'No customers found'}</p>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700">
            {isNepali ? 'पहिलो ग्राहक थप्नुहोस्' : 'Add First Customer'}
          </button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => viewCustomerDetail(customer)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">{customer.name}</h3>
                  {customer.nameNepali && <p className="text-sm text-gray-500">{customer.nameNepali}</p>}
                  {customer.phone && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-center gap-1 text-sm text-gray-400 mt-0.5">
                      <MapPin className="w-3 h-3" /> {customer.address}
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEditForm(customer)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(customer)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{customer.totalPurchases || 0} {isNepali ? 'खरिद' : 'orders'}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(customer.totalAmount)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
