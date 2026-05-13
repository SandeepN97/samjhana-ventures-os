/* ─────────────────────────────────────────────────────────────
   Beekeeping product SVG illustrations — modern, high-detail
   All viewBox="0 0 320 240". Warm palette + honey amber tones.
───────────────────────────────────────────────────────────── */

/* ── HIVES ─────────────────────────────────────────────────── */

export function LangstrothHiveSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="lh-box" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6B4226"/>
          <stop offset="40%" stopColor="#A0632E"/>
          <stop offset="100%" stopColor="#7A4E28"/>
        </linearGradient>
        <linearGradient id="lh-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#D4A06A"/>
          <stop offset="100%" stopColor="#B87840"/>
        </linearGradient>
        <linearGradient id="lh-roof" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C0C0C0"/>
          <stop offset="100%" stopColor="#888888"/>
        </linearGradient>
        <linearGradient id="lh-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#4A2E18"/>
          <stop offset="100%" stopColor="#5A3820"/>
        </linearGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="160" cy="228" rx="100" ry="7" fill="#3a1a00" opacity="0.10"/>

      {/* === Roof === */}
      {/* Roof side face */}
      <polygon points="248,56 268,64 268,68 248,60" fill="#888" opacity="0.6"/>
      {/* Roof front face */}
      <polygon points="72,60 248,60 248,56 72,56" fill="url(#lh-roof)"/>
      {/* Roof peak left */}
      <polygon points="72,56 248,56 160,30 88,30" fill="#D0D0D0"/>
      {/* Roof peak right (darker side) */}
      <polygon points="248,56 268,64 178,38 160,30" fill="#909090"/>
      {/* Roof ridge cap */}
      <rect x="88" y="28" width="72" height="5" rx="2" fill="#A0A0A0"/>
      {/* Roof lip/overhang */}
      <rect x="68" y="58" width="184" height="6" rx="1" fill="#C8C8C8"/>

      {/* === Honey super (upper box) === */}
      {/* Front face */}
      <rect x="72" y="64" width="176" height="52" fill="url(#lh-box)"/>
      {/* Wood grain lines on front */}
      {[72,80,88,96,104,112,120,128,136,144,152,160,168,176,184,192,200,208,216,224,232,240,248].map((x) => (
        <line key={x} x1={x} y1="64" x2={x} y2="116" stroke="#5A3018" strokeWidth="0.4" opacity="0.25"/>
      ))}
      {/* Horizontal groove lines */}
      <line x1="72" y1="84" x2="248" y2="84" stroke="#5A3018" strokeWidth="0.8" opacity="0.30"/>
      <line x1="72" y1="96" x2="248" y2="96" stroke="#5A3018" strokeWidth="0.8" opacity="0.30"/>
      {/* Top surface of super */}
      <rect x="72" y="62" width="176" height="5" fill="url(#lh-top)"/>
      {/* Right side face of super */}
      <polygon points="248,64 268,72 268,124 248,116" fill="url(#lh-side)"/>
      {/* Frame tops visible at top of super */}
      {[82,102,122,142,162,182,202,222,242].map((x, i) => (
        <rect key={i} x={x} y="64" width="14" height="6" rx="1" fill="#C49A6C" opacity="0.60"/>
      ))}
      {/* Super label */}
      <rect x="110" y="100" width="80" height="14" rx="3" fill="#E8A400" opacity="0.20"/>
      <text x="150" y="111" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#C07800" fontWeight="600" opacity="0.80">HONEY SUPER</text>

      {/* === Brood box (lower box) === */}
      <rect x="72" y="116" width="176" height="62" fill="url(#lh-box)"/>
      {[72,80,88,96,104,112,120,128,136,144,152,160,168,176,184,192,200,208,216,224,232,240,248].map((x) => (
        <line key={x} x1={x} y1="116" x2={x} y2="178" stroke="#5A3018" strokeWidth="0.4" opacity="0.22"/>
      ))}
      <line x1="72" y1="136" x2="248" y2="136" stroke="#5A3018" strokeWidth="0.8" opacity="0.25"/>
      <line x1="72" y1="152" x2="248" y2="152" stroke="#5A3018" strokeWidth="0.8" opacity="0.25"/>
      <line x1="72" y1="168" x2="248" y2="168" stroke="#5A3018" strokeWidth="0.8" opacity="0.25"/>
      <rect x="72" y="114" width="176" height="5" fill="url(#lh-top)"/>
      <polygon points="248,116 268,124 268,186 248,178" fill="url(#lh-side)"/>
      <rect x="110" y="154" width="80" height="14" rx="3" fill="#8B5E3C" opacity="0.20"/>
      <text x="150" y="165" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#5A3018" fontWeight="600" opacity="0.80">BROOD CHAMBER</text>

      {/* === Bottom board / entrance === */}
      <rect x="68" y="178" width="184" height="12" rx="3" fill="#5A3018"/>
      <rect x="68" y="176" width="184" height="5" rx="2" fill="#7A4E28"/>
      <polygon points="248,178 268,186 272,196 252,188" fill="#3A1E0A"/>
      {/* Entrance slot */}
      <rect x="100" y="182" width="80" height="5" rx="1" fill="#3A1A00" opacity="0.60"/>
      <rect x="68" y="188" width="188" height="6" rx="2" fill="#3A1A00" opacity="0.25"/>

      {/* === Legs === */}
      <rect x="84"  y="192" width="14" height="30" rx="4" fill="#6B4226"/>
      <rect x="222" y="192" width="14" height="30" rx="4" fill="#6B4226"/>
      <rect x="88"  y="220" width="6"  height="4" rx="1" fill="#4A2E18"/>
      <rect x="226" y="220" width="6"  height="4" rx="1" fill="#4A2E18"/>

      {/* Queen excluder line between boxes */}
      <rect x="72" y="113" width="176" height="4" rx="1" fill="#534ab7" opacity="0.40"/>
      <line x1="80" y1="115" x2="240" y2="115" stroke="#534ab7" strokeWidth="0.6" strokeDasharray="3,2" opacity="0.50"/>
    </svg>
  );
}

export function LogHiveSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="log-body" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8B6040"/>
          <stop offset="50%" stopColor="#6B4226"/>
          <stop offset="100%" stopColor="#4A2E18"/>
        </linearGradient>
        <linearGradient id="log-end" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A07050"/>
          <stop offset="100%" stopColor="#6B4226"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="226" rx="115" ry="7" fill="#3a1a00" opacity="0.10"/>

      {/* Log main cylinder body */}
      <rect x="52" y="100" width="200" height="110" rx="55" fill="url(#log-body)"/>
      {/* Bark texture rings */}
      {[70,90,110,130,150,170,190,210,228].map((x, i) => (
        <ellipse key={i} cx={x} cy="155" rx="2" ry="50" fill="none" stroke="#4A2E18" strokeWidth="1.5" opacity="0.18"/>
      ))}
      {/* Highlight top */}
      <ellipse cx="160" cy="108" rx="96" ry="14" fill="#B08060" opacity="0.40"/>

      {/* Left end-grain face */}
      <ellipse cx="60" cy="155" rx="12" ry="52" fill="url(#log-end)"/>
      <ellipse cx="60" cy="155" rx="8" ry="36" fill="none" stroke="#8B6040" strokeWidth="1.2" opacity="0.40"/>
      <ellipse cx="60" cy="155" rx="4" ry="20" fill="none" stroke="#8B6040" strokeWidth="1" opacity="0.35"/>
      <ellipse cx="60" cy="155" rx="1.5" ry="8" fill="#5A3820" opacity="0.50"/>

      {/* Right end-grain face */}
      <ellipse cx="252" cy="155" rx="12" ry="52" fill="#7A5030"/>
      <ellipse cx="252" cy="155" rx="8" ry="36" fill="none" stroke="#8B6040" strokeWidth="1.2" opacity="0.35"/>
      <ellipse cx="252" cy="155" rx="4" ry="20" fill="none" stroke="#8B6040" strokeWidth="1" opacity="0.30"/>

      {/* Entrance hole */}
      <ellipse cx="160" cy="175" rx="14" ry="10" fill="#2A1608" opacity="0.80"/>
      <ellipse cx="160" cy="174" rx="11" ry="8" fill="#1A0E04" opacity="0.90"/>

      {/* Support logs underneath */}
      <ellipse cx="100" cy="222" rx="20" ry="10" fill="#5A3820"/>
      <rect x="80" y="205" width="40" height="18" rx="8" fill="#5A3820"/>
      <ellipse cx="220" cy="222" rx="20" ry="10" fill="#5A3820"/>
      <rect x="200" y="205" width="40" height="18" rx="8" fill="#5A3820"/>

      {/* Nepali label */}
      <text x="160" y="148" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#E8C4A0" opacity="0.70">कुन्दो मौरी घर</text>
    </svg>
  );
}

export function NucleusBoxSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="nuc-box" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7A4E28"/>
          <stop offset="50%" stopColor="#A06838"/>
          <stop offset="100%" stopColor="#7A4E28"/>
        </linearGradient>
        <linearGradient id="nuc-top" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C49A6C"/>
          <stop offset="100%" stopColor="#9A7048"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="224" rx="90" ry="6" fill="#3a1a00" opacity="0.10"/>

      {/* Lid */}
      <rect x="88" y="78" width="144" height="18" rx="3" fill="url(#nuc-top)"/>
      <rect x="84" y="76" width="152" height="8" rx="2" fill="#D4A878"/>
      <polygon points="232,78 252,86 252,96 232,88" fill="#8B6040"/>

      {/* Box body */}
      <rect x="92" y="96" width="136" height="120" fill="url(#nuc-box)"/>
      {/* Wood grain */}
      {[102,116,130,144,158,172,186,200,214].map((x) => (
        <line key={x} x1={x} y1="96" x2={x} y2="216" stroke="#5A3018" strokeWidth="0.5" opacity="0.20"/>
      ))}
      {/* Right side */}
      <polygon points="228,96 252,106 252,226 228,216" fill="#5A3820"/>
      {/* Top surface of box */}
      <rect x="92" y="94" width="136" height="5" fill="url(#nuc-top)"/>

      {/* Frame tops (5 frames) */}
      {[102,120,138,156,174,192].map((x, i) => (
        <rect key={i} x={x} y="96" width="14" height="8" rx="1" fill="#C49A6C" opacity="0.70"/>
      ))}

      {/* Ventilation holes on side */}
      {[130,150,170].map((y) => (
        <ellipse key={y} cx="94" cy={y} rx="3" ry="5" fill="#3A1A00" opacity="0.40"/>
      ))}

      {/* Entrance slot */}
      <rect x="128" y="208" width="64" height="6" rx="2" fill="#2A1200" opacity="0.60"/>

      {/* Handle slots */}
      <rect x="96"  y="142" width="8" height="24" rx="4" fill="#4A2E18" opacity="0.50"/>
      <rect x="216" y="142" width="8" height="24" rx="4" fill="#3A2010" opacity="0.50"/>

      {/* Bottom */}
      <rect x="88" y="214" width="148" height="8" rx="3" fill="#5A3820"/>
      <polygon points="232,214 252,224 252,230 232,222" fill="#3A2010"/>

      {/* Feet */}
      <rect x="100" y="220" width="14" height="16" rx="3" fill="#6B4226"/>
      <rect x="206" y="220" width="14" height="16" rx="3" fill="#6B4226"/>
    </svg>
  );
}

export function TuniFrameSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="frame-wood" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B6040"/>
          <stop offset="100%" stopColor="#C49A6C"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="228" rx="100" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* Outer wooden frame */}
      {/* Top bar */}
      <rect x="64" y="42" width="192" height="16" rx="4" fill="url(#frame-wood)"/>
      {/* Bottom bar */}
      <rect x="74" y="194" width="172" height="14" rx="4" fill="#8B6040"/>
      {/* Left side bar */}
      <rect x="64" y="42" width="14" height="166" rx="3" fill="#8B6040"/>
      {/* Right side bar */}
      <rect x="242" y="42" width="14" height="166" rx="3" fill="#7A5030"/>

      {/* Top bar notch/shoulder detail */}
      <rect x="60" y="54" width="22" height="8" rx="2" fill="#6B4226"/>
      <rect x="238" y="54" width="22" height="8" rx="2" fill="#6B4226"/>

      {/* Beeswax foundation — hexagonal grid */}
      {/* Main foundation area */}
      <rect x="82" y="62" width="156" height="128" rx="2" fill="#F5DFA0" opacity="0.60"/>
      {/* Hex cell pattern — rows of hexagons */}
      {Array.from({ length: 8 }, (_, row) =>
        Array.from({ length: 12 }, (_, col) => {
          const cx = 90 + col * 13 + (row % 2 === 0 ? 0 : 6.5);
          const cy = 74 + row * 14;
          if (cx > 228 || cy > 180) return null;
          return (
            <polygon key={`${row}-${col}`}
              points={`${cx},${cy-7} ${cx+6},${cy-3.5} ${cx+6},${cy+3.5} ${cx},${cy+7} ${cx-6},${cy+3.5} ${cx-6},${cy-3.5}`}
              fill={row < 3 ? '#F5D060' : '#F0E890'}
              stroke="#D4A400"
              strokeWidth="0.5"
              opacity="0.80"
            />
          );
        })
      )}

      {/* Capped cells (darker, wax capped) */}
      {[[116,88],[130,88],[144,88],[116,102],[130,102],[144,102],[158,102],
         [116,116],[130,116],[144,116],[158,116]].map(([cx,cy]) => (
        <polygon key={`${cx}-${cy}`}
          points={`${cx},${cy-7} ${cx+6},${cy-3.5} ${cx+6},${cy+3.5} ${cx},${cy+7} ${cx-6},${cy+3.5} ${cx-6},${cy-3.5}`}
          fill="#D4A030" stroke="#B07800" strokeWidth="0.6" opacity="0.85"/>
      ))}

      {/* Foundation wire (horizontal) */}
      {[100,126,152,176].map((y) => (
        <line key={y} x1="82" y1={y} x2="238" y2={y} stroke="#C0A060" strokeWidth="0.6" opacity="0.30"/>
      ))}

      {/* Label */}
      <rect x="108" y="204" width="104" height="12" rx="3" fill="#E8A400" opacity="0.15"/>
      <text x="160" y="213" textAnchor="middle" fontFamily="sans-serif" fontSize="7.5" fill="#8B6040" fontWeight="600">Tuni Frame · 10 pack</text>
    </svg>
  );
}

/* ── PROTECTIVE GEAR ────────────────────────────────────────── */

export function FullSuitSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="suit-body" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#E8E8E0"/>
          <stop offset="50%" stopColor="#F5F5F0"/>
          <stop offset="100%" stopColor="#DCDCD4"/>
        </linearGradient>
        <linearGradient id="veil-mesh" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#B0B0A0"/>
          <stop offset="100%" stopColor="#808078"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="228" rx="72" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* Helmet / veil */}
      {/* Veil frame ring */}
      <ellipse cx="160" cy="72" rx="52" ry="54" fill="#C8C8B8"/>
      {/* Veil mesh inside */}
      <ellipse cx="160" cy="72" rx="46" ry="48" fill="url(#veil-mesh)" opacity="0.85"/>
      {/* Mesh grid lines */}
      {[130,140,150,160,170,180,190].map((x) => (
        <line key={`v${x}`} x1={x} y1="24" x2={x} y2="120" stroke="#A0A090" strokeWidth="0.6" opacity="0.35"/>
      ))}
      {[30,42,54,66,78,90,102,114].map((y) => (
        <line key={`h${y}`} x1="114" y1={y} x2="206" y2={y} stroke="#A0A090" strokeWidth="0.6" opacity="0.35"/>
      ))}
      {/* Face opening (clear window) */}
      <rect x="132" y="42" width="56" height="44" rx="8" fill="#D0E8F0" opacity="0.40"/>
      <rect x="134" y="44" width="20" height="12" rx="3" fill="white" opacity="0.20"/>
      {/* Top vent */}
      <ellipse cx="160" cy="24" rx="18" ry="6" fill="#B0B0A8"/>
      {[152,156,160,164,168].map((x) => (
        <line key={x} x1={x} y1="19" x2={x} y2="29" stroke="#909088" strokeWidth="1" opacity="0.50"/>
      ))}
      {/* Veil-to-suit connector ring */}
      <rect x="118" y="118" width="84" height="10" rx="5" fill="#D0D0C8"/>

      {/* Body / suit */}
      {/* Torso */}
      <rect x="122" y="126" width="76" height="80" rx="12" fill="url(#suit-body)"/>
      {/* Center zipper */}
      <line x1="160" y1="128" x2="160" y2="204" stroke="#C8C0A8" strokeWidth="2" opacity="0.70"/>
      {[132,140,148,156,164,172,180,188,196,204].map((y) => (
        <rect key={y} x="157" y={y} width="6" height="4" rx="1" fill="#B0A890" opacity="0.60"/>
      ))}
      {/* Pocket left */}
      <rect x="128" y="152" width="24" height="20" rx="4" fill="#DCDCD0" opacity="0.70"/>
      <line x1="128" y1="162" x2="152" y2="162" stroke="#C0C0B8" strokeWidth="0.8"/>
      {/* Pocket right */}
      <rect x="168" y="152" width="24" height="20" rx="4" fill="#DCDCD0" opacity="0.70"/>

      {/* Left sleeve */}
      <rect x="80" y="126" width="44" height="64" rx="16" fill="url(#suit-body)"/>
      {/* Right sleeve */}
      <rect x="196" y="126" width="44" height="64" rx="16" fill="#DCDCD4"/>
      {/* Elastic cuffs */}
      <rect x="80"  y="182" width="44" height="10" rx="5" fill="#C8C8C0"/>
      <rect x="196" y="182" width="44" height="10" rx="5" fill="#C8C8C0"/>

      {/* Legs */}
      <rect x="126" y="202" width="30" height="28" rx="10" fill="url(#suit-body)"/>
      <rect x="164" y="202" width="30" height="28" rx="10" fill="#DCDCD4"/>
      {/* Ankle elastic */}
      <rect x="126" y="224" width="30" height="6" rx="3" fill="#C8C8C0"/>
      <rect x="164" y="224" width="30" height="6" rx="3" fill="#C8C8C0"/>

      {/* Elastic wrist ties */}
      <rect x="80"  y="190" width="44" height="4" rx="2" fill="#E8A400" opacity="0.60"/>
      <rect x="196" y="190" width="44" height="4" rx="2" fill="#E8A400" opacity="0.60"/>
    </svg>
  );
}

export function VeilCapSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="225" rx="80" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* Veil body — circular */}
      {/* Outer ring frame */}
      <ellipse cx="160" cy="120" rx="100" ry="90" fill="#C0C0B0"/>
      {/* Mesh interior */}
      <ellipse cx="160" cy="120" rx="92" ry="82" fill="#A8A898" opacity="0.85"/>
      {/* Mesh grid pattern */}
      {Array.from({ length: 14 }, (_, i) => {
        const x = 72 + i * 14;
        return <line key={`mv${i}`} x1={x} y1="40" x2={x} y2="200" stroke="#909088" strokeWidth="0.7" opacity="0.30"/>;
      })}
      {Array.from({ length: 12 }, (_, i) => {
        const y = 42 + i * 14;
        return <line key={`mh${i}`} x1="64" y1={y} x2="256" y2={y} stroke="#909088" strokeWidth="0.7" opacity="0.30"/>;
      })}
      {/* Brim frame ring */}
      <ellipse cx="160" cy="120" rx="100" ry="90" fill="none" stroke="#D0D0C0" strokeWidth="5"/>

      {/* Hat top crown */}
      <ellipse cx="160" cy="52" rx="72" ry="28" fill="#E8E8E0"/>
      <rect x="88" y="38" width="144" height="28" rx="8" fill="#E8E8E0"/>
      {/* Crown seam */}
      <line x1="88" y1="52" x2="232" y2="52" stroke="#D0D0C8" strokeWidth="1.5" opacity="0.50"/>
      {/* Crown top edge */}
      <ellipse cx="160" cy="38" rx="72" ry="12" fill="#F0F0E8"/>

      {/* Face opening (clear front panel) */}
      <rect x="108" y="78" width="104" height="70" rx="8" fill="#D0E8F0" opacity="0.35"/>
      <rect x="112" y="82" width="30" height="18" rx="4" fill="white" opacity="0.20"/>

      {/* Elastic band at bottom */}
      <ellipse cx="160" cy="200" rx="92" ry="12" fill="#D0D0C8" opacity="0.70"/>
      <ellipse cx="160" cy="200" rx="92" ry="12" fill="none" stroke="#B0B0A8" strokeWidth="2"/>
      {/* Elastic dots */}
      {[80,100,120,140,160,180,200,220,240].map((x) => (
        <circle key={x} cx={x} cy="200" r="2" fill="#A0A098" opacity="0.50"/>
      ))}
    </svg>
  );
}

export function LeatherGlovesSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leather" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#C49A6C"/>
          <stop offset="50%" stopColor="#A07840"/>
          <stop offset="100%" stopColor="#8B6030"/>
        </linearGradient>
        <linearGradient id="leather2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B08850"/>
          <stop offset="100%" stopColor="#7A5828"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="228" rx="100" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* LEFT GLOVE */}
      {/* Gauntlet cuff */}
      <rect x="30" y="124" width="80" height="80" rx="12" fill="url(#leather)"/>
      <line x1="30" y1="158" x2="110" y2="158" stroke="#8B6030" strokeWidth="1" opacity="0.30"/>
      <line x1="30" y1="172" x2="110" y2="172" stroke="#8B6030" strokeWidth="1" opacity="0.30"/>
      {/* Stitching lines on cuff */}
      {[36,42,48,54,60,66,72,78,84,90,96,102].map((x) => (
        <line key={x} x1={x} y1="126" x2={x} y2="200" stroke="#7A5028" strokeWidth="0.4" opacity="0.25"/>
      ))}
      {/* Hand palm */}
      <rect x="40" y="68" width="60" height="64" rx="8" fill="url(#leather)"/>
      {/* Fingers */}
      <rect x="42" y="30" width="16" height="46" rx="8" fill="url(#leather)"/>
      <rect x="60" y="24" width="16" height="52" rx="8" fill="url(#leather)"/>
      <rect x="78" y="26" width="16" height="50" rx="8" fill="url(#leather)"/>
      <rect x="94" y="32" width="14" height="44" rx="7" fill="url(#leather)"/>
      {/* Thumb */}
      <rect x="28" y="78" width="18" height="40" rx="9" fill="url(#leather)" transform="rotate(18 37 98)"/>
      {/* Knuckle highlights */}
      {[50,68,86,101].map((x) => (
        <rect key={x} x={x} y="72" width="8" height="4" rx="2" fill="#D4AA70" opacity="0.40"/>
      ))}
      {/* Wrist stitching */}
      <line x1="40" y1="126" x2="100" y2="126" stroke="#8B6030" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.50"/>

      {/* RIGHT GLOVE */}
      <rect x="210" y="124" width="80" height="80" rx="12" fill="url(#leather2)"/>
      <line x1="210" y1="158" x2="290" y2="158" stroke="#7A5028" strokeWidth="1" opacity="0.30"/>
      <line x1="210" y1="172" x2="290" y2="172" stroke="#7A5028" strokeWidth="1" opacity="0.30"/>
      {[216,222,228,234,240,246,252,258,264,270,276,282].map((x) => (
        <line key={x} x1={x} y1="126" x2={x} y2="200" stroke="#6A4820" strokeWidth="0.4" opacity="0.25"/>
      ))}
      <rect x="220" y="68" width="60" height="64" rx="8" fill="url(#leather2)"/>
      <rect x="262" y="30" width="16" height="46" rx="8" fill="url(#leather2)"/>
      <rect x="244" y="24" width="16" height="52" rx="8" fill="url(#leather2)"/>
      <rect x="226" y="26" width="16" height="50" rx="8" fill="url(#leather2)"/>
      <rect x="212" y="32" width="14" height="44" rx="7" fill="url(#leather2)"/>
      <rect x="274" y="78" width="18" height="40" rx="9" fill="url(#leather2)" transform="rotate(-18 283 98)"/>
      {[229,247,265,276].map((x) => (
        <rect key={x} x={x} y="72" width="8" height="4" rx="2" fill="#C49A60" opacity="0.40"/>
      ))}
      <line x1="220" y1="126" x2="280" y2="126" stroke="#7A5028" strokeWidth="1.5" strokeDasharray="3,2" opacity="0.50"/>

      {/* Crossed at wrist — visual arrangement */}
      <text x="160" y="226" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#8B6030" opacity="0.60">Leather Gauntlet Gloves</text>
    </svg>
  );
}

/* ── TOOLS ─────────────────────────────────────────────────── */

export function BeeSmokeSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="smoker-metal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#909090"/>
          <stop offset="40%" stopColor="#D0D0D0"/>
          <stop offset="100%" stopColor="#A0A0A0"/>
        </linearGradient>
        <linearGradient id="bellows-leather" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5E3C"/>
          <stop offset="100%" stopColor="#C49A6C"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="226" rx="85" ry="6" fill="#3a1a00" opacity="0.08"/>

      {/* Smoke wisps */}
      <path d="M 148,18 Q 144,8 148,0" stroke="#C0C0C0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.35"/>
      <path d="M 160,22 Q 156,8 162,0" stroke="#C0C0C0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.30"/>
      <path d="M 172,20 Q 170,8 168,0" stroke="#C0C0C0" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.25"/>

      {/* Smoker nozzle / spout */}
      <rect x="142" y="22" width="36" height="22" rx="4" fill="#B0B0B0"/>
      <rect x="146" y="24" width="28" height="18" rx="3" fill="#C8C8C8"/>
      {/* Nozzle guard ring */}
      <rect x="140" y="40" width="40" height="6" rx="2" fill="#909090"/>

      {/* Main cylinder body */}
      <rect x="128" y="46" width="64" height="140" rx="10" fill="url(#smoker-metal)"/>
      {/* Cylinder shine stripe */}
      <rect x="140" y="50" width="12" height="132" rx="5" fill="white" opacity="0.12"/>
      {/* Metal bands / seams */}
      <rect x="128" y="70"  width="64" height="5" rx="2" fill="#808080" opacity="0.40"/>
      <rect x="128" y="120" width="64" height="5" rx="2" fill="#808080" opacity="0.40"/>
      <rect x="128" y="170" width="64" height="5" rx="2" fill="#808080" opacity="0.40"/>

      {/* Fire grate at bottom */}
      <rect x="130" y="184" width="60" height="6" rx="2" fill="#606060"/>
      {[134,140,146,152,158,164,170,176,180,186].map((x) => (
        <line key={x} x1={x} y1="184" x2={x} y2="190" stroke="#505050" strokeWidth="1.5" opacity="0.60"/>
      ))}

      {/* Handle / hook */}
      <path d="M 192,80 Q 220,80 220,110 Q 220,140 192,145" stroke="#909090" strokeWidth="5" fill="none" strokeLinecap="round"/>
      <path d="M 192,80 Q 220,80 220,110 Q 220,140 192,145" stroke="#C0C0C0" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.50"/>

      {/* Bellows body */}
      <rect x="64" y="100" width="66" height="80" rx="14" fill="url(#bellows-leather)"/>
      {/* Bellows accordion folds */}
      {[112,122,132,142,152,162].map((y) => (
        <rect key={y} x="64" y={y} width="66" height="5" rx="2" fill="#8B5030" opacity="0.35"/>
      ))}
      {/* Bellows sides (stitching) */}
      <line x1="66" y1="102" x2="66" y2="178" stroke="#7A4520" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.40"/>
      <line x1="128" y1="102" x2="128" y2="178" stroke="#7A4520" strokeWidth="1.5" strokeDasharray="2,2" opacity="0.40"/>
      {/* Bellows pipe connecting to smoker */}
      <rect x="126" y="126" width="6" height="30" rx="3" fill="#A0A0A0"/>

      {/* Bottom stand */}
      <rect x="122" y="190" width="76" height="16" rx="5" fill="#808080"/>
      <rect x="130" y="204" width="14" height="18" rx="4" fill="#707070"/>
      <rect x="176" y="204" width="14" height="18" rx="4" fill="#707070"/>
    </svg>
  );
}

export function HiveToolSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="steel" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E0E0E0"/>
          <stop offset="40%" stopColor="#C0C0C0"/>
          <stop offset="100%" stopColor="#909090"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="226" rx="60" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* J-type hive tool — angled diagonally for visual interest */}
      {/* Main body of tool */}
      <rect x="80" y="46" width="160" height="18" rx="6" fill="url(#steel)" transform="rotate(8 160 120)"/>
      {/* Steel shine */}
      <rect x="84" y="48" width="60" height="6" rx="3" fill="white" opacity="0.20" transform="rotate(8 160 120)"/>

      {/* One end — flat scraper blade */}
      <polygon points="232,50 256,42 258,58 234,66" fill="#D0D0D0"/>
      <polygon points="252,43 260,40 262,46 254,49" fill="#E8E8E8"/>
      <line x1="234" y1="54" x2="258" y2="46" stroke="#A0A0A0" strokeWidth="0.8" opacity="0.40"/>

      {/* Other end — J hook */}
      <path d="M 84,126 Q 62,126 60,148 Q 58,168 82,172"
        stroke="url(#steel)" strokeWidth="14" fill="none" strokeLinecap="round"/>
      <path d="M 84,126 Q 62,126 60,148 Q 58,168 82,172"
        stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.18"/>
      {/* Hook tip */}
      <ellipse cx="86" cy="172" rx="10" ry="7" fill="#C8C8C8"/>

      {/* Handle grip — rubber section */}
      <rect x="128" y="78" width="60" height="20" rx="8" fill="#E8A400" opacity="0.80" transform="rotate(8 158 88)"/>
      {[132,140,148,156,164,172,178].map((x) => (
        <line key={x} x1={x} y1="76" x2={x-6} y2="101" stroke="#C07800" strokeWidth="1.5" opacity="0.40"/>
      ))}

      {/* Engraved logo area */}
      <rect x="174" y="52" width="40" height="14" rx="4" fill="#B0B0B0" opacity="0.50" transform="rotate(8 194 59)"/>

      {/* Flat scraper edge highlight */}
      <line x1="240" y1="42" x2="258" y2="36" stroke="white" strokeWidth="1.5" opacity="0.30"/>
    </svg>
  );
}

export function QueenCageSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="226" rx="70" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* PVC cage body */}
      <rect x="102" y="48" width="116" height="148" rx="16" fill="#EEEDfe" stroke="#534ab7" strokeWidth="2.5"/>
      {/* Grid bars vertical */}
      {[118,130,142,154,166,178,190,202].map((x) => (
        <line key={x} x1={x} y1="52" x2={x} y2="192" stroke="#534ab7" strokeWidth="1.2" opacity="0.40"/>
      ))}
      {/* Grid bars horizontal */}
      {[68,84,100,116,132,148,164,180].map((y) => (
        <line key={y} x1="106" y1={y} x2="214" y2={y} stroke="#534ab7" strokeWidth="1.2" opacity="0.40"/>
      ))}
      {/* Top cap */}
      <rect x="100" y="44" width="120" height="16" rx="8" fill="#7070C8"/>
      <rect x="110" y="46" width="100" height="10" rx="5" fill="#8080D8" opacity="0.60"/>
      {/* Bottom cap */}
      <rect x="100" y="188" width="120" height="16" rx="8" fill="#7070C8"/>
      {/* Clip lock mechanism */}
      <rect x="148" y="38" width="24" height="14" rx="4" fill="#534ab7"/>
      <rect x="152" y="40" width="16" height="10" rx="3" fill="#6868C8"/>
      {/* Queen bee inside (stylized) */}
      <ellipse cx="160" cy="120" rx="18" ry="26" fill="#E8A400" opacity="0.80"/>
      <ellipse cx="160" cy="110" rx="10" ry="8" fill="#F5C840" opacity="0.90"/>
      {/* Wings */}
      <ellipse cx="142" cy="114" rx="16" ry="8" fill="white" opacity="0.50" transform="rotate(-20 142 114)"/>
      <ellipse cx="178" cy="114" rx="16" ry="8" fill="white" opacity="0.50" transform="rotate(20 178 114)"/>
      {/* Crown mark */}
      <text x="160" y="124" textAnchor="middle" fontSize="14" fill="#FFF" opacity="0.80">♛</text>

      {/* Label */}
      <text x="160" y="220" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#534ab7" opacity="0.70">Queen Capture Cage · PVC</text>
    </svg>
  );
}

export function HoneyExtractorSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="extractor-metal" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A0A0A0"/>
          <stop offset="40%" stopColor="#E0E0E0"/>
          <stop offset="100%" stopColor="#B0B0B0"/>
        </linearGradient>
        <linearGradient id="honey-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F5D060" stopOpacity="0.60"/>
          <stop offset="100%" stopColor="#E8A400" stopOpacity="0.70"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="228" rx="90" ry="6" fill="#3a1a00" opacity="0.10"/>

      {/* Barrel / cylinder body */}
      <ellipse cx="160" cy="72" rx="80" ry="20" fill="#D0D0D0"/>
      <rect x="80" y="72" width="160" height="140" fill="url(#extractor-metal)"/>
      <ellipse cx="160" cy="72" rx="80" ry="20" fill="none" stroke="#B0B0B0" strokeWidth="2"/>
      {/* Shine stripe */}
      <rect x="90" y="72" width="20" height="136" fill="white" opacity="0.12"/>
      {/* Metal bands */}
      <rect x="80" y="100" width="160" height="5" fill="#B0B0B0" opacity="0.50"/>
      <rect x="80" y="150" width="160" height="5" fill="#B0B0B0" opacity="0.50"/>
      {/* Honey level inside (visible through glass-ish barrel) */}
      <rect x="84" y="170" width="152" height="40" fill="url(#honey-fill)" rx="4"/>

      {/* Bottom ellipse */}
      <ellipse cx="160" cy="212" rx="80" ry="14" fill="#C0C0C0"/>

      {/* Honey gate tap */}
      <rect x="195" y="196" width="36" height="20" rx="5" fill="#C0C0C0"/>
      <rect x="228" y="200" width="16" height="12" rx="3" fill="#909090"/>
      <ellipse cx="246" cy="206" rx="8" ry="6" fill="#808080"/>

      {/* Hand crank handle (top) */}
      <rect x="152" y="36" width="16" height="40" rx="6" fill="#A0A0A0"/>
      <rect x="148" y="32" width="24" height="10" rx="4" fill="#C0C0C0"/>
      <rect x="156" y="14" width="8" height="24" rx="4" fill="#909090"/>
      {/* Crank arm */}
      <rect x="164" y="16" width="36" height="8" rx="4" fill="#A0A0A0" transform="rotate(30 182 20)"/>
      <ellipse cx="196" cy="28" rx="8" ry="8" fill="#C8C8C8"/>
      <ellipse cx="196" cy="28" rx="5" ry="5" fill="#A0A0A0"/>

      {/* Frame basket inside (hint) */}
      <ellipse cx="160" cy="72" rx="52" ry="14" fill="#D4A060" opacity="0.30"/>
      {[130,148,166,184].map((x) => (
        <line key={x} x1={x} y1="72" x2={x} y2="168" stroke="#D4A060" strokeWidth="1.5" opacity="0.25"/>
      ))}

      {/* Stand legs */}
      <rect x="92"  y="218" width="14" height="18" rx="4" fill="#909090"/>
      <rect x="214" y="218" width="14" height="18" rx="4" fill="#909090"/>
      <rect x="88"  y="230" width="22" height="5" rx="2" fill="#808080"/>
      <rect x="210" y="230" width="22" height="5" rx="2" fill="#808080"/>
    </svg>
  );
}

/* ── HONEY PRODUCTS ─────────────────────────────────────────── */

export function HoneyJarSVG({ shade = 'light' }) {
  const honeyColor = shade === 'dark' ? '#C07800' : '#E8A400';
  const honeyLight = shade === 'dark' ? '#D4A030' : '#F5C840';
  const lidColor   = shade === 'dark' ? '#8B5E0A' : '#C8880A';

  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`jar-glass-${shade}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#D0E8F0" stopOpacity="0.50"/>
          <stop offset="30%" stopColor="#F0F8FC" stopOpacity="0.35"/>
          <stop offset="70%" stopColor="#D8EEF5" stopOpacity="0.50"/>
          <stop offset="100%" stopColor="#A8C8D8" stopOpacity="0.60"/>
        </linearGradient>
        <linearGradient id={`jar-honey-${shade}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={honeyLight}/>
          <stop offset="100%" stopColor={honeyColor}/>
        </linearGradient>
        <linearGradient id={`jar-lid-${shade}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8C050"/>
          <stop offset="100%" stopColor={lidColor}/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="227" rx="72" ry="6" fill="#3a1a00" opacity="0.10"/>

      {/* Lid */}
      <ellipse cx="160" cy="56" rx="54" ry="14" fill={`url(#jar-lid-${shade})`}/>
      <rect x="106" y="50" width="108" height="18" rx="4" fill={`url(#jar-lid-${shade})`}/>
      <ellipse cx="160" cy="50" rx="54" ry="12" fill="#F0D060"/>
      {/* Lid ring detail */}
      <ellipse cx="160" cy="50" rx="50" ry="10" fill="none" stroke={lidColor} strokeWidth="1.5" opacity="0.50"/>
      {/* Lid top highlight */}
      <ellipse cx="148" cy="46" rx="16" ry="6" fill="white" opacity="0.18"/>

      {/* Jar shoulder (hexagonal) */}
      <rect x="106" y="62" width="108" height="18" rx="6" fill={`url(#jar-glass-${shade})`} stroke="#C0D8E8" strokeWidth="1"/>

      {/* Jar body */}
      <rect x="98" y="78" width="124" height="136" rx="12" fill={`url(#jar-glass-${shade})`} stroke="#B0CCD8" strokeWidth="1.5"/>
      {/* Glass shine — vertical streak left */}
      <rect x="108" y="82" width="14" height="126" rx="6" fill="white" opacity="0.14"/>
      {/* Glass shine — small right */}
      <rect x="198" y="86" width="8" height="60" rx="4" fill="white" opacity="0.10"/>

      {/* Honey fill */}
      <rect x="102" y="138" width="116" height="72" rx="0" fill={`url(#jar-honey-${shade})`} opacity="0.85"/>
      <rect x="102" y="206" width="116" height="6" rx="0" fill={`url(#jar-honey-${shade})`}/>
      {/* Bottom round fill */}
      <rect x="102" y="208" width="116" height="4" rx="12" fill={honeyColor} opacity="0.70"/>
      {/* Honey surface gloss */}
      <ellipse cx="160" cy="138" rx="56" ry="6" fill={honeyLight} opacity="0.60"/>

      {/* Label on jar */}
      <rect x="110" y="90" width="100" height="44" rx="6" fill="white" opacity="0.75"/>
      <rect x="112" y="92" width="96" height="40" rx="5" fill="#FFFEF5" opacity="0.90"/>
      {/* Honeycomb hex pattern on label */}
      {[[130,98],[144,98],[158,98],[172,98],[130,110],[144,110],[158,110],[172,110]].map(([x,y]) => (
        <polygon key={`${x}${y}`}
          points={`${x},${y-5} ${x+4},${y-2.5} ${x+4},${y+2.5} ${x},${y+5} ${x-4},${y+2.5} ${x-4},${y-2.5}`}
          fill={honeyColor} opacity="0.20" stroke={honeyColor} strokeWidth="0.4" opacity2="0.30"/>
      ))}
      <text x="160" y="108" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#8B5E00" fontWeight="700">RAW HONEY</text>
      <text x="160" y="120" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fill="#A07828">Gulmi, Nepal</text>
      <text x="160" y="130" textAnchor="middle" fontFamily="sans-serif" fontSize="6" fill="#C49A00" opacity="0.80">500g · Unfiltered</text>

      {/* Bottom of jar */}
      <ellipse cx="160" cy="214" rx="62" ry="8" fill={honeyColor} opacity="0.40"/>
    </svg>
  );
}

export function BeeswaxBlockSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wax-top" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5E060"/>
          <stop offset="100%" stopColor="#D4B820"/>
        </linearGradient>
        <linearGradient id="wax-front" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8C830"/>
          <stop offset="100%" stopColor="#B89010"/>
        </linearGradient>
        <linearGradient id="wax-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C8A820"/>
          <stop offset="100%" stopColor="#A88810"/>
        </linearGradient>
      </defs>

      <ellipse cx="165" cy="222" rx="100" ry="7" fill="#3a1a00" opacity="0.10"/>

      {/* Block isometric view */}
      {/* Top face */}
      <polygon points="80,90 200,58 268,98 148,130" fill="url(#wax-top)"/>
      {/* Surface texture lines */}
      {[[85,92,202,60],[102,84,218,52],[120,76,236,44],[138,68,253,36]].map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4B000" strokeWidth="0.5" opacity="0.20"/>
      ))}
      {[[84,90,154,128],[116,80,186,118],[150,70,220,108],[184,62,254,100]].map(([x1,y1,x2,y2], i) => (
        <line key={`v${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4B000" strokeWidth="0.5" opacity="0.20"/>
      ))}

      {/* Front face */}
      <polygon points="80,90 148,130 148,210 80,170" fill="url(#wax-front)"/>
      {/* Texture on front */}
      {[110,130,150,170,190].map((y) => (
        <line key={y} x1="82" y1={y} x2="146" y2={y+38} stroke="#B09000" strokeWidth="0.5" opacity="0.20"/>
      ))}

      {/* Right face */}
      <polygon points="148,130 268,98 268,178 148,210" fill="url(#wax-side)"/>
      {/* Texture on right */}
      {[108,128,148,168].map((y) => (
        <line key={y} x1="150" y1={y} x2="266" y2={y-30} stroke="#988000" strokeWidth="0.5" opacity="0.20"/>
      ))}

      {/* Bottom edges */}
      <polygon points="80,170 148,210 268,178 200,138" fill="#A08010" opacity="0.15"/>

      {/* Weight label stamp on top */}
      <ellipse cx="165" cy="92" rx="36" ry="18" fill="white" opacity="0.18"/>
      <text x="165" y="88" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#8B6000" fontWeight="700" opacity="0.80">500g</text>
      <text x="165" y="100" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#8B6000" opacity="0.60">Pure Beeswax</text>

      {/* Top shine */}
      <polygon points="100,76 160,60 200,78 140,94" fill="white" opacity="0.14"/>
    </svg>
  );
}

export function HoneycombFrameSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="hc-frame" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5E3C"/>
          <stop offset="100%" stopColor="#C49A6C"/>
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="226" rx="100" ry="5" fill="#3a1a00" opacity="0.08"/>

      {/* Frame border */}
      <rect x="52" y="28" width="216" height="186" rx="6" fill="url(#hc-frame)"/>
      <rect x="60" y="36" width="200" height="170" rx="4" fill="#FAEEDA"/>

      {/* Dense honeycomb hex grid */}
      {Array.from({ length: 11 }, (_, row) =>
        Array.from({ length: 16 }, (_, col) => {
          const size = 11;
          const cx = 72 + col * (size * 1.74) + (row % 2 === 0 ? 0 : size * 0.87);
          const cy = 48 + row * (size * 1.5);
          if (cx > 250 || cy > 196) return null;
          const capped = (row + col) % 3 !== 0;
          const halfEmpty = (row + col) % 7 === 0;
          const fillColor = capped ? '#D4A030' : halfEmpty ? '#F5E890' : '#E8C050';
          const strokeColor = capped ? '#B07800' : '#D4A030';
          const pts = [0,60,120,180,240,300].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return `${cx + size * Math.cos(rad)},${cy + size * Math.sin(rad)}`;
          }).join(' ');
          return <polygon key={`${row}-${col}`} points={pts} fill={fillColor} stroke={strokeColor} strokeWidth="0.6" opacity="0.90"/>;
        })
      )}

      {/* Capped cells darker for visual interest */}
      {/* Frame top bar */}
      <rect x="52" y="28" width="216" height="12" rx="4" fill="#8B5E3C"/>
      <rect x="52" y="194" width="216" height="14" rx="4" fill="#7A4E28"/>
      <rect x="52" y="28" width="12" height="186" rx="4" fill="#7A4E28"/>
      <rect x="256" y="28" width="12" height="186" rx="4" fill="#6B4226"/>

      {/* Top bar notch */}
      <rect x="48" y="36" width="20" height="10" rx="3" fill="#6B4226"/>
      <rect x="252" y="36" width="20" height="10" rx="3" fill="#6B4226"/>

      {/* Honey drip detail */}
      <path d="M 148 204 Q 148 218 140 222" stroke="#E8A400" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.60"/>
      <ellipse cx="140" cy="222" rx="4" ry="5" fill="#E8A400" opacity="0.55"/>
      <path d="M 172 204 Q 172 214 178 220" stroke="#E8A400" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.50"/>
      <ellipse cx="178" cy="220" rx="3" ry="4" fill="#E8A400" opacity="0.50"/>
    </svg>
  );
}

/* ── STARTER KITS ───────────────────────────────────────────── */

export function BasicKitSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="228" rx="110" ry="6" fill="#3a1a00" opacity="0.08"/>
      {/* Small hive */}
      <rect x="48" y="80" width="90" height="50" rx="6" fill="#A0632E"/>
      <rect x="48" y="60" width="90" height="24" rx="5" fill="#8B5020"/>
      <polygon points="38,64 148,64 128,40 58,40" fill="#C8C8C8"/>
      <rect x="38" y="62" width="110" height="6" rx="2" fill="#D8D8D8"/>
      <rect x="48" y="128" width="90" height="10" rx="3" fill="#6B4226"/>
      {/* Smoker */}
      <rect x="165" y="60" width="32" height="80" rx="8" fill="#C0C0C0"/>
      <rect x="173" y="52" width="16" height="14" rx="4" fill="#A0A0A0"/>
      {/* Veil cap */}
      <ellipse cx="240" cy="96" rx="38" ry="34" fill="#C0C0B0"/>
      <ellipse cx="240" cy="96" rx="30" ry="26" fill="#A8A898" opacity="0.80"/>
      <rect x="214" y="66" width="52" height="16" rx="6" fill="#E8E8E0"/>
      {/* Hive tool */}
      <rect x="56" y="148" width="100" height="8" rx="3" fill="#C0C0C0" transform="rotate(-5 106 152)"/>
      {/* Label */}
      <rect x="84" y="186" width="152" height="28" rx="8" fill="#eaf3de"/>
      <text x="160" y="198" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fill="#3b6d11" fontWeight="700">Basic Starter Kit</text>
      <text x="160" y="210" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#3b6d11" opacity="0.70">6 essential items included</text>
    </svg>
  );
}

export function CompleteKitSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="228" rx="120" ry="6" fill="#3a1a00" opacity="0.10"/>
      {/* Full suit (simplified) */}
      <ellipse cx="72" cy="64" rx="34" ry="36" fill="#A0A090"/>
      <ellipse cx="72" cy="64" rx="28" ry="30" fill="#C0C0B0"/>
      <rect x="48" y="92" width="48" height="70" rx="12" fill="#E8E8E0"/>
      <line x1="72" y1="96" x2="72" y2="158" stroke="#C0C0B8" strokeWidth="1.5"/>
      {/* Two-story hive */}
      <rect x="118" y="54" width="88" height="44" rx="6" fill="#A0632E"/>
      <rect x="118" y="100" width="88" height="54" rx="5" fill="#8B5020"/>
      <polygon points="108,58 216,58 198,34 126,34" fill="#C8C8C8"/>
      <rect x="108" y="56" width="108" height="6" rx="2" fill="#D8D8D8"/>
      <rect x="118" y="152" width="88" height="10" rx="3" fill="#6B4226"/>
      {/* Honey jar */}
      <ellipse cx="250" cy="92" rx="28" ry="10" fill="#E8C050"/>
      <rect x="222" y="92" width="56" height="68" rx="10" fill="#F5E8C0" opacity="0.70"/>
      <rect x="225" y="130" width="50" height="28" rx="4" fill="#E8A400" opacity="0.60"/>
      <ellipse cx="250" cy="92" rx="28" ry="10" fill="none" stroke="#C8A030" strokeWidth="1.5"/>
      {/* Tools strip */}
      <rect x="28" y="174" width="264" height="8" rx="3" fill="#C0C0C0" opacity="0.70"/>
      {[52,72,92,112,132,152,172,192,212,232,252].map((x) => (
        <rect key={x} x={x} y="170" width="6" height="14" rx="2" fill="#A0A0A0" opacity="0.60"/>
      ))}
      {/* Label */}
      <rect x="68" y="192" width="184" height="32" rx="8" fill="#faeeda"/>
      <text x="160" y="206" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#8B6000" fontWeight="700">Complete Beekeeper Kit</text>
      <text x="160" y="218" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#8B6000" opacity="0.70">8 items · Most popular</text>
    </svg>
  );
}

export function ProKitSVG() {
  return (
    <svg viewBox="0 0 320 240" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="160" cy="228" rx="120" ry="6" fill="#3a1a00" opacity="0.10"/>
      {/* Extractor (dominant) */}
      <ellipse cx="84" cy="88" rx="48" ry="14" fill="#D0D0D0"/>
      <rect x="36" y="88" width="96" height="110" rx="10" fill="#C0C0C0"/>
      <rect x="44" y="88" width="16" height="106" rx="4" fill="white" opacity="0.12"/>
      <rect x="36" y="158" width="96" height="5" fill="#A0A0A0" opacity="0.50"/>
      <ellipse cx="84" cy="198" rx="48" ry="10" fill="#B0B0B0"/>
      <rect x="76" y="62" width="16" height="28" rx="6" fill="#A0A0A0"/>
      {/* Honey super stack (2x) */}
      <rect x="156" y="68" width="80" height="36" rx="5" fill="#E8A400" opacity="0.25"/>
      <rect x="156" y="68" width="80" height="36" rx="5" fill="#A0632E" opacity="0.60"/>
      <rect x="156" y="106" width="80" height="42" rx="5" fill="#8B5020"/>
      <polygon points="148,72 244,72 228,50 164,50" fill="#C8C8C8"/>
      {/* Nuc box */}
      <rect x="158" y="160" width="78" height="50" rx="6" fill="#9A5828"/>
      <rect x="158" y="150" width="78" height="14" rx="4" fill="#7A4018"/>
      {/* Uncapping knife */}
      <rect x="150" y="188" width="140" height="8" rx="3" fill="#D0D0D0" transform="rotate(-15 220 192)"/>
      <rect x="270" y="164" width="24" height="18" rx="5" fill="#E8C050" transform="rotate(-15 282 173)"/>
      {/* Pro label */}
      <rect x="56" y="192" width="208" height="32" rx="8" fill="#eeedfe"/>
      <text x="160" y="207" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fill="#534ab7" fontWeight="700">Honey Harvest Pro Kit</text>
      <text x="160" y="219" textAnchor="middle" fontFamily="sans-serif" fontSize="7" fill="#534ab7" opacity="0.70">7 items · Complete setup</text>
    </svg>
  );
}

/* ── Matcher ────────────────────────────────────────────────── */
export function getBeeSVG(productId) {
  const map = {
    'hive-001':  LangstrothHiveSVG,
    'hive-002':  LogHiveSVG,
    'hive-003':  NucleusBoxSVG,
    'hive-004':  TuniFrameSVG,
    'gear-001':  FullSuitSVG,
    'gear-002':  FullSuitSVG,
    'gear-003':  VeilCapSVG,
    'gear-004':  LeatherGlovesSVG,
    'gear-005':  LeatherGlovesSVG,
    'tool-001':  BeeSmokeSVG,
    'tool-002':  HiveToolSVG,
    'tool-003':  QueenCageSVG,
    'tool-004':  QueenCageSVG,
    'tool-005':  QueenCageSVG,
    'tool-006':  HiveToolSVG,
    'tool-007':  HoneyExtractorSVG,
    'tool-008':  HiveToolSVG,
    'tool-009':  TuniFrameSVG,
    'tool-010':  QueenCageSVG,
    'honey-001': () => <HoneyJarSVG shade="light" />,
    'honey-002': () => <HoneyJarSVG shade="dark" />,
    'honey-003': BeeswaxBlockSVG,
    'honey-004': HoneycombFrameSVG,
    'kit-001':   BasicKitSVG,
    'kit-002':   CompleteKitSVG,
    'kit-003':   ProKitSVG,
  };
  return map[productId] ?? LangstrothHiveSVG;
}