const CATEGORIES = [
  { id: 'hives',        label: 'Hives',         count: 8,  emoji: '🏠' },
  { id: 'protective',  label: 'Protective gear', count: 6,  emoji: '🛡️' },
  { id: 'tools',       label: 'Tools',           count: 12, emoji: '🔧' },
  { id: 'honey',       label: 'Honey',           count: 5,  emoji: '🍯' },
  { id: 'queen',       label: 'Queen devices',   count: 4,  emoji: '👑' },
  { id: 'kits',        label: 'Starter kits',    count: 3,  emoji: '📦' },
  { id: 'wax',         label: 'Wax & frames',    count: 7,  emoji: '🕯️' },
  { id: 'smokers',     label: 'Smokers',         count: 3,  emoji: '💨' },
];

const SECTION_IDS = {
  hives:     'bee-hives',
  protective:'bee-protective',
  tools:     'bee-tools',
  honey:     'bee-honey',
  queen:     'bee-tools',
  kits:      'bee-kits',
  wax:       'bee-hives',
  smokers:   'bee-tools',
};

export default function BeeNav({ activeCategory, setActiveCategory }) {
  const handleClick = (cat) => {
    setActiveCategory(cat.id);
    const el = document.getElementById(SECTION_IDS[cat.id]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e8a400]/15 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex gap-1 overflow-x-auto scrollbar-none py-2">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button key={cat.id} onClick={() => handleClick(cat)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl shrink-0 transition-all font-sans text-sm
                  ${active
                    ? 'bg-[#faeeda] text-[#8B6914] border-b-2 border-[#e8a400]'
                    : 'text-[#1a1000]/50 hover:text-[#1a1000] hover:bg-[#fdf8e8]'
                  }`}>
                <span className="text-base leading-none">{cat.emoji}</span>
                <span className="font-medium">{cat.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                  ${active ? 'bg-[#e8a400] text-white' : 'bg-[#f0ebe0] text-[#1a1000]/40'}`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}