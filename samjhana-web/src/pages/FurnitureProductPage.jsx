import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ShoppingCart, Zap, Star, ChevronRight,
  Loader, AlertCircle, Shield, Truck, Plus, Minus, Check,
} from 'lucide-react';
import { furnitureApi } from '../api/api.js';
import { useCartStore } from '../store/cartStore';
import { getProductVisual } from '../components/FurnitureIllustrations';

function StarRow({ rating = 4.8, count = 24 }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex">
        {[1,2,3,4,5].map((i) => (
          <Star key={i} size={14} className={i <= Math.round(rating) ? 'fill-gold text-gold' : 'fill-warm-border text-warm-border'} />
        ))}
      </div>
      <span className="font-sans text-sm text-dark/40">{rating} ({count} reviews)</span>
    </div>
  );
}

function RelatedCard({ product }) {
  const { addItem } = useCartStore();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  const { Illustration, accent } = getProductVisual(product.name);

  const price = Number(product.sellingPrice ?? 0);

  const handleAdd = (e) => {
    e.stopPropagation();
    addItem({ ...product, price }, 1, false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div onClick={() => navigate(`/furniture/${product.id}`)}
      className="group bg-white rounded-2xl overflow-hidden cursor-pointer flex flex-col
        shadow-[0_2px_12px_rgba(30,18,6,0.06)] hover:shadow-[0_8px_28px_rgba(30,18,6,0.12)]
        transition-all duration-300 hover:-translate-y-1">
      <div className="relative overflow-hidden h-36" style={{ backgroundColor: accent.bg }}>
        <Illustration />
        {product.stockQty === 0 && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-xs font-semibold text-dark/40 bg-white px-3 py-1 rounded-full border border-warm-border">Out of stock</span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="font-sans font-semibold text-dark text-sm leading-tight line-clamp-2 group-hover:text-gold transition-colors">{product.name}</p>
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className="font-serif text-lg text-dark">Rs {price.toLocaleString()}</p>
          <button onClick={handleAdd} disabled={product.stockQty === 0}
            className="w-8 h-8 rounded-xl bg-warm hover:bg-gold hover:text-white text-dark/50 transition-colors flex items-center justify-center disabled:opacity-30 flex-shrink-0">
            {added ? <Check size={13} className="text-green-600" /> : <ShoppingCart size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FurnitureProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty]         = useState(1);
  const [added, setAdded]     = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const setOpen = useCartStore((s) => s.setOpen);

  useEffect(() => {
    setLoading(true);
    setQty(1);
    furnitureApi.getItem(id)
      .then((p) => {
        setProduct(p);
        return furnitureApi.getItems();
      })
      .then((all) => setRelated(all.filter((p) => p.id !== id).slice(0, 4)))
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [id]);

  const price = Number(product?.sellingPrice ?? 0);

  const handleAddToCart = () => {
    addItem({ ...product, price }, qty, false);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleOrderNow = () => {
    addItem({ ...product, price }, qty, false);
    setOpen(true);
  };

  if (loading) return (
    <div className="min-h-screen bg-warm flex items-center justify-center">
      <Loader size={28} className="animate-spin text-dark/30" />
    </div>
  );

  if (!product) return (
    <div className="min-h-screen bg-warm flex flex-col items-center justify-center gap-4">
      <AlertCircle size={40} className="text-dark/20" />
      <p className="font-serif text-xl text-dark/40">Product not found</p>
      <Link to="/furniture" className="btn-outline text-sm">Back to catalogue</Link>
    </div>
  );

  const inStock   = product.stockQty > 0;
  const lowStock  = product.stockQty > 0 && product.stockQty <= 3;
  const stockInfo = !inStock
    ? { cls: 'bg-red-50 text-red-600 border-red-200',     label: 'Out of stock' }
    : lowStock
    ? { cls: 'bg-amber-50 text-amber-700 border-amber-200', label: `Only ${product.stockQty} left` }
    : { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'In stock' };

  const { Illustration, accent } = getProductVisual(product.name);

  return (
    <div className="min-h-screen bg-warm">

      {/* Sticky breadcrumb */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-warm-border sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-2 text-sm font-sans overflow-x-auto whitespace-nowrap">
          <Link to="/#furniture" className="text-dark/35 hover:text-dark transition-colors shrink-0">Home</Link>
          <ChevronRight size={13} className="text-dark/20 shrink-0" />
          <Link to="/furniture" className="text-dark/35 hover:text-dark transition-colors shrink-0">Furniture</Link>
          <ChevronRight size={13} className="text-dark/20 shrink-0" />
          <span className="text-dark font-medium truncate">{product.name}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* ── Main product block ── */}
        <div className="grid lg:grid-cols-[55%_45%] gap-12 lg:gap-16 mb-24">

          {/* Illustration panel — sticky on desktop */}
          <div className="lg:sticky lg:top-32 lg:self-start">
            <div className="rounded-3xl overflow-hidden aspect-[4/3] shadow-[0_8px_40px_rgba(30,18,6,0.10)]"
              style={{ backgroundColor: accent.bg }}>
              <Illustration />
            </div>
            {/* Stock + rating pill strip */}
            <div className="flex items-center gap-3 mt-4">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${stockInfo.cls}`}>
                {stockInfo.label}
              </span>
              <StarRow />
            </div>
          </div>

          {/* Details panel */}
          <div className="flex flex-col gap-7">

            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-gold/70 mb-2">
                Handcrafted Furniture · Gulmi, Nepal
              </p>
              <h1 className="font-serif text-3xl lg:text-4xl text-dark leading-tight">{product.name}</h1>
            </div>

            <p className="font-serif text-4xl text-dark">
              Rs {price.toLocaleString()}
            </p>

            <p className="text-dark/60 text-[15px] leading-relaxed font-sans">
              {product.description || 'Handcrafted with care using premium Nepali hardwood. Built to last generations with traditional joinery techniques.'}
            </p>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: Truck,   label: 'Free delivery', sub: 'Gulmi district' },
                { Icon: Shield,  label: '2-year warranty', sub: 'Guaranteed' },
                { Icon: Star,    label: 'Handcrafted', sub: 'Premium wood' },
              ].map(({ Icon, label, sub }) => (
                <div key={label} className="bg-white rounded-2xl p-3 flex flex-col items-center text-center gap-1.5
                  shadow-[0_2px_8px_rgba(30,18,6,0.05)]">
                  <div className="w-8 h-8 rounded-xl bg-gold/10 flex items-center justify-center">
                    <Icon size={14} className="text-gold" />
                  </div>
                  <p className="font-sans font-semibold text-dark text-[11px] leading-tight">{label}</p>
                  <p className="text-[10px] text-dark/35 font-sans">{sub}</p>
                </div>
              ))}
            </div>

            {/* Qty selector */}
            {inStock && (
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-dark/40 font-sans uppercase tracking-wide text-[11px]">Quantity</span>
                <div className="flex items-center bg-white border border-warm-border rounded-2xl overflow-hidden shadow-sm">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-11 h-11 flex items-center justify-center hover:bg-warm text-dark/40 hover:text-dark transition-colors">
                    <Minus size={14} />
                  </button>
                  <span className="w-11 text-center font-serif text-lg text-dark">{qty}</span>
                  <button onClick={() => setQty((q) => Math.min(product.stockQty, q + 1))}
                    className="w-11 h-11 flex items-center justify-center hover:bg-warm text-dark/40 hover:text-dark transition-colors">
                    <Plus size={14} />
                  </button>
                </div>
                {qty > 1 && (
                  <span className="text-sm text-dark/40 font-sans">
                    = Rs {(price * qty).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="flex gap-3">
              <button onClick={handleOrderNow} disabled={!inStock}
                className="flex-1 min-h-[52px] bg-dark text-white font-sans font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-dark/90 transition-colors disabled:opacity-40">
                <Zap size={16} /> Order now
              </button>
              <button onClick={handleAddToCart} disabled={!inStock}
                className="flex-1 min-h-[52px] border border-warm-border bg-white font-sans font-semibold text-dark rounded-2xl flex items-center justify-center gap-2 hover:bg-warm transition-colors disabled:opacity-40 shadow-sm">
                {added
                  ? <><Check size={16} className="text-emerald-600" /> Added to cart</>
                  : <><ShoppingCart size={16} /> Add to cart</>
                }
              </button>
            </div>

            <p className="text-xs text-dark/25 font-sans text-center">
              Questions? Call us: +977-9800000000 · Based in Gulmi, Nepal
            </p>
          </div>
        </div>

        {/* ── Related products ── */}
        {related.length > 0 && (
          <div>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="font-serif text-2xl text-dark">More pieces you'll love</h2>
              <div className="flex-1 h-px bg-warm-border" />
              <Link to="/furniture" className="text-sm font-medium text-gold flex items-center gap-1 hover:underline font-sans shrink-0">
                View all <ChevronRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {related.map((p) => <RelatedCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>

      {/* Mobile sticky CTA bar */}
      {inStock && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-warm-border px-4 py-3 z-40 flex gap-3 shadow-lg">
          <button onClick={handleAddToCart}
            className="flex-1 min-h-[48px] border border-warm-border bg-white text-dark font-sans font-semibold text-sm rounded-xl flex items-center justify-center gap-2">
            {added ? <><Check size={14} className="text-emerald-600" /> Added</> : <><ShoppingCart size={14} /> Add to cart</>}
          </button>
          <button onClick={handleOrderNow}
            className="flex-1 min-h-[48px] bg-dark text-white font-sans font-semibold text-sm rounded-xl flex items-center justify-center gap-2">
            <Zap size={14} /> Order now
          </button>
        </div>
      )}
    </div>
  );
}