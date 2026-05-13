const SERVICES = [
  { icon: '🛞', name: 'Tyre Change',      price: 'Rs 300', time: '30 min',   color: '#fef3c7', accent: '#92400e' },
  { icon: '⚙️', name: 'Engine Service',   price: 'Rs 800', time: '2–3 hr',   color: '#dbeafe', accent: '#1d4ed8' },
  { icon: '⚡', name: 'Electrical Fix',   price: 'Rs 500', time: '1–2 hr',   color: '#ede9fe', accent: '#6d28d9' },
  { icon: '🛑', name: 'Brake Service',    price: 'Rs 400', time: '45 min',   color: '#fee2e2', accent: '#b91c1c' },
  { icon: '💡', name: 'Lighting Repair',  price: 'Rs 200', time: '20 min',   color: '#dcfce7', accent: '#15803d' },
  { icon: '🔍', name: 'Free Diagnostics', price: 'Free',   time: 'Walk-in',  color: '#e8dfc8', accent: '#8B6914' },
];

const PILLS = ['All bikes', 'Motorcycles', 'Scooters', 'Electric'];

export default function BikeRepairSection() {
  return (
    <section id="bike-repair" className="py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-6">

        {/* Section label */}
        <div className="flex items-center gap-4 mb-12">
          <span className="section-label">Section 03</span>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left — intro */}
          <div className="flex flex-col gap-6">
            <p className="font-serif text-[120px] leading-none text-gold/15 select-none -mb-6">06</p>
            <h2 className="font-serif text-4xl lg:text-5xl text-dark">Bike Repair<br />Workshop</h2>
            <p className="text-dark/60 font-sans leading-relaxed">
              From a quick tyre swap to full engine overhauls — our trained mechanics get you
              back on the road without the wait. All bikes welcome.
            </p>
            <div className="flex flex-wrap gap-2">
              {PILLS.map((p) => (
                <span key={p} className="pill pill-inactive text-xs">{p}</span>
              ))}
            </div>
            <a href="#" className="btn-dark self-start">Book a service</a>
          </div>

          {/* Right — 3×2 service grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {SERVICES.map((s) => (
              <div key={s.name}
                style={{ backgroundColor: s.color }}
                className="rounded-2xl p-4 flex flex-col gap-3">
                <span className="text-2xl">{s.icon}</span>
                <div>
                  <p className="font-sans font-semibold text-dark text-sm leading-tight">{s.name}</p>
                  <p className="font-serif text-lg text-dark mt-1">{s.price}</p>
                </div>
                <span className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/60"
                  style={{ color: s.accent }}>
                  {s.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}