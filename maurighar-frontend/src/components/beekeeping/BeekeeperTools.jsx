import { useState } from 'react';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import { tools } from '../../data/beekeepingProducts';
import SectionDivider from './SectionDivider';
import { getBeeSVG } from './BeekeepingSVGs';

const CAT_COLORS = {
  inspection: '#faeeda',
  queen:      '#eeedfe',
  harvest:    '#e1f5ee',
  hive:       '#fdf3c0',
};

const CAT_TEXT = {
  inspection: '#8B6914',
  queen:      '#534ab7',
  harvest:    '#166534',
  hive:       '#8B6914',
};

const fmt = (n) => Number(n).toLocaleString();

function ToolRow({ tool, onAddToCart }) {
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    onAddToCart?.(tool);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-[#e8a400]/10 last:border-0">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: CAT_COLORS[tool.category] }}>
        <span className="text-lg">🔧</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-sans text-sm font-semibold text-[#1a1000] leading-tight">{tool.name}</p>
        <p className="font-sans text-[11px] text-[#8B6914] mt-0.5">{tool.nepali}</p>
        <p className="font-sans text-[11px] text-[#1a1000]/50 mt-1 line-clamp-2 leading-snug">{tool.description}</p>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <p className="font-serif text-base text-[#1a1000]">Rs {fmt(tool.price)}</p>
        <button onClick={handleAdd}
          className="min-h-[32px] px-3 py-1 bg-[#faeeda] hover:bg-[#e8a400] hover:text-white text-[#8B6914] text-xs font-semibold font-sans rounded-lg transition-colors">
          {added ? '✓ Added' : '+ Add'}
        </button>
      </div>
    </div>
  );
}

function QueenDeviceCard({ tool, onAddToCart }) {
  const [added, setAdded] = useState(false);
  const handleAdd = () => {
    onAddToCart?.(tool);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const ToolSvg = getBeeSVG(tool.id);
  return (
    <div className="bg-[#eeedfe] rounded-2xl p-4 border border-[#534ab7]/15">
      <div className="h-28 rounded-xl overflow-hidden mb-3 bg-[#534ab7]/10">
        <ToolSvg />
      </div>
      <p className="font-sans font-semibold text-sm text-[#1a1000]">{tool.name}</p>
      <p className="font-sans text-[11px] text-[#534ab7] mt-0.5">{tool.nepali}</p>
      <p className="font-sans text-[11px] text-[#1a1000]/50 mt-2 leading-relaxed">{tool.description}</p>
      <div className="flex items-center justify-between mt-4">
        <p className="font-serif text-lg text-[#534ab7]">Rs {fmt(tool.price)}</p>
        <button onClick={handleAdd}
          className="min-h-[44px] px-4 bg-[#534ab7] text-white text-sm font-semibold font-sans rounded-xl hover:bg-[#4a42a0] transition-colors flex items-center gap-2">
          <ShoppingCart size={13} />
          {added ? 'Added!' : 'Add to cart'}
        </button>
      </div>
    </div>
  );
}

const DISPLAY_TOOLS = ['tool-001','tool-002','tool-003','tool-004','tool-005','tool-006','tool-007','tool-008','tool-009'];
const QUEEN_DEVICES = ['tool-003','tool-010'];

export default function BeekeeperTools({ onAddToCart }) {
  const displayList = DISPLAY_TOOLS.map((id) => tools.find((t) => t.id === id)).filter(Boolean);
  const queenList   = QUEEN_DEVICES.map((id) => tools.find((t) => t.id === id)).filter(Boolean);

  return (
    <section id="bee-tools" className="bg-[#fdf8e8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="04" name="Tools & queen devices" tag="Inspector" tagColor="honey" />

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">

          {/* Left: tools list */}
          <div>
            <h2 className="font-serif text-2xl text-[#1a1000] mb-6">Beekeeping tools</h2>
            <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(26,16,0,0.05)]">
              {displayList.map((tool) => (
                <ToolRow key={tool.id} tool={tool} onAddToCart={onAddToCart} />
              ))}
            </div>
          </div>

          {/* Right: queen devices */}
          <div>
            <h2 className="font-serif text-2xl text-[#1a1000] mb-3">Queen devices</h2>

            <div className="bg-[#eeedfe] rounded-2xl p-4 border border-[#534ab7]/15 mb-5">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-[#534ab7]/60 mb-2">
                Why queen management matters
              </p>
              <p className="font-sans text-sm text-[#534ab7]/80 leading-relaxed">
                The queen is the heart of the colony — she lays up to 1,500 eggs per day.
                Finding, monitoring, and occasionally replacing the queen keeps your colony
                productive and disease-free. Invest in queen tools early.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {queenList.map((tool) => (
                <QueenDeviceCard key={tool.id} tool={tool} onAddToCart={onAddToCart} />
              ))}
            </div>

            {/* Training callout */}
            <div className="mt-5 bg-[#1a1000] rounded-2xl p-5 flex items-start gap-4">
              <MessageCircle size={20} className="text-[#e8a400] shrink-0 mt-0.5" />
              <div>
                <p className="font-sans font-semibold text-white text-sm">Queen rearing training</p>
                <p className="font-sans text-xs text-white/50 mt-1 leading-relaxed">
                  WhatsApp us for the next workshop date in Gulmi district.
                </p>
                <a href="https://wa.me/9779800000000?text=Namaste!%20I%20want%20to%20join%20the%20queen%20rearing%20training."
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 font-sans text-xs font-semibold text-[#e8a400] hover:underline">
                  💬 WhatsApp us →
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}