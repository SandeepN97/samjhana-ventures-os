import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Sofa, ShoppingCart, Eye, Loader } from 'lucide-react';
import { furnitureApi } from '../api/api.js';
import { useCartStore } from '../store/cartStore';
import ProductModal from './ProductModal';
import CustomOrderModal from './CustomOrderModal';

const FILTERS = ['All pieces', 'Sofa', 'Bed', 'Table', 'Chair', 'Cabinet', 'Custom order'];

const CATEGORY_MAP = {
  'All pieces':   null,
  'Sofa':         'SOFA',
  'Bed':          'BED',
  'Table':        'TABLE',
  'Chair':        'CHAIR',
  'Cabinet':      'CABINET',
  'Custom order': null,
};

function ProductCard({ product, onView, compact }) {
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const price = Number(product.sellingPrice ?? 0);

  const handleAdd = (e) => {
    e.stopPropagation();
    addItem({ ...product, price }, 1, false);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  if (compact) return (
    <div onClick={() => onView(product)}
      className="bg-white rounded-2xl border border-warm-border p-4 flex items-center gap-3 hover:shadow-sm transition-all cursor-pointer group">
      <div className="w-12 h-12 rounded-xl bg-[#e8dfc8] flex items-center justify-center flex-shrink-0">
        <Sofa size={20} strokeWidth={1.5} className="text-dark/20" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans font-medium text-dark text-sm truncate">{product.name}</p>
        <p className="font-serif text-base text-dark mt-0.5">Rs {price.toLocaleString()}</p>
      </div>
      <button onClick={handleAdd}
        className="w-8 h-8 rounded-full bg-warm flex items-center justify-center hover:bg-gold hover:text-white transition-colors text-dark/40 flex-shrink-0">
        {added ? '✓' : <ShoppingCart size={13} />}
      </button>
    </div>
  );

  return (
    <div onClick={() => onView(product)}
      className="bg-white rounded-2xl border border-warm-border overflow-hidden hover:shadow-md transition-all cursor-pointer group flex flex-col">
      <div className="bg-[#e8dfc8] h-32 flex items-center justify-center relative">
        <Sofa size={40} strokeWidth={1.2} className="text-dark/15" />
        <div className="absolute inset-0 bg-dark/0 group-hover:bg-dark/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="bg-white text-dark text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
            <Eye size={12} /> View
          </span>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex-1">
          <p className="font-sans font-medium text-dark text-sm leading-tight">{product.name}</p>
          <p className="text-xs text-dark/40 font-sans mt-1 line-clamp-2">{product.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <p className="font-serif text-lg text-dark">Rs {price.toLocaleString()}</p>
          <button onClick={handleAdd}
            className="text-xs font-medium px-3 py-1.5 rounded-xl bg-warm hover:bg-gold hover:text-white text-dark/60 transition-colors">
            {added ? '✓ Added' : '+ Cart'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FurnitureSection() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All pieces');
  const [showAll, setShowAll] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCustomOrder, setShowCustomOrder] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();

  useEffect(() => {
    furnitureApi.getItems()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const handleFilter = (f) => {
    if (f === 'Custom order') { setShowCustomOrder(true); return; }
    setFilter(f);
    setShowAll(false);
  };

  const cat = CATEGORY_MAP[filter];
  const filtered = cat ? products.filter((p) => p.category === cat) : products;

  const featured  = filtered[0] ?? null;
  const sidebar   = filtered.slice(1, 3);
  const gridItems = showAll ? filtered.slice(3) : filtered.slice(3, 6);
  const remaining = filtered.length - 3 - 6;

  const featuredPrice = Number(featured?.sellingPrice ?? 0);

  return (
    <section id="furniture" className="py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-6">

        <div className="flex items-center gap-4 mb-10">
          <div className="flex items-center gap-2.5">
            <span className="bg-gold text-white text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full">Highlight</span>
            <span className="section-label">Section 01</span>
          </div>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <h2 className="font-serif text-4xl lg:text-5xl text-dark">Furniture</h2>
          <Link to="/furniture"
            className="text-sm font-medium text-gold flex items-center gap-1 hover:underline">
            Full catalogue <ArrowRight size={14} />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-10">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => handleFilter(f)}
              className={`pill ${filter === f && f !== 'Custom order' ? 'pill-active' : 'pill-inactive'} ${f === 'Custom order' ? 'border-gold/40 text-gold hover:bg-gold hover:text-white hover:border-gold' : ''}`}>
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-dark/40">
            <Loader size={20} className="animate-spin" />
            <span className="font-sans text-sm">Loading furniture…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-serif text-xl text-dark/40">No pieces in this category yet.</p>
            <button onClick={() => setFilter('All pieces')} className="btn-outline mt-4">View all pieces</button>
          </div>
        ) : (
          <>
            {featured && (
              <div className="grid lg:grid-cols-3 gap-5 mb-5">
                <div className="lg:col-span-2 bg-white rounded-2xl overflow-hidden border border-warm-border flex flex-col sm:flex-row">
                  <div className="bg-[#e8dfc8] sm:w-60 flex-shrink-0 flex items-center justify-center p-10 min-h-[220px] cursor-pointer"
                    onClick={() => navigate(`/furniture/${featured.id}`)}>
                    <Sofa size={88} strokeWidth={0.8} className="text-dark/15" />
                  </div>
                  <div className="p-7 flex flex-col justify-between flex-1">
                    <div>
                      <span className="inline-block bg-gold/10 text-gold text-xs font-semibold px-2.5 py-1 rounded mb-3">Bestseller</span>
                      <h3 className="font-serif text-2xl text-dark mb-2 cursor-pointer hover:text-gold transition-colors"
                        onClick={() => navigate(`/furniture/${featured.id}`)}>
                        {featured.name}
                      </h3>
                      <p className="text-dark/60 text-sm leading-relaxed font-sans">{featured.description}</p>
                    </div>
                    <div className="mt-5 flex items-center justify-between flex-wrap gap-4">
                      <p className="font-serif text-3xl text-dark">Rs {featuredPrice.toLocaleString()}</p>
                      <div className="flex gap-2">
                        <button onClick={() => addItem({ ...featured, price: featuredPrice }, 1, true)}
                          className="btn-dark text-sm">Order now</button>
                        <button onClick={() => navigate(`/furniture/${featured.id}`)}
                          className="btn-outline text-sm">View details</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {sidebar.map((p) => <ProductCard key={p.id} product={p} onView={setSelectedProduct} compact />)}
                  <button onClick={() => setShowCustomOrder(true)}
                    className="bg-gold rounded-2xl p-5 flex flex-col gap-2 flex-1 text-left hover:opacity-90 transition-opacity">
                    <p className="font-serif text-lg text-white">Custom Order</p>
                    <p className="text-sm text-white/75 font-sans leading-relaxed">
                      Don't see what you need? We build to your exact specifications.
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-white underline underline-offset-2">
                      Get a quote <ArrowRight size={13} />
                    </span>
                  </button>
                </div>
              </div>
            )}

            {gridItems.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {gridItems.map((p) => <ProductCard key={p.id} product={p} onView={setSelectedProduct} />)}
                {!showAll && remaining > 0 && (
                  <button onClick={() => setShowAll(true)}
                    className="rounded-2xl border border-gold/20 bg-gold/5 p-5 flex flex-col items-center justify-center gap-2 text-center hover:bg-gold/10 transition-colors cursor-pointer min-h-[180px]">
                    <p className="font-serif text-3xl text-gold">+{remaining}</p>
                    <p className="text-sm text-dark/60 font-sans">more pieces</p>
                    <span className="text-xs font-medium text-gold underline underline-offset-2">View all</span>
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
      {showCustomOrder && <CustomOrderModal onClose={() => setShowCustomOrder(false)} />}
    </section>
  );
}