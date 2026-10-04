import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionDivider from './SectionDivider';
import { useSection } from '../../site/SiteContext';

const BAR_COLOR = (pct) => {
  if (pct >= 80) return '#e8a400';
  if (pct >= 50) return '#c4a45a';
  return '#e8d0a0';
};

export default function BeekeeperEdu() {
  const copy = useSection('beekeeping').education || {};
  const [openFaq, setOpenFaq] = useState(null);
  const STEPS = (copy.steps || []).map((s, i) => ({ num: i + 1, title: s.title, desc: s.text }));
  const FAQS = (copy.faqs || []).map((f) => ({ q: f.question, a: f.answer }));
  const SEASONS = (copy.seasons || []).map((x) => ({ ...x, pct: Number(x.percent) || 0 }));

  return (
    <section id="bee-edu" className="bg-[#fdf8e8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="07" name={copy.sectionName} tag={copy.tag} tagColor="green" />

        <div className="grid md:grid-cols-3 gap-10 lg:gap-12">

          {/* Column 1: Steps */}
          <div>
            <h2 className="font-serif text-xl text-[#1a1000] mb-6">{copy.stepsTitle}</h2>
            <div className="flex flex-col gap-5">
              {STEPS.map((step) => (
                <div key={step.num} className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#e8a400] flex items-center justify-center shrink-0">
                    <span className="font-sans text-xs font-bold text-white">{step.num}</span>
                  </div>
                  <div>
                    <p className="font-sans text-sm font-semibold text-[#1a1000]">{step.title}</p>
                    <p className="font-sans text-[12px] text-[#1a1000]/55 mt-1 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: FAQ */}
          <div>
            <h2 className="font-serif text-xl text-[#1a1000] mb-6">{copy.faqTitle}</h2>
            <div className="flex flex-col divide-y divide-[#e8a400]/10">
              {FAQS.map((faq, i) => (
                <div key={i} className="py-3">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-start justify-between gap-3 text-left">
                    <p className="font-sans text-sm font-semibold text-[#1a1000] leading-snug">{faq.q}</p>
                    <ChevronDown size={16} className={`text-[#e8a400] shrink-0 mt-0.5 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <p className="font-sans text-[12px] text-[#1a1000]/60 mt-2 leading-relaxed pr-6">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Season calendar */}
          <div>
            <h2 className="font-serif text-xl text-[#1a1000] mb-6">{copy.seasonTitle}</h2>
            <div className="flex flex-col gap-3">
              {SEASONS.map((s) => (
                <div key={s.month}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-xs font-semibold text-[#1a1000]/70">{s.month}</span>
                      <span className="font-sans text-[11px] text-[#8B6914]">{s.nepali}</span>
                    </div>
                    <span className="font-sans text-[10px] text-[#1a1000]/40">{s.label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e8a400]/10 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, backgroundColor: BAR_COLOR(s.pct) }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Nepali note */}
            <div className="mt-6 bg-[#faeeda] rounded-2xl p-4 border border-[#e8a400]/15">
              <p className="font-sans text-[13px] text-[#8B6914] leading-relaxed">
                {copy.seasonNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}