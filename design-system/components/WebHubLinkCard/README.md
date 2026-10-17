# WebHubLinkCard

A small white card with an icon, a name and its Nepali name, used in the two big panels at the top of the home page: "Visit" (services) and "Shop".

Source: `samjhana-web/src/components/home/HubLanes.jsx`; styles `hub-link-card`, `hub-link-grid` in `src/index.css`. Names, Nepali names, icons and links come from the Website page in the admin (`hub`).

## Rules
- Two columns (`hub-link-grid`), one column under 480 px. Card: 58 px minimum height, 12 px radius, `rgba(255,255,255,.58)` fill with a hairline border; on hover or focus it turns almost white and rises 2 px.
- Icon: Lucide line icon, 18 px, class `hub-icon` (it tilts 8° and grows on hover). The "Visit" cards end with a faint `ArrowUpRight`. The "Shop" cards put the icon or picture in a 34 px `hub-card-image` box instead.
- Name 13 px (.82rem) bold, Nepali name 11.5 px (.72rem) at 48 % dark.
- The panels behind are `hub-visit` (cream `#f7f3ed`) and `hub-shop` (soft green `#e9efdf`).
- Hover animation stops when the visitor prefers reduced motion.
