import { useState, useEffect } from 'react';
import { Fuel, Zap, Clock } from 'lucide-react';
import { fuelApi, evApi } from '../api/api.js';

const HOURS_CARD = { icon: Clock, label: 'Hours', value: '6am – 9pm', sub: 'Every day', bg: '#fef3c7', accent: '#92400e' };

export default function FuelEvSection() {
  const [fuel, setFuel]       = useState(null);
  const [vehicles, setVehicles] = useState([]);

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
    ...(vehicles.length > 0 ? [{
      icon: Zap,
      label: 'EV Charging',
      value: `Rs ${Number(vehicles[0].ratePerPercent).toFixed(0)}/%`,
      sub: `${vehicles.length} vehicle type${vehicles.length > 1 ? 's' : ''}`,
      bg: '#ede9fe',
      accent: '#6d28d9',
    }] : []),
  ];

  return (
    <section id="fuel-ev" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="flex items-center gap-4 mb-10">
          <div className="flex items-center gap-2.5">
            <span className="section-label">Section 02</span>
          </div>
          <div className="flex-1 h-px bg-warm-border" />
        </div>

        <h2 className="font-serif text-4xl lg:text-5xl text-dark mb-12">Petrol Pump & EV</h2>

        <div className="grid lg:grid-cols-2 gap-10">

          {/* Left — info cards */}
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3">
              {infoCards.map((c) => {
                const Icon = c.icon;
                return (
                  <div key={c.label} style={{ backgroundColor: c.bg }} className="rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: c.accent }}>{c.label}</p>
                      <Icon size={16} style={{ color: c.accent }} />
                    </div>
                    <p className="font-serif text-2xl text-dark">{c.value}</p>
                    <p className="text-xs text-dark/50 font-sans mt-1">{c.sub}</p>
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
          </div>

          {/* Right — EV vehicles */}
          <div className="flex flex-col gap-4">
            <div className="bg-[#dce8d4] rounded-2xl p-7 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Zap size={20} className="text-[#15803d]" />
                <p className="section-label text-[#15803d]">EV Charging Station</p>
              </div>
              <p className="font-serif text-3xl text-dark">Fast Charging</p>
              <div className="flex flex-wrap gap-4 text-sm text-dark/70 font-sans">
                <span>{vehicles.length > 0 ? `${vehicles.length} vehicle type${vehicles.length > 1 ? 's' : ''}` : 'All EV types'}</span>
                {vehicles.length > 0 && (
                  <>
                    <span>·</span>
                    <span>From Rs {Math.min(...vehicles.map((v) => Number(v.ratePerPercent))).toFixed(0)} / %</span>
                  </>
                )}
              </div>
              <a href="#" className="btn-dark self-start mt-2 text-sm">Book a slot</a>
            </div>

            {/* Vehicle list */}
            {vehicles.length > 0 && (
              <div className="bg-warm rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-dark/40 mb-4">Supported Vehicles</p>
                <div className="flex flex-col gap-3">
                  {vehicles.map((v) => (
                    <div key={v.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-sans font-medium text-dark text-sm">{v.vehicleName}</p>
                        {v.batteryCapacityKw && (
                          <p className="text-xs text-dark/40 font-sans">{Number(v.batteryCapacityKw).toFixed(1)} kW battery</p>
                        )}
                      </div>
                      <p className="font-serif text-base text-dark">Rs {Number(v.ratePerPercent).toFixed(0)}/%</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}