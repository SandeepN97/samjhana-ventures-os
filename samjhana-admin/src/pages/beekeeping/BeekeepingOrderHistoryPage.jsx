import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Search } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import BusinessTabs from '../../components/BusinessTabs';
import useLocaleFormat from '../../hooks/useLocaleFormat';

// The server sends this many sales at a time; "Show older sales" asks for the next batch.
const PAGE_SIZE = 50;
const pageUrl = (page) => `/api/beekeeping/orders?page=${page}&size=${PAGE_SIZE}`;

export default function BeekeepingOrderHistoryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { money, num } = useLocaleFormat();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);              // the last batch asked for
  const [hasMore, setHasMore] = useState(false);    // the last batch was full, so there may be older sales
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(pageUrl(0));
      setOrders(res.data);
      setPage(0);
      setHasMore(res.data.length >= PAGE_SIZE);
      setMoreError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const loadOlder = async () => {
    setLoadingMore(true);
    setMoreError(false);
    try {
      const res = await api.get(pageUrl(page + 1));
      // A sale recorded meanwhile pushes one onto the next page: show it once.
      setOrders((shown) => {
        const seen = new Set(shown.map((o) => o.id));
        return [...shown, ...res.data.filter((o) => !seen.has(o.id))];
      });
      setPage(page + 1);
      setHasMore(res.data.length >= PAGE_SIZE);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visible = orders.filter((o) => !search || (o.customerName || '').toLowerCase().includes(search.toLowerCase()));

  const olderButton = hasMore && (
    <div className="px-4 pb-4 text-center">
      {moreError && <p role="alert" className="mb-2 text-sm text-red-600">{t('beeOrd.failedToLoadOlder')}</p>}
      <button type="button" onClick={loadOlder} disabled={loadingMore}
        className="min-h-[44px] rounded-xl border-2 border-beekeeping-600 px-6 font-bold text-beekeeping-700 disabled:opacity-60">
        {loadingMore ? t('common.loading') : t('beeOrd.showOlder')}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit="beekeeping" icon={ClipboardList} title={t('beeOrd.historyTitle')} backTo="/entry/beekeeping" >
        <BusinessTabs business="beekeeping" />
      </PageHeader>

      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            aria-label={t('beeOrd.searchByCustomer')} placeholder={t('beeOrd.searchByCustomer')}
            className="w-full min-h-[44px] pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-beekeeping-500" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-beekeeping-600" role="status" aria-label={t('common.loading')} />
        </div>
      ) : error ? (
        <div role="alert" className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-red-700">
          <p className="mb-3">{t('beeOrd.failedToLoad')}</p>
          <button type="button" onClick={load} className="min-h-[44px] rounded-lg bg-red-600 px-5 font-bold text-white">{t('beeDash.retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
          <p className="text-lg">{t('beeOrd.noOrdersFound')}</p>
          <button type="button" onClick={() => navigate('/beekeeping/orders/new')}
            className="mt-4 min-h-[44px] bg-beekeeping-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-beekeeping-700">
            {t('beeOrd.createFirstOrder')}
          </button>
          {olderButton}
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {visible.map((o) => {
            const items = Array.isArray(o.items) ? o.items : [];
            return (
              <div key={o.id} className="bg-white rounded-xl shadow-sm p-4" data-testid="sale-row">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-gray-800">{o.customerName || t('beeOrd.walkInCustomer')}</p>
                  <span className="font-bold text-gray-800">{money(o.amount)}</span>
                </div>
                <p className="text-sm text-gray-500 mb-2">
                  {o.transactionDate}
                  {o.paymentMethod ? ` · ${o.paymentMethod === 'BANK' ? t('common.bank') : t('common.cash')}` : ''}
                </p>
                <ul className="text-sm text-gray-700 space-y-0.5">
                  {items.slice(0, 3).map((it, i) => (
                    <li key={i}>{it.itemName} × {num(it.quantity)}</li>
                  ))}
                </ul>
                {items.length > 3 && <p className="text-xs text-gray-400 mt-1">+{num(items.length - 3)} {t('beeOrd.more')}</p>}
              </div>
            );
          })}
          {olderButton}
        </div>
      )}
    </div>
  );
}
