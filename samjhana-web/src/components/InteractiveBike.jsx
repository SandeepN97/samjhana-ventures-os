import { useState } from 'react';
import { AlertCircle, BatteryCharging, Disc3, Lightbulb, Search, Wrench } from 'lucide-react';
import motorcycleImage from '../assets/plates/motorcycle-real.jpg';

export const BIKE_SERVICES = [
  { id: 'tyre', Icon: Disc3, name: 'Tyre Change', time: '30 min', accent: '#d6b35c', story: 'A quick change when the road has caught up with your tyres.', x: 14, y: 74 },
  { id: 'engine', Icon: Wrench, name: 'Engine Service', time: '2–3 hr', accent: '#8fc5ff', story: 'For the deeper check when the bike needs more than a quick adjustment.', x: 58, y: 61 },
  { id: 'electrical', Icon: BatteryCharging, name: 'Electrical Fix', time: '1–2 hr', accent: '#c5a5ff', story: 'Lights, battery, and electrical issues checked before they become roadside problems.', x: 64, y: 43 },
  { id: 'brakes', Icon: AlertCircle, name: 'Brake Service', time: '45 min', accent: '#ff8e8e', story: 'A safety-first stop for brakes that feel soft, noisy, or uncertain.', x: 87, y: 74 },
  { id: 'lights', Icon: Lightbulb, name: 'Lighting Repair', time: '20 min', accent: '#a3edc0', story: 'Get seen again on early starts, late returns, and mountain roads.', x: 84, y: 32 },
  { id: 'diagnostics', Icon: Search, name: 'Free Diagnostics', time: 'Walk-in', accent: '#f1d58a', story: 'Start with a conversation and a practical look at what is wrong.', x: 51, y: 48 },
];

export default function InteractiveBike({ selected, onSelect }) {
  const [hovered, setHovered] = useState(null);
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
        <img src={motorcycleImage} alt="Motorcycle ready for repair service" className="interactive-bike-image" />
      </div>
      {BIKE_SERVICES.map((service) => { const Icon = service.Icon; return <button type="button" key={service.id} aria-label={`Show ${service.name}`} onMouseEnter={() => setHovered(service.id)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(service.id)} onBlur={() => setHovered(null)} onClick={() => { onSelect(service); setHovered(service.id); }} className={`bike-hotspot ${selected?.id === service.id ? 'bike-hotspot-active' : ''}`} style={{ left: `${service.x}%`, top: `${service.y}%`, '--hotspot-color': service.accent }}><Icon size={14} /><span className={`bike-hotspot-label ${service.y > 58 ? 'bike-hotspot-label-above' : 'bike-hotspot-label-below'} ${service.x < 25 ? 'bike-hotspot-label-left' : ''} ${service.x > 75 ? 'bike-hotspot-label-right' : ''}`}>{service.name}</span></button>; })}
      {selected && hovered === selected.id && <div className={`bike-story-popover ${selected.y < 42 ? 'bike-story-popover-below' : ''} ${selected.x < 28 ? 'bike-story-popover-left' : ''} ${selected.x > 72 ? 'bike-story-popover-right' : ''}`} style={{ left: `${selected.x}%`, top: `${selected.y}%`, '--popover-accent': selected.accent }}>
        <span className="bike-story-popover-kicker">{selected.time}</span>
        <strong>{selected.name}</strong>
        <p>{selected.story}</p>
      </div>}
      <div className="bike-instruction">Hover a part · tap on mobile</div>
    </div>
  );
}
