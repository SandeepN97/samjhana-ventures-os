import { useState } from 'react';
import { AlertCircle, BatteryCharging, Disc3, Lightbulb, Search, Wrench } from 'lucide-react';
import { useSection } from '../../site/SiteContext';
import { mediaPath, mediaUrl } from '../../api/api.js';
import { telLink } from '../../site/links';

const ICONS = { disc: Disc3, wrench: Wrench, battery: BatteryCharging, alert: AlertCircle, bulb: Lightbulb, search: Search };

function InteractiveBike({ bike, selected, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const services = bike.services || [];
  const image = mediaUrl(mediaPath(bike.image));

  const handleMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    event.currentTarget.style.setProperty('--bike-rotate-y', `${x * 4}deg`);
    event.currentTarget.style.setProperty('--bike-rotate-x', `${y * -3}deg`);
  };
  const resetMove = (event) => {
    event.currentTarget.style.setProperty('--bike-rotate-y', '0deg');
    event.currentTarget.style.setProperty('--bike-rotate-x', '0deg');
  };

  return (
    <div className="interactive-bike" style={{ '--bike-accent': selected?.accent || '#d6b35c' }} onPointerMove={handleMove} onPointerLeave={resetMove}>
      <div className="bike-workshop-stage">
        <div className="bike-workshop-glow" />
        {image && <img src={image} alt="Motorcycle ready for repair service" className="interactive-bike-image" />}
      </div>
      {services.map((service) => {
        const Icon = ICONS[service.icon] || Wrench;
        const x = Number(service.x) || 50;
        const y = Number(service.y) || 50;
        return (
          <button type="button" key={service.name} aria-label={`Show ${service.name}`}
            onMouseEnter={() => setHovered(service.name)} onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(service.name)} onBlur={() => setHovered(null)}
            onClick={() => { onSelect(service); setHovered(service.name); }}
            className={`bike-hotspot ${selected?.name === service.name ? 'bike-hotspot-active' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, '--hotspot-color': service.accent }}>
            <Icon size={14} />
            <span className={`bike-hotspot-label ${y > 58 ? 'bike-hotspot-label-above' : 'bike-hotspot-label-below'} ${x < 25 ? 'bike-hotspot-label-left' : ''} ${x > 75 ? 'bike-hotspot-label-right' : ''}`}>{service.name}</span>
          </button>
        );
      })}
      {selected && hovered === selected.name && (
        <div className={`bike-story-popover ${Number(selected.y) < 42 ? 'bike-story-popover-below' : ''} ${Number(selected.x) < 28 ? 'bike-story-popover-left' : ''} ${Number(selected.x) > 72 ? 'bike-story-popover-right' : ''}`}
          style={{ left: `${Number(selected.x) || 50}%`, top: `${Number(selected.y) || 50}%`, '--popover-accent': selected.accent }}>
          <span className="bike-story-popover-kicker">{selected.time}</span>
          <strong>{selected.name}</strong>
          <p>{selected.story}</p>
        </div>
      )}
      {bike.hint && <div className="bike-instruction">{bike.hint}</div>}
    </div>
  );
}

export default function BikeRepairSection() {
  const bike = useSection('bike');
  const hours = useSection('hours');
  const contact = useSection('contact');
  const [selected, setSelected] = useState(null);
  const tel = telLink(contact);

  return (
    <section id="bike-repair" className="py-24 bg-warm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-12"><span className="section-label">{bike.eyebrow}</span><div className="flex-1 h-px bg-warm-border" /></div>
        <div className="grid lg:grid-cols-[.8fr_1.2fr] gap-12 lg:gap-16 items-center">
          <div className="flex flex-col gap-6">
            <h2 className="font-serif text-4xl lg:text-5xl text-dark">{bike.titleLine1}<br /><em className="not-italic text-gold">{bike.titleLine2}</em></h2>
            <p className="text-dark/60 font-sans leading-relaxed">{bike.copy}</p>
            {hours.bikeRepair && <p className="text-sm text-dark/50">{hours.bikeRepair}</p>}
            {(bike.pills || []).length > 0 && <div className="flex flex-wrap gap-2">{bike.pills.map((p) => <span key={p} className="pill pill-inactive text-xs">{p}</span>)}</div>}
            {tel && bike.cta && <a href={tel} className="btn-dark self-start">{bike.cta}</a>}
          </div>
          <InteractiveBike bike={bike} selected={selected} onSelect={setSelected} />
        </div>
      </div>
    </section>
  );
}
