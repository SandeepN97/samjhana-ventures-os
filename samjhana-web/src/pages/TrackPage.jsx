import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneLookup } from './OrderPage';

export default function TrackPage() {
  const navigate = useNavigate();
  const [orderNumber, setOrderNumber] = useState('');

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="font-serif text-3xl text-dark">Track your order</h1>
      <p className="mb-6 mt-2 text-dark/60">Enter your order number and the phone number you gave when you ordered.</p>
      <div className="mb-4">
        <label htmlFor="track-number" className="mb-1 block text-sm font-medium">Order number</label>
        <input id="track-number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value.toUpperCase())} placeholder="SV-261003-AB2C" autoCapitalize="characters"
          className="min-h-[44px] w-full rounded-lg border border-warm-border bg-white px-3 py-2 font-mono focus:border-gold focus:outline-none" />
      </div>
      <PhoneLookup orderNumber={orderNumber}
        onFound={(order, phone) => navigate(`/order/${order.orderNumber}`, { state: { order, phone } })} />
    </main>
  );
}
