# The original Claude concept: "Shringashwor Oil Store, Siringa"

Before this folder existed the design lived in Claude as a website mockup called **Shringashwor Oil Store — Siringa, Nepal** (a single-page React mockup, bilingual English and Nepali). This note keeps its look and ideas in the repository. **It is not what the apps look like today**, and nothing in the apps was changed to match it. The live apps are described in [../README.md](../README.md) and [../TOKENS.md](../TOKENS.md).

No code was copied from the mockup: its sample text includes figures (a 4.7 rating, an address and a map grid reference) that [PRODUCT.md](../../PRODUCT.md) does not approve as facts.

## Pages in the mockup
Home (hero, service grid), Fuel, Furniture (filters and cards), Restaurant (menu), Bike repairs, Contact (form and map), plus a shared header, product card and footer. A language switch (EN / नेपाली) changes every string.

## Its palette, fonts and shapes

| Idea | Concept | The live public site today |
|---|---|---|
| Page background | paper `#F5F0E8` | cream `#f7f3ed` (`bg-warm`) |
| Text | ink `#1A1208` | dark brown `#1e1206` (`text-dark`) |
| Main accent | rust `#C4520A` (buttons, active link, logo tile) | gold `#8B6914` (`text-gold`, `btn-gold`); buttons are near-black |
| Earth tones | brown `#8B6C47`, dark `#5C4530` and `#4A3C28`, muted `#9E8E7A` | `dark-muted` `#5a3a1a` and `gold-light` `#c4a45a` |
| Other accents | amber `#D4900A`, forest green `#2D4A2D` with `#4A7A4A` | honey amber `#e8a400` on beekeeping pages, soft green `#e9efdf` panels |
| Headings | Playfair Display | Playfair Display (same) |
| Body | Source Serif 4 | DM Sans |
| Labels | Space Mono, uppercase, wide letter spacing | DM Sans, uppercase, `tracking-[0.2em]` (`section-label`) |
| Nepali text | Tiro Devanagari Hindi | the device's Devanagari font |
| Shapes | 6 to 12 px radius, soft brown shadows | 4 px buttons, 12 to 24 px cards, soft brown shadows |
| Logo | rust square with a lightning bolt, "Shringashwor" and "Oil Store · Siringa" | gold four-square grid mark, name from the Website page |
| Page header | dark band, mono eyebrow, serif title, 3 px accent line | not used; the home page uses two big panels |
| Section colours | fuel rust, furniture amber, restaurant green, repairs grey | one gold system; the admin uses the business colours instead |

## What the two have in common
Playfair Display headings, a warm cream page with dark brown text, soft brown shadows, Nepali beside English, and a similar page set (fuel, furniture, restaurant, repairs, contact).

## How the live site differs
The live site uses gold, cream and DM Sans instead of rust, forest green and Source Serif / Space Mono / Tiro Devanagari. It is "Samjhana Multiproduct" (the name staff set on the Website page) with a home page of two panels (visit and shop), an online shop, a beekeeping section and an admin that edits its words and pictures.

## If the concept is revived
Treat it as a direction, not a spec. Decide the palette first (rust or gold), then change `tailwind.config.js` and `tokens.json` together, and use the guard in [../CONSISTENCY.md](../CONSISTENCY.md) to move screens over. The original file lives in the owner's Claude account.
