import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';

/* ─── SVG artwork for each cell ─── */

function MaurigharArt() {
  const r = 22;
  const dx = r * Math.sqrt(3);
  const dy = r * 1.5;
  const hex = (cx, cy, radius) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 - 90) * Math.PI / 180;
      return `${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  const cx = 130, cy = 148;
  const inner = [
    [cx, cy], [cx + dx, cy], [cx + dx / 2, cy - dy], [cx - dx / 2, cy - dy],
    [cx - dx, cy], [cx - dx / 2, cy + dy], [cx + dx / 2, cy + dy],
  ];
  const outer = [
    [cx + dx, cy - dy], [cx, cy - dy * 2], [cx - dx, cy - dy],
    [cx - dx * 1.5, cy - dy / 2], [cx + dx * 1.5, cy - dy / 2],
  ];
  return (
    <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <circle cx="130" cy="130" r="110" fill="#c4a45a" opacity="0.04" />
      {/* Honeycomb inner ring */}
      {inner.map(([hx, hy], i) => (
        <polygon key={i} points={hex(hx, hy, r)}
          fill="#c4a45a" fillOpacity={i === 0 ? 0.32 : 0.13}
          stroke="#c4a45a" strokeWidth="1.2" strokeOpacity="0.35" />
      ))}
      {/* Outer partial ring */}
      {outer.map(([hx, hy], i) => (
        <polygon key={i} points={hex(hx, hy, r)}
          fill="none" stroke="#c4a45a" strokeWidth="0.9" strokeOpacity="0.18" />
      ))}
      {/* Honey drips */}
      <path d="M 108 28 Q 106 48 102 60 Q 98 72 104 80 Q 108 86 106 96"
        stroke="#c4a45a" strokeWidth="3.5" fill="none" opacity="0.45" strokeLinecap="round" />
      <ellipse cx="105" cy="99" rx="5.5" ry="7.5" fill="#c4a45a" opacity="0.45" />
      <path d="M 152 18 Q 150 40 147 54 Q 144 66 149 75 Q 153 82 151 92"
        stroke="#c4a45a" strokeWidth="2.8" fill="none" opacity="0.3" strokeLinecap="round" />
      <ellipse cx="150" cy="95" rx="4.5" ry="6" fill="#c4a45a" opacity="0.3" />
      {/* Bee */}
      <g transform="translate(206 60) rotate(25)" opacity="0.45">
        <ellipse cx="0" cy="0" rx="9" ry="6" fill="#c4a45a" />
        <line x1="-5" y1="-5" x2="-5" y2="5" stroke="#5a3a1a" strokeWidth="2.2" />
        <line x1="0"  y1="-6" x2="0"  y2="6" stroke="#5a3a1a" strokeWidth="2.2" />
        <line x1="5"  y1="-5" x2="5"  y2="5" stroke="#5a3a1a" strokeWidth="2.2" />
        <ellipse cx="-3" cy="-9" rx="8" ry="3.5" fill="#f5edd8" opacity="0.65" transform="rotate(-20 -3 -9)" />
        <ellipse cx="3"  cy="-9" rx="8" ry="3.5" fill="#f5edd8" opacity="0.65" transform="rotate(20 3 -9)" />
      </g>
      {/* Botanical accent */}
      <ellipse cx="32" cy="222" rx="14" ry="30" fill="#c4a45a" opacity="0.09" transform="rotate(22 32 222)" />
      <ellipse cx="50" cy="238" rx="10" ry="22" fill="#c4a45a" opacity="0.06" transform="rotate(12 50 238)" />
      {/* Script hint */}
      <text x="130" y="238" textAnchor="middle" fontFamily="serif" fontSize="12" fill="#c4a45a" opacity="0.3">मौरीघर</text>
    </svg>
  );
}

function FurnitureArt() {
  return (
    <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Wood-grain lines */}
      {[0,18,36,54,72,90,108,126,144,162,180,198,216,234,252].map((y, i) => (
        <line key={i} x1="-20" y1={y} x2="280" y2={y - 12} stroke="#8B6914" strokeWidth="0.6" opacity="0.18" />
      ))}
      {/* Floor shadow */}
      <ellipse cx="130" cy="212" rx="88" ry="10" fill="#5a3a1a" opacity="0.08" />
      {/* Sofa body */}
      <rect x="42" y="148" width="176" height="52" rx="14" fill="#8B6914" opacity="0.22" />
      {/* Sofa back */}
      <rect x="52" y="112" width="156" height="46" rx="12" fill="#8B6914" opacity="0.16" />
      {/* Left arm */}
      <rect x="36" y="120" width="28" height="66" rx="10" fill="#8B6914" opacity="0.22" />
      {/* Right arm */}
      <rect x="196" y="120" width="28" height="66" rx="10" fill="#8B6914" opacity="0.22" />
      {/* Cushion lines */}
      <line x1="130" y1="150" x2="130" y2="196" stroke="#5a3a1a" strokeWidth="1.2" opacity="0.12" />
      {/* Legs */}
      <rect x="68"  y="196" width="10" height="20" rx="3" fill="#5a3a1a" opacity="0.2" />
      <rect x="182" y="196" width="10" height="20" rx="3" fill="#5a3a1a" opacity="0.2" />
      {/* Decorative circle top-right */}
      <circle cx="210" cy="52" r="38" fill="#c4a45a" opacity="0.09" />
      <circle cx="210" cy="52" r="24" fill="#c4a45a" opacity="0.09" />
      {/* Small leaf accent */}
      <ellipse cx="46" cy="70" rx="12" ry="22" fill="#8B6914" opacity="0.1" transform="rotate(-30 46 70)" />
      <ellipse cx="58" cy="58" rx="8" ry="16" fill="#8B6914" opacity="0.08" transform="rotate(-15 58 58)" />
    </svg>
  );
}

function RestaurantArt() {
  return (
    <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Warm glow behind bowl */}
      <circle cx="130" cy="140" r="90" fill="#c4a45a" opacity="0.06" />
      <circle cx="130" cy="140" r="60" fill="#c4a45a" opacity="0.06" />
      {/* Plate */}
      <ellipse cx="130" cy="170" rx="82" ry="18" fill="#c4a45a" opacity="0.15" />
      {/* Bowl body */}
      <path d="M 60 145 Q 60 195 130 200 Q 200 195 200 145 Z" fill="#c4a45a" opacity="0.2" />
      {/* Bowl rim */}
      <ellipse cx="130" cy="145" rx="70" ry="14" fill="#c4a45a" opacity="0.25" />
      {/* Rice mound */}
      <ellipse cx="130" cy="138" rx="44" ry="18" fill="#f7f3ed" opacity="0.18" />
      {/* Steam wisps */}
      <path d="M 100 118 Q 95 100 100 82 Q 105 64 100 48" stroke="#c4a45a" strokeWidth="2.5" fill="none" opacity="0.35" strokeLinecap="round" />
      <path d="M 130 112 Q 125 92 130 72 Q 135 52 130 34" stroke="#c4a45a" strokeWidth="2.5" fill="none" opacity="0.35" strokeLinecap="round" />
      <path d="M 160 118 Q 155 98 160 80 Q 165 62 160 46" stroke="#c4a45a" strokeWidth="2.5" fill="none" opacity="0.35" strokeLinecap="round" />
      {/* Gold dots scattered */}
      {[[50,60],[200,80],[40,170],[220,155],[80,38],[175,44]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#c4a45a" opacity="0.35" />
      ))}
      {/* Nepali script decorative */}
      <text x="130" y="232" textAnchor="middle" fontFamily="serif" fontSize="13" fill="#c4a45a" opacity="0.4">नेपाली खाना</text>
      {/* Corner botanical */}
      <ellipse cx="28" cy="228" rx="14" ry="28" fill="#c4a45a" opacity="0.08" transform="rotate(20 28 228)" />
      <ellipse cx="42" cy="238" rx="10" ry="20" fill="#c4a45a" opacity="0.06" transform="rotate(10 42 238)" />
    </svg>
  );
}

function FuelEvArt() {
  return (
    <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Diagonal split */}
      <path d="M 0 0 L 260 0 L 140 260 L 0 260 Z" fill="#1a3a1a" opacity="0.07" />
      {/* EV circle */}
      <circle cx="178" cy="90" r="54" stroke="#22c55e" strokeWidth="1.5" fill="none" opacity="0.2" />
      <circle cx="178" cy="90" r="40" stroke="#22c55e" strokeWidth="1" fill="none" opacity="0.15" />
      {/* Lightning bolt */}
      <path d="M 185 58 L 168 92 L 180 92 L 163 124 L 194 84 L 180 84 Z"
        fill="#22c55e" opacity="0.55" />
      {/* Charging arc */}
      <path d="M 138 90 A 40 40 0 0 1 178 50" stroke="#22c55e" strokeWidth="2.5" fill="none" opacity="0.4" strokeLinecap="round" />
      {/* Fuel nozzle left side */}
      <rect x="52" y="130" width="26" height="60" rx="6" fill="#1a3a1a" opacity="0.18" />
      <rect x="46" y="125" width="38" height="14" rx="5" fill="#1a3a1a" opacity="0.2" />
      <path d="M 78 148 Q 96 148 96 165 L 96 178" stroke="#1a3a1a" strokeWidth="5" fill="none" opacity="0.2" strokeLinecap="round" />
      <rect x="88" y="178" width="18" height="26" rx="4" fill="#1a3a1a" opacity="0.2" />
      {/* Ground dots */}
      {[70,100,130,160,190].map((x, i) => (
        <circle key={i} cx={x} cy="240" r="2" fill="#1a3a1a" opacity="0.1" />
      ))}
      {/* Connecting line */}
      <line x1="0" y1="200" x2="260" y2="200" stroke="#1a3a1a" strokeWidth="0.8" opacity="0.1" strokeDasharray="6 4" />
      {/* Label badge hint */}
      <rect x="30" y="38" width="68" height="22" rx="11" fill="#1a3a1a" opacity="0.1" />
      <rect x="162" y="148" width="62" height="22" rx="11" fill="#22c55e" opacity="0.12" />
    </svg>
  );
}

function BikeRepairArt() {
  return (
    <svg viewBox="0 0 260 260" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Large wheel back */}
      <circle cx="132" cy="148" r="88" stroke="#8B6914" strokeWidth="1" fill="none" opacity="0.1" />
      {/* Main wheel */}
      <circle cx="132" cy="148" r="72" stroke="#5a3a1a" strokeWidth="2.5" fill="none" opacity="0.18" />
      {/* Tyre thickness */}
      <circle cx="132" cy="148" r="60" stroke="#5a3a1a" strokeWidth="7" fill="none" opacity="0.1" />
      {/* Hub */}
      <circle cx="132" cy="148" r="10" fill="#8B6914" opacity="0.3" />
      <circle cx="132" cy="148" r="5"  fill="#8B6914" opacity="0.5" />
      {/* Spokes — 8 of them */}
      {Array.from({length: 8}, (_, i) => {
        const angle = (i * Math.PI * 2) / 8;
        const x2 = 132 + Math.cos(angle) * 58;
        const y2 = 148 + Math.sin(angle) * 58;
        return <line key={i} x1="132" y1="148" x2={x2} y2={y2} stroke="#5a3a1a" strokeWidth="1.2" opacity="0.22" />;
      })}
      {/* Wrench top-left */}
      <g transform="translate(38, 42) rotate(-40)" opacity="0.25">
        <rect x="-4" y="-36" width="8" height="52" rx="4" fill="#5a3a1a" />
        <circle cx="0" cy="-36" r="10" fill="none" stroke="#5a3a1a" strokeWidth="4" />
        <circle cx="0" cy="-36" r="5" fill="#f0e4d0" />
      </g>
      {/* Small gear top-right */}
      <g transform="translate(212, 56)" opacity="0.2">
        {Array.from({length: 8}, (_, i) => {
          const a = (i * Math.PI * 2) / 8;
          return <rect key={i} x={Math.cos(a)*18 - 4} y={Math.sin(a)*18 - 7} width="8" height="14"
            rx="3" fill="#5a3a1a" transform={`rotate(${i*45} ${Math.cos(a)*18} ${Math.sin(a)*18})`} />;
        })}
        <circle cx="0" cy="0" r="16" fill="#f0e4d0" />
        <circle cx="0" cy="0" r="8"  fill="#5a3a1a" opacity="0.5" />
      </g>
      {/* Tread marks on wheel */}
      {Array.from({length: 12}, (_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        const x1 = 132 + Math.cos(angle) * 54;
        const y1 = 148 + Math.sin(angle) * 54;
        const x2 = 132 + Math.cos(angle) * 62;
        const y2 = 148 + Math.sin(angle) * 62;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#5a3a1a" strokeWidth="3" opacity="0.15" />;
      })}
    </svg>
  );
}


const STATS = [
  { value: '16+',   label: 'Years' },
  { value: '4',     label: 'Business units' },
  { value: '4.9★',  label: 'Food rating' },
  { value: 'Gulmi', label: 'Nepal' },
];

export default function HeroSection() {
  return (
    <section id="home" className="min-h-screen pt-16 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center py-20">

        {/* Left — text */}
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <p className="font-serif text-4xl lg:text-5xl text-dark tracking-tight">Samjhana Ventures</p>
            <p className="section-label">Gulmi, Nepal · Est. 2008</p>
          </div>

          <h1 className="font-serif text-5xl lg:text-6xl leading-[1.1] text-dark">
            Where{' '}
            <em className="not-italic text-gold italic">craft</em>{' '}
            meets community,<br className="hidden lg:block" /> in the hills.
          </h1>

          <p className="text-dark/60 text-lg leading-relaxed max-w-md font-sans font-light">
            Four businesses, one family. Furniture built to last, food cooked with heart,
            fuel for every journey, and repairs that get you moving.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to="/furniture" className="btn-dark">
              Explore our work <ArrowRight size={15} />
            </Link>
            <a href="#restaurant" className="btn-outline">View menu</a>
          </div>
        </div>

        {/* Right — business grid */}
        <div className="grid grid-cols-2 gap-3">

          {/* Maurighar — same square size as Furniture & Restaurant */}
          <Link to="/beekeeping"
            style={{ backgroundColor: '#2d1a0a', color: '#f5edd8' }}
            className="rounded-2xl aspect-square relative overflow-hidden flex flex-col justify-end p-5
                       transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
            <MaurigharArt />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <p className="font-serif text-xl font-semibold leading-tight">Maurighar</p>
              <p className="text-sm opacity-60 mt-0.5 font-sans">Honey & Heritage</p>
            </div>
            <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/10 flex items-center justify-center
                            opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
              <ArrowRight size={13} />
            </div>
          </Link>

          {/* Furniture */}
          <Link to="/furniture"
            style={{ backgroundColor: '#e8dfc8', color: '#3d2010' }}
            className="rounded-2xl aspect-square relative overflow-hidden flex flex-col justify-end p-5
                       transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
            <FurnitureArt />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <p className="font-serif text-xl font-semibold leading-tight">Furniture</p>
              <p className="text-sm opacity-65 mt-0.5 font-sans">Handcrafted wood</p>
            </div>
            <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
              <ArrowRight size={13} />
            </div>
          </Link>

          {/* Restaurant + Bike Repair — stacked in one grid slot */}
          <div className="flex flex-col gap-3 aspect-square">

            <a href="#restaurant"
              style={{ backgroundColor: '#1e1206', color: '#f5edd8' }}
              className="flex-1 rounded-2xl relative overflow-hidden flex flex-col justify-end p-4
                         transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group">
              <RestaurantArt />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex items-end justify-between">
                <div>
                  <p className="font-serif text-base font-semibold leading-tight">Restaurant</p>
                  <p className="text-xs opacity-60 mt-0.5 font-sans">Taste of the hills</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <ArrowRight size={11} />
                </div>
              </div>
            </a>

            <a href="#bike-repair"
              style={{ backgroundColor: '#f0e4d0', color: '#3d2010' }}
              className="flex-1 rounded-2xl relative overflow-hidden flex flex-col justify-end p-4
                         transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl group">
              <BikeRepairArt />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex items-end justify-between">
                <div>
                  <p className="font-serif text-base font-semibold leading-tight">Bike Repair</p>
                  <p className="text-xs opacity-60 mt-0.5 font-sans">Quick fix workshop</p>
                </div>
                <div className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <ArrowRight size={11} />
                </div>
              </div>
            </a>

          </div>

          {/* Fuel & EV */}
          <a href="#fuel-ev"
            style={{ backgroundColor: '#dce8d4', color: '#1a3a1a' }}
            className="rounded-2xl aspect-square relative overflow-hidden flex flex-col justify-end p-5
                       transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group">
            <FuelEvArt />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative z-10">
              <p className="font-serif text-xl font-semibold leading-tight">Fuel & EV</p>
              <p className="text-sm opacity-65 mt-0.5 font-sans">Pump & charging</p>
            </div>
            <div className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0">
              <ArrowRight size={13} />
            </div>
          </a>

        </div>
      </div>

      {/* Stat strip */}
      <div className="border-t border-warm-border bg-white/60">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-center sm:justify-start gap-x-10 gap-y-3">
          {STATS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="text-center">
                <p className="font-serif text-2xl font-semibold text-dark">{s.value}</p>
                <p className="text-xs text-dark/50 font-sans uppercase tracking-wider">{s.label}</p>
              </div>
              {i < STATS.length - 1 && <div className="w-px h-8 bg-warm-border hidden sm:block" />}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div className="flex justify-center py-4 animate-bounce">
        <ChevronDown size={20} className="text-dark/30" />
      </div>
    </section>
  );
}