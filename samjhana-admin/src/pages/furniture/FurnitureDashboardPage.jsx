import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sofa, Package, TrendingUp, AlertTriangle, Truck, ShoppingCart, Users, ClipboardList, Clock } from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../../components/LanguageToggle';

export default function FurnitureDashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/api/furniture/dashboard');
      setDashboard(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard', err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `रु ${num.toLocaleString('en-IN')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const data = dashboard || {};

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-purple-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-full hover:bg-purple-700 transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Sofa className="w-8 h-8 ml-2" />
            <div className="ml-3">
              <h1 className="text-xl font-bold">
                {t('furnitureDash.title')}
              </h1>
              <p className="text-purple-200 text-xs">
                {t('furnitureDash.dashboardLabel')}
              </p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Summary Cards */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {/* Total Stock Value */}
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-purple-500">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-purple-500" />
            <span className="text-xs text-gray-500">
              {t('furnitureDash.stockValue')}
            </span>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {formatCurrency(data.totalStockValue)}
          </p>
          <p className="text-xs text-gray-400">{data.totalItems || 0} {t('furnitureDash.itemsLabel')}</p>
        </div>

        {/* Today's Sales */}
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <span className="text-xs text-gray-500">
              {t('furnitureDash.todaySales')}
            </span>
          </div>
          <p className="text-lg font-bold text-gray-800">
            {formatCurrency(data.todayRevenue)}
          </p>
          <p className="text-xs text-gray-400">{data.todaySalesCount || 0} {t('furnitureDash.orders')}</p>
        </div>

        {/* Low Stock Alert */}
        <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 ${(data.lowStockCount || 0) > 0 ? 'border-red-500' : 'border-amber-400'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`w-5 h-5 ${(data.lowStockCount || 0) > 0 ? 'text-red-500' : 'text-amber-400'}`} />
            <span className="text-xs text-gray-500">
              {t('furnitureDash.lowStock')}
            </span>
          </div>
          <p className="text-lg font-bold text-gray-800">{data.lowStockCount || 0}</p>
          <p className="text-xs text-gray-400">{t('furnitureDash.itemsLabel')}</p>
        </div>

        {/* Pending Deliveries */}
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-5 h-5 text-blue-500" />
            <span className="text-xs text-gray-500">
              {t('furnitureDash.pendingDelivery')}
            </span>
          </div>
          <p className="text-lg font-bold text-gray-800">{data.pendingDeliveries || 0}</p>
          <p className="text-xs text-gray-400">{t('furnitureDash.orders')}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2">
        <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">
          {t('furnitureDash.quickActions')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/furniture/orders/new')}
            className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
          >
            <ShoppingCart className="w-8 h-8" />
            <span className="text-sm font-bold">{t('furnitureDash.newSale')}</span>
          </button>

          <button
            onClick={() => navigate('/furniture/inventory')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
          >
            <Package className="w-8 h-8" />
            <span className="text-sm font-bold">{t('furnitureDash.inventory')}</span>
          </button>

          <button
            onClick={() => navigate('/furniture/customers')}
            className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
          >
            <Users className="w-8 h-8" />
            <span className="text-sm font-bold">{t('furnitureDash.customers')}</span>
          </button>

          <button
            onClick={() => navigate('/furniture/orders')}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md hover:shadow-lg transition-shadow"
          >
            <ClipboardList className="w-8 h-8" />
            <span className="text-sm font-bold">{t('furnitureDash.orderHistory')}</span>
          </button>
        </div>
      </div>

      {/* Low Stock Items */}
      {data.lowStockItems && data.lowStockItems.length > 0 && (
        <div className="px-4 py-4">
          <h2 className="text-sm font-bold text-red-600 mb-3 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t('furnitureDash.lowStockAlert')}
          </h2>
          <div className="space-y-2">
            {data.lowStockItems.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between border-l-4 border-red-400">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{item.stockQty}</p>
                  <p className="text-xs text-gray-400">{t('furnitureDash.left')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      <div className="px-4 py-4">
        <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {t('furnitureDash.recentOrders')}
        </h2>
        {data.recentOrders && data.recentOrders.length > 0 ? (
          <div className="space-y-2">
            {data.recentOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-gray-800">
                    {order.customerName || t('furnitureDash.walkInCustomer')}
                  </p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    order.deliveryStatus === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                    order.deliveryStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.deliveryStatus === 'DELIVERED' ? t('furnitureDash.delivered') :
                     order.deliveryStatus === 'IN_PROGRESS' ? t('furnitureDash.inProgress') :
                     t('furnitureDash.pending')}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{order.transactionDate}</span>
                  <span className="font-bold text-gray-800">{formatCurrency(order.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('furnitureDash.noOrders')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
