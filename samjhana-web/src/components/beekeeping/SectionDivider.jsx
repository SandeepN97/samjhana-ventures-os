const TAG_COLORS = {
  honey:  'bg-[#faeeda] text-[#8B6914]',
  green:  'bg-[#eaf3de] text-[#3b6d11]',
  amber:  'bg-[#e8a400] text-white',
  muted:  'bg-gray-100 text-gray-500',
  purple: 'bg-[#eeedfe] text-[#534ab7]',
};

export default function SectionDivider({ num, name, tag, tagColor = 'honey' }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="font-sans text-[11px] font-semibold text-[#8B6914]/60 tracking-widest uppercase">{num}</span>
      <span className="font-serif text-sm text-[#1a1000]/40">{name}</span>
      <div className="flex-1 h-px bg-[#e8a400]/15" />
      {tag && (
        <span className={`text-[9px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full font-sans ${TAG_COLORS[tagColor] ?? TAG_COLORS.honey}`}>
          {tag}
        </span>
      )}
    </div>
  );
}