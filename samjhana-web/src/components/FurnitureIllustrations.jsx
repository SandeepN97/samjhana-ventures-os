/* ─────────────────────────────────────────────────────────────
   Furniture illustration SVGs — one per product type.
   All use viewBox="0 0 320 240", no background fill (parent sets it).
   Warm palette: #8B6914 / #c4a45a / #5a3a1a / #1e1206
───────────────────────────────────────────────────────────── */

export const PRODUCT_ACCENTS = {
  sofa:       { bg: '#ede5d4', shadow: '#8B6914' },
  bed:        { bg: '#e8e0d0', shadow: '#6b4c2a' },
  wardrobe:   { bg: '#ddd5c0', shadow: '#5a3a1a' },
  dining:     { bg: '#e4dac8', shadow: '#7a5c2a' },
  chair:      { bg: '#d8e0d4', shadow: '#3a5a3a' },
  desk:       { bg: '#dce0dc', shadow: '#3a4a3a' },
  coffee:     { bg: '#ede5d8', shadow: '#8B6914' },
  bookshelf:  { bg: '#e6ddd0', shadow: '#6b4c2a' },
  tv:         { bg: '#d8d4c8', shadow: '#3a3a2a' },
  dresser:    { bg: '#e8dcd4', shadow: '#7a4a3a' },
  nightstand: { bg: '#f0e8de', shadow: '#8B6914' },
  cabinet:    { bg: '#d8d0c0', shadow: '#5a3a1a' },
  shoe:       { bg: '#dce0d8', shadow: '#4a5a3a' },
  island:     { bg: '#e0dcd4', shadow: '#6a5a3a' },
  default:    { bg: '#e8dfc8', shadow: '#8B6914' },
};

function SofaIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="213" rx="122" ry="9" fill="#5a3a1a" opacity="0.07"/>
      {/* back frame */}
      <rect x="42" y="88" width="236" height="68" rx="11" fill="#8B6914" opacity="0.16"/>
      {/* back cushions */}
      <rect x="50"  y="93" width="72" height="60" rx="8" fill="#c4a45a" opacity="0.40"/>
      <rect x="126" y="93" width="70" height="60" rx="8" fill="#c4a45a" opacity="0.40"/>
      <rect x="200" y="93" width="72" height="60" rx="8" fill="#c4a45a" opacity="0.40"/>
      <line x1="86"  y1="95"  x2="86"  y2="151" stroke="#8B6914" strokeWidth="0.9" opacity="0.20"/>
      <line x1="161" y1="95"  x2="161" y2="151" stroke="#8B6914" strokeWidth="0.9" opacity="0.20"/>
      <line x1="236" y1="95"  x2="236" y2="151" stroke="#8B6914" strokeWidth="0.9" opacity="0.20"/>
      {/* seat base */}
      <rect x="42" y="152" width="236" height="54" rx="10" fill="#8B6914" opacity="0.20"/>
      {/* seat cushions */}
      <rect x="50"  y="155" width="72" height="46" rx="7" fill="#c4a45a" opacity="0.44"/>
      <rect x="126" y="155" width="70" height="46" rx="7" fill="#c4a45a" opacity="0.44"/>
      <rect x="200" y="155" width="72" height="46" rx="7" fill="#c4a45a" opacity="0.44"/>
      <line x1="86"  y1="157" x2="86"  y2="199" stroke="#8B6914" strokeWidth="0.9" opacity="0.16"/>
      <line x1="161" y1="157" x2="161" y2="199" stroke="#8B6914" strokeWidth="0.9" opacity="0.16"/>
      <line x1="236" y1="157" x2="236" y2="199" stroke="#8B6914" strokeWidth="0.9" opacity="0.16"/>
      {/* armrests */}
      <rect x="26"  y="100" width="30" height="104" rx="11" fill="#8B6914" opacity="0.26"/>
      <rect x="22"  y="132" width="38" height="17"  rx="8"  fill="#c4a45a" opacity="0.38"/>
      <rect x="264" y="100" width="30" height="104" rx="11" fill="#8B6914" opacity="0.26"/>
      <rect x="260" y="132" width="38" height="17"  rx="8"  fill="#c4a45a" opacity="0.38"/>
      {/* legs */}
      <rect x="58"  y="202" width="11" height="20" rx="4" fill="#5a3a1a" opacity="0.28"/>
      <rect x="122" y="202" width="11" height="20" rx="4" fill="#5a3a1a" opacity="0.28"/>
      <rect x="189" y="202" width="11" height="20" rx="4" fill="#5a3a1a" opacity="0.28"/>
      <rect x="251" y="202" width="11" height="20" rx="4" fill="#5a3a1a" opacity="0.28"/>
      {/* throw pillow */}
      <rect x="114" y="140" width="26" height="22" rx="5" fill="#8B6914" opacity="0.38" transform="rotate(-12 127 151)"/>
    </svg>
  );
}

function BedIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="130" ry="8" fill="#5a3a1a" opacity="0.07"/>
      {/* platform */}
      <rect x="28" y="165" width="264" height="38" rx="7" fill="#8B6914" opacity="0.22"/>
      {/* mattress */}
      <rect x="34" y="120" width="252" height="50" rx="6" fill="#f0e8d8" opacity="0.75"/>
      {/* mattress side strip */}
      <rect x="34" y="162" width="252" height="10" rx="3" fill="#e0d0b8" opacity="0.60"/>
      {/* duvet */}
      <rect x="34" y="130" width="252" height="34" rx="6" fill="#c4a45a" opacity="0.35"/>
      <rect x="34" y="154" width="252" height="12" rx="4" fill="#c4a45a" opacity="0.45"/>
      {/* duvet fold line */}
      <line x1="34" y1="154" x2="286" y2="154" stroke="#8B6914" strokeWidth="0.8" opacity="0.25"/>
      {/* duvet stitching lines */}
      <line x1="116" y1="130" x2="116" y2="154" stroke="#8B6914" strokeWidth="0.7" opacity="0.18"/>
      <line x1="196" y1="130" x2="196" y2="154" stroke="#8B6914" strokeWidth="0.7" opacity="0.18"/>
      {/* pillows */}
      <rect x="46"  y="116" width="84" height="24" rx="8" fill="#f5f0e8" opacity="0.85"/>
      <rect x="190" y="116" width="84" height="24" rx="8" fill="#f5f0e8" opacity="0.85"/>
      <line x1="88"  y1="117" x2="88"  y2="139" stroke="#8B6914" strokeWidth="0.6" opacity="0.12"/>
      <line x1="232" y1="117" x2="232" y2="139" stroke="#8B6914" strokeWidth="0.6" opacity="0.12"/>
      {/* headboard */}
      <rect x="28" y="72" width="264" height="54" rx="10" fill="#8B6914" opacity="0.24"/>
      <rect x="38" y="78" width="244" height="42" rx="8"  fill="#c4a45a" opacity="0.22"/>
      {/* headboard panel lines */}
      <line x1="116" y1="80" x2="116" y2="118" stroke="#8B6914" strokeWidth="0.8" opacity="0.18"/>
      <line x1="204" y1="80" x2="204" y2="118" stroke="#8B6914" strokeWidth="0.8" opacity="0.18"/>
      {/* footboard */}
      <rect x="28" y="199" width="264" height="16" rx="5" fill="#8B6914" opacity="0.24"/>
      {/* legs */}
      <rect x="38"  y="202" width="10" height="18" rx="3" fill="#5a3a1a" opacity="0.26"/>
      <rect x="272" y="202" width="10" height="18" rx="3" fill="#5a3a1a" opacity="0.26"/>
    </svg>
  );
}

function DiningTableIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="214" rx="124" ry="8" fill="#5a3a1a" opacity="0.07"/>
      {/* two chairs behind */}
      <rect x="60"  y="82" width="52" height="52" rx="8" fill="#c4a45a" opacity="0.28"/>
      <rect x="208" y="82" width="52" height="52" rx="8" fill="#c4a45a" opacity="0.28"/>
      {/* chair backs behind */}
      <rect x="66"  y="66" width="40" height="20" rx="6" fill="#8B6914" opacity="0.28"/>
      <rect x="214" y="66" width="40" height="20" rx="6" fill="#8B6914" opacity="0.28"/>
      {/* table top */}
      <rect x="44" y="128" width="232" height="18" rx="5" fill="#c4a45a" opacity="0.30"/>
      <rect x="44" y="132" width="232" height="36" rx="8" fill="#8B6914" opacity="0.28"/>
      <rect x="50" y="134" width="220" height="30" rx="6" fill="#c4a45a" opacity="0.22"/>
      {/* table edge highlight */}
      <rect x="44" y="126" width="232" height="10" rx="4" fill="#c4a45a" opacity="0.45"/>
      {/* table legs */}
      <rect x="64"  y="166" width="12" height="44" rx="5" fill="#5a3a1a" opacity="0.28"/>
      <rect x="244" y="166" width="12" height="44" rx="5" fill="#5a3a1a" opacity="0.28"/>
      <rect x="88"  y="170" width="10" height="40" rx="4" fill="#5a3a1a" opacity="0.18"/>
      <rect x="222" y="170" width="10" height="40" rx="4" fill="#5a3a1a" opacity="0.18"/>
      {/* front chairs */}
      <rect x="60"  y="174" width="52" height="40" rx="8" fill="#c4a45a" opacity="0.32"/>
      <rect x="208" y="174" width="52" height="40" rx="8" fill="#c4a45a" opacity="0.32"/>
      {/* place settings on table */}
      <ellipse cx="114" cy="141" rx="14" ry="10" fill="#f0e8d8" opacity="0.55"/>
      <ellipse cx="206" cy="141" rx="14" ry="10" fill="#f0e8d8" opacity="0.55"/>
      <rect x="132" y="138" width="6" height="7" rx="1" fill="#8B6914" opacity="0.28"/>
      <rect x="178" y="138" width="6" height="7" rx="1" fill="#8B6914" opacity="0.28"/>
    </svg>
  );
}

function WardrobeIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="216" rx="100" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* main body */}
      <rect x="56" y="38" width="208" height="174" rx="6" fill="#8B6914" opacity="0.18"/>
      {/* top cornice */}
      <rect x="50" y="30" width="220" height="16" rx="4" fill="#8B6914" opacity="0.30"/>
      {/* bottom plinth */}
      <rect x="50" y="208" width="220" height="10" rx="3" fill="#8B6914" opacity="0.28"/>
      {/* center divider */}
      <line x1="160" y1="38" x2="160" y2="212" stroke="#8B6914" strokeWidth="2" opacity="0.28"/>
      {/* left door panel */}
      <rect x="62"  y="44" width="90" height="162" rx="4" fill="#c4a45a" opacity="0.20"/>
      {/* right door panel - mirror */}
      <rect x="162" y="44" width="90" height="162" rx="4" fill="#c4a45a" opacity="0.28"/>
      {/* mirror reflection */}
      <rect x="168" y="50" width="78" height="150" rx="3" fill="#dde8f0" opacity="0.30"/>
      <line x1="172" y1="54" x2="240" y2="195" stroke="white" strokeWidth="1.2" opacity="0.20"/>
      {/* left door inner frame */}
      <rect x="68"  y="50" width="78" height="75" rx="3" fill="#c4a45a" opacity="0.22"/>
      <rect x="68"  y="132" width="78" height="68" rx="3" fill="#c4a45a" opacity="0.22"/>
      {/* handles */}
      <rect x="148" y="120" width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="166" y="120" width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      {/* feet */}
      <rect x="68"  y="212" width="12" height="10" rx="2" fill="#5a3a1a" opacity="0.28"/>
      <rect x="240" y="212" width="12" height="10" rx="2" fill="#5a3a1a" opacity="0.28"/>
    </svg>
  );
}

function OfficeChairIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="214" rx="70" ry="7" fill="#3a5a3a" opacity="0.08"/>
      {/* seat */}
      <rect x="96" y="118" width="128" height="42" rx="14" fill="#c4a45a" opacity="0.38"/>
      <rect x="100" y="120" width="120" height="36" rx="12" fill="#c4a45a" opacity="0.30"/>
      {/* seat side depth */}
      <rect x="96" y="148" width="128" height="10" rx="5" fill="#8B6914" opacity="0.28"/>
      {/* back rest */}
      <rect x="106" y="52" width="108" height="76" rx="12" fill="#c4a45a" opacity="0.36"/>
      <rect x="112" y="56" width="96"  height="68" rx="10" fill="#c4a45a" opacity="0.28"/>
      {/* back lumbar line */}
      <path d="M 118 100 Q 160 108 202 100" stroke="#8B6914" strokeWidth="1.2" fill="none" opacity="0.22"/>
      {/* back post */}
      <rect x="150" y="124" width="20" height="30" rx="5" fill="#5a3a1a" opacity="0.28"/>
      {/* armrests */}
      <rect x="74"  y="126" width="28" height="10" rx="5" fill="#5a3a1a" opacity="0.32"/>
      <rect x="218" y="126" width="28" height="10" rx="5" fill="#5a3a1a" opacity="0.32"/>
      <rect x="78"  y="130" width="8"  height="28" rx="4" fill="#5a3a1a" opacity="0.24"/>
      <rect x="234" y="130" width="8"  height="28" rx="4" fill="#5a3a1a" opacity="0.24"/>
      {/* central column */}
      <rect x="152" y="154" width="16" height="40" rx="5" fill="#3a4a3a" opacity="0.35"/>
      {/* base star */}
      {[0,72,144,216,288].map((deg, i) => {
        const r = deg * Math.PI / 180;
        const x2 = 160 + Math.cos(r) * 52;
        const y2 = 204 + Math.sin(r) * 10;
        return <line key={i} x1="160" y1="196" x2={x2} y2={y2} stroke="#3a4a3a" strokeWidth="5" strokeLinecap="round" opacity="0.32"/>;
      })}
      {/* casters */}
      {[0,72,144,216,288].map((deg, i) => {
        const r = deg * Math.PI / 180;
        const cx = 160 + Math.cos(r) * 52;
        const cy = 204 + Math.sin(r) * 10;
        return <circle key={i} cx={cx} cy={cy} r="5" fill="#3a4a3a" opacity="0.45"/>;
      })}
    </svg>
  );
}

function CoffeeTableIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="212" rx="118" ry="8" fill="#5a3a1a" opacity="0.07"/>
      {/* lower shelf */}
      <rect x="72" y="166" width="176" height="12" rx="5" fill="#8B6914" opacity="0.22"/>
      {/* glass top */}
      <rect x="54" y="136" width="212" height="14" rx="5" fill="#d0e8f0" opacity="0.38"/>
      {/* wood frame under glass */}
      <rect x="58" y="142" width="204" height="26" rx="6" fill="#8B6914" opacity="0.28"/>
      <rect x="62" y="144" width="196" height="20" rx="5" fill="#c4a45a" opacity="0.26"/>
      {/* glass highlight */}
      <rect x="58" y="136" width="200" height="5" rx="3" fill="white" opacity="0.28"/>
      {/* legs */}
      <rect x="76"  y="166" width="12" height="40" rx="5" fill="#5a3a1a" opacity="0.30"/>
      <rect x="232" y="166" width="12" height="40" rx="5" fill="#5a3a1a" opacity="0.30"/>
      <rect x="100" y="170" width="10" height="36" rx="4" fill="#5a3a1a" opacity="0.18"/>
      <rect x="210" y="170" width="10" height="36" rx="4" fill="#5a3a1a" opacity="0.18"/>
      {/* decorative items on table */}
      {/* vase */}
      <ellipse cx="140" cy="139" rx="8"  ry="4"  fill="#8B6914" opacity="0.35"/>
      <rect    x="136" y="114" width="8" height="26" rx="4" fill="#8B6914" opacity="0.30"/>
      <ellipse cx="140" cy="114" rx="8"  ry="4"  fill="#8B6914" opacity="0.35"/>
      {/* book */}
      <rect x="166" y="134" width="28" height="8" rx="2" fill="#c4a45a" opacity="0.45"/>
      <rect x="168" y="124" width="24" height="12" rx="1" fill="#c4a45a" opacity="0.38"/>
      {/* candle */}
      <rect x="195" y="128" width="8" height="10" rx="2" fill="#f0e8d8" opacity="0.70"/>
      <line x1="199" y1="128" x2="199" y2="122" stroke="#8B6914" strokeWidth="1" opacity="0.40"/>
    </svg>
  );
}

function BookshelfIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="92" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* main frame */}
      <rect x="72" y="22" width="176" height="192" rx="5" fill="#8B6914" opacity="0.18"/>
      {/* back panel */}
      <rect x="76" y="26" width="168" height="184" rx="3" fill="#c4a45a" opacity="0.12"/>
      {/* 5 shelves */}
      {[60, 96, 132, 168].map((y) => (
        <rect key={y} x="76" y={y} width="168" height="8" rx="2" fill="#8B6914" opacity="0.28"/>
      ))}
      {/* bottom shelf */}
      <rect x="76" y="206" width="168" height="8" rx="2" fill="#8B6914" opacity="0.28"/>
      {/* side panels */}
      <rect x="72"  y="22" width="10" height="192" rx="3" fill="#8B6914" opacity="0.28"/>
      <rect x="238" y="22" width="10" height="192" rx="3" fill="#8B6914" opacity="0.28"/>
      {/* books row 1 (top) */}
      <rect x="84"  y="30" width="10" height="28" rx="1" fill="#c4693a" opacity="0.55"/>
      <rect x="96"  y="32" width="14" height="26" rx="1" fill="#3a6a8B" opacity="0.45"/>
      <rect x="112" y="28" width="10" height="30" rx="1" fill="#6a8B3a" opacity="0.50"/>
      <rect x="124" y="30" width="12" height="28" rx="1" fill="#c4a45a" opacity="0.60"/>
      <rect x="138" y="32" width="8"  height="26" rx="1" fill="#8B3a6a" opacity="0.45"/>
      <rect x="148" y="28" width="14" height="30" rx="1" fill="#3a6a8B" opacity="0.50"/>
      <rect x="164" y="30" width="10" height="28" rx="1" fill="#c4693a" opacity="0.45"/>
      <rect x="176" y="31" width="12" height="27" rx="1" fill="#6a8B3a" opacity="0.50"/>
      <rect x="190" y="28" width="10" height="30" rx="1" fill="#c4a45a" opacity="0.55"/>
      <rect x="202" y="30" width="28" height="28" rx="1" fill="#8B6914" opacity="0.20"/>
      {/* books row 2 */}
      <rect x="84"  y="68" width="16" height="26" rx="1" fill="#6a8B3a" opacity="0.55"/>
      <rect x="102" y="70" width="10" height="24" rx="1" fill="#c4693a" opacity="0.50"/>
      <rect x="114" y="66" width="12" height="28" rx="1" fill="#8B3a6a" opacity="0.45"/>
      <rect x="128" y="68" width="10" height="26" rx="1" fill="#3a6a8B" opacity="0.50"/>
      <rect x="140" y="66" width="14" height="28" rx="1" fill="#c4a45a" opacity="0.60"/>
      <rect x="156" y="68" width="10" height="26" rx="1" fill="#c4693a" opacity="0.45"/>
      <rect x="168" y="70" width="12" height="24" rx="1" fill="#6a8B3a" opacity="0.50"/>
      <rect x="182" y="66" width="10" height="28" rx="1" fill="#3a6a8B" opacity="0.55"/>
      {/* small decorative item on shelf 2 */}
      <rect x="200" y="62" width="10" height="32" rx="5" fill="#c4a45a" opacity="0.40"/>
      <ellipse cx="205" cy="62" rx="6" ry="4" fill="#c4a45a" opacity="0.40"/>
      {/* books row 3 */}
      <rect x="84"  y="104" width="12" height="26" rx="1" fill="#c4a45a" opacity="0.55"/>
      <rect x="98"  y="106" width="10" height="24" rx="1" fill="#8B3a6a" opacity="0.50"/>
      <rect x="110" y="102" width="14" height="28" rx="1" fill="#c4693a" opacity="0.55"/>
      <rect x="126" y="104" width="10" height="26" rx="1" fill="#6a8B3a" opacity="0.45"/>
      <rect x="138" y="104" width="12" height="26" rx="1" fill="#3a6a8B" opacity="0.50"/>
      {/* plant on shelf 3 */}
      <rect x="188" y="104" width="14" height="26" rx="3" fill="#8B6914" opacity="0.30"/>
      <ellipse cx="195" cy="100" rx="14" ry="10" fill="#3a7a3a" opacity="0.35"/>
      <ellipse cx="188" cy="96"  rx="10" ry="8"  fill="#3a7a3a" opacity="0.30"/>
      {/* books row 4 */}
      <rect x="84"  y="140" width="10" height="26" rx="1" fill="#3a6a8B" opacity="0.55"/>
      <rect x="96"  y="142" width="14" height="24" rx="1" fill="#c4a45a" opacity="0.60"/>
      <rect x="112" y="138" width="10" height="28" rx="1" fill="#c4693a" opacity="0.50"/>
      <rect x="124" y="140" width="12" height="26" rx="1" fill="#6a8B3a" opacity="0.50"/>
      <rect x="138" y="142" width="10" height="24" rx="1" fill="#8B3a6a" opacity="0.45"/>
      <rect x="150" y="138" width="8"  height="28" rx="1" fill="#3a6a8B" opacity="0.50"/>
      {/* row 5 - storage baskets */}
      <rect x="86"  y="178" width="36" height="24" rx="4" fill="#c4a45a" opacity="0.38"/>
      <rect x="128" y="178" width="36" height="24" rx="4" fill="#8B6914" opacity="0.28"/>
      <rect x="170" y="176" width="58" height="26" rx="4" fill="#c4a45a" opacity="0.30"/>
      {/* basket weave hints */}
      <line x1="96" y1="178" x2="96" y2="202" stroke="#8B6914" strokeWidth="0.8" opacity="0.25"/>
      <line x1="106" y1="178" x2="106" y2="202" stroke="#8B6914" strokeWidth="0.8" opacity="0.25"/>
    </svg>
  );
}

function TvStandIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="216" rx="126" ry="7" fill="#3a3a2a" opacity="0.07"/>
      {/* TV screen hint above */}
      <rect x="82" y="34" width="156" height="96" rx="8" fill="#1e1206" opacity="0.22"/>
      <rect x="88" y="40" width="144" height="84" rx="5" fill="#2a3a4a" opacity="0.35"/>
      {/* screen reflection */}
      <rect x="92" y="44" width="60" height="30" rx="3" fill="white" opacity="0.06"/>
      {/* TV stand neck */}
      <rect x="150" y="128" width="20" height="16" rx="4" fill="#1e1206" opacity="0.35"/>
      <rect x="130" y="140" width="60" height="8" rx="4" fill="#1e1206" opacity="0.30"/>
      {/* main cabinet body */}
      <rect x="30" y="148" width="260" height="58" rx="7" fill="#8B6914" opacity="0.25"/>
      <rect x="34" y="150" width="252" height="52" rx="6" fill="#c4a45a" opacity="0.20"/>
      {/* left door */}
      <rect x="38" y="154" width="78" height="44" rx="5" fill="#c4a45a" opacity="0.28"/>
      <rect x="42" y="157" width="70" height="38" rx="3" fill="#c4a45a" opacity="0.20"/>
      {/* center open shelf */}
      <rect x="120" y="154" width="80" height="44" rx="3" fill="#1e1206" opacity="0.10"/>
      <rect x="124" y="158" width="72" height="36" rx="2" fill="#1e1206" opacity="0.08"/>
      {/* right door */}
      <rect x="204" y="154" width="78" height="44" rx="5" fill="#c4a45a" opacity="0.28"/>
      <rect x="208" y="157" width="70" height="38" rx="3" fill="#c4a45a" opacity="0.20"/>
      {/* door handles */}
      <rect x="106" y="173" width="6" height="12" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="208" y="173" width="6" height="12" rx="3" fill="#5a3a1a" opacity="0.45"/>
      {/* legs */}
      <rect x="46"  y="204" width="14" height="14" rx="4" fill="#5a3a1a" opacity="0.28"/>
      <rect x="260" y="204" width="14" height="14" rx="4" fill="#5a3a1a" opacity="0.28"/>
      {/* device on shelf */}
      <rect x="138" y="166" width="44" height="10" rx="3" fill="#3a3a2a" opacity="0.35"/>
      {/* LED strip hint */}
      <rect x="34" y="200" width="252" height="3" rx="1" fill="#c4a45a" opacity="0.30"/>
    </svg>
  );
}

function DresserIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="100" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* mirror */}
      <rect x="90"  y="22"  width="140" height="78" rx="6" fill="#8B6914" opacity="0.20"/>
      <rect x="96"  y="26"  width="128" height="70" rx="4" fill="#d0e8f0" opacity="0.32"/>
      {/* mirror frame detail */}
      <rect x="92"  y="24"  width="136" height="8"  rx="3" fill="#c4a45a" opacity="0.35"/>
      {/* mirror reflection */}
      <line x1="100" y1="32" x2="140" y2="90" stroke="white" strokeWidth="1.5" opacity="0.18"/>
      {/* dresser body */}
      <rect x="60" y="100" width="200" height="108" rx="7" fill="#8B6914" opacity="0.22"/>
      <rect x="64" y="102" width="192" height="104" rx="5" fill="#c4a45a" opacity="0.18"/>
      {/* 3 drawers */}
      <rect x="68" y="106" width="184" height="30" rx="4" fill="#c4a45a" opacity="0.28"/>
      <rect x="68" y="140" width="184" height="30" rx="4" fill="#c4a45a" opacity="0.28"/>
      <rect x="68" y="174" width="184" height="28" rx="4" fill="#c4a45a" opacity="0.28"/>
      {/* drawer handles */}
      <rect x="148" y="118" width="24" height="7" rx="3" fill="#5a3a1a" opacity="0.40"/>
      <rect x="148" y="152" width="24" height="7" rx="3" fill="#5a3a1a" opacity="0.40"/>
      <rect x="148" y="185" width="24" height="7" rx="3" fill="#5a3a1a" opacity="0.40"/>
      {/* drawer divider lines */}
      <line x1="68" y1="136" x2="252" y2="136" stroke="#8B6914" strokeWidth="1" opacity="0.20"/>
      <line x1="68" y1="170" x2="252" y2="170" stroke="#8B6914" strokeWidth="1" opacity="0.20"/>
      {/* items on dresser top */}
      <rect x="74"  y="94" width="18" height="10" rx="4" fill="#c4a45a" opacity="0.50"/>
      <ellipse cx="212" cy="98" rx="12" ry="5" fill="#8B6914" opacity="0.30"/>
      {/* legs */}
      <rect x="72"  y="206" width="12" height="12" rx="3" fill="#5a3a1a" opacity="0.28"/>
      <rect x="236" y="206" width="12" height="12" rx="3" fill="#5a3a1a" opacity="0.28"/>
    </svg>
  );
}

function NightstandIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="214" rx="80" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* lamp on top */}
      {/* lamp shade */}
      <path d="M 138 66 L 118 94 L 202 94 L 182 66 Z" fill="#f0e8d0" opacity="0.60"/>
      <path d="M 138 66 L 118 94" stroke="#c4a45a" strokeWidth="1" opacity="0.35"/>
      <path d="M 182 66 L 202 94" stroke="#c4a45a" strokeWidth="1" opacity="0.35"/>
      {/* lamp base */}
      <rect x="155" y="94" width="10" height="28" rx="4" fill="#8B6914" opacity="0.40"/>
      <ellipse cx="160" cy="124" rx="14" ry="5" fill="#8B6914" opacity="0.35"/>
      {/* lamp glow */}
      <ellipse cx="160" cy="94" rx="20" ry="6" fill="#f0e8b0" opacity="0.20"/>
      {/* nightstand body */}
      <rect x="100" y="122" width="120" height="84" rx="7" fill="#8B6914" opacity="0.24"/>
      <rect x="104" y="124" width="112" height="80" rx="5" fill="#c4a45a" opacity="0.20"/>
      {/* top drawer */}
      <rect x="108" y="128" width="104" height="34" rx="4" fill="#c4a45a" opacity="0.32"/>
      {/* bottom open shelf */}
      <rect x="108" y="166" width="104" height="34" rx="4" fill="#c4a45a" opacity="0.18"/>
      {/* handle */}
      <rect x="148" y="142" width="24" height="7" rx="3" fill="#5a3a1a" opacity="0.40"/>
      {/* items on shelf */}
      <rect x="118" y="170" width="22" height="24" rx="2" fill="#3a6a8B" opacity="0.30"/>
      <rect x="142" y="174" width="16" height="20" rx="2" fill="#c4693a" opacity="0.30"/>
      {/* divider */}
      <line x1="108" y1="162" x2="212" y2="162" stroke="#8B6914" strokeWidth="1" opacity="0.20"/>
      {/* legs */}
      <rect x="110" y="202" width="10" height="14" rx="3" fill="#5a3a1a" opacity="0.28"/>
      <rect x="200" y="202" width="10" height="14" rx="3" fill="#5a3a1a" opacity="0.28"/>
    </svg>
  );
}

function DeskIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="128" ry="7" fill="#3a4a3a" opacity="0.07"/>
      {/* desk top surface */}
      <rect x="30" y="118" width="260" height="18" rx="5" fill="#c4a45a" opacity="0.38"/>
      <rect x="34" y="122" width="252" height="16" rx="4" fill="#8B6914" opacity="0.22"/>
      {/* desk top highlight */}
      <rect x="30" y="116" width="260" height="6" rx="3" fill="#c4a45a" opacity="0.45"/>
      {/* drawer unit on right */}
      <rect x="210" y="134" width="76" height="74" rx="6" fill="#8B6914" opacity="0.24"/>
      <rect x="214" y="136" width="68" height="68" rx="4" fill="#c4a45a" opacity="0.20"/>
      {/* drawers */}
      <rect x="218" y="140" width="60" height="18" rx="3" fill="#c4a45a" opacity="0.30"/>
      <rect x="218" y="162" width="60" height="18" rx="3" fill="#c4a45a" opacity="0.30"/>
      <rect x="218" y="184" width="60" height="14" rx="3" fill="#c4a45a" opacity="0.30"/>
      {/* drawer handles */}
      <rect x="240" y="146" width="16" height="5" rx="2" fill="#5a3a1a" opacity="0.40"/>
      <rect x="240" y="168" width="16" height="5" rx="2" fill="#5a3a1a" opacity="0.40"/>
      <rect x="240" y="189" width="16" height="5" rx="2" fill="#5a3a1a" opacity="0.40"/>
      {/* left leg */}
      <rect x="36"  y="134" width="14" height="76" rx="5" fill="#5a3a1a" opacity="0.28"/>
      {/* monitor on desk */}
      <rect x="76"  y="54"  width="110" height="68" rx="5" fill="#1e1206" opacity="0.22"/>
      <rect x="80"  y="58"  width="102" height="60" rx="3" fill="#2a3a4a" opacity="0.30"/>
      <rect x="82"  y="60"  width="48"  height="24" rx="2" fill="white" opacity="0.06"/>
      <rect x="122" y="118" width="18"  height="10" rx="3" fill="#1e1206" opacity="0.28"/>
      <rect x="106" y="126" width="50"  height="4"  rx="2" fill="#1e1206" opacity="0.22"/>
      {/* keyboard */}
      <rect x="72"  y="108" width="100" height="14" rx="4" fill="#3a4a3a" opacity="0.28"/>
      <rect x="76"  y="110" width="92"  height="10" rx="3" fill="#3a4a3a" opacity="0.22"/>
      {/* pen holder */}
      <rect x="192" y="96" width="18" height="24" rx="4" fill="#c4a45a" opacity="0.40"/>
      <line x1="196" y1="84" x2="196" y2="98" stroke="#5a3a1a" strokeWidth="1.5" opacity="0.35"/>
      <line x1="200" y1="80" x2="200" y2="98" stroke="#5a3a1a" strokeWidth="1.5" opacity="0.35"/>
      <line x1="204" y1="82" x2="204" y2="98" stroke="#5a3a1a" strokeWidth="1.5" opacity="0.30"/>
    </svg>
  );
}

function StorageCabinetIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="100" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* main body */}
      <rect x="64" y="34" width="192" height="174" rx="6" fill="#8B6914" opacity="0.20"/>
      {/* top panel */}
      <rect x="60" y="28" width="200" height="14" rx="4" fill="#8B6914" opacity="0.30"/>
      {/* bottom panel */}
      <rect x="60" y="204" width="200" height="10" rx="3" fill="#8B6914" opacity="0.28"/>
      {/* center horizontal divider */}
      <rect x="64" y="116" width="192" height="8" rx="2" fill="#8B6914" opacity="0.28"/>
      {/* center vertical divider */}
      <line x1="160" y1="34" x2="160" y2="208" stroke="#8B6914" strokeWidth="2.5" opacity="0.28"/>
      {/* 4 door panels */}
      <rect x="70"  y="40"  width="84" height="70" rx="4" fill="#c4a45a" opacity="0.24"/>
      <rect x="166" y="40"  width="84" height="70" rx="4" fill="#c4a45a" opacity="0.24"/>
      <rect x="70"  y="130" width="84" height="70" rx="4" fill="#c4a45a" opacity="0.24"/>
      <rect x="166" y="130" width="84" height="70" rx="4" fill="#c4a45a" opacity="0.24"/>
      {/* inner frame lines */}
      <rect x="74"  y="44"  width="76" height="62" rx="3" fill="#c4a45a" opacity="0.18"/>
      <rect x="170" y="44"  width="76" height="62" rx="3" fill="#c4a45a" opacity="0.18"/>
      <rect x="74"  y="134" width="76" height="62" rx="3" fill="#c4a45a" opacity="0.18"/>
      <rect x="170" y="134" width="76" height="62" rx="3" fill="#c4a45a" opacity="0.18"/>
      {/* handles */}
      <rect x="144" y="72"  width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="170" y="72"  width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="144" y="162" width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="170" y="162" width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      {/* feet */}
      <rect x="72"  y="210" width="14" height="10" rx="3" fill="#5a3a1a" opacity="0.28"/>
      <rect x="234" y="210" width="14" height="10" rx="3" fill="#5a3a1a" opacity="0.28"/>
    </svg>
  );
}

function ShoeRackIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="108" ry="7" fill="#4a5a3a" opacity="0.07"/>
      {/* frame */}
      <rect x="68"  y="24"  width="10" height="190" rx="4" fill="#8B6914" opacity="0.30"/>
      <rect x="242" y="24"  width="10" height="190" rx="4" fill="#8B6914" opacity="0.30"/>
      {/* 5 shelves */}
      {[30, 72, 114, 156, 196].map((y) => (
        <rect key={y} x="64" y={y} width="192" height="8" rx="3" fill="#8B6914" opacity="0.28"/>
      ))}
      {/* shoes on shelf 1 */}
      <path d="M 84 62 Q 84 38 102 36 L 124 36 Q 136 36 136 46 L 136 62 Z" fill="#c4693a" opacity="0.40"/>
      <path d="M 142 62 Q 142 38 160 36 L 182 36 Q 194 36 194 46 L 194 62 Z" fill="#3a4a8B" opacity="0.40"/>
      <path d="M 200 62 Q 200 38 218 36 L 232 36 Q 234 40 234 50 L 234 62 Z" fill="#3a3a3a" opacity="0.35"/>
      {/* shoes on shelf 2 */}
      <path d="M 84 104 Q 84 80 102 78 L 120 78 Q 132 78 132 88 L 132 104 Z" fill="#8B6914" opacity="0.40"/>
      <path d="M 140 104 Q 140 80 158 78 L 180 78 Q 192 78 192 88 L 192 104 Z" fill="#c4a45a" opacity="0.45"/>
      {/* sandals on shelf 2 */}
      <ellipse cx="220" cy="90" rx="18" ry="10" fill="#c4693a" opacity="0.35"/>
      <line x1="208" y1="86" x2="232" y2="94" stroke="#c4693a" strokeWidth="2" opacity="0.45"/>
      {/* shoes on shelf 3 */}
      <path d="M 88 148 Q 88 124 104 122 L 122 122 Q 132 122 132 132 L 132 148 Z" fill="#3a3a3a" opacity="0.38"/>
      <path d="M 148 146 Q 148 124 162 122 L 180 122 Q 190 124 190 134 L 190 148 Z" fill="#c4693a" opacity="0.35"/>
      <path d="M 198 148 Q 198 124 214 122 L 228 122 Q 236 124 236 134 L 236 148 Z" fill="#3a6a8B" opacity="0.38"/>
      {/* boots on shelf 4 */}
      <rect x="88"  y="162" width="22" height="32" rx="4" fill="#3a3a3a" opacity="0.38"/>
      <rect x="116" y="162" width="22" height="32" rx="4" fill="#3a3a3a" opacity="0.38"/>
      <path d="M 88 168 Q 100 162 110 168" fill="none" stroke="#3a3a3a" strokeWidth="1.5" opacity="0.40"/>
      {/* heels on shelf 4 */}
      <path d="M 162 186 Q 162 164 178 162 L 196 162 Q 200 164 200 172 L 196 186 Z" fill="#8B3a6a" opacity="0.40"/>
      <rect x="188" y="180" width="4" height="8" rx="1" fill="#8B3a6a" opacity="0.45"/>
    </svg>
  );
}

function ChestOfDrawersIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="96" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* body */}
      <rect x="70" y="32" width="180" height="176" rx="6" fill="#8B6914" opacity="0.20"/>
      {/* top surface */}
      <rect x="66" y="24" width="188" height="14" rx="4" fill="#c4a45a" opacity="0.40"/>
      {/* bottom base */}
      <rect x="70" y="204" width="180" height="10" rx="3" fill="#8B6914" opacity="0.28"/>
      {/* 5 equal drawers */}
      {[38, 72, 106, 140, 172].map((y, i) => (
        <g key={i}>
          <rect x="76" y={y} width="168" height="30" rx="4" fill="#c4a45a" opacity="0.28"/>
          <rect x="80" y={y+3} width="160" height="24" rx="3" fill="#c4a45a" opacity="0.18"/>
          <rect x="144" y={y+11} width="32" height="8" rx="4" fill="#5a3a1a" opacity="0.38"/>
        </g>
      ))}
      {/* divider lines */}
      {[68, 102, 136, 170].map((y) => (
        <line key={y} x1="76" y1={y} x2="244" y2={y} stroke="#8B6914" strokeWidth="1" opacity="0.20"/>
      ))}
      {/* items on top */}
      <rect x="80"  y="16" width="18" height="10" rx="4" fill="#c4a45a" opacity="0.50"/>
      <ellipse cx="218" cy="20" rx="14" ry="6" fill="#8B6914" opacity="0.30"/>
      {/* legs */}
      <rect x="80"  y="210" width="12" height="12" rx="3" fill="#5a3a1a" opacity="0.28"/>
      <rect x="228" y="210" width="12" height="12" rx="3" fill="#5a3a1a" opacity="0.28"/>
    </svg>
  );
}

function KitchenIslandIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="214" rx="120" ry="7" fill="#6a5a3a" opacity="0.07"/>
      {/* counter top - butcher block */}
      <rect x="34" y="112" width="252" height="16" rx="5" fill="#c4a45a" opacity="0.45"/>
      {/* butcher block grain lines */}
      {[40,48,56,64,72,80,88,96,104,112,120,128,136,144,152,160,168,176,184,192,200,208,216,224,232,240,248,256,264,272].map((x,i) => (
        <line key={i} x1={x} y1="112" x2={x} y2="128" stroke="#8B6914" strokeWidth="0.5" opacity="0.15"/>
      ))}
      {/* counter body */}
      <rect x="34" y="126" width="252" height="72" rx="6" fill="#8B6914" opacity="0.24"/>
      <rect x="38" y="128" width="244" height="68" rx="4" fill="#c4a45a" opacity="0.18"/>
      {/* cabinet doors */}
      <rect x="42"  y="132" width="72" height="60" rx="4" fill="#c4a45a" opacity="0.26"/>
      <rect x="122" y="132" width="76" height="60" rx="4" fill="#c4a45a" opacity="0.26"/>
      <rect x="206" y="132" width="72" height="60" rx="4" fill="#c4a45a" opacity="0.26"/>
      {/* handles */}
      <rect x="74"  y="159" width="6" height="12" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="156" y="159" width="6" height="12" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="240" y="159" width="6" height="12" rx="3" fill="#5a3a1a" opacity="0.45"/>
      {/* bar stools */}
      <rect x="58"  y="66" width="30" height="28" rx="8" fill="#c4a45a" opacity="0.32"/>
      <rect x="64"  y="94" width="18" height="22" rx="5" fill="#5a3a1a" opacity="0.26"/>
      <rect x="52"  y="112" width="30" height="5" rx="3" fill="#5a3a1a" opacity="0.22"/>
      <rect x="152" y="66" width="30" height="28" rx="8" fill="#c4a45a" opacity="0.32"/>
      <rect x="158" y="94" width="18" height="22" rx="5" fill="#5a3a1a" opacity="0.26"/>
      <rect x="146" y="112" width="30" height="5" rx="3" fill="#5a3a1a" opacity="0.22"/>
      <rect x="248" y="66" width="30" height="28" rx="8" fill="#c4a45a" opacity="0.32"/>
      <rect x="254" y="94" width="18" height="22" rx="5" fill="#5a3a1a" opacity="0.26"/>
      <rect x="242" y="112" width="30" height="5" rx="3" fill="#5a3a1a" opacity="0.22"/>
      {/* items on counter */}
      <rect x="90" y="96" width="30" height="18" rx="4" fill="#c4a45a" opacity="0.40"/>
      <rect x="184" y="92" width="14" height="22" rx="4" fill="#8B6914" opacity="0.35"/>
      {/* feet */}
      <rect x="44"  y="196" width="12" height="16" rx="4" fill="#5a3a1a" opacity="0.28"/>
      <rect x="264" y="196" width="12" height="16" rx="4" fill="#5a3a1a" opacity="0.28"/>
    </svg>
  );
}

function AccentChairIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="213" rx="86" ry="7" fill="#5a3a1a" opacity="0.07"/>
      {/* back cushion */}
      <rect x="90" y="78" width="140" height="90" rx="16" fill="#c4a45a" opacity="0.38"/>
      <rect x="96" y="84" width="128" height="78" rx="12" fill="#c4a45a" opacity="0.28"/>
      {/* back frame */}
      <rect x="86" y="72" width="148" height="98" rx="18" fill="#8B6914" opacity="0.18"/>
      {/* seat */}
      <rect x="82" y="158" width="156" height="46" rx="12" fill="#c4a45a" opacity="0.42"/>
      <rect x="86" y="160" width="148" height="38" rx="10" fill="#c4a45a" opacity="0.32"/>
      {/* seat base */}
      <rect x="82" y="192" width="156" height="12" rx="6" fill="#8B6914" opacity="0.26"/>
      {/* armrests */}
      <rect x="70"  y="130" width="22" height="70" rx="10" fill="#8B6914" opacity="0.28"/>
      <rect x="66"  y="142" width="30" height="14" rx="7" fill="#c4a45a" opacity="0.38"/>
      <rect x="228" y="130" width="22" height="70" rx="10" fill="#8B6914" opacity="0.28"/>
      <rect x="224" y="142" width="30" height="14" rx="7" fill="#c4a45a" opacity="0.38"/>
      {/* button tufting on back */}
      <circle cx="160" cy="110" r="4" fill="#8B6914" opacity="0.35"/>
      <circle cx="136" cy="126" r="4" fill="#8B6914" opacity="0.30"/>
      <circle cx="184" cy="126" r="4" fill="#8B6914" opacity="0.30"/>
      {/* tufting lines */}
      <line x1="160" y1="110" x2="136" y2="126" stroke="#8B6914" strokeWidth="0.6" opacity="0.15"/>
      <line x1="160" y1="110" x2="184" y2="126" stroke="#8B6914" strokeWidth="0.6" opacity="0.15"/>
      {/* legs */}
      <rect x="96"  y="200" width="12" height="24" rx="5" fill="#5a3a1a" opacity="0.30"/>
      <rect x="212" y="200" width="12" height="24" rx="5" fill="#5a3a1a" opacity="0.30"/>
    </svg>
  );
}

function FloatingShelfIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="215" rx="120" ry="6" fill="#5a3a1a" opacity="0.05"/>
      {/* wall hint */}
      <rect x="30" y="20" width="260" height="180" rx="3" fill="#8B6914" opacity="0.04"/>
      {/* 3 floating shelves */}
      {/* shelf 1 */}
      <rect x="50" y="48" width="220" height="12" rx="3" fill="#c4a45a" opacity="0.40"/>
      <rect x="50" y="56" width="220" height="5"  rx="2" fill="#8B6914" opacity="0.22"/>
      {/* bracket */}
      <rect x="70"  y="56" width="6" height="22" rx="2" fill="#8B6914" opacity="0.30"/>
      <rect x="244" y="56" width="6" height="22" rx="2" fill="#8B6914" opacity="0.30"/>
      {/* items on shelf 1 */}
      <rect x="58"  y="26" width="10" height="24" rx="2" fill="#c4693a" opacity="0.45"/>
      <rect x="70"  y="28" width="14" height="22" rx="2" fill="#3a6a8B" opacity="0.40"/>
      <rect x="86"  y="24" width="10" height="26" rx="2" fill="#6a8B3a" opacity="0.45"/>
      <ellipse cx="130" cy="40" rx="14" ry="12" fill="#3a7a3a" opacity="0.30"/>
      <rect    cx="128" y="40" width="4" height="12" rx="2" fill="#8B6914" opacity="0.30"/>
      <rect x="158" y="26" width="22" height="24" rx="2" fill="#c4a45a" opacity="0.40"/>
      <rect x="192" y="28" width="10" height="22" rx="2" fill="#8B3a6a" opacity="0.40"/>
      <rect x="204" y="24" width="14" height="26" rx="2" fill="#c4693a" opacity="0.40"/>
      <ellipse cx="242" cy="39" rx="10" ry="11" fill="#8B6914" opacity="0.35"/>
      {/* shelf 2 */}
      <rect x="50" y="112" width="220" height="12" rx="3" fill="#c4a45a" opacity="0.40"/>
      <rect x="50" y="120" width="220" height="5"  rx="2" fill="#8B6914" opacity="0.22"/>
      <rect x="70"  y="120" width="6" height="22" rx="2" fill="#8B6914" opacity="0.30"/>
      <rect x="244" y="120" width="6" height="22" rx="2" fill="#8B6914" opacity="0.30"/>
      <rect x="58"  y="90" width="14" height="24" rx="2" fill="#3a6a8B" opacity="0.45"/>
      <rect x="74"  y="88" width="10" height="26" rx="2" fill="#c4693a" opacity="0.45"/>
      <ellipse cx="110" cy="102" rx="12" ry="12" fill="#c4a45a" opacity="0.40"/>
      <rect x="158" y="88" width="22" height="26" rx="3" fill="#8B6914" opacity="0.30"/>
      <rect x="192" y="90" width="10" height="24" rx="2" fill="#6a8B3a" opacity="0.45"/>
      <rect x="204" y="88" width="14" height="26" rx="2" fill="#8B3a6a" opacity="0.40"/>
      {/* shelf 3 */}
      <rect x="50" y="176" width="220" height="12" rx="3" fill="#c4a45a" opacity="0.40"/>
      <rect x="50" y="184" width="220" height="5"  rx="2" fill="#8B6914" opacity="0.22"/>
      <rect x="70"  y="184" width="6" height="22" rx="2" fill="#8B6914" opacity="0.30"/>
      <rect x="244" y="184" width="6" height="22" rx="2" fill="#8B6914" opacity="0.30"/>
      <rect x="60"  y="154" width="10" height="24" rx="2" fill="#c4693a" opacity="0.45"/>
      <rect x="72"  y="152" width="14" height="26" rx="2" fill="#3a6a8B" opacity="0.40"/>
      <ellipse cx="130" cy="165" rx="14" ry="13" fill="#3a7a3a" opacity="0.32"/>
      <rect x="190" y="152" width="22" height="26" rx="3" fill="#c4a45a" opacity="0.38"/>
      <rect x="224" y="154" width="10" height="24" rx="2" fill="#8B3a6a" opacity="0.40"/>
    </svg>
  );
}

function DefaultFurnitureIllustration() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="213" rx="110" ry="8" fill="#5a3a1a" opacity="0.07"/>
      {/* generic cabinet/sideboard */}
      <rect x="56" y="108" width="208" height="88" rx="8" fill="#8B6914" opacity="0.22"/>
      <rect x="60" y="110" width="200" height="84" rx="6" fill="#c4a45a" opacity="0.18"/>
      {/* legs */}
      <rect x="66"  y="196" width="14" height="20" rx="5" fill="#5a3a1a" opacity="0.28"/>
      <rect x="112" y="196" width="14" height="20" rx="5" fill="#5a3a1a" opacity="0.28"/>
      <rect x="194" y="196" width="14" height="20" rx="5" fill="#5a3a1a" opacity="0.28"/>
      <rect x="240" y="196" width="14" height="20" rx="5" fill="#5a3a1a" opacity="0.28"/>
      {/* 2 doors */}
      <rect x="64"  y="114" width="92" height="72" rx="5" fill="#c4a45a" opacity="0.28"/>
      <rect x="164" y="114" width="92" height="72" rx="5" fill="#c4a45a" opacity="0.28"/>
      <rect x="68"  y="118" width="84" height="64" rx="3" fill="#c4a45a" opacity="0.18"/>
      <rect x="168" y="118" width="84" height="64" rx="3" fill="#c4a45a" opacity="0.18"/>
      {/* handles */}
      <rect x="146" y="146" width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      <rect x="168" y="146" width="6" height="14" rx="3" fill="#5a3a1a" opacity="0.45"/>
      {/* top items */}
      <rect x="68"  y="92" width="20" height="18" rx="5" fill="#c4a45a" opacity="0.45"/>
      <ellipse cx="212" cy="100" rx="16" ry="10" fill="#8B6914" opacity="0.30"/>
      <rect x="238" y="88" width="10" height="22" rx="4" fill="#c4a45a" opacity="0.40"/>
    </svg>
  );
}

/* ── Matcher: product name → illustration component + accent colors ── */
export function getProductVisual(name = '') {
  const n = name.toLowerCase();

  if (/sofa|couch|lounge/.test(n))                   return { Illustration: SofaIllustration,         accent: PRODUCT_ACCENTS.sofa };
  if (/bed/.test(n))                                  return { Illustration: BedIllustration,           accent: PRODUCT_ACCENTS.bed };
  if (/wardrobe|almari/.test(n))                      return { Illustration: WardrobeIllustration,      accent: PRODUCT_ACCENTS.wardrobe };
  if (/dining table|dining set/.test(n))              return { Illustration: DiningTableIllustration,   accent: PRODUCT_ACCENTS.dining };
  if (/office chair|chair/.test(n))                   return { Illustration: OfficeChairIllustration,   accent: PRODUCT_ACCENTS.chair };
  if (/coffee table|center table/.test(n))            return { Illustration: CoffeeTableIllustration,   accent: PRODUCT_ACCENTS.coffee };
  if (/bookshelf|bookcase/.test(n))                   return { Illustration: BookshelfIllustration,     accent: PRODUCT_ACCENTS.bookshelf };
  if (/tv|entertainment unit/.test(n))                return { Illustration: TvStandIllustration,       accent: PRODUCT_ACCENTS.tv };
  if (/dresser/.test(n))                              return { Illustration: DresserIllustration,       accent: PRODUCT_ACCENTS.dresser };
  if (/nightstand|bedside/.test(n))                   return { Illustration: NightstandIllustration,    accent: PRODUCT_ACCENTS.nightstand };
  if (/desk|computer table|study/.test(n))            return { Illustration: DeskIllustration,          accent: PRODUCT_ACCENTS.desk };
  if (/storage cabinet|cabinet/.test(n))              return { Illustration: StorageCabinetIllustration,accent: PRODUCT_ACCENTS.cabinet };
  if (/shoe rack/.test(n))                            return { Illustration: ShoeRackIllustration,      accent: PRODUCT_ACCENTS.shoe };
  if (/chest of drawer/.test(n))                      return { Illustration: ChestOfDrawersIllustration,accent: PRODUCT_ACCENTS.cabinet };
  if (/kitchen island/.test(n))                       return { Illustration: KitchenIslandIllustration, accent: PRODUCT_ACCENTS.island };
  if (/accent chair|single chair/.test(n))            return { Illustration: AccentChairIllustration,   accent: PRODUCT_ACCENTS.sofa };
  if (/floating.*shelf|wall shelf/.test(n))           return { Illustration: FloatingShelfIllustration, accent: PRODUCT_ACCENTS.bookshelf };

  return { Illustration: DefaultFurnitureIllustration, accent: PRODUCT_ACCENTS.default };
}