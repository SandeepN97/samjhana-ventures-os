import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X, Plus, Minus, Trash2, ShoppingBag, CheckCircle,
  ChevronRight, ArrowLeft, MapPin, Phone,
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { getProductVisual } from './FurnitureIllustrations';
import { ordersApi, shopApi, mediaUrl, errorMessage } from '../api/api.js';
import { useSection } from '../site/SiteContext';
import { deliveryFeeFor } from '../utils/delivery';
import { formatMoney } from '../utils/format';

const fmt = (n) => Number(n).toLocaleString('en-IN');
const PHONE = /^\+?[0-9]{7,15}$/;

/* ── Cart step ─────────────────────────────────────────────── */
function CartStep({ onCheckout }) {
  const { items, removeItem, updateQty, total, count } = useCartStore();
  const furniture = useSection('furniture');
  const blocked = items.some((i) => i.unavailable);

  if (count === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-warm flex items-center justify-center">
        <ShoppingBag size={26} className="text-dark/20" />
      </div>
      <div>
        <p className="font-serif text-lg text-dark">Your cart is empty</p>
        <p className="text-sm text-dark/40 font-sans mt-1">{furniture.emptyCartText}</p>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto divide-y divide-warm-border">
        {items.map((item) => {
          const { Illustration, accent } = getProductVisual(item.name);
          return (
            <div key={item.id} className="px-5 py-4 flex items-center gap-3">
              {/* Mini thumbnail — photo if available, else SVG illustration */}
              <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-warm-border"
                style={{ backgroundColor: item.imageUrl ? '#f7f3ed' : accent.bg }}>
                {item.imageUrl
                  ? <img src={mediaUrl(item.imageUrl)} alt={item.name} className="w-full h-full object-cover" />
                  : <Illustration />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-dark text-sm leading-tight truncate">{item.name}</p>
                <p className="text-xs text-dark/40 font-sans mt-0.5">Rs {fmt(item.price)} each</p>
                {item.unavailable && <p role="alert" className="text-xs text-red-600 font-sans mt-0.5">No longer available — remove it to continue.</p>}
                {/* Qty controls */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button onClick={() => updateQty(item.id, item.qty - 1)} aria-label={`Fewer ${item.name}`}
                    className="w-6 h-6 rounded-lg border border-warm-border flex items-center justify-center hover:bg-warm text-dark/50 transition-colors">
                    <Minus size={10} />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-dark">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)} aria-label={`More ${item.name}`}
                    className="w-6 h-6 rounded-lg border border-warm-border flex items-center justify-center hover:bg-warm text-dark/50 transition-colors">
                    <Plus size={10} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <p className="font-serif text-base text-dark">Rs {fmt(item.price * item.qty)}</p>
                <button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}
                  className="text-dark/20 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-5 border-t border-warm-border bg-white">
        <div className="flex justify-between items-center mb-1">
          <p className="text-sm text-dark/50 font-sans">{count} item{count !== 1 ? 's' : ''}</p>
          <p className="font-serif text-2xl text-dark">Rs {fmt(total)}</p>
        </div>
        <p className="text-xs text-dark/30 font-sans mb-4">{furniture.cartNote}</p>
        <button onClick={onCheckout} disabled={blocked}
          className="btn-dark w-full justify-center gap-2 py-3.5 text-base disabled:opacity-40">
          Checkout <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

/* ── Checkout step ─────────────────────────────────────────── */
function CheckoutStep({ onSuccess, onBack }) {
  const { items, total, clearCart } = useCartStore();
  const shop = useSection('shop');
  const [form, setForm] = useState({ fullName: '', phone: '', fulfilment: 'DELIVERY', shippingAddress: '', city: '', website: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const sellable = items.filter((i) => !i.unavailable);
  const delivery = form.fulfilment === 'DELIVERY';
  const fee = delivery ? deliveryFeeFor(total, shop) : 0;

  const field = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const cls = 'w-full border border-warm-border rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors bg-white';

  const validate = () => {
    const e = {};
    if (form.fullName.trim().length < 2) e.fullName = 'Enter your name.';
    if (!PHONE.test(form.phone.replace(/[\s\-().]/g, ''))) e.phone = 'Enter a phone number we can call.';
    if (delivery && form.shippingAddress.trim().length < 3) e.shippingAddress = 'Enter the delivery address.';
    if (delivery && form.city.trim().length < 2) e.city = 'Enter your town or city.';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const order = await ordersApi.place({
        customerName: form.fullName.trim(),
        customerPhone: form.phone.trim(),
        fulfilment: form.fulfilment,
        addressLine: delivery ? form.shippingAddress.trim() : null,
        city: delivery ? form.city.trim() : null,
        items: sellable.map((i) => ({ slug: i.id, quantity: i.qty })),
        website: form.website,
      });
      clearCart();
      onSuccess({ order, phone: form.phone.trim() });
    } catch (err) {
      setServerError(err?.response?.status === 409
        ? `${errorMessage(err, 'Something in your cart ran out.')} Please check your cart.`
        : errorMessage(err, 'We couldn’t place your order. Please try again, or call us.'));
      setBusy(false);
    }
  };

  const err = (name) => errors[name] && <p role="alert" className="text-xs text-red-600 mt-1">{errors[name]}</p>;

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
      <div>
        <p className="font-serif text-xl text-dark">{delivery ? 'Delivery details' : 'Pickup details'}</p>
        <p className="text-xs text-dark/40 font-sans mt-1">We'll call you to confirm your order.</p>
      </div>

      {/* Order summary */}
      <div className="bg-warm rounded-2xl p-4 text-xs font-sans">
        <p className="text-dark/40 uppercase tracking-wide font-semibold text-[10px] mb-3">Order summary</p>
        <div className="space-y-1.5">
          {sellable.map((i) => (
            <div key={i.id} className="flex justify-between text-dark/60">
              <span className="truncate mr-4">{i.name} ×{i.qty}</span>
              <span className="flex-shrink-0 font-semibold text-dark">Rs {fmt(i.price * i.qty)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-dark/60 pt-3 mt-3 border-t border-warm-border">
          <span>{delivery ? 'Delivery' : 'Pickup'}</span><span>{fee > 0 ? formatMoney(fee) : 'Free'}</span>
        </div>
        <div className="flex justify-between font-semibold text-dark pt-2 mt-2 border-t border-warm-border text-sm">
          <span>Total</span>
          <span className="font-serif text-base">Rs {fmt(total + fee)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How would you like it?">
          {[['DELIVERY', 'Delivery'], ['PICKUP', 'Pick up at the shop']].map(([value, label]) => (
            <label key={value} className={`min-h-[44px] flex items-center justify-center text-center rounded-xl border text-xs font-semibold cursor-pointer px-2 ${form.fulfilment === value ? 'border-gold bg-gold/10 text-dark' : 'border-warm-border text-dark/50'}`}>
              <input type="radio" name="fulfilment" value={value} checked={form.fulfilment === value} onChange={field('fulfilment')} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-dark/40 font-sans">{delivery ? shop.deliveryNote : shop.pickupNote}</p>
        <div>
          <label htmlFor="cd-name" className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5">Full name</label>
          <input id="cd-name" value={form.fullName} onChange={field('fullName')} placeholder="Your name" className={cls} />
          {err('fullName')}
        </div>
        <div>
          <label htmlFor="cd-phone" className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
            <Phone size={11} /> Phone number
          </label>
          <input id="cd-phone" type="tel" value={form.phone} onChange={field('phone')} placeholder="+977-98xxxxxxxx" className={cls} />
          {err('phone')}
        </div>
        {delivery && (
          <>
            <div>
              <label htmlFor="cd-address" className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                <MapPin size={11} /> Delivery address
              </label>
              <textarea id="cd-address" value={form.shippingAddress} onChange={field('shippingAddress')} rows={2}
                placeholder="Village / Ward No., Gulmi district…" className={`${cls} resize-none`} />
              {err('shippingAddress')}
            </div>
            <div>
              <label htmlFor="cd-city" className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5">Town or city</label>
              <input id="cd-city" value={form.city} onChange={field('city')} className={cls} />
              {err('city')}
            </div>
          </>
        )}
        {/* Real visitors never see or fill this; a form-filling bot usually does. */}
        <div className="absolute -left-[9999px]" aria-hidden="true">
          <label htmlFor="cd-website">Website</label>
          <input id="cd-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={field('website')} />
        </div>
        {serverError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{serverError}</p>}
        <button type="submit" disabled={busy || sellable.length === 0} className="btn-dark justify-center py-3.5 gap-2 mt-1 text-base disabled:opacity-40">
          {busy ? 'Placing your order…' : `Place order · Rs ${fmt(total + fee)}`}
        </button>
      </form>

      <button onClick={onBack} className="text-xs text-dark/40 hover:text-dark transition-colors font-sans flex items-center justify-center gap-1">
        <ArrowLeft size={12} /> Back to cart
      </button>
    </div>
  );
}

/* ── Drawer shell ──────────────────────────────────────────── */
export default function CartDrawer() {
  const { open, setOpen, count, items, syncProducts } = useCartStore();
  const [step, setStep] = useState('cart');
  const [placed, setPlaced] = useState(null);
  const slugs = items.map((i) => i.id).sort().join(',');

  // Whenever the cart is opened, bring its prices and availability up to date with the shop.
  useEffect(() => {
    if (!open || !slugs) return;
    shopApi.products({ slugs, size: 60 }).then((data) => syncProducts(data.items || [])).catch(() => {});
  }, [open, slugs, syncProducts]);

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => { setStep('cart'); setPlaced(null); }, 320);
  };

  const titles = { cart: 'Cart', checkout: 'Checkout', success: 'Order placed!' };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 bg-dark/40 z-[55] backdrop-blur-sm" onClick={handleClose} />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-[420px] bg-white z-[56] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-border bg-white">
          <div className="flex items-center gap-3">
            {step !== 'cart' && step !== 'success' && (
              <button onClick={() => setStep('cart')} aria-label="Back to cart"
                className="w-8 h-8 rounded-full hover:bg-warm flex items-center justify-center text-dark/40 hover:text-dark transition-colors">
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <p className="font-serif text-lg text-dark leading-none">{titles[step]}</p>
              {step === 'cart' && count > 0 && (
                <p className="text-xs text-dark/40 font-sans mt-0.5">{count} item{count !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} aria-label="Close cart"
            className="w-8 h-8 rounded-full hover:bg-warm flex items-center justify-center text-dark/40 hover:text-dark transition-colors">
            <X size={17} />
          </button>
        </div>

        {/* Content */}
        {step === 'success' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center">
              <CheckCircle size={40} className="text-gold" />
            </div>
            <div>
              <p className="font-serif text-2xl text-dark">Thank you!</p>
              <p className="text-sm text-dark/50 font-sans mt-2 leading-relaxed max-w-xs">
                Your order has been received. We'll call you to confirm the details.
              </p>
              {placed && (
                <p className="text-sm text-dark mt-3 font-sans">
                  Order number <span className="font-mono font-semibold">{placed.order.orderNumber}</span>
                  <br />
                  <Link to={`/order/${placed.order.orderNumber}`} state={{ order: placed.order, phone: placed.phone, placed: true }} onClick={handleClose}
                    className="text-gold underline">Track this order</Link>
                </p>
              )}
            </div>
            <button onClick={handleClose} className="btn-dark mt-2 gap-2">
              Continue shopping
            </button>
          </div>
        ) : step === 'checkout' ? (
          <CheckoutStep
            onSuccess={(result) => { setPlaced(result); setStep('success'); }}
            onBack={() => setStep('cart')}
          />
        ) : (
          <CartStep onCheckout={() => setStep('checkout')} />
        )}
      </div>
    </>
  );
}