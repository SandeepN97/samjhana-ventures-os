import { ShoppingCart, Star } from 'lucide-react';
import { useState } from 'react';
import { protectiveGear } from '../../data/beekeepingProducts';
import SectionDivider from './SectionDivider';
import ProductCard from './ProductCard';
import { getBeeSVG } from './BeekeepingSVGs';

const GEAR_LAYERS = [
  { num: '1', name: 'Full-body bee suit', note: 'Head-to-toe protection — never skip' },
  { num: '2', name: 'Veil / hood', note: 'Face and neck — critical for safety' },
  { num: '3', name: 'Leather gauntlet gloves', note: 'Wrist-length sting protection' },
  { num: '4', name: 'Closed-toe boots', note: 'Heavy socks, tucked-in trouser legs' },
];

const DARK_CARDS = protectiveGear.slice(0, 4);

export default function ProtectiveGear({ onAddToCart }) {
  return (
    <section id="bee-protective" className="pb-16">
      {/* Dark hero strip */}
      <div className="bg-[#1a1000] py-14">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-start">

            {/* Left */}
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-[#e8a400]/60 mb-4">
                Safety first · सुरक्षा पहिले
              </p>
              <h2 className="font-serif text-3xl text-white leading-snug mb-4">
                Suited for the <em className="text-[#e8a400] not-italic">hive.</em>
              </h2>
              <p className="font-sans text-sm text-white/50 leading-relaxed mb-8">
                Never approach a colony without protection. Even docile Apis cerana
                colonies will defend when disturbed. Layer up correctly every time.
              </p>

              <div className="flex flex-col gap-3">
                {GEAR_LAYERS.map((layer) => (
                  <div key={layer.num} className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#e8a400]/15 flex items-center justify-center shrink-0">
                      <span className="font-sans text-xs font-bold text-[#e8a400]">{layer.num}</span>
                    </div>
                    <div>
                      <p className="font-sans text-sm font-semibold text-white">{layer.name}</p>
                      <p className="font-sans text-[11px] text-white/40">{layer.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: dark product cards 2×2 */}
            <div className="grid grid-cols-2 gap-3">
              {DARK_CARDS.map((g) => (
                <DarkGearCard key={g.id} gear={g} onAddToCart={onAddToCart} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Light product grid */}
      <div className="bg-[#fdf8e8] py-12">
        <div className="max-w-7xl mx-auto px-6">
          <SectionDivider num="03" name="Protective gear" tag="Safety" tagColor="green" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {protectiveGear.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={onAddToCart} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function DarkGearCard({ gear, onAddToCart }) {
  const [added, setAdded] = useState(false);
  const GearSVG = getBeeSVG(gear.id);
  const handleAdd = () => {
    onAddToCart?.(gear);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-2">
      <div className="h-20 rounded-xl overflow-hidden" style={{ backgroundColor: gear.bgColor + '22' }}>
        <GearSVG />
      </div>
      <p className="font-sans text-sm font-semibold text-white leading-tight line-clamp-2">{gear.name}</p>
      <p className="font-sans text-[10px] text-white/40 line-clamp-2 leading-snug">{gear.description}</p>
      <div className="flex items-center justify-between mt-auto pt-1">
        <p className="font-serif text-base text-[#e8a400]">Rs {Number(gear.price).toLocaleString()}</p>
        <button onClick={handleAdd}
          className="w-8 h-8 rounded-xl bg-[#e8a400]/15 hover:bg-[#e8a400] text-[#e8a400] hover:text-white transition-colors flex items-center justify-center min-h-[44px] sm:min-h-[32px]">
          {added ? '✓' : <ShoppingCart size={13} />}
        </button>
      </div>
    </div>
  );
}