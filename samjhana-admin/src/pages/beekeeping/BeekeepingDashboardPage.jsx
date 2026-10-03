import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hexagon, Package, TrendingUp, AlertTriangle, ShoppingCart, ClipboardList, Clock } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import useLocaleFormat from '../../hooks/useLocaleFormat';

export default function BeekeepingDashboardPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { money, num } = useLocaleFormat();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/api/beekeeping/dashboard');
      setData(res.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-beekeeping-600" role="status" aria-label={t('common.loading')} />
      </div>
    );
  }

  const d = data || {};
  const lowCount = d.lowStockCount || 0;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit="beekeeping" icon={Hexagon} title={t('beeDash.title')} subtitle={t('beeDash.dashboardLabel')} />

      {error && (
        <div role="alert" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{t('beeDash.failedToLoad')}</span>
          <button type="button" onClick={load} className="min-h-[44px] rounded-lg bg-red-600 px-4 font-bold text-white">
            {t('beeDash.retry')}
          </button>
        </div>
      )}

      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-beekeeping-500">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5 text-beekeeping-600" aria-hidden="true" />
            <span className="text-xs text-gray-500">{t('beeDash.stockValue')}</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{money(d.totalStockValue || 0)}</p>
          <p className="text-xs text-gray-400">{num(d.totalItems || 0)} {t('beeDash.itemsLabel')}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-green-500">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-500" aria-hidden="true" />
            <span className="text-xs text-gray-500">{t('beeDash.todaySales')}</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{money(d.todayRevenue || 0)}</p>
          <p className="text-xs text-gray-400">{num(d.todaySalesCount || 0)} {t('beeDash.orders')}</p>
        </div>

        <div className={`bg-white rounded-xl shadow-sm p-4 border-l-4 col-span-2 ${lowCount > 0 ? 'border-red-500' : 'border-amber-400'}`}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={`w-5 h-5 ${lowCount > 0 ? 'text-red-500' : 'text-amber-400'}`} aria-hidden="true" />
            <span className="text-xs text-gray-500">{t('beeDash.lowStock')}</span>
          </div>
          <p className="text-lg font-bold text-gray-800">{num(lowCount)}</p>
          <p className="text-xs text-gray-400">{t('beeDash.itemsLabel')}</p>
        </div>
      </div>

      <div className="px-4 py-2">
        <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide">{t('beeDash.quickActions')}</h2>
        <div className="grid grid-cols-3 gap-3">
          <button type="button" onClick={() => navigate('/beekeeping/orders/new')}
            className="min-h-[44px] bg-gradient-to-r from-beekeeping-500 to-beekeeping-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md">
            <ShoppingCart className="w-8 h-8" aria-hidden="true" />
            <span className="text-sm font-bold text-center">{t('beeDash.newSale')}</span>
          </button>
          <button type="button" onClick={() => navigate('/beekeeping/inventory')}
            className="min-h-[44px] bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md">
            <Package className="w-8 h-8" aria-hidden="true" />
            <span className="text-sm font-bold text-center">{t('beeDash.inventory')}</span>
          </button>
          <button type="button" onClick={() => navigate('/beekeeping/orders')}
            className="min-h-[44px] bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-md">
            <ClipboardList className="w-8 h-8" aria-hidden="true" />
            <span className="text-sm font-bold text-center">{t('beeDash.orderHistory')}</span>
          </button>
        </div>
      </div>

      {d.lowStockItems && d.lowStockItems.length > 0 && (
        <div className="px-4 py-4">
          <h2 className="text-sm font-bold text-red-600 mb-3 uppercase tracking-wide flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            {t('beeDash.lowStockAlert')}
          </h2>
          <div className="space-y-2">
            {d.lowStockItems.map((item) => (
              <div key={item.id} className="bg-white rounded-lg shadow-sm p-3 flex items-center justify-between border-l-4 border-red-400">
                <p className="font-medium text-gray-800">{item.name}</p>
                <div className="text-right">
                  <p className="text-lg font-bold text-red-600">{num(item.stockQty)}</p>
                  <p className="text-xs text-gray-400">{t('beeDash.left')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4">
        <h2 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4" aria-hidden="true" />
          {t('beeDash.recentOrders')}
        </h2>
        {d.recentOrders && d.recentOrders.length > 0 ? (
          <div className="space-y-2">
            {d.recentOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow-sm p-3">
                <p className="font-medium text-gray-800 mb-1">{order.customerName || t('beeDash.walkInCustomer')}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{order.transactionDate}</span>
                  <span className="font-bold text-gray-800">{money(order.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
            <p>{t('beeDash.noOrders')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
