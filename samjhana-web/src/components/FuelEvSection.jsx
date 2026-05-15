import { useState, useEffect } from 'react';
import { Fuel, Zap, Clock, Search } from 'lucide-react';
import { fuelApi, evApi } from '../api/api.js';

const HOURS_CARD = { icon: Clock, label: 'Hours', value: '6am – 9pm', sub: 'Every day', bg: '#fef3c7', accent: '#92400e' };

export default function FuelEvSection() {
  const [fuel, setFuel]         = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [query, setQuery]       = useState('');

  useEffect(() => {
    fuelApi.getCurrent().then(setFuel).catch(() => {});
    evApi.getVehicles().then(setVehicles).catch(() => {});
  }, []);

  const petrolPrice = fuel?.petrol?.pricePerLiter ? `Rs ${Number(fuel.petrol.pricePerLiter).toFixed(1)}/L` : '—';
  const dieselPrice = fuel?.diesel?.pricePerLiter ? `Rs ${Number(fuel.diesel.pricePerLiter).toFixed(1)}/L` : '—';

  const infoCards = [
    { icon: Fuel,  label: 'Petrol', value: petrolPrice, sub: 'Available now', bg: '#dbeafe', accent: '#1d4ed8' },
    { icon: Fuel,  label: 'Diesel', value: dieselPrice, sub: 'Available now', bg: '#dcfce7', accent: '#15803d' },
    HOURS_CARD,
  ];

  const minRate    = vehicles.length > 0 ? Math.min(...vehicles.map((v) => Number(v.ratePerPercent))) : null;
  const filtered   = vehicles.filter((v) => v.vehicleName.toLowerCase().includes(query.toLowerCase()));

  return (
    <section id="fuel-ev" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="flex items-center gap-4 mb-10">
          <span className="section-label">Section 02</span>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        <h2 className="font-serif text-4xl lg:text-5xl text-dark mb-12">Petrol Pump & EV</h2>

        <div className="grid lg:grid-cols-2 gap-10 items-start">

          {/* Left — fuel cards + EV banner */}
          <div className="flex flex-col gap-4">

            {/* 3 info cards */}
            <div className="grid grid-cols-3 gap-3">
              {infoCards.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} style={{ backgroundColor: c.bg }} className="rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: c.accent }}>{c.label}</p>
                      <Icon size={13} style={{ color: c.accent }} />
                    </div>
                    <p className="font-serif text-xl text-dark">{c.value}</p>
                    <p className="text-[10px] text-dark/50 font-sans mt-1">{c.sub}</p>
                  </div>
                );
              })}
            </div>

            {/* Fuel price note */}
            {fuel?.petrol?.effectiveDate && (
              <p className="text-xs text-dark/40 font-sans">
                Prices effective {fuel.petrol.effectiveDate} · Source: NOC
              </p>
            )}

            {/* EV Charging Station banner */}
            <div className="bg-[#dce8d4] rounded-2xl p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-[#15803d]" />
                <p className="section-label text-[#15803d]">EV Charging Station</p>
              </div>
              <p className="font-serif text-3xl text-dark">Fast Charging</p>
              <div className="flex flex-wrap gap-3 text-sm text-dark/70 font-sans">
                <span>{vehicles.length > 0 ? `${vehicles.length} vehicle types` : 'All EV types'}</span>
                {minRate !== null && <><span>·</span><span>From Rs {minRate.toFixed(0)} / %</span></>}
              </div>
              <a href="#" className="btn-dark self-start mt-1 text-sm">Book a slot</a>
            </div>
          </div>

          {/* Right — searchable vehicle list */}
          {vehicles.length > 0 && (
            <div className="bg-warm rounded-2xl p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-dark/40">Supported Vehicles</p>
                <span className="text-xs text-dark/30 font-sans">{vehicles.length} types</span>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark/30 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search vehicle…"
                  className="w-full pl-8 pr-3 py-2 text-sm font-sans bg-white border border-warm-border rounded-xl
                             text-dark placeholder:text-dark/30 focus:outline-none focus:ring-1 focus:ring-gold/40"
                />
              </div>

              <div className="ev-scroll overflow-y-auto max-h-72 flex flex-col divide-y divide-warm-border/60 pr-1">
                {filtered.length > 0 ? filtered.map((v) => (
                  <div key={v.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="font-sans font-medium text-dark text-sm">{v.vehicleName}</p>
                      {v.batteryCapacityKw && (
                        <p className="text-xs text-dark/40 font-sans">
                          {Number(v.batteryCapacityKw).toFixed(1)} kW · {v.seatingCapacity} seats
                        </p>
                      )}
                    </div>
                    <p className="font-serif text-sm text-dark shrink-0 ml-4">
                      Rs {Number(v.ratePerPercent).toFixed(0)}/%
                    </p>
                  </div>
                )) : (
                  <p className="py-6 text-sm text-dark/30 font-sans text-center">No match for "{query}"</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}