import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, ShoppingCart, ArrowRight,
  Package, LogOut, X, ChevronDown, Sparkles,
} from 'lucide-react';
import { furnitureApi } from '../api/api.js';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import CustomOrderModal from '../components/CustomOrderModal';
import { getProductVisual } from '../components/FurnitureIllustrations';

/* ─── Categories ─────────────────────────────────── */
const CATS = [
  { id: 'All',      label: 'All pieces',    fn: () => true },
  { id: 'SOFA',     label: 'Sofa',          fn: (p) => p.category === 'SOFA' },
  { id: 'BED',      label: 'Bedroom',       fn: (p) => p.category === 'BED' },
  { id: 'TABLE',    label: 'Table',         fn: (p) => p.category === 'TABLE' },
  { id: 'CHAIR',    label: 'Chair',         fn: (p) => p.category === 'CHAIR' },
  { id: 'CABINET',  label: 'Cabinet',       fn: (p) => p.category === 'CABINET' || p.category === 'WARDROBE' },
  { id: 'SHELF',    label: 'Shelf',         fn: (p) => p.category === 'SHELF' },
];

const SORTS = [
  { id: 'default',    label: 'Featured' },
  { id: 'price-asc',  label: 'Price: Low to High' },
  { id: 'price-desc', label: 'Price: High to Low' },
  { id: 'name',       label: 'Name A–Z' },
];

const fmt = (n) => Number(n).toLocaleString();

/* ─── Product card ───────────────────────────────── */
function ProductCard({ product, featured = false }) {
  const { addItem } = useCartStore();
  const navigate    = useNavigate();
  const [added, setAdded] = useState(false);
  const { Illustration, accent } = getProductVisual(product.name);
  const outOfStock = product.stockQty === 0;
  const lowStock   = product.stockQty > 0 && product.stockQty <= 3;

  const price = Number(product.sellingPrice ?? 0);

  const handleAdd = (e) => {
    e.stopPropagation();
    if (outOfStock) return;
    addItem({ ...product, price }, 1, false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div
      onClick={() => navigate(`/furniture/${product.id}`)}
      className={`group bg-white rounded-3xl overflow-hidden cursor-pointer flex flex-col
        transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5
        shadow-[0_2px_12px_rgba(30,18,6,0.06)]
        ${featured ? 'lg:col-span-2 lg:flex-row' : ''}`}>

      {/* Image */}
      <div
        className={`relative overflow-hidden flex-shrink-0 ${featured ? 'lg:w-[52%] h-64 lg:h-auto' : 'h-52'}`}
        style={{ backgroundColor: accent.bg }}>
        <div className="absolute inset-0 group-hover:scale-105 transition-transform duration-500 ease-out">
          <Illustration />
        </div>

        {/* Badges */}
        {lowStock && (
          <span className="absolute top-3 left-3 bg-amber-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
            Only {product.stockQty} left
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-3 left-3 bg-dark/60 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
            Out of stock
          </span>
        )}
        {featured && (
          <span className="absolute top-3 left-3 bg-gold text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Sparkles size={9} /> Bestseller
          </span>
        )}

        {/* Quick-add float */}
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className="absolute bottom-3 right-3 h-9 px-4 rounded-full bg-white/95 backdrop-blur-sm
            shadow-lg text-xs font-semibold text-dark flex items-center gap-1.5
            opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0
            hover:bg-gold hover:text-white
            transition-all duration-250 disabled:opacity-0">
          {added ? '✓ Added' : <><ShoppingCart size={12} /> Add</>}
        </button>
      </div>

      {/* Info */}
      <div className={`p-5 flex flex-col gap-3 flex-1 ${featured ? 'justify-center lg:py-8 lg:px-8' : ''}`}>
        {featured && (
          <p className="text-xs text-gold font-semibold uppercase tracking-widest font-sans">Featured piece</p>
        )}
        <div className="flex-1">
          <p className="font-sans font-semibold text-dark leading-snug line-clamp-2
            group-hover:text-gold transition-colors duration-200
            text-[15px]">
            {product.name}
          </p>
          {featured && (
            <p className="text-sm text-dark/50 font-sans mt-2 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between">
          <p className="font-serif text-2xl text-dark">Rs {fmt(price)}</p>
          <span className="text-xs text-dark/30 font-sans group-hover:text-gold transition-colors">
            View →
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────── */
export default function FurnitureCataloguePage() {
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [catId, setCatId]         = useState('All');
  const [sort, setSort]           = useState('default');
  const [showSort, setShowSort]   = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const searchRef = useRef(null);

  const { count, setOpen } = useCartStore();
  const { customer, token, logout } = useAuthStore();

  useEffect(() => {
    furnitureApi.getItems().then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  }, []);

  const cat = CATS.find((c) => c.id === catId) ?? CATS[0];
  const filtered = products
    .filter(cat.fn)
    .filter((p) => !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'price-asc')  return Number(a.sellingPrice) - Number(b.sellingPrice);
      if (sort === 'price-desc') return Number(b.sellingPrice) - Number(a.sellingPrice);
      if (sort === 'name')       return a.name.localeCompare(b.name);
      return 0;
    });

  const featured = filtered[0];
  const rest     = filtered.slice(1);
  const currentSort = SORTS.find((s) => s.id === sort) ?? SORTS[0];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf8f5' }}>

      {/* ── Top nav bar ── */}
      <div className="bg-white/90 backdrop-blur-md border-b border-warm-border sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/#furniture"
              className="flex items-center gap-1.5 text-sm text-dark/50 hover:text-dark transition-colors font-sans shrink-0 group">
              <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:block">Back</span>
            </Link>
            <div className="w-px h-4 bg-warm-border" />
            <span className="font-serif text-base text-dark shrink-0">Furniture</span>
            {!loading && (
              <span className="text-xs text-dark/30 font-sans hidden md:block">
                · {filtered.length} piece{filtered.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-1 shrink-0">
            {token && (
              <>
                <Link to="/furniture/orders"
                  className="hidden sm:flex items-center gap-1.5 text-xs text-dark/50 hover:text-dark font-sans px-3 py-1.5 rounded-xl hover:bg-warm transition-colors">
                  <Package size={13} /> My Orders
                </Link>
                <button onClick={logout}
                  className="hidden sm:flex items-center gap-1 text-xs text-dark/30 hover:text-red-400 transition-colors font-sans px-2 py-1.5 rounded-xl hover:bg-warm">
                  <LogOut size={13} />
                </button>
              </>
            )}
            <button onClick={() => setOpen(true)} className="relative p-2.5 text-dark/60 hover:text-dark transition-colors">
              <ShoppingCart size={19} />
              {count > 0 && (
                <span className="absolute top-0.5 right-0.5 w-[18px] h-[18px] bg-gold text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e1206 0%, #2d1a0a 100%)' }}>
        {/* Grain texture */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 4px)' }} />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20 flex flex-col sm:flex-row items-center gap-10">
          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 bg-gold/20 border border-gold/30 rounded-full px-3 py-1 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              <span className="text-[11px] text-gold font-semibold uppercase tracking-widest font-sans">Gulmi, Nepal · Est. 2008</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white leading-[1.1]">
              Built to last.<br />
              <em className="not-italic text-gold">Crafted</em> with care.
            </h1>
            <p className="text-white/40 font-sans text-sm mt-5 max-w-sm leading-relaxed">
              Every piece is hand-built in our Gulmi workshop using premium Nepali hardwood and traditional joinery techniques.
            </p>
            <div className="flex gap-3 mt-8 flex-wrap">
              <button
                onClick={() => searchRef.current?.focus()}
                className="btn-gold text-sm gap-2">
                Browse collection <ArrowRight size={14} />
              </button>
              <button onClick={() => setShowCustom(true)}
                className="inline-flex items-center gap-2 border border-white/20 text-white/70 hover:text-white hover:border-white/40 text-sm font-medium px-5 py-2.5 rounded transition-colors">
                Custom order
              </button>
            </div>
          </div>

          {/* Floating product cards */}
          {!loading && products.length > 0 && (
            <div className="relative w-full sm:w-72 h-52 shrink-0 hidden sm:block">
              {products.slice(0, 3).map((p, i) => {
                const { Illustration, accent } = getProductVisual(p.name);
                const offsets = [
                  'top-0 right-0 w-44 h-44 z-30 rotate-2',
                  'top-8 right-36 w-36 h-36 z-20 -rotate-3',
                  'top-20 right-16 w-28 h-28 z-10 rotate-1',
                ];
                return (
                  <div key={p.id} className={`absolute rounded-2xl overflow-hidden shadow-2xl border border-white/10 ${offsets[i]}`}
                    style={{ backgroundColor: accent.bg }}>
                    <Illustration />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Category tabs ── */}
      <div className="bg-white border-b border-warm-border sticky top-[112px] z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-8">
          <div className="flex items-center gap-1 overflow-x-auto py-0 scrollbar-hide">
            {CATS.map((c) => {
              const n = products.filter(c.fn).length;
              const active = c.id === catId;
              return (
                <button key={c.id} onClick={() => { setCatId(c.id); setSearch(''); }}
                  className={`flex-shrink-0 flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap
                    ${active
                      ? 'border-dark text-dark font-semibold'
                      : 'border-transparent text-dark/50 hover:text-dark hover:border-dark/20'}`}>
                  {c.label}
                  {!loading && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full transition-colors
                      ${active ? 'bg-dark text-white' : 'bg-warm text-dark/40'}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">

        {/* Search + sort */}
        <div className="flex gap-3 mb-8 items-center">
          <div className="relative flex-1 max-w-lg">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark/30 pointer-events-none" />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${catId === 'All' ? 'furniture' : cat.label.toLowerCase()}…`}
              className="w-full bg-white border border-warm-border rounded-2xl pl-11 pr-10 py-3 text-sm font-sans
                focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold/60
                shadow-sm placeholder:text-dark/30 transition-shadow" />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-dark/30 hover:text-dark transition-colors">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <button onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-2 bg-white border border-warm-border rounded-2xl px-4 py-3 text-sm font-medium text-dark/60 hover:text-dark hover:border-dark/30 transition-colors shadow-sm whitespace-nowrap">
              {currentSort.label}
              <ChevronDown size={14} className={`transition-transform ${showSort ? 'rotate-180' : ''}`} />
            </button>
            {showSort && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSort(false)} />
                <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-warm-border z-20 overflow-hidden min-w-[180px]">
                  {SORTS.map((s) => (
                    <button key={s.id} onClick={() => { setSort(s.id); setShowSort(false); }}
                      className={`w-full text-left px-4 py-3 text-sm font-sans transition-colors
                        ${sort === s.id ? 'bg-warm text-dark font-semibold' : 'text-dark/60 hover:bg-warm/60 hover:text-dark'}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-5">
            <div className="relative w-14 h-14">
              <div className="w-14 h-14 rounded-full border-2 border-warm-border" />
              <div className="absolute inset-0 w-14 h-14 rounded-full border-2 border-t-gold animate-spin" />
            </div>
            <p className="font-sans text-sm text-dark/30 tracking-wide">Loading collection…</p>
          </div>

        ) : filtered.length === 0 ? (
          <div className="text-center py-40">
            <div className="w-20 h-20 rounded-3xl bg-warm mx-auto mb-6 flex items-center justify-center">
              <Search size={28} className="text-dark/20" />
            </div>
            <p className="font-serif text-2xl text-dark/40 mb-2">No matches found</p>
            <p className="text-sm text-dark/30 font-sans mb-8">Try a different search or browse all categories.</p>
            <button onClick={() => { setSearch(''); setCatId('All'); }}
              className="btn-dark text-sm">Show all furniture</button>
          </div>

        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {/* Featured first card spans 2 cols on large screens */}
            {featured && catId === 'All' && !search && (
              <ProductCard product={featured} featured key={featured.id} />
            )}

            {/* Rest of the products */}
            {(catId === 'All' && !search ? rest : filtered).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}

            {/* Custom order card */}
            <button onClick={() => setShowCustom(true)}
              className="rounded-3xl border-2 border-dashed border-gold/25 p-6
                flex flex-col items-center justify-center gap-4 text-center
                hover:border-gold/50 hover:bg-gold/5 transition-all duration-300
                cursor-pointer min-h-[280px] group">
              <div className="w-16 h-16 rounded-2xl bg-gold/10 group-hover:bg-gold/20
                flex items-center justify-center transition-colors text-3xl">
                ✏️
              </div>
              <div>
                <p className="font-serif text-lg text-dark">Custom build</p>
                <p className="text-xs text-dark/40 font-sans mt-1.5 leading-relaxed max-w-[160px]">
                  Your dimensions, wood choice, and finish — built from scratch.
                </p>
              </div>
              <span className="text-xs font-semibold text-gold flex items-center gap-1.5">
                Request a quote <ArrowRight size={12} />
              </span>
            </button>
          </div>
        )}
      </div>

      {showCustom && <CustomOrderModal onClose={() => setShowCustom(false)} />}
    </div>
  );
}