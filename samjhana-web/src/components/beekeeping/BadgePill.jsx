const COLOR_MAP = {
  amber:  'bg-[#faeeda] text-[#8B6914] border-[#e8a400]/30',
  green:  'bg-[#eaf3de] text-[#3b6d11] border-[#3b6d11]/20',
  new:    'bg-[#eeedfe] text-[#534ab7] border-[#534ab7]/20',
  best:   'bg-[#e8a400] text-white border-transparent',
  hot:    'bg-red-50 text-red-600 border-red-200',
  raw:    'bg-[#fdf3c0] text-[#8B6914] border-[#e8a400]/30',
  muted:  'bg-gray-100 text-gray-500 border-gray-200',
};

export default function BadgePill({ text, color = 'amber' }) {
  return (
    <span className={`inline-block text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border font-sans ${COLOR_MAP[color] ?? COLOR_MAP.amber}`}>
      {text}
    </span>
  );
}