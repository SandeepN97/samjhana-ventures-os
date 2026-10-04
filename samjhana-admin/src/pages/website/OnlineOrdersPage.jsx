import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, Search, X, Phone, MapPin, Package } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import useLocaleFormat from '../../hooks/useLocaleFormat';

const TABS = ['NEW', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED', 'ALL'];
const REFRESH_MS = 30_000;
const STATUS_STYLE = {
  NEW: 'bg-amber-100 text-amber-800',
  CONFIRMED: 'bg-blue-100 text-blue-800',
  READY: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-200 text-gray-700',
};

/** Which buttons an order shows next: the same steps the server allows. */
const NEXT = {
  NEW: ['CONFIRMED'],
  CONFIRMED: ['READY', 'COMPLETED'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export default function OnlineOrdersPage() {
  const { t, i18n } = useTranslation();
  const { money, num } = useLocaleFormat();
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const canCancel = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [tab, setTab] = useState('NEW');
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        api.get(`/api/shop-orders?status=${tab}`),
        api.get('/api/shop-orders/summary'),
      ]);
      setOrders(list.data);
      setCounts(summary.data);
      setLoadError(false);
    } catch {
      if (!quiet) setLoadError(true);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // New orders arrive while someone is on this page; check again every half minute.
  useEffect(() => {
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const visible = orders.filter((o) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerPhone.includes(q);
  });

  const when = (iso) => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(i18n.language === 'ne' ? 'ne-NP' : 'en-NP', {
        timeZone: 'Asia/Kathmandu', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h12',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const statusLabel = (s) => t(`shopOrders.status.${s}`);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit="core" icon={ShoppingBag} title={t('shopOrders.title')} backTo="/website" />

      <div className="overflow-x-auto border-b bg-white px-4 py-2">
        <div className="flex min-w-max gap-2" role="tablist" aria-label={t('shopOrders.title')}>
          {TABS.map((s) => (
            <button type="button" role="tab" key={s} aria-selected={tab === s} onClick={() => setTab(s)}
              className={`flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-medium ${tab === s ? 'bg-core-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'ALL' ? t('shopOrders.all') : statusLabel(s)}
              {s !== 'ALL' && counts[s] > 0 && (
                <span className={`rounded-full px-2 text-xs font-bold ${tab === s ? 'bg-white/20' : 'bg-gray-300 text-gray-800'}`}>{num(counts[s])}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b bg-white px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            aria-label={t('shopOrders.search')} placeholder={t('shopOrders.search')}
            className="min-h-[44px] w-full rounded-xl border-2 border-gray-200 py-3 pl-10 pr-4 focus:border-core-500 focus:outline-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-core-700" role="status" aria-label={t('common.loading')} /></div>
      ) : loadError ? (
        <div role="alert" className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-red-700">
          <p className="mb-3">{t('shopOrders.failedToLoad')}</p>
          <button type="button" onClick={() => load()} className="min-h-[44px] rounded-lg bg-red-600 px-5 font-bold text-white">{t('beeDash.retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <Package className="mx-auto mb-4 h-16 w-16 opacity-50" aria-hidden="true" />
          <p className="text-lg">{t('shopOrders.none')}</p>
        </div>
      ) : (
        <ul className="space-y-3 px-4 py-4">
          {visible.map((o) => (
            <li key={o.id}>
              <button type="button" onClick={() => setSelected(o)} data-testid="order-row"
                className="w-full rounded-xl bg-white p-4 text-left shadow-sm hover:shadow">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-gray-800">{o.orderNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status]}`}>{statusLabel(o.status)}</span>
                </div>
                <p className="font-medium text-gray-800">{o.customerName} · {o.customerPhone}</p>
                <p className="text-sm text-gray-500">
                  {o.fulfilment === 'DELIVERY' ? t('shopOrders.delivery') : t('shopOrders.pickup')} · {when(o.createdAt)}
                </p>
                <p className="mt-1 truncate text-sm text-gray-700">{o.items.map((i) => `${num(i.quantity)} × ${i.name}`).join(', ')}</p>
                <p className="mt-1 text-right text-lg font-bold text-gray-900">{money(o.total)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <OrderDetail
          key={selected.id}
          order={selected}
          canCancel={canCancel}
          onClose={() => setSelected(null)}
          onChanged={(updated) => { setSelected(updated); load(true); }}
          when={when}
          statusLabel={statusLabel}
        />
      )}
    </div>
  );
}

function OrderDetail({ order, canCancel, onClose, onChanged, when, statusLabel }) {
  const { t } = useTranslation();
  const { money, num } = useLocaleFormat();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);   // 'COMPLETED' | 'CANCELLED'
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState(order.internalNotes || '');
  const [notesSaved, setNotesSaved] = useState(false);

  const move = async (status) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.patch(`/api/shop-orders/${order.id}/status`, { status, reason: status === 'CANCELLED' ? reason : undefined });
      setConfirming(null);
      onChanged(res.data.order);
    } catch (err) {
      setError(err.response?.data?.message || t('shopOrders.failedToUpdate'));
    } finally {
      setBusy(false);
    }
  };

  const saveNotes = async () => {
    setError('');
    try {
      const res = await api.patch(`/api/shop-orders/${order.id}/notes`, { notes });
      setNotesSaved(true);
      onChanged(res.data.order);
    } catch (err) {
      setError(err.response?.data?.message || t('shopOrders.failedToUpdate'));
    }
  };

  const next = NEXT[order.status] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-4">
      <div role="dialog" aria-modal="true" aria-label={order.orderNumber} className="mx-4 my-auto w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-mono text-lg font-bold text-gray-800">{order.orderNumber}</h2>
            <p className="text-sm text-gray-500">{when(order.createdAt)} · {statusLabel(order.status)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded hover:bg-gray-100"><X className="h-6 w-6 text-gray-500" /></button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
          {error && <div role="alert" className="rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700">{error}</div>}

          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-500">{t('shopOrders.customer')}</h3>
            <p className="font-medium text-gray-800">{order.customerName}</p>
            <a href={`tel:${order.customerPhone}`} className="flex min-h-[44px] items-center gap-2 text-core-700 underline">
              <Phone className="h-4 w-4" aria-hidden="true" /> {order.customerPhone}
            </a>
            {order.customerEmail && <p className="text-sm text-gray-600">{order.customerEmail}</p>}
            {order.fulfilment === 'DELIVERY' ? (
              <p className="mt-1 flex items-start gap-2 text-gray-700">
                <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{[order.addressLine, order.city, order.landmark].filter(Boolean).join(', ')}</span>
              </p>
            ) : (
              <p className="mt-1 text-gray-700">{t('shopOrders.pickupAtShop')}</p>
            )}
            <p className="text-sm text-gray-500">{order.paymentMethod === 'CASH_ON_DELIVERY' ? t('shopOrders.cod') : t('shopOrders.payAtShop')}</p>
            {order.customerNotes && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-gray-800"><strong>{t('shopOrders.customerNote')}:</strong> {order.customerNotes}</p>}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-500">{t('shopOrders.items')}</h3>
            <ul className="divide-y">
              {order.items.map((i) => (
                <li key={`${i.slug}`} className="flex justify-between gap-3 py-2">
                  <span>{num(i.quantity)} × {i.name}</span>
                  <span className="font-medium">{money(i.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt>{t('shopOrders.subtotal')}</dt><dd>{money(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>{t('shopOrders.deliveryFee')}</dt><dd>{money(order.deliveryFee)}</dd></div>
              <div className="flex justify-between text-base font-bold"><dt>{t('shopOrders.total')}</dt><dd>{money(order.total)}</dd></div>
            </dl>
            {order.status === 'CANCELLED' && order.cancelReason && (
              <p className="mt-2 text-sm text-gray-600">{t('shopOrders.cancelReason')}: {order.cancelReason}</p>
            )}
          </section>

          <section>
            <label htmlFor="order-notes" className="mb-1 block text-sm font-bold uppercase tracking-wide text-gray-500">{t('shopOrders.internalNotes')}</label>
            <textarea id="order-notes" rows={2} value={notes} onChange={(e) => { setNotes(e.target.value); setNotesSaved(false); }}
              className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-core-500 focus:outline-none" />
            <button type="button" onClick={saveNotes} className="mt-1 min-h-[44px] rounded-lg border-2 border-gray-300 px-4 font-medium text-gray-700">
              {notesSaved ? t('shopOrders.notesSaved') : t('shopOrders.saveNotes')}
            </button>
          </section>

          {(next.length > 0 || (canCancel && !['COMPLETED', 'CANCELLED'].includes(order.status))) && (
            <section className="space-y-2 border-t pt-3">
              {confirming === 'COMPLETED' && (
                <p className="rounded-lg bg-green-50 p-3 text-sm text-green-900">{t('shopOrders.completeNote')}</p>
              )}
              {confirming === 'CANCELLED' && (
                <div>
                  <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium text-gray-700">{t('shopOrders.cancelReasonLabel')}</label>
                  <input id="cancel-reason" type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border-2 border-gray-300 px-3 focus:border-core-500 focus:outline-none" />
                  <p className="mt-1 text-xs text-gray-500">{t('shopOrders.cancelNote')}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {confirming ? (
                  <>
                    <button type="button" disabled={busy} onClick={() => move(confirming)}
                      className={`min-h-[44px] flex-1 rounded-lg px-4 font-bold text-white ${confirming === 'CANCELLED' ? 'bg-red-600' : 'bg-green-600'}`}>
                      {confirming === 'CANCELLED' ? t('shopOrders.confirmCancel') : t('shopOrders.confirmComplete')}
                    </button>
                    <button type="button" onClick={() => setConfirming(null)} className="min-h-[44px] flex-1 rounded-lg border-2 border-gray-300 px-4 font-bold text-gray-700">{t('shopOrders.back')}</button>
                  </>
                ) : (
                  <>
                    {next.map((s) => (
                      <button type="button" key={s} disabled={busy}
                        onClick={() => (s === 'COMPLETED' ? setConfirming('COMPLETED') : move(s))}
                        className="min-h-[44px] flex-1 rounded-lg bg-core-800 px-4 font-bold text-white hover:bg-core-700">
                        {t(`shopOrders.action.${s}`)}
                      </button>
                    ))}
                    {canCancel && !['COMPLETED', 'CANCELLED'].includes(order.status) && (
                      <button type="button" onClick={() => setConfirming('CANCELLED')}
                        className="min-h-[44px] rounded-lg border-2 border-red-300 px-4 font-bold text-red-700">{t('shopOrders.action.CANCELLED')}</button>
                    )}
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
