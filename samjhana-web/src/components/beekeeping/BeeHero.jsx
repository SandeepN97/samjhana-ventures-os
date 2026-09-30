import honeyPhoto from '../../assets/real/honey-jar.jpg';
import hivePhoto from '../../assets/real/hive-boxes.jpg';
import suitPhoto from '../../assets/real/protective-suit.webp';
import toolsPhoto from '../../assets/real/smoker-tools.jpg';

const STATS = [
  { value: '16+',  label: 'Years experience' },
  { value: 'Apis cerana', label: 'Native bee species' },
  { value: 'Tuni wood', label: 'Premium material' },
  { value: '4.9 ★', label: 'Customer rating' },
];

const GRID_ITEMS = [
  { label: 'Mauri Ghar hives', image: hivePhoto, position: 'center' },
  { label: 'Protective suits', image: suitPhoto, position: 'center' },
  { label: 'Beekeeping tools', image: toolsPhoto, position: 'center' },
  { label: 'Raw Gulmi honey', image: honeyPhoto, position: 'center' },
];

export default function BeeHero({ onShopHives, onStarterKits }) {
  return (
    <section className="bg-[#fdf8e8] pt-28 pb-0 relative overflow-hidden">
      <div aria-hidden="true" className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#f4d35e]/25 blur-3xl" />
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left */}
          <div className="flex flex-col gap-6 motion-rise">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-widest text-[#8B6914]/60">
              Gulmi · Nepal · Apis Cerana · Since 2008
            </p>

            <h1 className="font-serif text-4xl lg:text-5xl text-[#1a1000] leading-tight">
              Honey and beekeeping<br />
              <em className="text-[#e8a400] not-italic">from Gulmi.</em>
            </h1>

            <p className="font-sans text-base text-[#1a1000]/60 leading-relaxed">
              Traditional hives. Modern tools. Honest honey.
            </p>
            <p className="font-sans text-sm text-[#1a1000]/50 leading-relaxed max-w-md">
              From the hills of Gulmi, we craft Langstroth and traditional hives
              from seasoned Nepali Tuni wood — perfect for Apis cerana colonies.
              Everything you need to start or scale your apiary.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={onShopHives}
                className="min-h-[44px] px-6 py-3 bg-[#e8a400] text-white font-sans font-semibold text-sm rounded-xl hover:bg-[#d49400] transition-colors">
                Browse hives
              </button>
              <button onClick={onStarterKits}
                className="min-h-[44px] px-6 py-3 bg-[#1a1000] text-white font-sans font-semibold text-sm rounded-xl hover:bg-[#2d1a0a] transition-colors">
                See starter kits
              </button>
              <a href="#bee-edu"
                className="min-h-[44px] px-6 py-3 border border-[#e8a400]/40 text-[#8B6914] font-sans font-semibold text-sm rounded-xl hover:bg-[#faeeda] transition-colors flex items-center">
                Learn beekeeping
              </a>
            </div>
          </div>

          {/* Right */}
          <div className="flex flex-col gap-5 motion-fade motion-delay-2">
            <div className="grid grid-cols-2 gap-3">
              {GRID_ITEMS.map(({ label, image, position }) => (
                <div key={label} className="rounded-2xl overflow-hidden aspect-[4/3] relative flex flex-col"
                  style={{ backgroundColor: '#f4e9ae' }}>
                  <img className="bee-hero-photo" src={image} alt="" style={{ objectPosition: position }} />
                  <div className="bee-hero-photo-shade" />
                  <p className="absolute bottom-2 left-3 z-10 font-sans text-[11px] font-semibold text-white/90">{label}</p>
                </div>
              ))}
            </div>

            {/* Stats strip */}
            <div className="bee-stats grid grid-cols-4 gap-3 bg-white rounded-2xl p-4 border border-[#e8a400]/10">
              {STATS.map(({ value, label }) => (
                <div key={label} className="text-center">
                  <p className="font-serif text-lg text-[#1a1000] leading-none">{value}</p>
                  <p className="font-sans text-[10px] text-[#1a1000]/40 mt-1 leading-tight">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Honey wave divider */}
      <div className="mt-10 h-8 bg-[#fdf3c0]" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
    </section>
  );
}
