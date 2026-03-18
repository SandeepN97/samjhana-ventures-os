import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ClipboardList, Search, X, Truck, Check } from 'lucide-react';
import api from '../utils/api';
import LanguageToggle from '../components/LanguageToggle';

const STATUS_TABS = [
  { value: 'ALL', labelEn: 'All', labelNe: 'सबै' },
  { value: 'PENDING', labelEn: 'Pending', labelNe: 'बाँकी' },
  { value: 'IN_PROGRESS', labelEn: 'In Progress', labelNe: 'प्रगतिमा' },
  { value: 'DELIVERED', labelEn: 'Delivered', labelNe: 'डेलिभर' },
];

export default function FurnitureOrderHistoryPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [selectedTab]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedTab !== 'ALL') params.append('status', selectedTab);
      const res = await api.get(`/api/furniture/orders?${params}`);
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to fetch orders', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDeliveryStatus = async (orderId, newStatus) => {
    setUpdatingStatus(true);
    try {
      await api.patch(`/api/furniture/orders/${orderId}/delivery-status`, { deliveryStatus: newStatus });
      fetchOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, deliveryStatus: newStatus });
      }
    } catch (err) {
      alert(isNepali ? 'स्थिति अपडेट गर्न सकिएन' : 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return o.customerName?.toLowerCase().includes(s);
  });

  const formatCurrency = (amount) => `रु ${parseFloat(amount || 0).toLocaleString('en-IN')}`;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-700';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-yellow-100 text-yellow-700';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'DELIVERED': return isNepali ? 'डेलिभर' : 'Delivered';
      case 'IN_PROGRESS': return isNepali ? 'प्रगतिमा' : 'In Progress';
      default: return isNepali ? 'बाँकी' : 'Pending';
    }
  };

  const getItemsSummary = (items) => {
    if (!items || !Array.isArray(items)) return '';
    if (items.length === 1) return items[0].itemName || '';
    return `${items[0].itemName || ''} + ${items.length - 1} ${isNepali ? 'थप' : 'more'}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-amber-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/entry/furniture')} className="p-2 -ml-2 rounded-full hover:bg-amber-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <ClipboardList className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">{isNepali ? 'अर्डर इतिहास' : 'Order History'}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Status Filter Tabs */}
      <div className="px-4 py-2 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setSelectedTab(tab.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedTab === tab.value ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {isNepali ? tab.labelNe : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isNepali ? 'ग्राहक नाम खोज्नुहोस्...' : 'Search by customer name...'}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-amber-500" />
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">{isNepali ? 'अर्डर विवरण' : 'Order Details'}</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Customer & Date */}
              <div className="flex justify-between">
                <div>
                  <p className="text-sm text-gray-500">{isNepali ? 'ग्राहक' : 'Customer'}</p>
                  <p className="font-bold text-gray-800">{selectedOrder.customerName || (isNepali ? 'वाक-इन' : 'Walk-in')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">{isNepali ? 'मिति' : 'Date'}</p>
                  <p className="font-medium text-gray-800">{selectedOrder.transactionDate}</p>
                </div>
              </div>

              {/* Items */}
              {selectedOrder.items && Array.isArray(selectedOrder.items) && (
                <div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{isNepali ? 'सामानहरू' : 'Items'}</p>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-lg p-3 flex justify-between">
                        <div>
                          <p className="font-medium text-gray-800">{item.itemName}</p>
                          <p className="text-sm text-gray-500">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                        </div>
                        <p className="font-bold text-gray-800">{formatCurrency(item.total || item.quantity * item.unitPrice)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="bg-purple-50 rounded-lg p-3 flex justify-between items-center">
                <p className="font-bold text-purple-800">{isNepali ? 'कुल रकम' : 'Total'}</p>
                <p className="text-xl font-bold text-purple-800">{formatCurrency(selectedOrder.amount)}</p>
              </div>

              {/* Payment & Delivery */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedOrder.paymentMethod && (
                  <div>
                    <p className="text-gray-500">{isNepali ? 'भुक्तानी' : 'Payment'}</p>
                    <p className="font-medium">{selectedOrder.paymentMethod}</p>
                  </div>
                )}
                {selectedOrder.deliveryDate && (
                  <div>
                    <p className="text-gray-500">{isNepali ? 'डेलिभरी मिति' : 'Delivery Date'}</p>
                    <p className="font-medium">{selectedOrder.deliveryDate}</p>
                  </div>
                )}
                {selectedOrder.deliveryAddress && (
                  <div className="col-span-2">
                    <p className="text-gray-500">{isNepali ? 'ठेगाना' : 'Address'}</p>
                    <p className="font-medium">{selectedOrder.deliveryAddress}</p>
                  </div>
                )}
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-sm text-gray-500">{isNepali ? 'टिप्पणी' : 'Notes'}</p>
                  <p className="text-gray-700">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Update Delivery Status */}
              <div>
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{isNepali ? 'डेलिभरी स्थिति अपडेट' : 'Update Delivery Status'}</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'PENDING', labelEn: 'Pending', labelNe: 'बाँकी', color: 'yellow' },
                    { value: 'IN_PROGRESS', labelEn: 'In Progress', labelNe: 'प्रगतिमा', color: 'blue' },
                    { value: 'DELIVERED', labelEn: 'Delivered', labelNe: 'डेलिभर', color: 'green' },
                  ].map(ds => (
                    <button key={ds.value} disabled={updatingStatus}
                      onClick={() => handleUpdateDeliveryStatus(selectedOrder.id, ds.value)}
                      className={`py-2 text-sm font-medium rounded-lg border-2 transition-colors flex items-center justify-center gap-1 ${
                        selectedOrder.deliveryStatus === ds.value
                          ? ds.color === 'green' ? 'bg-green-600 text-white border-green-600'
                            : ds.color === 'blue' ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-yellow-500 text-white border-yellow-500'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}>
                      {selectedOrder.deliveryStatus === ds.value && <Check className="w-3 h-3" />}
                      {isNepali ? ds.labelNe : ds.labelEn}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600"></div>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{isNepali ? 'कुनै अर्डर छैन' : 'No orders found'}</p>
          <button onClick={() => navigate('/furniture/orders/new')}
            className="mt-4 bg-purple-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-purple-700">
            {isNepali ? 'पहिलो अर्डर बनाउनुहोस्' : 'Create First Order'}
          </button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filteredOrders.map((order) => (
            <div key={order.id}
              onClick={() => setSelectedOrder(order)}
              className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-800">
                    {order.customerName || (isNepali ? 'वाक-इन ग्राहक' : 'Walk-in Customer')}
                  </h3>
                  <p className="text-sm text-gray-500">{getItemsSummary(order.items)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(order.deliveryStatus)}`}>
                  {getStatusLabel(order.deliveryStatus)}
                </span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">{order.transactionDate}</span>
                <span className="font-bold text-gray-800">{formatCurrency(order.amount)}</span>
              </div>

              {order.deliveryDate && (
                <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                  <Truck className="w-3 h-3" />
                  {isNepali ? 'डेलिभरी' : 'Delivery'}: {order.deliveryDate}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
