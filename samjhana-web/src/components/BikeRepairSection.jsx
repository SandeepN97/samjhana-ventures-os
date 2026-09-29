import { useState } from 'react';
import InteractiveBike, { BIKE_SERVICES } from './InteractiveBike';

const PILLS = ['All bikes', 'Motorcycles', 'Scooters', 'Electric'];

export default function BikeRepairSection() {
  const [selected, setSelected] = useState(null);

  return (
    <section id="bike-repair" className="py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-12"><span className="section-label">Section 03</span><div className="flex-1 h-px bg-warm-border" /></div>
        <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-12 lg:gap-16 items-center">
          <div className="flex flex-col gap-6">
            <p className="font-serif text-[120px] leading-none text-gold/15 select-none -mb-6">03</p>
            <h2 className="font-serif text-4xl lg:text-5xl text-dark">Back on the<br /><em className="not-italic text-gold">road again.</em></h2>
            <p className="text-dark/60 font-sans leading-relaxed">From a quick tyre swap to a deeper engine check, our mechanics help you get moving again. Tap a part of the bike to see how we can help, then call to check today’s availability.</p>
            <div className="flex flex-wrap gap-2">{PILLS.map((p) => <span key={p} className="pill pill-inactive text-xs">{p}</span>)}</div>
            <a href="tel:+9779363147818" className="btn-dark self-start">Call about your bike</a>
          </div>
          <InteractiveBike selected={selected} onSelect={setSelected} />
        </div>
      </div>
    </section>
  );
}
