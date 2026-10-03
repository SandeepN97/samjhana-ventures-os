import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Loader, Truck, Store } from 'lucide-react';
import { ordersApi, errorMessage } from '../api/api.js';
import useCartProducts from '../store/useCartProducts';
import { useCartStore } from '../store/cartStore';
import { useSection } from '../site/SiteContext';
import Picture from '../components/ui/Picture';
import { deliveryFeeFor } from './CartPage';
import { formatMoney } from '../utils/format';

const PHONE = /^\+?[0-9]{7,15}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const FIELD = 'min-h-[44px] w-full rounded-lg border border-warm-border bg-white px-3 py-2 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/40';

export function validate(form) {
  const errors = {};
  if (form.customerName.trim().length < 2) errors.customerName = 'Enter your name.';
  if (!PHONE.test(form.customerPhone.replace(/[\s\-().]/g, ''))) errors.customerPhone = 'Enter a phone number we can call.';
  if (form.customerEmail.trim() && !EMAIL.test(form.customerEmail.trim())) errors.customerEmail = 'Enter a valid email address or leave it empty.';
  if (form.fulfilment === 'DELIVERY') {
    if (form.addressLine.trim().length < 3) errors.addressLine = 'Enter the delivery address.';
    if (form.city.trim().length < 2) errors.city = 'Enter your town or city.';
  }
  return errors;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const shop = useSection('shop');
  const clear = useCartStore((s) => s.clear);
  const { lines, subtotal, loading, error, blocked, retry } = useCartProducts();
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerEmail: '', fulfilment: 'DELIVERY', addressLine: '', city: '', landmark: '', notes: '', website: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const delivery = form.fulfilment === 'DELIVERY';
  const fee = delivery ? deliveryFeeFor(subtotal, shop) : 0;
  const total = subtotal + fee;
  const sellable = lines.filter((l) => l.product && l.product.stockStatus !== 'OUT_OF_STOCK');

  if (lines.length === 0 && !submitting) return <Navigate to="/cart" replace />;

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      const order = await ordersApi.place({
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        customerEmail: form.customerEmail.trim() || null,
        fulfilment: form.fulfilment,
        addressLine: delivery ? form.addressLine.trim() : null,
        city: delivery ? form.city.trim() : null,
        landmark: delivery ? form.landmark.trim() || null : null,
        notes: form.notes.trim() || null,
        items: sellable.map((l) => ({ slug: l.slug, quantity: l.qty })),
        website: form.website,
      });
      clear();
      navigate(`/order/${order.orderNumber}`, { replace: true, state: { order, phone: form.customerPhone.trim(), placed: true } });
    } catch (err) {
      const status = err?.response?.status;
      setServerError(status === 409
        ? `${errorMessage(err, 'Something in your cart ran out.')} Please check your cart.`
        : errorMessage(err, 'We couldn’t place your order. Please try again, or call us.'));
      setSubmitting(false);
    }
  };

  const fieldError = (name) => errors[name] && <p id={`${name}-error`} role="alert" className="mt-1 text-sm text-red-700">{errors[name]}</p>;
  const aria = (name) => (errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {});

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-serif text-3xl text-dark">Checkout</h1>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-warm-border bg-white p-4 text-center">
          <p className="mb-3 text-dark/70">We couldn&apos;t check the latest prices.</p>
          <button type="button" onClick={retry} className="btn-dark">Try again</button>
        </div>
      )}
      {blocked && (
        <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          Something in your cart is no longer available. <Link to="/cart" className="font-medium underline">Update your cart</Link> to continue.
        </p>
      )}

      <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="mb-1 font-serif text-xl text-dark">Your details</legend>
            <div>
              <label htmlFor="co-name" className="mb-1 block text-sm font-medium">Full name</label>
              <input id="co-name" autoComplete="name" value={form.customerName} onChange={set('customerName')} className={FIELD} {...aria('customerName')} />
              {fieldError('customerName')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="co-phone" className="mb-1 block text-sm font-medium">Phone</label>
                <input id="co-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.customerPhone} onChange={set('customerPhone')} className={FIELD} {...aria('customerPhone')} />
                {fieldError('customerPhone')}
              </div>
              <div>
                <label htmlFor="co-email" className="mb-1 block text-sm font-medium">Email <span className="text-dark/40">(optional)</span></label>
                <input id="co-email" type="email" autoComplete="email" value={form.customerEmail} onChange={set('customerEmail')} className={FIELD} {...aria('customerEmail')} />
                {fieldError('customerEmail')}
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-serif text-xl text-dark">How would you like it?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { value: 'DELIVERY', title: 'Delivery', note: shop.deliveryNote, icon: Truck },
                { value: 'PICKUP', title: 'Pick up at the shop', note: shop.pickupNote, icon: Store },
              ].map(({ value, title, note, icon: Icon }) => (
                <label key={value} className={`flex min-h-[44px] cursor-pointer gap-3 rounded-xl border-2 p-4 ${form.fulfilment === value ? 'border-gold bg-gold-pale' : 'border-warm-border bg-white'}`}>
                  <input type="radio" name="fulfilment" value={value} checked={form.fulfilment === value} onChange={set('fulfilment')} className="mt-1 h-5 w-5" />
                  <span>
                    <span className="flex items-center gap-2 font-medium"><Icon size={16} aria-hidden="true" /> {title}</span>
                    {note && <span className="mt-1 block text-sm text-dark/60">{note}</span>}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {delivery && (
            <fieldset className="space-y-4">
              <legend className="mb-1 font-serif text-xl text-dark">Delivery address</legend>
              <div>
                <label htmlFor="co-address" className="mb-1 block text-sm font-medium">Street, ward or village</label>
                <input id="co-address" autoComplete="street-address" value={form.addressLine} onChange={set('addressLine')} className={FIELD} {...aria('addressLine')} />
                {fieldError('addressLine')}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-city" className="mb-1 block text-sm font-medium">Town or city</label>
                  <input id="co-city" autoComplete="address-level2" value={form.city} onChange={set('city')} className={FIELD} {...aria('city')} />
                  {fieldError('city')}
                </div>
                <div>
                  <label htmlFor="co-landmark" className="mb-1 block text-sm font-medium">Landmark <span className="text-dark/40">(optional)</span></label>
                  <input id="co-landmark" value={form.landmark} onChange={set('landmark')} className={FIELD} />
                </div>
              </div>
            </fieldset>
          )}

          <div>
            <label htmlFor="co-notes" className="mb-1 block text-sm font-medium">Anything we should know? <span className="text-dark/40">(optional)</span></label>
            <textarea id="co-notes" rows={3} value={form.notes} onChange={set('notes')} className={`${FIELD} resize-y`} />
          </div>

          {/* Real visitors never see or fill this; a form-filling bot usually does. */}
          <div className="absolute -left-[9999px]" aria-hidden="true">
            <label htmlFor="co-website">Website</label>
            <input id="co-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
          </div>
        </div>

        <aside aria-label="Order summary" className="h-fit rounded-xl border border-warm-border bg-white p-5 lg:sticky lg:top-36">
          <h2 className="mb-3 font-serif text-xl text-dark">Your order</h2>
          {loading && lines.every((l) => !l.product) ? (
            <p className="flex items-center gap-2 py-6 text-dark/40" role="status"><Loader size={16} className="animate-spin" /> Checking prices…</p>
          ) : (
            <ul className="divide-y divide-warm-border">
              {sellable.map((l) => (
                <li key={l.slug} className="flex gap-3 py-3 text-sm">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-warm-soft"><Picture src={l.product.image} alt="" className="h-full w-full" /></div>
                  <span className="min-w-0 flex-1">{l.qty} × {l.product.name}</span>
                  <span className="font-medium">{formatMoney(Number(l.product.price) * l.qty)}</span>
                </li>
              ))}
            </ul>
          )}
          <dl className="mt-3 space-y-1 border-t border-warm-border pt-3 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>{delivery ? 'Delivery' : 'Pickup'}</dt><dd>{fee > 0 ? formatMoney(fee) : 'Free'}</dd></div>
            <div className="flex justify-between border-t border-warm-border pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(total)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-dark/50">{delivery ? shop.paymentNote : shop.pickupNote}</p>

          {serverError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{serverError}</p>}
          <button type="submit" disabled={submitting || loading || error || blocked || sellable.length === 0}
            className="mt-4 min-h-[48px] w-full rounded-full bg-cta font-semibold text-dark hover:bg-cta-hover disabled:cursor-not-allowed disabled:bg-warm-soft disabled:text-dark/40">
            {submitting ? 'Placing your order…' : 'Place order'}
          </button>
        </aside>
      </form>
    </main>
  );
}
