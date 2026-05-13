import { useState } from 'react';
import { Plus, Minus, Star, Shield, Truck, MessageCircle } from 'lucide-react';
import { hives } from '../../data/beekeepingProducts';
import SectionDivider from './SectionDivider';
import { getBeeSVG } from './BeekeepingSVGs';

function HiveSvg() {
  return (
    <svg viewBox="0 0 260 220" className="w-full h-full max-h-48" xmlns="http://www.w3.org/2000/svg">
      {/* Roof */}
      <polygon points="30,72 130,18 230,72" fill="#8B6914" opacity="0.35" />
      <polygon points="36,72 130,24 224,72" fill="#c4a45a" opacity="0.45" />
      {/* Honey super (top chamber) */}
      <rect x="44" y="72" width="172" height="40" rx="4" fill="#e8a400" opacity="0.25" />
      <rect x="48" y="75" width="164" height="34" rx="3" fill="#e8a400" opacity="0.18" />
      <text x="130" y="96" textAnchor="middle" fill="#8B6914" fontSize="9" fontFamily="DM Sans" opacity="0.7">HONEY SUPER</text>
      {/* Queen excluder */}
      <rect x="44" y="112" width="172" height="7" rx="2" fill="#534ab7" opacity="0.25" />
      <line x1="55" y1="115" x2="205" y2="115" stroke="#534ab7" strokeWidth="0.8" strokeDasharray="4,3" opacity="0.35" />
      <text x="130" y="114" textAnchor="middle" fill="#534ab7" fontSize="7" fontFamily="DM Sans" opacity="0.60">QUEEN EXCLUDER</text>
      {/* Brood chamber */}
      <rect x="44" y="119" width="172" height="52" rx="4" fill="#c4a45a" opacity="0.28" />
      <rect x="48" y="122" width="164" height="46" rx="3" fill="#c4a45a" opacity="0.18" />
      {/* Frame lines in brood */}
      {[60,76,92,108,124,140,156,172,188].map((x) => (
        <line key={x} x1={x} y1="124" x2={x} y2="166" stroke="#8B6914" strokeWidth="0.6" opacity="0.20"/>
      ))}
      <text x="130" y="148" textAnchor="middle" fill="#8B6914" fontSize="9" fontFamily="DM Sans" opacity="0.7">BROOD CHAMBER</text>
      {/* Bottom board */}
      <rect x="36" y="171" width="188" height="10" rx="3" fill="#5a3a1a" opacity="0.30" />
      {/* Entrance */}
      <rect x="100" y="178" width="60" height="6" rx="2" fill="#1a1000" opacity="0.20" />
      {/* Legs */}
      <rect x="56"  y="181" width="10" height="28" rx="4" fill="#5a3a1a" opacity="0.30" />
      <rect x="194" y="181" width="10" height="28" rx="4" fill="#5a3a1a" opacity="0.30" />
      {/* Ground shadow */}
      <ellipse cx="130" cy="212" rx="80" ry="5" fill="#5a3a1a" opacity="0.07" />
    </svg>
  );
}

const WOOD_OPTIONS = [
  { id: 'tuni',   label: 'Tuni',   color: '#8B6914' },
  { id: 'uttish', label: 'Uttish', color: '#3a2010' },
  { id: 'mixed',  label: 'Mixed',  color: '#6a4a2a' },
];

const TRUST = [
  { Icon: Shield,         label: 'Made in Nepal' },
  { Icon: Truck,          label: 'Delivery across Nepal' },
  { Icon: Star,           label: '1-year guarantee' },
  { Icon: MessageCircle,  label: 'WhatsApp support' },
];

const fmt = (n) => Number(n).toLocaleString();

export default function FeaturedHive({ onAddToCart }) {
  const featured = hives[0];
  const [selectedType, setSelectedType]   = useState('hive-001');
  const [selectedWood, setSelectedWood]   = useState('tuni');
  const [qty, setQty]                     = useState(1);
  const [saved, setSaved]                 = useState(false);
  const HiveSVGComp = getBeeSVG(selectedType);

  const handleOrder = () => {
    onAddToCart?.({ ...featured, qty });
  };

  const SPEC_ROWS = [
    ['Dimensions',      featured.specs.dimensions],
    ['Wood type',       featured.specs.wood],
    ['Brood chamber',   featured.specs.broodFrames],
    ['Honey chamber',   featured.specs.honeyFrames],
    ['Bee species',     featured.specs.beeSpecies],
    ['Roof',            featured.specs.roof],
  ];

  return (
    <section id="bee-hives" className="bg-[#fdf3c0] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="01" name="Mauri Ghar hives" tag="Flagship product" tagColor="amber" />

        <div className="grid md:grid-cols-[3fr_2fr] gap-10 lg:gap-16">

          {/* Left: illustration + info */}
          <div>
            <div className="rounded-3xl overflow-hidden border border-[#e8a400]/15 mb-6 relative bg-[#fdf3c0]" style={{ minHeight: 280 }}>
              <div className="w-full h-72">
                <HiveSVGComp />
              </div>
              {/* Overlay diagram badge */}
              <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-md">
                <div className="w-24 h-20">
                  <HiveSvg />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="font-serif text-2xl text-[#1a1000]">{featured.name}</h2>
                <p className="font-sans text-sm text-[#8B6914] mt-0.5">
                  {featured.nepali} · {featured.type} · Made in Nepal
                </p>
              </div>

              <p className="font-sans text-sm text-[#1a1000]/60 leading-relaxed">{featured.description}</p>

              {/* Specs grid */}
              <div className="grid grid-cols-2 gap-2">
                {SPEC_ROWS.map(([label, val]) => (
                  <div key={label} className="bg-white/70 rounded-xl p-3 border border-[#e8a400]/10">
                    <p className="font-sans text-[10px] font-semibold uppercase tracking-wider text-[#8B6914]/60">{label}</p>
                    <p className="font-sans text-[12px] text-[#1a1000]/80 mt-0.5 leading-tight">{val}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-2">
                <p className="font-serif text-2xl text-[#1a1000]">Rs {fmt(featured.price)}</p>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map((i) => (
                    <Star key={i} size={12} className={i <= Math.round(featured.rating) ? 'fill-[#e8a400] text-[#e8a400]' : 'fill-gray-200 text-gray-200'} />
                  ))}
                  <span className="font-sans text-xs text-[#1a1000]/40 ml-1">{featured.rating} · {featured.reviewCount} reviews</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: configurator */}
          <div className="flex flex-col gap-5">

            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#1a1000]/40 mb-3">Choose your hive type</p>
              <div className="flex flex-col gap-2">
                {hives.slice(0, 3).map((h) => (
                  <button key={h.id} onClick={() => setSelectedType(h.id)}
                    className={`text-left p-3 rounded-xl border transition-all font-sans
                      ${selectedType === h.id
                        ? 'border-[#e8a400] bg-[#faeeda]'
                        : 'border-[#e8a400]/20 bg-white hover:bg-[#fdf8e8]'
                      }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[#1a1000]">{h.name}</p>
                        <p className="text-[11px] text-[#1a1000]/50 mt-0.5 leading-snug">{h.description.split('.')[0]}.</p>
                      </div>
                      <p className="font-serif text-base text-[#8B6914] shrink-0">Rs {fmt(h.price)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Wood selector */}
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#1a1000]/40 mb-3">Wood finish</p>
              <div className="flex gap-3">
                {WOOD_OPTIONS.map((w) => (
                  <button key={w.id} onClick={() => setSelectedWood(w.id)}
                    className="flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full transition-all"
                      style={{
                        backgroundColor: w.color,
                        boxShadow: selectedWood === w.id ? `0 0 0 3px white, 0 0 0 5px ${w.color}` : 'none',
                      }} />
                    <span className="font-sans text-[10px] text-[#1a1000]/50">{w.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Qty */}
            <div>
              <p className="font-sans text-xs font-semibold uppercase tracking-widest text-[#1a1000]/40 mb-3">Quantity</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-white border border-[#e8a400]/20 rounded-xl overflow-hidden">
                  <button onClick={() => setQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:bg-[#faeeda] text-[#1a1000]/50 transition-colors min-h-[44px]">
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-semibold text-[#1a1000] font-sans text-sm">{qty}</span>
                  <button onClick={() => setQty((q) => q + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-[#faeeda] text-[#1a1000]/50 transition-colors min-h-[44px]">
                    <Plus size={14} />
                  </button>
                </div>
                {qty > 1 && (
                  <span className="font-sans text-sm text-[#1a1000]/40">= Rs {fmt(featured.price * qty)}</span>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="flex gap-2">
              <button onClick={handleOrder}
                className="flex-1 min-h-[44px] bg-[#e8a400] text-white font-sans font-semibold text-sm rounded-xl hover:bg-[#d49400] transition-colors">
                Order now · Rs {fmt(featured.price * qty)}
              </button>
              <button onClick={() => setSaved((s) => !s)}
                className={`px-4 min-h-[44px] rounded-xl border font-sans text-sm font-semibold transition-colors
                  ${saved ? 'bg-[#faeeda] border-[#e8a400] text-[#8B6914]' : 'border-[#e8a400]/20 text-[#1a1000]/50 hover:bg-[#fdf8e8]'}`}>
                {saved ? '♥ बचत' : '♡ Save'}
              </button>
            </div>

            {/* WhatsApp mobile */}
            <a href={`https://wa.me/9779800000000?text=${encodeURIComponent(`Namaste! I want to order: ${featured.name} (${featured.nepali}) — Rs ${featured.price.toLocaleString()}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 min-h-[44px] border border-[#25D366]/30 text-[#128C7E] bg-[#f0fdf4] rounded-xl font-sans text-sm font-semibold hover:bg-[#dcfce7] transition-colors sm:hidden">
              <span>💬</span> Order via WhatsApp
            </a>

            {/* Trust signals */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              {TRUST.map(({ Icon, label }) => (
                <div key={label} className="flex items-center gap-2 bg-white/60 rounded-xl px-3 py-2">
                  <Icon size={13} className="text-[#e8a400] shrink-0" />
                  <span className="font-sans text-[11px] text-[#1a1000]/60">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}