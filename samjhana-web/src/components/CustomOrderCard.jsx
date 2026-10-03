import { useState } from 'react';
import { ArrowRight, MessageCircle, X } from 'lucide-react';
import { useSection } from '../site/SiteContext';
import { whatsappLink } from '../site/links';

/**
 * A custom-furniture request. It is written up as a WhatsApp message to the shop (the number comes from the
 * contact details), so the request really reaches somebody instead of going nowhere.
 */
export default function CustomOrderCard() {
  const shop = useSection('shop');
  const contact = useSection('contact');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', description: '', budget: '' });
  const base = whatsappLink(contact);
  if (!base || !shop.customOrderTitle) return null;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const message = [
    `Custom order request`,
    `Name: ${form.name}`,
    `Phone: ${form.phone}`,
    `What I need: ${form.description}`,
    form.budget && `Budget: ${form.budget}`,
  ].filter(Boolean).join('\n');
  const ready = form.name.trim() && form.phone.trim() && form.description.trim();

  return (
    <>
      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl bg-gold p-6 text-white sm:flex-row sm:items-center">
        <div>
          <p className="font-serif text-xl">{shop.customOrderTitle}</p>
          {shop.customOrderText && <p className="mt-1 text-sm text-white/80">{shop.customOrderText}</p>}
        </div>
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 font-semibold text-dark hover:bg-warm">
          {shop.customOrderCta || 'Ask for a quote'} <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-dark/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={shop.customOrderTitle} className="relative w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-dark/40 hover:bg-warm hover:text-dark"><X size={18} /></button>
            <h2 className="mb-1 font-serif text-2xl text-dark">{shop.customOrderTitle}</h2>
            <p className="mb-6 text-sm text-dark/50">Tell us what you need. Your message opens in WhatsApp, ready to send to us.</p>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="co-q-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dark/60">Your name</label>
                  <input id="co-q-name" value={form.name} onChange={set('name')} className="min-h-[44px] w-full rounded-xl border border-warm-border px-4 text-sm focus:border-gold focus:outline-none" />
                </div>
                <div>
                  <label htmlFor="co-q-phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dark/60">Phone</label>
                  <input id="co-q-phone" type="tel" value={form.phone} onChange={set('phone')} className="min-h-[44px] w-full rounded-xl border border-warm-border px-4 text-sm focus:border-gold focus:outline-none" />
                </div>
              </div>
              <div>
                <label htmlFor="co-q-desc" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dark/60">Describe what you need</label>
                <textarea id="co-q-desc" rows={3} value={form.description} onChange={set('description')} className="w-full resize-none rounded-xl border border-warm-border px-4 py-2.5 text-sm focus:border-gold focus:outline-none" />
              </div>
              <div>
                <label htmlFor="co-q-budget" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-dark/60">Estimated budget (optional)</label>
                <input id="co-q-budget" value={form.budget} onChange={set('budget')} className="min-h-[44px] w-full rounded-xl border border-warm-border px-4 text-sm focus:border-gold focus:outline-none" />
              </div>
              <a href={ready ? `${base}?text=${encodeURIComponent(message)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!ready}
                onClick={(e) => { if (!ready) e.preventDefault(); else setOpen(false); }}
                className={`btn-gold min-h-[44px] justify-center py-3 ${ready ? '' : 'pointer-events-none opacity-50'}`}>
                <MessageCircle size={16} aria-hidden="true" /> Send on WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
