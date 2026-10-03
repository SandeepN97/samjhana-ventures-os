import { useState, useEffect } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { useSection } from '../site/SiteContext';
import { whatsappLink } from '../site/links';

export default function CustomOrderModal({ onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', description: '', budget: '' });
  const [submitted, setSubmitted] = useState(false);
  const copy = useSection('furniture');
  const contact = useSection('contact');

  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // The request goes to the shop on WhatsApp, where the quote is agreed (nothing is stored on this website).
  const handleSubmit = (e) => {
    e.preventDefault();
    const message = `Namaste! Custom furniture request\nName: ${form.name}\nPhone: ${form.phone}\nWhat I need: ${form.description}${form.budget ? `\nBudget: ${form.budget}` : ''}`;
    const link = whatsappLink(contact, message);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-dark/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-warm text-dark/40 hover:text-dark transition-colors">
          <X size={18} />
        </button>

        {submitted ? (
          <div className="text-center py-6 flex flex-col items-center gap-4">
            <CheckCircle size={48} className="text-gold" />
            <h3 className="font-serif text-2xl text-dark">Almost there!</h3>
            <p className="text-dark/60 font-sans text-sm leading-relaxed">
              Your request is ready in WhatsApp. Press send there and we will reply with a quote.
            </p>
            <button onClick={onClose} className="btn-dark mt-2">Close</button>
          </div>
        ) : (
          <>
            <h2 className="font-serif text-2xl text-dark mb-1">{copy.customTitle}</h2>
            <p className="text-sm text-dark/50 font-sans mb-6">{copy.customIntro}</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-dark/60 uppercase tracking-wide mb-1.5">Your name</label>
                  <input value={form.name} onChange={set('name')} required placeholder="Full name"
                    className="w-full border border-warm-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold font-sans" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark/60 uppercase tracking-wide mb-1.5">Phone</label>
                  <input value={form.phone} onChange={set('phone')} required placeholder="98XXXXXXXX"
                    className="w-full border border-warm-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold font-sans" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark/60 uppercase tracking-wide mb-1.5">Describe what you need</label>
                <textarea value={form.description} onChange={set('description')} required rows={3}
                  placeholder={copy.customHint}
                  className="w-full border border-warm-border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold font-sans" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark/60 uppercase tracking-wide mb-1.5">Estimated budget</label>
                <input value={form.budget} onChange={set('budget')} placeholder="e.g. Rs 50,000 – 80,000"
                  className="w-full border border-warm-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold font-sans" />
              </div>

              <button type="submit" className="btn-gold justify-center py-3 mt-1">Send on WhatsApp</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}