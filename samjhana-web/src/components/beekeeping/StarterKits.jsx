import { Check } from 'lucide-react';
import { starterKits } from '../../data/beekeepingProducts';
import SectionDivider from './SectionDivider';
import { getBeeSVG } from './BeekeepingSVGs';

const fmt = (n) => Number(n).toLocaleString();

const LEVEL_COLORS = {
  'Beginner':     { bg: '#eaf3de', text: '#3b6d11' },
  'Most popular': { bg: '#faeeda', text: '#8B6914' },
  'Pro':          { bg: '#eeedfe', text: '#534ab7' },
};

export default function StarterKits({ onAddToCart }) {
  return (
    <section id="bee-kits" className="bg-[#fdf3c0] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="06" name="Starter kits" tag="Best value" tagColor="amber" />

        <div className="flex items-end justify-between mb-8">
          <h2 className="font-serif text-2xl text-[#1a1000]">Everything in one kit</h2>
          <p className="font-sans text-xs text-[#1a1000]/40">Free bundled shipping</p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {starterKits.map((kit) => {
            const lc = LEVEL_COLORS[kit.level] ?? LEVEL_COLORS['Beginner'];
            const KitSVG = getBeeSVG(kit.id);
            return (
              <div key={kit.id}
                className={`bg-white rounded-3xl overflow-hidden flex flex-col shadow-[0_4px_24px_rgba(26,16,0,0.06)] transition-all hover:-translate-y-1
                  ${kit.featured ? 'border-2 border-[#e8a400] shadow-[0_8px_32px_rgba(232,164,0,0.18)]' : 'border border-[#e8a400]/10'}`}>

                {/* Kit illustration */}
                <div className="h-40 relative overflow-hidden" style={{ backgroundColor: kit.featured ? '#faeeda' : '#fdf8e8' }}>
                  <KitSVG />
                  {kit.featured && (
                    <div className="absolute top-3 left-3">
                      <span className="bg-[#e8a400] text-white text-[10px] font-bold font-sans uppercase tracking-wider px-3 py-1 rounded-full">
                        Most popular
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-5 flex flex-col gap-4 flex-1">
                  {/* Level badge */}
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full font-sans"
                    style={{ backgroundColor: lc.bg, color: lc.text }}>
                    {kit.level}
                  </span>

                  <div>
                    <h3 className="font-serif text-xl text-[#1a1000] leading-tight">{kit.name}</h3>
                    <p className="font-sans text-xs text-[#8B6914] mt-0.5">{kit.nepali}</p>
                  </div>

                  {/* Includes list */}
                  <ul className="flex flex-col gap-2 flex-1">
                    {kit.includes.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-[#e8a400]/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Check size={9} className="text-[#e8a400]" />
                        </div>
                        <span className="font-sans text-xs text-[#1a1000]/70 leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Price */}
                  <div className="pt-2 border-t border-[#e8a400]/10">
                    <div className="flex items-end gap-2 mb-1">
                      <p className="font-serif text-2xl text-[#1a1000]">Rs {fmt(kit.price)}</p>
                      <p className="font-sans text-sm text-[#1a1000]/30 line-through mb-0.5">Rs {fmt(kit.originalPrice)}</p>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-sans text-[11px] font-semibold text-[#3b6d11] bg-[#eaf3de] px-2 py-0.5 rounded-full">
                        बचत Rs {fmt(kit.savings)}
                      </span>
                    </div>
                    <button onClick={() => onAddToCart?.(kit)}
                      className="w-full min-h-[44px] bg-[#e8a400] text-white font-sans font-semibold text-sm rounded-xl hover:bg-[#d49400] transition-colors">
                      यो किट लिनुहोस्
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}