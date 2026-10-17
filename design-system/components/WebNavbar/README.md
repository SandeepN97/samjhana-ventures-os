# WebNavbar

The top bar of the public website: the grid mark and name on the left, four links, language label, call, WhatsApp and directions icons, the cart and a dark "Talk to us" button. Under 768 px wide the links fold into a menu button and the bar keeps only the cart and menu.

Source: `samjhana-web/src/components/Navbar.jsx`. The name and tagline come from the Website page in the admin (`identity`).

## Rules
- Fixed to the top (`fixed top-0 inset-x-0 z-50`), `bg-warm/95 backdrop-blur-sm`, a warm bottom border, 64 px high (60 px on a phone). The preview shows it in the page flow.
- The name is Playfair Display (`font-serif font-semibold`), the tagline DM Sans 11 px at 50 % dark.
- Links: `px-3.5 py-2 text-sm font-medium text-dark/70`, darker and on a `warm-soft` wash when hovered.
- On a phone the cart and menu buttons are 44 × 44 px. The cart count is a small gold circle.
- The "EN | नेपाली" label is only a label today. The public site is not switchable between languages yet.
- Hash links scroll smoothly to the section on the home page (`/#contact`).
