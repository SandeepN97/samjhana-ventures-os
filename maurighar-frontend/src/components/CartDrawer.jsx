import { useState } from 'react';
import {
  X, Plus, Minus, Trash2, ShoppingBag, CheckCircle,
  ChevronRight, ArrowLeft, MapPin, Phone,
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { getProductVisual } from './FurnitureIllustrations';

const fmt = (n) => Number(n).toLocaleString();

/* ── Cart step ─────────────────────────────────────────────── */
function CartStep({ onCheckout }) {
  const { items, removeItem, updateQty, total, count } = useCartStore();

  if (count === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-full bg-warm flex items-center justify-center">
        <ShoppingBag size={26} className="text-dark/20" />
      </div>
      <div>
        <p className="font-serif text-lg text-dark">Your cart is empty</p>
        <p className="text-sm text-dark/40 font-sans mt-1">Browse our furniture and add pieces to get started.</p>
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
                  ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                  : <Illustration />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-sans font-semibold text-dark text-sm leading-tight truncate">{item.name}</p>
                <p className="text-xs text-dark/40 font-sans mt-0.5">Rs {fmt(item.price)} each</p>
                {/* Qty controls */}
                <div className="flex items-center gap-1.5 mt-2">
                  <button onClick={() => updateQty(item.id, item.qty - 1)}
                    className="w-6 h-6 rounded-lg border border-warm-border flex items-center justify-center hover:bg-warm text-dark/50 transition-colors">
                    <Minus size={10} />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-dark">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, item.qty + 1)}
                    className="w-6 h-6 rounded-lg border border-warm-border flex items-center justify-center hover:bg-warm text-dark/50 transition-colors">
                    <Plus size={10} />
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <p className="font-serif text-base text-dark">Rs {fmt(item.price * item.qty)}</p>
                <button onClick={() => removeItem(item.id)}
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
        <p className="text-xs text-dark/30 font-sans mb-4">Free delivery within Gulmi district</p>
        <button onClick={onCheckout}
          className="btn-dark w-full justify-center gap-2 py-3.5 text-base">
          Checkout <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

/* ── Checkout step ─────────────────────────────────────────── */
function CheckoutStep({ onSuccess, onBack }) {
  const { items, total, clearCart } = useCartStore();
  const [form, setForm] = useState({ fullName: '', phone: '', shippingAddress: '' });

  const field = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));
  const cls = 'w-full border border-warm-border rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors bg-white';

  const handleSubmit = (e) => {
    e.preventDefault();
    clearCart();
    onSuccess();
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
      <div>
        <p className="font-serif text-xl text-dark">Delivery details</p>
        <p className="text-xs text-dark/40 font-sans mt-1">We'll call you to confirm your order.</p>
      </div>

      {/* Order summary */}
      <div className="bg-warm rounded-2xl p-4 text-xs font-sans">
        <p className="text-dark/40 uppercase tracking-wide font-semibold text-[10px] mb-3">Order summary</p>
        <div className="space-y-1.5">
          {items.map((i) => (
            <div key={i.id} className="flex justify-between text-dark/60">
              <span className="truncate mr-4">{i.name} ×{i.qty}</span>
              <span className="flex-shrink-0 font-semibold text-dark">Rs {fmt(i.price * i.qty)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between font-semibold text-dark pt-3 mt-3 border-t border-warm-border text-sm">
          <span>Total</span>
          <span className="font-serif text-base">Rs {fmt(total)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5">Full name</label>
          <input value={form.fullName} onChange={field('fullName')} placeholder="Your name" required className={cls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
            <Phone size={11} /> Phone number
          </label>
          <input value={form.phone} onChange={field('phone')} required placeholder="+977-98xxxxxxxx" className={cls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-dark/50 font-sans uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
            <MapPin size={11} /> Delivery address
          </label>
          <textarea value={form.shippingAddress} onChange={field('shippingAddress')} required rows={3}
            placeholder="Village / Ward No., Gulmi district…"
            className={`${cls} resize-none`} />
        </div>
        <button type="submit" className="btn-dark justify-center py-3.5 gap-2 mt-1 text-base">
          Place order · Rs {fmt(total)}
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
  const { open, setOpen, count } = useCartStore();
  const [step, setStep] = useState('cart');

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setStep('cart'), 320);
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
              <button onClick={() => setStep('cart')}
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
          <button onClick={handleClose}
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
                Your order has been received. We'll call you to confirm delivery details.
              </p>
            </div>
            <button onClick={handleClose} className="btn-dark mt-2 gap-2">
              Continue shopping
            </button>
          </div>
        ) : step === 'checkout' ? (
          <CheckoutStep
            onSuccess={() => setStep('success')}
            onBack={() => setStep('cart')}
          />
        ) : (
          <CartStep onCheckout={() => setStep('checkout')} />
        )}
      </div>
    </>
  );
}