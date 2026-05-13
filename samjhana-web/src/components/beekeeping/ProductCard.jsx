import { ShoppingCart, Star } from 'lucide-react';
import { useState } from 'react';
import BadgePill from './BadgePill';
import { getBeeSVG } from './BeekeepingSVGs';

const fmt = (n) => Number(n).toLocaleString();

function StarRow({ rating, reviewCount }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex">
        {[1,2,3,4,5].map((i) => (
          <Star key={i} size={10}
            className={i <= Math.round(rating) ? 'fill-[#e8a400] text-[#e8a400]' : 'fill-gray-200 text-gray-200'} />
        ))}
      </div>
      <span className="text-[10px] text-[#1a1000]/40 font-sans">{rating} ({reviewCount})</span>
    </div>
  );
}

export default function ProductCard({ product, onAddToCart }) {
  const [added, setAdded] = useState(false);
  const BeeSVG = getBeeSVG(product.id);

  const handleAdd = (e) => {
    e.stopPropagation();
    onAddToCart?.(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden
      shadow-[0_2px_12px_rgba(26,16,0,0.06)] hover:shadow-[0_8px_24px_rgba(26,16,0,0.12)]
      transition-all duration-300 hover:-translate-y-1 flex flex-col">

      {/* Illustration */}
      <div className="relative overflow-hidden h-36" style={{ backgroundColor: product.bgColor + '44' }}>
        <BeeSVG />
        {product.badge && (
          <div className="absolute top-2 left-2">
            <BadgePill text={product.badge} color={product.badgeColor ?? 'amber'} />
          </div>
        )}
        {product.inStock === false && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <span className="text-[10px] font-semibold text-[#1a1000]/40 bg-white px-2 py-0.5 rounded-full border border-gray-200 font-sans">
              उपलब्ध छैन
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex-1">
          <p className="font-serif text-base text-[#1a1000] leading-tight line-clamp-2">{product.name}</p>
          {product.nepali && (
            <p className="text-[11px] text-[#8B6914] font-sans mt-0.5">{product.nepali}</p>
          )}
          <p className="text-[11px] text-[#1a1000]/50 font-sans mt-1.5 line-clamp-2 leading-relaxed">{product.description}</p>
        </div>

        {product.rating != null && (
          <StarRow rating={product.rating} reviewCount={product.reviewCount} />
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="font-serif text-lg text-[#1a1000]">Rs {fmt(product.price)}</p>
          <button onClick={handleAdd} disabled={product.inStock === false}
            className="w-8 h-8 rounded-xl bg-[#faeeda] hover:bg-[#e8a400] hover:text-white text-[#8B6914]
              transition-colors flex items-center justify-center disabled:opacity-30 flex-shrink-0">
            {added ? '✓' : <ShoppingCart size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}