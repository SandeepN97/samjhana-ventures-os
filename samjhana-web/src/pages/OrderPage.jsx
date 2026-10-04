import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Circle, XCircle, Loader } from 'lucide-react';
import { ordersApi, errorMessage } from '../api/api.js';
import { useSection } from '../site/SiteContext';
import { formatMoney } from '../utils/format';
import { telLink } from '../site/links';

const STEPS = [
  { status: 'NEW', label: 'Order received' },
  { status: 'CONFIRMED', label: 'Confirmed' },
  { status: 'READY', label: 'Ready' },
  { status: 'COMPLETED', label: 'Completed' },
];

export function PhoneLookup({ orderNumber, onFound, initialError = '' }) {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);

  const submit = async (event) => {
    event.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) { setError('Enter your order number and the phone number you gave us.'); return; }
    setBusy(true);
    setError('');
    try {
      onFound(await ordersApi.track(orderNumber.trim(), phone.trim()), phone.trim());
    } catch (err) {
      setError(errorMessage(err, 'We couldn’t look that up. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="lookup-phone" className="mb-1 block text-sm font-medium">Phone number on the order</label>
        <input id="lookup-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
          className="min-h-[44px] w-full rounded-lg border border-warm-border bg-white px-3 py-2 focus:border-gold focus:outline-none" />
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="btn-dark min-h-[44px]">{busy ? 'Looking…' : 'Show my order'}</button>
    </form>
  );
}

export default function OrderPage() {
  const { orderNumber } = useParams();
  const location = useLocation();
  const contact = useSection('contact');
  const [order, setOrder] = useState(location.state?.order || null);
  const [phone, setPhone] = useState(location.state?.phone || '');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const placed = Boolean(location.state?.placed);

  // A new order number in the address means a different order: forget the one on screen.
  useEffect(() => {
    if (order && order.orderNumber !== orderNumber) setOrder(null);
  }, [orderNumber, order]);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError('');
    try {
      setOrder(await ordersApi.track(orderNumber, phone));
    } catch (err) {
      setRefreshError(errorMessage(err, 'We couldn’t refresh the status.'));
    } finally {
      setRefreshing(false);
    }
  };

  if (!order) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-serif text-3xl text-dark">Order {orderNumber}</h1>
        <p className="mb-6 mt-2 text-dark/60">To keep your details private, enter the phone number you gave when you ordered.</p>
        <PhoneLookup orderNumber={orderNumber} onFound={(found, p) => { setOrder(found); setPhone(p); }} />
      </main>
    );
  }

  const cancelled = order.status === 'CANCELLED';
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const tel = telLink(contact);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      {placed && (
        <div role="status" className="mb-6 rounded-xl border border-green-200 bg-green-50 p-5">
          <p className="font-serif text-2xl text-green-900">Thank you, {order.customerName.split(' ')[0]}!</p>
          <p className="mt-1 text-green-900/80">Your order is in. We will call you to confirm it. Keep your order number to check on it.</p>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-serif text-3xl text-dark">Order <span className="font-mono text-2xl">{order.orderNumber}</span></h1>
        <p className="text-sm text-dark/60">{order.fulfilment === 'DELIVERY' ? 'Delivery' : 'Pickup at the shop'}</p>
      </div>

      <section aria-label="Order status" className="mb-8 rounded-xl border border-warm-border bg-white p-5">
        {cancelled ? (
          <p className="flex items-center gap-2 font-medium text-red-700"><XCircle size={20} aria-hidden="true" /> This order was cancelled.</p>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-4">
            {STEPS.map((s, i) => {
              const done = i <= stepIndex;
              return (
                <li key={s.status} aria-current={i === stepIndex ? 'step' : undefined} className={`flex items-center gap-2 ${done ? 'font-medium text-dark' : 'text-dark/40'}`}>
                  {done ? <CheckCircle2 size={20} className="text-green-600" aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}
                  {s.status === 'READY' && order.fulfilment === 'DELIVERY' ? 'Ready to go' : s.label}
                </li>
              );
            })}
          </ol>
        )}
        {phone && (
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <button type="button" onClick={refresh} disabled={refreshing} className="flex min-h-[44px] items-center gap-2 rounded border border-warm-border px-4 hover:bg-warm">
              {refreshing && <Loader size={14} className="animate-spin" aria-hidden="true" />} Refresh status
            </button>
            {refreshError && <span role="alert" className="text-red-700">{refreshError}</span>}
          </div>
        )}
      </section>

      <section aria-label="What you ordered" className="rounded-xl border border-warm-border bg-white p-5">
        <ul className="divide-y divide-warm-border">
          {(order.items || []).map((i) => (
            <li key={i.slug} className="flex justify-between gap-4 py-3">
              <span>{i.quantity} × <Link to={`/product/${i.slug}`} className="hover:text-gold">{i.name}</Link></span>
              <span className="font-medium">{formatMoney(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-warm-border pt-3 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Delivery</dt><dd>{Number(order.deliveryFee) > 0 ? formatMoney(order.deliveryFee) : 'Free'}</dd></div>
          <div className="flex justify-between border-t border-warm-border pt-2 text-lg font-semibold"><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-dark/60">{order.paymentMethod === 'CASH_ON_DELIVERY' ? 'Pay in cash when it arrives.' : 'Pay at the shop when you collect it.'}</p>
        <p className="mt-1 text-xs text-dark/40">For {order.customerName} · {order.customerPhone}</p>
      </section>

      <p className="mt-6 text-sm text-dark/60">
        Questions? {tel ? <>Call <a href={tel} className="font-medium text-gold underline">{contact.phone}</a>.</> : null}
      </p>
      <Link to="/shop" className="btn-outline mt-6">Keep shopping</Link>
    </main>
  );
}
