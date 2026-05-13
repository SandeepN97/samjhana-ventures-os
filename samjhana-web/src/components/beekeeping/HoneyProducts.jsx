import { useState } from 'react';
import { ShoppingCart, Star } from 'lucide-react';
import { honeyProducts } from '../../data/beekeepingProducts';
import SectionDivider from './SectionDivider';
import BadgePill from './BadgePill';

const fmt = (n) => Number(n).toLocaleString();

function HoneyJarSvg({ color = '#e8a400' }) {
  return (
    <svg viewBox="0 0 120 140" className="w-20 h-24 mx-auto" xmlns="http://www.w3.org/2000/svg">
      {/* Lid */}
      <rect x="32" y="18" width="56" height="16" rx="4" fill={color} opacity="0.70"/>
      <rect x="36" y="22" width="48" height="8" rx="2" fill="white" opacity="0.15"/>
      {/* Jar body */}
      <rect x="24" y="34" width="72" height="86" rx="10" fill={color} opacity="0.22"/>
      <rect x="28" y="38" width="64" height="78" rx="8" fill={color} opacity="0.30"/>
      {/* Fill */}
      <rect x="30" y="68" width="60" height="46" rx="6" fill={color} opacity="0.55"/>
      {/* Shine */}
      <rect x="36" y="42" width="18" height="34" rx="4" fill="white" opacity="0.15"/>
      {/* Label */}
      <rect x="32" y="54" width="56" height="26" rx="4" fill="white" opacity="0.60"/>
      <text x="60" y="64" textAnchor="middle" fill="#8B6914" fontSize="7" fontFamily="DM Sans" fontWeight="600">RAW HONEY</text>
      <text x="60" y="73" textAnchor="middle" fill="#8B6914" fontSize="6" fontFamily="DM Sans">Gulmi, Nepal</text>
      {/* Bottom shadow */}
      <ellipse cx="60" cy="122" rx="36" ry="4" fill={color} opacity="0.12"/>
    </svg>
  );
}

const SIZES = ['250g', '500g', '1kg'];

function FeaturedHoneyCard({ product, onAddToCart }) {
  const [added, setAdded] = useState(false);
  const [size, setSize]   = useState('500g');

  const handleAdd = () => {
    onAddToCart?.(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-[0_4px_24px_rgba(26,16,0,0.08)] flex flex-col">
      <div className="relative h-52 overflow-hidden flex items-center justify-center py-4"
        style={{ backgroundColor: product.bgColor + '44' }}>
        <HoneyJarSvg color={product.bgColor} />
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        {product.badge && <BadgePill text={product.badge} color="raw" />}
        <div>
          <h3 className="font-serif text-xl text-[#1a1000] leading-tight">{product.name}</h3>
          <p className="font-sans text-xs text-[#8B6914] mt-0.5">{product.nepali}</p>
        </div>
        <p className="font-sans text-xs text-[#1a1000]/60 leading-relaxed">{product.description}</p>

        {/* Size selector */}
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <button key={s} onClick={() => setSize(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-sans transition-colors border
                ${size === s
                  ? 'bg-[#e8a400] text-white border-[#e8a400]'
                  : 'border-[#e8a400]/20 text-[#1a1000]/50 hover:bg-[#faeeda]'
                }`}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            <p className="font-serif text-2xl text-[#1a1000]">Rs {fmt(product.price)}</p>
            <p className="font-sans text-[10px] text-[#1a1000]/40">{product.unit}</p>
          </div>
          <button onClick={handleAdd}
            className="min-h-[44px] px-4 bg-[#e8a400] text-white font-sans font-semibold text-sm rounded-xl hover:bg-[#d49400] transition-colors flex items-center gap-2">
            <ShoppingCart size={14} />
            {added ? 'Added! मालमा थपियो' : 'मालमा थप्नुहोस्'}
          </button>
        </div>

        {product.rating && (
          <div className="flex items-center gap-1.5 pt-1">
            {[1,2,3,4,5].map((i) => (
              <Star key={i} size={11} className={i <= Math.round(product.rating) ? 'fill-[#e8a400] text-[#e8a400]' : 'fill-gray-200 text-gray-200'} />
            ))}
            <span className="font-sans text-[11px] text-[#1a1000]/40 ml-1">{product.rating} · {product.reviewCount} reviews</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SmallHoneyCard({ product, onAddToCart }) {
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    onAddToCart?.(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(26,16,0,0.06)] flex flex-col">
      <div className="h-28 overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: product.bgColor + '44' }}>
        <HoneyJarSvg color={product.bgColor} />
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="font-serif text-base text-[#1a1000] leading-tight line-clamp-2">{product.name}</p>
        <p className="font-sans text-[11px] text-[#8B6914]">{product.nepali}</p>
        {!product.inStock && (
          <span className="text-[10px] font-semibold text-red-500 font-sans">उपलब्ध छैन</span>
        )}
        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            <p className="font-serif text-lg text-[#1a1000]">Rs {fmt(product.price)}</p>
            <p className="font-sans text-[10px] text-[#1a1000]/40">{product.unit}</p>
          </div>
          <button onClick={handleAdd} disabled={!product.inStock}
            className="w-8 h-8 rounded-xl bg-[#faeeda] hover:bg-[#e8a400] hover:text-white text-[#8B6914] transition-colors flex items-center justify-center disabled:opacity-30 min-h-[44px] sm:min-h-[32px]">
            {added ? '✓' : <ShoppingCart size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HoneyProducts({ onAddToCart }) {
  const [featured, ...rest] = honeyProducts;

  return (
    <section id="bee-honey" className="bg-[#fdf8e8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="05" name="Raw Gulmi honey" tag="शुद्ध मह" tagColor="amber" />

        <div className="flex items-end justify-between mb-8">
          <h2 className="font-serif text-2xl text-[#1a1000]">Pure honey from Gulmi</h2>
          <p className="font-sans text-xs text-[#1a1000]/40">Unfiltered · Unheated · गुल्मी, नेपालबाट</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-4">
          <div className="col-span-2 lg:col-span-1">
            <FeaturedHoneyCard product={featured} onAddToCart={onAddToCart} />
          </div>
          {rest.map((p) => (
            <SmallHoneyCard key={p.id} product={p} onAddToCart={onAddToCart} />
          ))}
        </div>
      </div>
    </section>
  );
}