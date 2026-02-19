import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShoppingCart, Plus, Trash2, Check, Search, X } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';
import DatePicker from '../components/DatePicker';
import SearchableSelect from '../components/SearchableSelect';

export default function FurnitureOrderPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [customers, setCustomers] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');

  const [lineItems, setLineItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('PENDING');
  const [notes, setNotes] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().split('T')[0]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/api/furniture/customers'),
      api.get('/api/furniture/items'),
    ]).then(([custRes, itemRes]) => {
      setCustomers(custRes.data);
      setInventoryItems(itemRes.data);
    }).catch(err => {
      console.error('Failed to load data', err);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const s = customerSearch.toLowerCase();
    return c.name?.toLowerCase().includes(s) || c.phone?.includes(customerSearch);
  });

  const addLineItem = () => {
    setLineItems([...lineItems, { itemId: '', itemName: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateLineItem = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;

    if (field === 'itemId') {
      const item = inventoryItems.find(i => i.id === value);
      if (item) {
        updated[index].itemName = item.name;
        updated[index].unitPrice = parseFloat(item.sellingPrice) || 0;
      }
    }

    setLineItems(updated);
  };

  const removeLineItem = (index) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const orderTotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (lineItems.length === 0) {
      setErrorMessage(isNepali ? 'कम्तिमा एउटा सामान थप्नुहोस्' : 'Add at least one item');
      return;
    }

    const invalidItems = lineItems.filter(li => !li.itemId || li.quantity < 1);
    if (invalidItems.length > 0) {
      setErrorMessage(isNepali ? 'सबै सामान सही भर्नुहोस्' : 'Please fill all item details correctly');
      return;
    }

    const customerName = isWalkIn
      ? (walkInName || (isNepali ? 'वाक-इन ग्राहक' : 'Walk-in Customer'))
      : (selectedCustomer?.name || '');

    setIsSubmitting(true);
    try {
      const payload = {
        businessCode: 'furniture',
        transactionType: 'SALE',
        transactionDate,
        amount: orderTotal,
        notes,
        customFields: {
          customerId: isWalkIn ? null : selectedCustomerId,
          customerName,
          items: lineItems.map(li => ({
            itemId: li.itemId,
            itemName: li.itemName,
            quantity: li.quantity,
            unitPrice: li.unitPrice,
            total: li.quantity * li.unitPrice,
          })),
          paymentMethod,
          deliveryDate: deliveryDate || null,
          deliveryAddress: deliveryAddress || null,
          deliveryStatus,
        },
      };

      await api.post('/api/transactions', payload);
      setSuccessMessage(isNepali ? 'अर्डर सफलतापूर्वक सेभ भयो!' : 'Order saved successfully!');

      setTimeout(() => {
        navigate('/furniture/orders');
      }, 2000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Failed to save order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount) => `रु ${parseFloat(amount || 0).toLocaleString('en-IN')}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/entry/furniture')} className="p-2 -ml-2 rounded-full hover:bg-purple-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <ShoppingCart className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">{isNepali ? 'नयाँ बिक्री' : 'New Sale'}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Success Message */}
      {successMessage && (
        <div className="mx-4 mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-xl flex items-center">
          <Check className="w-5 h-5 mr-2" />{successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mx-4 mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        {/* Date */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'मिति' : 'Date'} <span className="text-red-500">*</span>
          </label>
          <DatePicker
            value={transactionDate}
            onChange={(val) => setTransactionDate(val)}
            accentColor="purple"
          />
        </div>

        {/* Customer Selection */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'ग्राहक' : 'Customer'}
          </label>

          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => { setIsWalkIn(false); setSelectedCustomerId(''); }}
              className={`flex-1 py-2 rounded-lg font-medium border-2 transition-colors ${!isWalkIn ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'}`}>
              {isNepali ? 'ग्राहक छान्नुहोस्' : 'Select Customer'}
            </button>
            <button type="button" onClick={() => { setIsWalkIn(true); setSelectedCustomerId(''); }}
              className={`flex-1 py-2 rounded-lg font-medium border-2 transition-colors ${isWalkIn ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300'}`}>
              {isNepali ? 'वाक-इन' : 'Walk-in'}
            </button>
          </div>

          {isWalkIn ? (
            <input type="text" value={walkInName} onChange={(e) => setWalkInName(e.target.value)}
              placeholder={isNepali ? 'ग्राहकको नाम (ऐच्छिक)' : 'Customer name (optional)'}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
          ) : (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="text" value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder={isNepali ? 'ग्राहक खोज्नुहोस्...' : 'Search customer...'}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              {selectedCustomer && (
                <div className="mt-2 bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-purple-800">{selectedCustomer.name}</p>
                    {selectedCustomer.phone && <p className="text-sm text-purple-600">{selectedCustomer.phone}</p>}
                  </div>
                  <button type="button" onClick={() => { setSelectedCustomerId(''); setCustomerSearch(''); }}
                    className="p-1 text-purple-500 hover:text-purple-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {showCustomerDropdown && !selectedCustomerId && filteredCustomers.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {filteredCustomers.map(c => (
                    <button key={c.id} type="button"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setCustomerSearch('');
                        setShowCustomerDropdown(false);
                        if (c.address) setDeliveryAddress(c.address);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-purple-50 border-b last:border-b-0">
                      <p className="font-medium text-gray-800">{c.name}</p>
                      {c.phone && <p className="text-sm text-gray-500">{c.phone}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-lg font-medium text-gray-700">{isNepali ? 'सामानहरू' : 'Items'} <span className="text-red-500">*</span></label>
            <button type="button" onClick={addLineItem}
              className="flex items-center gap-1 text-purple-600 font-medium hover:text-purple-700">
              <Plus className="w-5 h-5" /> {isNepali ? 'थप्नुहोस्' : 'Add'}
            </button>
          </div>

          {lineItems.length === 0 && (
            <button type="button" onClick={addLineItem}
              className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:border-purple-400 hover:text-purple-500 transition-colors">
              <Plus className="w-8 h-8 mx-auto mb-2" />
              <p>{isNepali ? 'सामान थप्नुहोस्' : 'Add items to this order'}</p>
            </button>
          )}

          <div className="space-y-3">
            {lineItems.map((li, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-4 border">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-sm font-bold text-gray-400">#{index + 1}</span>
                  <button type="button" onClick={() => removeLineItem(index)} className="p-1 text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'सामान' : 'Item'}</label>
                  <SearchableSelect
                    value={li.itemId}
                    onChange={(val) => updateLineItem(index, 'itemId', val)}
                    options={inventoryItems.map(item => ({
                      value: item.id,
                      label: `${item.name} (${item.category})`,
                      subtitle: `${isNepali ? 'स्टक' : 'Stock'}: ${item.stockQty}`,
                    }))}
                    placeholder={isNepali ? 'सामान छान्नुहोस्' : 'Select item'}
                    accentColor="purple"
                    className="py-2 text-base"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'संख्या' : 'Qty'}</label>
                    <input type="number" min="1" value={li.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-center font-bold" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'एकाइ मूल्य' : 'Unit Price'}</label>
                    <input type="number" step="0.01" min="0" value={li.unitPrice}
                      onChange={(e) => updateLineItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-center font-bold" />
                  </div>
                </div>

                <div className="mt-2 text-right text-sm font-bold text-gray-600">
                  {isNepali ? 'उप-जम्मा' : 'Subtotal'}: {formatCurrency(li.quantity * li.unitPrice)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Total */}
        {lineItems.length > 0 && (
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-80">{isNepali ? 'कुल रकम' : 'Order Total'}</p>
            <p className="text-3xl font-bold">{formatCurrency(orderTotal)}</p>
          </div>
        )}

        {/* Payment Method */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">{isNepali ? 'भुक्तानी' : 'Payment'}</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'CASH', labelEn: 'Cash', labelNe: 'नगद' },
              { value: 'BANK', labelEn: 'Bank', labelNe: 'बैंक' },
            ].map(pm => (
              <button key={pm.value} type="button" onClick={() => setPaymentMethod(pm.value)}
                className={`py-3 text-lg font-bold rounded-xl border-2 transition-all ${
                  paymentMethod === pm.value ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                }`}>
                {isNepali ? pm.labelNe : pm.labelEn}
              </button>
            ))}
          </div>
        </div>

        {/* Delivery Info */}
        <div className="space-y-3">
          <label className="block text-lg font-medium text-gray-700">{isNepali ? 'डेलिभरी जानकारी' : 'Delivery Info'}</label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'डेलिभरी मिति' : 'Delivery Date'}</label>
            <DatePicker
              value={deliveryDate}
              onChange={(val) => setDeliveryDate(val)}
              accentColor="purple"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'डेलिभरी ठेगाना' : 'Delivery Address'}</label>
            <input type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{isNepali ? 'डेलिभरी स्थिति' : 'Delivery Status'}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'PENDING', labelEn: 'Pending', labelNe: 'बाँकी' },
                { value: 'IN_PROGRESS', labelEn: 'In Progress', labelNe: 'प्रगतिमा' },
                { value: 'DELIVERED', labelEn: 'Delivered', labelNe: 'डेलिभर' },
              ].map(ds => (
                <button key={ds.value} type="button" onClick={() => setDeliveryStatus(ds.value)}
                  className={`py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                    deliveryStatus === ds.value
                      ? ds.value === 'DELIVERED' ? 'bg-green-600 text-white border-green-600'
                        : ds.value === 'IN_PROGRESS' ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-yellow-500 text-white border-yellow-500'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}>
                  {isNepali ? ds.labelNe : ds.labelEn}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            {isNepali ? 'टिप्पणी' : 'Notes'} <span className="text-gray-400 text-sm">({isNepali ? 'ऐच्छिक' : 'optional'})</span>
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
            className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
        </div>

        {/* Submit */}
        <button type="submit" disabled={isSubmitting}
          className={`w-full py-5 text-xl font-bold rounded-xl transition-all transform ${
            isSubmitting ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 active:scale-95 shadow-lg'
          } text-white`}>
          {isSubmitting ? (
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
              {isNepali ? 'अर्डर सेभ गर्नुहोस्' : 'Save Order'}
            </span>
          )}
        </button>
      </form>
    </div>
  );
}
