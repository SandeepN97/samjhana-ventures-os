const VEG = <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500 mr-2 shrink-0" />;
const NON = <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500  mr-2 shrink-0" />;

const MAINS = [
  { name: 'Dal Bhat Set',      price: 180, veg: true  },
  { name: 'Khasi ko Masu',     price: 350, veg: false },
  { name: 'Dhido Set',         price: 150, veg: true  },
  { name: 'Kukhura ko Masu',   price: 280, veg: false },
];
const SNACKS = [
  { name: 'Buff Momo (8 pcs)', price: 220, veg: false },
  { name: 'Sel Roti',          price: 80,  veg: true  },
  { name: 'Mushroom Chyau',    price: 120, veg: true  },
];
const DRINKS = [
  { name: 'Masala Chiya',   price: 30,  veg: true },
  { name: 'Plain Tea',      price: 20,  veg: true },
  { name: 'Lassi',          price: 60,  veg: true },
  { name: 'Fruit Juice',    price: 50,  veg: true },
];
const BREAKFAST = [
  { name: 'Sel Roti Set',   price: 100, veg: true },
  { name: 'Chiura Dahi',    price: 80,  veg: true },
  { name: 'Egg Roti',       price: 90,  veg: false },
];
const DISH_CELLS = [
  { emoji: '🍛', label: 'Dal Bhat',  bg: '#2d1a0a' },
  { emoji: '🥩', label: 'Khasi',     bg: '#3d2010' },
  { emoji: '🍵', label: 'Chiya',     bg: '#2a1808' },
  { emoji: '🥟', label: 'Momo',      bg: '#351e0d' },
];
const AMBIENCE = ['Mountain view', 'Open kitchen', 'Community table', 'No booking needed'];
const STATS = [
  { value: '10+', label: 'Years' },
  { value: '4.9★', label: 'Rating' },
  { value: 'Rs 80', label: 'Cheapest dish' },
  { value: '6am–9pm', label: 'Daily' },
];

function MenuItem({ item }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/10">
      <span className="flex items-center text-sm text-white/80 font-sans">
        {item.veg ? VEG : NON}{item.name}
      </span>
      <span className="font-serif text-white/90 text-sm shrink-0 ml-4">Rs {item.price}</span>
    </div>
  );
}

export default function RestaurantSection() {
  return (
    <section id="restaurant" className="bg-[#1e1206]">

      {/* Dark hero */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-center gap-4 mb-10">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Section 04</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <div className="flex flex-col gap-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold/80">Maurighar Restaurant</p>
            <h2 className="font-serif text-5xl lg:text-6xl text-white leading-tight">
              Taste of<br /><em className="italic text-gold">the hills.</em>
            </h2>
            <p className="text-white/50 font-sans leading-relaxed max-w-md">
              Home-cooked Nepali food made fresh every day. Grown in the hills, served with warmth.
              No fuss, no frills — just honest food.
            </p>
            {/* Stats */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-2">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="font-serif text-2xl text-white">{s.value}</p>
                  <p className="text-xs text-white/40 font-sans mt-0.5 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 2×2 dish preview */}
          <div className="grid grid-cols-2 gap-3">
            {DISH_CELLS.map((d) => (
              <div key={d.label} style={{ backgroundColor: d.bg }}
                className="rounded-2xl aspect-square flex flex-col items-center justify-center gap-2 border border-white/5">
                <span className="text-4xl">{d.emoji}</span>
                <p className="text-sm font-sans text-white/60">{d.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3-column menu */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">Full Menu</p>
            <div className="flex items-center gap-3 ml-4 text-xs text-white/30 font-sans">
              <span className="flex items-center gap-1.5">{VEG} Vegetarian</span>
              <span className="flex items-center gap-1.5">{NON} Non-veg</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-10">

            {/* Col 1 — Mains + Snacks */}
            <div>
              <p className="font-serif text-xl text-white mb-1">Mains</p>
              <p className="text-xs text-white/40 font-sans mb-4">Served with rice or dhido</p>
              {MAINS.map((i) => <MenuItem key={i.name} item={i} />)}

              <p className="font-serif text-xl text-white mt-8 mb-4">Snacks</p>
              {SNACKS.map((i) => <MenuItem key={i.name} item={i} />)}
            </div>

            {/* Col 2 — Drinks + Breakfast */}
            <div>
              <p className="font-serif text-xl text-white mb-1">Drinks</p>
              <p className="text-xs text-white/40 font-sans mb-4">Hot & cold beverages</p>
              {DRINKS.map((i) => <MenuItem key={i.name} item={i} />)}

              <p className="font-serif text-xl text-white mt-8 mb-1">Breakfast</p>
              <p className="text-xs text-white/40 font-sans mb-4">Served 6am – 10am daily</p>
              {BREAKFAST.map((i) => <MenuItem key={i.name} item={i} />)}
            </div>

            {/* Col 3 — Hours + Ambience + Nepali note */}
            <div className="flex flex-col gap-5">
              {/* Hours card */}
              <div className="rounded-2xl border border-white/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-4">Opening hours</p>
                {[
                  { day: 'Breakfast', time: '6:00 – 10:00 am' },
                  { day: 'Lunch',     time: '11:00 am – 3:00 pm' },
                  { day: 'Dinner',    time: '5:00 – 9:00 pm' },
                ].map((h) => (
                  <div key={h.day} className="flex justify-between py-2 border-b border-white/5 text-sm">
                    <span className="text-white/50 font-sans">{h.day}</span>
                    <span className="text-white/80 font-sans">{h.time}</span>
                  </div>
                ))}
                <p className="text-xs text-white/30 font-sans mt-3">Open every day — no reservations needed</p>
              </div>

              {/* Ambience cards */}
              <div className="grid grid-cols-2 gap-2">
                {AMBIENCE.map((a) => (
                  <div key={a} className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs text-white/50 font-sans">
                    {a}
                  </div>
                ))}
              </div>

              {/* Nepali kitchen note */}
              <div className="rounded-2xl bg-gold/10 border border-gold/20 p-5">
                <p className="text-gold text-sm font-semibold mb-2">Our kitchen</p>
                <p className="font-serif text-white/70 text-lg leading-relaxed">
                  "गुल्मीको माटोको स्वाद।"
                </p>
                <p className="text-white/30 text-xs font-sans mt-2">The taste of Gulmi's soil.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer strip */}
      <div className="border-t border-white/10 bg-dark/50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-sm text-white/40 font-sans">
          <div className="flex flex-wrap gap-6">
            <span>🕐 Daily 6am – 9pm</span>
            <span>📍 Gulmi, Baglung Highway</span>
            <span>📞 +977-XXXXXXXXXX</span>
          </div>
          <span className="text-xs">No reservations · Walk-in only</span>
        </div>
      </div>
    </section>
  );
}