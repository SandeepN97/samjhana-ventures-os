import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  List,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  Search,
  ShoppingBag,
  Store,
  Truck,
  X,
  XCircle,
} from 'lucide-react';
import ChipSlider from '../../components/ChipSlider';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import useLocaleFormat from '../../hooks/useLocaleFormat';

const TABS = ['NEW', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED', 'ALL'];
const REFRESH_MS = 30_000;
const STATUS_STYLE = {
  NEW: 'bg-amber-100 text-amber-900',
  CONFIRMED: 'bg-blue-100 text-blue-900',
  READY: 'bg-violet-100 text-violet-900',
  COMPLETED: 'bg-emerald-100 text-emerald-900',
  CANCELLED: 'bg-slate-200 text-slate-700',
};
const STATUS_DOT = {
  NEW: 'bg-amber-500',
  CONFIRMED: 'bg-blue-500',
  READY: 'bg-violet-500',
  COMPLETED: 'bg-emerald-500',
  CANCELLED: 'bg-rose-500',
};

/** The small icon on each status chip in the phone slider. */
const STATUS_ICON = {
  NEW: Bell,
  CONFIRMED: CheckCircle2,
  READY: PackageCheck,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
  ALL: List,
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
  const pageRef = useRef(null);
  const previousFocusRef = useRef(null);

  // True while a request for the list is out. The 30-second check skips its turn instead of piling a second
  // request on a server that is already slow to answer the first.
  const requestOut = useRef(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet && requestOut.current) return;
    requestOut.current = true;
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
      requestOut.current = false;
      if (!quiet) setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  // New orders arrive while someone is on this page; check again every half minute.
  useEffect(() => {
    const timer = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!selected) return undefined;
    const background = pageRef.current;
    const previousOverflow = document.body.style.overflow;
    background?.setAttribute('inert', '');
    background?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    return () => {
      background?.removeAttribute('inert');
      background?.removeAttribute('aria-hidden');
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);

  const visible = orders.filter((order) => {
    if (!search.trim()) return true;
    const query = search.trim().toLowerCase();
    return order.orderNumber.toLowerCase().includes(query)
      || order.customerName.toLowerCase().includes(query)
      || order.customerPhone.includes(query);
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

  const statusLabel = (status) => t(`shopOrders.status.${status}`);
  const openOrder = (order) => {
    previousFocusRef.current = document.activeElement;
    setSelected(order);
  };
  const closeOrder = () => {
    const focusTarget = previousFocusRef.current;
    setSelected(null);
    window.requestAnimationFrame(() => focusTarget?.focus());
  };

  return (
    <>
      <div ref={pageRef} className="min-h-screen bg-slate-100 pb-24">
        <PageHeader unit="core" icon={ShoppingBag} title={t('shopOrders.title')} backTo="/" />

        <main className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6">
          <section className="overflow-hidden rounded-2xl bg-[#f7f3ed] ring-1 ring-[#e4daca]" aria-labelledby="order-desk-title">
            <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e9efdf] text-[#6f591e] ring-1 ring-[#d7ddcb]">
                  <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 id="order-desk-title" className="text-lg font-bold text-slate-900">{t('shopOrders.deskTitle')}</h2>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f5548]">{t('shopOrders.deskIntro')}</p>
                  {!loading && !loadError && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-700" aria-label={t('shopOrders.queueSummary')}>
                      {['NEW', 'CONFIRMED', 'READY'].map((status) => (
                        <span key={status} className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
                          {num(counts[status] || 0)} {statusLabel(status)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[#5f5548]">
                <Clock3 className="h-4 w-4" aria-hidden="true" />{t('shopOrders.autoRefresh')}
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:p-4" aria-labelledby="order-queue-title">
            <div className="mb-3 flex items-end justify-between gap-3 px-1">
              <h2 id="order-queue-title" className="text-lg font-bold text-slate-900">{t('shopOrders.queueTitle')}</h2>
              {!loading && !loadError && (
                <p className="text-sm text-slate-500">{t('shopOrders.showingCount', { shown: num(visible.length), total: num(orders.length) })}</p>
              )}
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-center">
              <ChipSlider
                className="lg:hidden"
                label={t('shopOrders.filterLabel')}
                value={tab}
                onChange={setTab}
                items={TABS.map((status) => ({
                  value: status,
                  label: status === 'ALL' ? t('shopOrders.all') : statusLabel(status),
                  icon: STATUS_ICON[status],
                  count: status === 'ALL' ? undefined : num(counts[status] || 0),
                }))}
              />

              <div className="hidden lg:block" role="tablist" aria-label={t('shopOrders.filterLabel')}>
                <div className="flex min-w-max gap-2">
                  {TABS.map((status) => {
                    const selectedTab = tab === status;
                    return (
                      <button type="button" role="tab" key={status} aria-selected={selectedTab} onClick={() => setTab(status)}
                        className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 ${selectedTab ? 'bg-core-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}>
                        {status === 'ALL' ? t('shopOrders.all') : statusLabel(status)}
                        {status !== 'ALL' && (
                          <span aria-hidden="true" className={`rounded-full px-2 py-0.5 text-xs ${selectedTab ? 'bg-white/15 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{num(counts[status] || 0)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                  aria-label={t('shopOrders.search')} placeholder={t('shopOrders.search')}
                  className="min-h-[48px] w-full rounded-xl border border-slate-500 bg-white py-2.5 pl-11 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-600 focus:border-core-600 focus:ring-4 focus:ring-core-100" />
                {search && (
                  <button type="button" onClick={() => setSearch('')} aria-label={t('shopOrders.clearSearch')}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </section>

          {loading ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t('common.loading')}>
              {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />)}
            </div>
          ) : loadError ? (
            <div role="alert" className="mt-5 rounded-2xl bg-red-50 px-5 py-8 text-center text-red-800 ring-1 ring-red-200">
              <AlertTriangle className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
              <p className="mb-4 font-semibold">{t('shopOrders.failedToLoad')}</p>
              <button type="button" onClick={() => load()} className="min-h-[44px] rounded-xl bg-red-700 px-5 font-bold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">{t('beeDash.retry')}</button>
            </div>
          ) : visible.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-white px-5 py-16 text-center text-slate-600 ring-1 ring-slate-200">
              <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-900"><Package className="h-7 w-7" aria-hidden="true" /></span>
              <p className="text-lg font-semibold text-slate-800">{search ? t('shopOrders.noneSearch') : t('shopOrders.none')}</p>
              {search && <button type="button" onClick={() => setSearch('')} className="mt-5 min-h-[44px] rounded-xl bg-core-900 px-5 font-bold text-white hover:bg-core-800">{t('shopOrders.clearSearch')}</button>}
            </div>
          ) : (
            <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visible.map((order) => {
                const FulfilmentIcon = order.fulfilment === 'DELIVERY' ? Truck : Store;
                return (
                  <li key={order.id}>
                    <button type="button" onClick={() => openOrder(order)} data-testid="order-row"
                      className="group flex min-h-[236px] w-full flex-col overflow-hidden rounded-2xl bg-white text-left ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
                      <div className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-mono text-sm font-bold text-slate-800">{order.orderNumber}</span>
                            <p className="mt-1 text-xs font-medium text-slate-500">{when(order.createdAt)}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[order.status]}`}>{statusLabel(order.status)}</span>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><FulfilmentIcon className="h-5 w-5" aria-hidden="true" /></span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-900">{order.customerName} · {order.customerPhone}</p>
                            <p className="text-sm font-medium text-slate-500">{order.fulfilment === 'DELIVERY' ? t('shopOrders.delivery') : t('shopOrders.pickup')}</p>
                          </div>
                        </div>

                        <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{order.items.map((item) => `${num(item.quantity)} × ${item.name}`).join(', ')}</p>
                      </div>

                      <div className="flex min-h-[64px] items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3">
                        <span className="text-xl font-bold tabular-nums text-slate-900">{money(order.total)}</span>
                        <span className="flex items-center gap-1 text-sm font-bold text-core-700">{t('shopOrders.viewOrder')}<ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>

      {selected && (
        <OrderDetail
          key={selected.id}
          order={selected}
          canCancel={canCancel}
          onClose={closeOrder}
          onChanged={(updated) => { setSelected(updated); load(true); }}
          when={when}
          statusLabel={statusLabel}
        />
      )}
    </>
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
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, []);

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

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const next = NEXT[order.status] || [];
  const hasActions = next.length > 0 || (canCancel && !['COMPLETED', 'CANCELLED'].includes(order.status));

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-stretch sm:justify-end">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={order.orderNumber} onKeyDown={handleKeyDown}
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:h-full sm:max-h-none sm:rounded-none">
        <div className="flex items-start justify-between gap-4 border-b border-[#e4daca] bg-[#f7f3ed] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-lg font-bold text-slate-900">{order.orderNumber}</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[order.status]}`}>{statusLabel(order.status)}</span>
            </div>
            <p className="mt-1 text-sm text-[#5f5548]">{when(order.createdAt)}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t('common.close')}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {error && <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 ring-1 ring-red-200"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />{error}</div>}

          <section aria-labelledby="order-customer-heading" className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 sm:p-5">
            <h3 id="order-customer-heading" className="mb-3 text-sm font-bold uppercase tracking-[0.1em] text-slate-500">{t('shopOrders.customer')}</h3>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-core-700 ring-1 ring-slate-200"><Phone className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{order.customerName}</p>
                <a href={`tel:${order.customerPhone}`} className="inline-flex min-h-[44px] items-center font-semibold text-core-700 underline decoration-core-300 underline-offset-4">{order.customerPhone}</a>
                {order.customerEmail && <p className="break-all text-sm text-slate-600">{order.customerEmail}</p>}
              </div>
            </div>

            <div className="mt-4 flex items-start gap-3 border-t border-slate-200 pt-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200">
                {order.fulfilment === 'DELIVERY' ? <MapPin className="h-5 w-5" aria-hidden="true" /> : <Store className="h-5 w-5" aria-hidden="true" />}
              </span>
              <div>
                {order.fulfilment === 'DELIVERY' ? (
                  <p className="font-medium text-slate-800">{[order.addressLine, order.city, order.landmark].filter(Boolean).join(', ')}</p>
                ) : (
                  <p className="font-medium text-slate-800">{t('shopOrders.pickupAtShop')}</p>
                )}
                <p className="mt-1 text-sm text-slate-500">{order.paymentMethod === 'CASH_ON_DELIVERY' ? t('shopOrders.cod') : t('shopOrders.payAtShop')}</p>
              </div>
            </div>

            {order.customerNotes && <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-950 ring-1 ring-amber-200"><strong>{t('shopOrders.customerNote')}:</strong> {order.customerNotes}</p>}
          </section>

          <section aria-labelledby="order-items-heading" className="rounded-2xl bg-white ring-1 ring-slate-200">
            <h3 id="order-items-heading" className="border-b border-slate-200 px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] text-slate-500 sm:px-5">{t('shopOrders.items')}</h3>
            <ul className="divide-y divide-slate-200 px-4 sm:px-5">
              {order.items.map((item) => (
                <li key={item.slug} className="flex justify-between gap-3 py-3 text-slate-800">
                  <span>{num(item.quantity)} × {item.name}</span>
                  <span className="font-semibold tabular-nums">{money(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-slate-200 bg-slate-50 px-4 py-4 text-sm sm:px-5">
              <div className="flex justify-between"><dt className="text-slate-500">{t('shopOrders.subtotal')}</dt><dd className="font-medium tabular-nums text-slate-800">{money(order.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t('shopOrders.deliveryFee')}</dt><dd className="font-medium tabular-nums text-slate-800">{money(order.deliveryFee)}</dd></div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-bold"><dt>{t('shopOrders.total')}</dt><dd className="tabular-nums">{money(order.total)}</dd></div>
            </dl>
            {order.status === 'CANCELLED' && order.cancelReason && (
              <p className="border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 sm:px-5">{t('shopOrders.cancelReason')}: {order.cancelReason}</p>
            )}
          </section>

          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-5">
            <label htmlFor="order-notes" className="mb-2 block text-sm font-bold uppercase tracking-[0.1em] text-slate-500">{t('shopOrders.internalNotes')}</label>
            <textarea id="order-notes" rows={3} value={notes} onChange={(event) => { setNotes(event.target.value); setNotesSaved(false); }}
              className="w-full rounded-xl border border-slate-500 bg-white px-3.5 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-600 focus:border-core-600 focus:ring-4 focus:ring-core-100" />
            <button type="button" onClick={saveNotes}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-500 bg-white px-4 font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
              {notesSaved && <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />}
              {notesSaved ? t('shopOrders.notesSaved') : t('shopOrders.saveNotes')}
            </button>
          </section>
        </div>

        {hasActions && (
          <section className="border-t border-slate-200 bg-slate-50 p-4 sm:px-6" aria-label={t('shopOrders.nextStep')}>
            {confirming === 'COMPLETED' && (
              <p className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-900 ring-1 ring-emerald-200">{t('shopOrders.completeNote')}</p>
            )}
            {confirming === 'CANCELLED' && (
              <div className="mb-3">
                <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-semibold text-slate-700">{t('shopOrders.cancelReasonLabel')}</label>
                <input id="cancel-reason" type="text" value={reason} onChange={(event) => setReason(event.target.value)}
                  className="min-h-[48px] w-full rounded-xl border border-slate-500 bg-white px-3.5 text-slate-900 outline-none focus:border-core-600 focus:ring-4 focus:ring-core-100" />
                <p className="mt-1.5 text-xs text-slate-500">{t('shopOrders.cancelNote')}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {confirming ? (
                <>
                  <button type="button" disabled={busy} onClick={() => move(confirming)}
                    className={`inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl px-4 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${confirming === 'CANCELLED' ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800'}`}>
                    {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {confirming === 'CANCELLED' ? t('shopOrders.confirmCancel') : t('shopOrders.confirmComplete')}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="min-h-[48px] flex-1 rounded-xl border border-slate-500 bg-white px-4 font-bold text-slate-700 hover:bg-slate-50">{t('shopOrders.back')}</button>
                </>
              ) : (
                <>
                  {next.map((status) => (
                    <button type="button" key={status} disabled={busy}
                      onClick={() => (status === 'COMPLETED' ? setConfirming('COMPLETED') : move(status))}
                      className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-core-900 px-4 font-bold text-white hover:bg-core-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">
                      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {t(`shopOrders.action.${status}`)}
                    </button>
                  ))}
                  {canCancel && !['COMPLETED', 'CANCELLED'].includes(order.status) && (
                    <button type="button" disabled={busy} onClick={() => setConfirming('CANCELLED')}
                      className="min-h-[48px] rounded-xl border border-red-400 bg-white px-4 font-bold text-red-700 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-60">{t('shopOrders.action.CANCELLED')}</button>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </div>
    </div>,
    document.body
  );
}
