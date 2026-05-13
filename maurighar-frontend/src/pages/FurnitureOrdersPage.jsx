import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Package, ChevronDown, ChevronUp,
  ShoppingBag, LogOut, Loader, Clock,
} from 'lucide-react';
import { useCartStore } from '../store/cartStore';

const STATUS = {
  PENDING:    { cls: 'bg-amber-50 text-amber-700 border-amber-200',   label: 'Pending' },
  CONFIRMED:  { cls: 'bg-blue-50 text-blue-700 border-blue-200',      label: 'Confirmed' },
  PROCESSING: { cls: 'bg-purple-50 text-purple-700 border-purple-200',label: 'Processing' },
  SHIPPED:    { cls: 'bg-indigo-50 text-indigo-700 border-indigo-200',label: 'Shipped' },
  DELIVERED:  { cls: 'bg-green-50 text-green-700 border-green-200',   label: 'Delivered' },
  CANCELLED:  { cls: 'bg-red-50 text-red-600 border-red-200',         label: 'Cancelled' },
};

function OrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);
  const s = STATUS[order.status] ?? { cls: 'bg-warm text-dark/50 border-warm-border', label: order.status };
  const date = new Date(order.orderedAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-2xl border border-warm-border overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 flex items-center gap-4 hover:bg-warm/30 transition-colors">
        <div className="w-11 h-11 rounded-2xl bg-[#e8dfc8] flex items-center justify-center flex-shrink-0">
          <Package size={18} className="text-[#8B6914]/50" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-sans font-semibold text-dark text-sm">
              #{order.id.toString().slice(-8).toUpperCase()}
            </p>
            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${s.cls}`}>
              {s.label}
            </span>
          </div>
          <p className="text-xs text-dark/40 font-sans mt-0.5 flex items-center gap-1.5">
            <Clock size={11} />
            {date} · {order.items.length} item{order.items.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
          <p className="font-serif text-xl text-dark">Rs {Number(order.totalAmount).toLocaleString()}</p>
          {expanded
            ? <ChevronUp size={14} className="text-dark/30" />
            : <ChevronDown size={14} className="text-dark/30" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-warm-border bg-warm/30 px-5 py-4 flex flex-col gap-3">
          <div className="divide-y divide-warm-border/60">
            {order.items.map((item, i) => (
              <div key={i} className="py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#e8dfc8] flex-shrink-0 flex items-center justify-center">
                  <Package size={13} className="text-[#8B6914]/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-dark truncate">
                    {item.productNameSnapshot}
                  </p>
                  <p className="text-xs text-dark/40 font-sans">
                    {item.quantity} × Rs {Number(item.unitPriceSnapshot).toLocaleString()}
                  </p>
                </div>
                <p className="font-sans font-semibold text-dark text-sm flex-shrink-0">
                  Rs {Number(item.subtotal).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          <div className="border-t border-warm-border pt-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] text-dark/40 font-sans uppercase tracking-wider mb-1">Delivery address</p>
              <p className="text-sm font-sans text-dark/70 leading-relaxed">{order.shippingAddress}</p>
              <p className="text-xs text-dark/40 font-sans mt-0.5">{order.phone}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[11px] text-dark/40 font-sans uppercase tracking-wider mb-1">Total</p>
              <p className="font-serif text-2xl text-dark">Rs {Number(order.totalAmount).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FurnitureOrdersPage() {
  const { setOpen } = useCartStore();
  const navigate = useNavigate();
  const [orders] = useState([]);
  const loading = false;

  useEffect(() => { navigate('/furniture'); }, [navigate]);

  return (
    <div className="min-h-screen bg-warm">

      {/* Sub-header */}
      <div className="bg-white border-b border-warm-border sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link to="/furniture"
              className="flex items-center gap-1.5 text-sm text-dark/50 hover:text-dark transition-colors font-sans">
              <ArrowLeft size={16} /> Shop
            </Link>
            <div className="w-px h-5 bg-warm-border" />
            <div>
              <h1 className="font-serif text-xl text-dark">My Orders</h1>
              {!loading && (
                <p className="text-xs text-dark/40 font-sans">
                  {orders.length} order{orders.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/furniture'); }}
            className="flex items-center gap-1.5 text-sm text-dark/40 hover:text-red-500 transition-colors font-sans">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 max-w-3xl">

        {/* Account card */}
        <div className="bg-white rounded-2xl border border-warm-border p-5 flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-full bg-gold/15 flex items-center justify-center flex-shrink-0">
            <span className="font-serif text-gold text-xl font-semibold">
              {customer?.fullName?.[0]?.toUpperCase() ?? 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-semibold text-dark truncate">{customer?.fullName}</p>
            <p className="text-xs text-dark/40 font-sans mt-0.5 truncate">{customer?.email}</p>
          </div>
          <button onClick={() => setOpen(true)} className="btn-outline text-xs px-3 py-1.5">
            <ShoppingBag size={13} /> Cart
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-dark/30">
            <Loader size={22} className="animate-spin" />
            <span className="font-sans text-sm">Loading orders…</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-24">
            <ShoppingBag size={48} strokeWidth={0.8} className="text-dark/10 mx-auto mb-4" />
            <p className="font-serif text-xl text-dark/40">No orders yet</p>
            <p className="text-sm text-dark/30 font-sans mt-2">Browse our furniture and place your first order.</p>
            <Link to="/furniture" className="btn-dark mt-6 inline-flex">Browse furniture</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}