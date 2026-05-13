import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Sofa, ShoppingCart, Zap, ArrowRight } from 'lucide-react';
import { useCartStore } from '../store/cartStore';

export default function ProductModal({ product, onClose }) {
  const addItem = useCartStore((s) => s.addItem);

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!product) return null;

  const price = Number(product.sellingPrice ?? product.price ?? 0);
  const withPrice = { ...product, price };

  const handleAdd = () => { addItem(withPrice, 1, false); onClose(); };
  const handleOrderNow = () => { addItem(withPrice, 1, true); onClose(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dark/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl overflow-hidden w-full max-w-2xl shadow-2xl flex flex-col sm:flex-row">

        {/* Image area */}
        <div className="bg-[#e8dfc8] sm:w-64 flex-shrink-0 flex items-center justify-center p-12 min-h-[220px]">
          <Sofa size={88} strokeWidth={0.8} className="text-dark/15" />
        </div>

        {/* Content */}
        <div className="flex-1 p-7 flex flex-col gap-4">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-warm text-dark/40 hover:text-dark transition-colors">
            <X size={18} />
          </button>

          <div>
            <span className="inline-block bg-gold/10 text-gold text-xs font-semibold px-2.5 py-1 rounded mb-3">
              {product.category}
            </span>
            <h2 className="font-serif text-2xl text-dark">{product.name}</h2>
            <p className="text-dark/60 text-sm leading-relaxed font-sans mt-2">{product.description}</p>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <p className="font-serif text-3xl text-dark">Rs {price.toLocaleString()}</p>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${product.stockQty > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {product.stockQty > 0 ? `${product.stockQty} in stock` : 'Out of stock'}
            </span>
          </div>

          <div className="flex gap-2 mt-auto pt-2 flex-col">
            <div className="flex gap-2">
              <button onClick={handleOrderNow} disabled={product.stockQty === 0}
                className="btn-dark flex-1 justify-center gap-2 disabled:opacity-40">
                <Zap size={15} /> Order now
              </button>
              <button onClick={handleAdd} disabled={product.stockQty === 0}
                className="btn-outline flex-1 justify-center gap-2 disabled:opacity-40">
                <ShoppingCart size={15} /> Add to cart
              </button>
            </div>
            <Link to={`/furniture/${product.id}`} onClick={onClose}
              className="flex items-center justify-center gap-1 text-xs text-dark/40 hover:text-gold transition-colors font-sans py-1">
              View full details <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}