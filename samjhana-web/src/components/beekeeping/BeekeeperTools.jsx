import { useState } from 'react';
import { ShoppingCart, MessageCircle } from 'lucide-react';
import { whatsappLink } from '../../site/links';
import { useSection } from '../../site/SiteContext';
import SectionDivider from './SectionDivider';
import BeeImg from './BeeImg';

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
      <div className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
        style={{ backgroundColor: CAT_COLORS[tool.category] }}>
        <BeeImg src={tool.image} alt={tool.name} className="bee-product-photo h-full w-full object-contain p-1" loading="lazy" />
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

  return (
    <div className="bg-[#eeedfe] rounded-2xl p-4 border border-[#534ab7]/15">
      <div className="h-28 rounded-xl overflow-hidden mb-3 bg-[#534ab7]/10">
        <BeeImg src={tool.image} alt={tool.name} className="bee-product-photo h-full w-full object-contain p-2" loading="lazy" />
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

export default function BeekeeperTools({ tools, onAddToCart }) {
  const copy = useSection('beekeeping').tools || {};
  const contact = useSection('contact');
  const pick = (slugs) => (slugs || []).map((id) => tools.find((t) => t.id === id)).filter(Boolean);
  // Which tools are listed, and which are the queen devices, is chosen in the admin; with no choice every tool is listed.
  const displayList = copy.toolSlugs?.length ? pick(copy.toolSlugs) : tools;
  const queenList   = copy.queenSlugs?.length ? pick(copy.queenSlugs) : tools.filter((t) => t.category === 'queen');
  const training = whatsappLink(contact, copy.trainingMessage);

  return (
    <section id="bee-tools" className="bg-[#fdf8e8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="04" name={copy.sectionName} tag={copy.tag} tagColor="honey" />

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">

          {/* Left: tools list */}
          <div>
            <h2 className="font-serif text-2xl text-[#1a1000] mb-6">{copy.toolsTitle}</h2>
            <div className="bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(26,16,0,0.05)]">
              {displayList.map((tool) => (
                <ToolRow key={tool.id} tool={tool} onAddToCart={onAddToCart} />
              ))}
            </div>
          </div>

          {/* Right: queen devices */}
          <div>
            <h2 className="font-serif text-2xl text-[#1a1000] mb-3">{copy.queenTitle}</h2>

            <div className="bg-[#eeedfe] rounded-2xl p-4 border border-[#534ab7]/15 mb-5">
              <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-[#534ab7]/60 mb-2">
                {copy.queenNoteTitle}
              </p>
              <p className="font-sans text-sm text-[#534ab7]/80 leading-relaxed">
                {copy.queenNote}
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
                <p className="font-sans font-semibold text-white text-sm">{copy.trainingTitle}</p>
                <p className="font-sans text-xs text-white/50 mt-1 leading-relaxed">
                  {copy.trainingText}
                </p>
                {training && <a href={training}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 font-sans text-xs font-semibold text-[#e8a400] hover:underline">
                  {copy.trainingCta}
                </a>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
