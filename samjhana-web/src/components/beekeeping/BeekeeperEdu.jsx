import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SectionDivider from './SectionDivider';

const STEPS = [
  {
    num: 1,
    title: 'Choose your hive',
    desc: 'Langstroth two-story best for Apis cerana. Avoid log hives first — they\'re harder to manage and inspect.',
  },
  {
    num: 2,
    title: 'Get a colony',
    desc: 'Purchase nuc with mated queen from local apiary. Chaitra–Baisakh (March–April) is best time for new colonies.',
  },
  {
    num: 3,
    title: 'Suit up and inspect',
    desc: 'Always wear veil and gloves. Open in morning when bees are calmer. Smoke entrance first, wait 30 seconds.',
  },
  {
    num: 4,
    title: 'Manage the queen',
    desc: 'Find queen every 2–3 weeks. Check for eggs and brood pattern. Uniform capped brood = healthy queen.',
  },
  {
    num: 5,
    title: 'Harvest honey',
    desc: 'Capped frames ready to harvest. Use uncapping knife and extractor. Never heat above 40°C — preserves enzymes.',
  },
];

const FAQS = [
  {
    q: 'What bee species is best for Nepal?',
    a: 'Apis cerana (Ghar Mauri) is native to Nepal and perfectly adapted to local flora and climate. Apis mellifera (European honey bee) is kept commercially but requires more intensive management.',
  },
  {
    q: 'What wood is used for Mauri Ghar hives?',
    a: 'We use Tuni (Toona ciliata) and Uttish (Alnus nepalensis) — both locally sourced, seasoned Nepali hardwoods. They resist moisture, warping, and don\'t have strong odours that disturb bees.',
  },
  {
    q: 'How many hives can a beginner manage?',
    a: 'Start with 1–2 hives to learn the rhythm of inspections and bee behaviour. Most beginners are ready for 4–6 hives by their second season.',
  },
  {
    q: 'When is honey season in Gulmi?',
    a: 'Two peak seasons: Baisakh–Jestha (April–May, spring blossom) and Asoj–Kartik (October–November, autumn harvest). Spring honey is lighter; autumn darker and stronger.',
  },
  {
    q: 'Do you offer training?',
    a: 'Yes. We run practical beekeeping workshops in Gulmi district, covering hive setup, queen management, and honey extraction. WhatsApp us for the next date.',
  },
];

const SEASONS = [
  { month: 'Baisakh',  nepali: 'बैशाख',  pct: 90, label: 'Peak' },
  { month: 'Jestha',   nepali: 'जेठ',    pct: 60, label: 'Good' },
  { month: 'Asar',     nepali: 'असार',   pct: 20, label: 'Low' },
  { month: 'Shrawan',  nepali: 'साउन',   pct: 15, label: 'Low' },
  { month: 'Bhadra',   nepali: 'भदौ',    pct: 50, label: 'Rising' },
  { month: 'Asoj',     nepali: 'असोज',   pct: 85, label: 'Peak' },
  { month: 'Kartik',   nepali: 'कार्तिक', pct: 65, label: 'Good' },
];

const BAR_COLOR = (pct) => {
  if (pct >= 80) return '#e8a400';
  if (pct >= 50) return '#c4a45a';
  return '#e8d0a0';
};

export default function BeekeeperEdu() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <section id="bee-edu" className="bg-[#fdf8e8] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <SectionDivider num="07" name="Learn beekeeping" tag="Education" tagColor="green" />

        <div className="grid md:grid-cols-3 gap-10 lg:gap-12">

          {/* Column 1: Steps */}
          <div>
            <h2 className="font-serif text-xl text-[#1a1000] mb-6">How to start beekeeping in Nepal</h2>
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
            <h2 className="font-serif text-xl text-[#1a1000] mb-6">Frequently asked questions</h2>
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
            <h2 className="font-serif text-xl text-[#1a1000] mb-6">Nepal honey season calendar</h2>
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
                गुल्मीको मह मौसम बैशाख–जेठ र असोज–कार्तिकमा हुन्छ।
                यस समयमा मौरीहरू सबैभन्दा बढी मह संकलन गर्छन्।
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}