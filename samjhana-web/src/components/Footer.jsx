const LINKS = {
  Shop: [['Furniture', '/furniture'], ['Honey & beekeeping', '/beekeeping']],
  Visit: [['Fuel & EV', '/#fuel-ev'], ['Bike repair', '/#bike-repair'], ['Restaurant', '/#restaurant']],
  Contact: [['Call +977 9363147818', 'tel:+9779363147818'], ['WhatsApp', 'https://wa.me/9779363147818'], ['Directions', 'https://www.google.com/maps/@27.9922809,83.3629821,48m/data=!3m1!1e3?entry=ttu&g_ep=EgoyMDI2MDkyMy4wIKXMDSoASAFQAw%3D%3D']],
};

export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-10">

        {/* Brand */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-serif text-xl text-white">Samjhana Ventures</p>
            <p className="text-xs text-white/30 font-sans mt-0.5">Gulmi, Nepal · Est. 2008</p>
          </div>
          <p className="text-white/40 text-sm font-sans leading-relaxed">
            Where craft meets community, in the hills. Four businesses, one family, one vision.
          </p>
        </div>

        {/* Link columns */}
        {Object.entries(LINKS).map(([heading, items]) => (
          <div key={heading}>
            <p className="text-xs font-semibold uppercase tracking-widest text-gold mb-5">{heading}</p>
            <ul className="space-y-2.5">
          {items.map(([item, href]) => (
            <li key={item}>
                  <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} className="text-sm text-white/40 hover:text-white transition-colors font-sans">{item}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/30 font-sans">
            © {new Date().getFullYear()} Maurighar Ventures. All rights reserved.
          </p>
          <p className="font-serif italic text-gold/60 text-sm">
            गुल्मीको गर्वका साथ — Proudly from Gulmi
          </p>
        </div>
      </div>
    </footer>
  );
}
