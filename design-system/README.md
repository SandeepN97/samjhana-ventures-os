# Shringashwor Design System

How Samjhana Ventures looks and speaks, written down from the code as it is today. It describes the two apps; it changes nothing in them. It is laid out like Claude's Design System (README, tokens, components with live previews, assets), so it can be loaded into Claude later.

## Start here

| Open | For |
|---|---|
| **README.md** (this file) | the brand, the voice and the rules every screen follows |
| [TOKENS.md](TOKENS.md) and [tokens.json](tokens.json) | every colour, font, size, radius, shadow and animation, with exact values |
| [components/](components/) | one folder per piece: a guide (`README.md`) and a live preview (`preview.html`) |
| [index.html](index.html) | everything on one page; open it in a browser |
| [INVENTORY.md](INVENTORY.md) | what is documented and what is not yet |
| [CONSISTENCY.md](CONSISTENCY.md) | "use this, not that", and the guard that stops new drift |
| [REVIEW.md](REVIEW.md) | accessibility findings measured on today's screens |
| [assets/](assets/Logos/README.md), [fonts/](fonts/README.md), [reference/](reference/shringashwor-concept.md) | logos and icons, fonts, the original Claude concept |

**Before you build or change any screen** (people and agents alike): read this file, open the guide of the piece you need, and copy its classes. Do not invent a colour, a button or a card.

## Two surfaces, two looks

| | Admin (`samjhana-admin`) | Public website (`samjhana-web`) |
|---|---|---|
| Who | staff in Nepal, managers and family overseas; private (Tailscale) | local customers in Gulmi |
| Language | Nepali first (the default), English second; every string has both | English today; Nepali names sit beside English names; the words come from the admin's Website page |
| Feel | big, plain and touch-first: "Dad-proof". One accent colour per business, white cards on a grey page | warm and editorial: cream page, dark brown text, gold accents, serif headings |
| Colour | business accents + status colours + greys (Tailwind palettes) | `gold`, `dark`, `warm` + a few honey and green shades |
| Type | the device's system font | Playfair Display (headings) and DM Sans (text) from Google Fonts |
| Words and pictures | translations in `src/i18n/index.js` | the Website page (`/api/public/site`), pictures in the media store, products from the shop API; the code holds no text, prices or pictures |

## Brand

- **Names.** "Samjhana Ventures" and "Maurighar Ventures" are the same brand. Do not split them or pick one without a naming decision ([PRODUCT.md](../PRODUCT.md)). The public site shows whatever name staff set on the Website page. The petrol pump is "Shringeshwor" in the code. This design system is called "Shringashwor" after the owner's name for it.
- **Facts you may use.** Gulmi, Nepal. Established 2008. 16+ years. The 4.9★ food rating (a fixed claim, not a live feed). Nothing else: never invent a testimonial, a customer count or a review score.
- **Six businesses.** Petrol pump, EV charging, furniture shop, beekeeping shop, house rentals, bank loans. The public site shows fuel and EV, bike repair, restaurant, furniture and beekeeping; rentals and loans are internal only.
- **Family-run, rooted in Nepal.** Warm, local, trustworthy; not corporate and not flashy.

## Content fundamentals

- **Language.** Admin screens start in Nepali (`lng` defaults to `ne`; the choice is kept in `localStorage` as `preferredLanguage`; English is the fallback). Every display string lives in `samjhana-admin/src/i18n/index.js` with both `en` and `ne`. Never type display text into a screen.
- **Voice.** Short, plain and kind. The home screen greets the owner and father as "बुवा" ("Dad"): "स्वागत छ, बुवा!" / "Welcome!". Success is said briefly ("Sale saved!"); problems say what failed without blame ("Could not load orders") and the next step is clear.
- **Casing.** Screen and button names tend to be Title Case ("Go Back", "Save Entry", "End of Day"); messages are sentence case ("No orders found").
- **Numbers and dates.**
  - In Nepali, digits are Devanagari: ० १ २ ३ ४ ५ ६ ७ ८ ९ (`toNepaliNumerals`).
  - Large numbers group as lakhs and crores: `1,00,000`, `1,00,00,000`, never `100,000`.
  - Money is `रु 1,25,000` (`formatCurrency`); in Nepali `रु १,२५,०००`.
  - Dates are Bikram Sambat on screen ("३ चैत्र २०८२" / "3 Chaitra 2082"); business days follow Nepal time (`Asia/Kathmandu`).
  - Use `useLocaleFormat` in the admin; do not format numbers by hand.
- **The public site's words** are written by staff in the admin. Previews and guides here use sample text only.

## Visual foundations

- **Colour.** Admin: the business accent tells staff where they are; status colours (green, amber, red, blue, grey) always mean the same thing; greys do the rest. Public: cream background, dark brown text, gold for labels and links. See [TOKENS.md](TOKENS.md).
- **Type.** Admin text is the system font in Tailwind's scale (12 to 36 px). Public headings use Playfair Display, the rest DM Sans. Nepali text uses each device's Devanagari font.
- **Shape.** Admin: cards and buttons 12 px, fields 8 px, home tiles 16 px, pills fully round. Public: buttons 4 px, cards 12 to 24 px.
- **Depth.** Admin uses Tailwind's shadows (`sm` on cards, `lg` on headers and tiles, `xl` on dialogs and toasts). Public shadows are soft and brown-tinted.
- **Touch.** Every admin control is at least 44 px tall and wide. Fields are at least 16 px text so iPhones do not zoom. Number fields have no spinner arrows.
- **Motion.** Short and gentle: a 0.2 s slide-up in the admin; 180 to 700 ms rises and lifts on the public site, with one easing (`cubic-bezier(.16,1,.3,1)`). Every animation has a `prefers-reduced-motion` override; keep it that way.
- **Pictures.** Uploaded in the admin (JPEG, PNG or WebP, up to 3 MB) and shown through `/api/public/media/{id}`. Product cut-outs sit on a soft green; photos get a light desaturation. Private pictures (loan receipts, EV plate photos) are never shown on the public site.
- **Icons.** Lucide line icons (`lucide-react`), 2 px stroke, in the sizes of the guides. See [assets/Icons](assets/Icons/README.md).
- **Logo.** Admin: a building icon and the name. Public: the four-square grid mark. See [assets/Logos](assets/Logos/README.md).

## Rules every screen follows

From [CLAUDE.md](../CLAUDE.md) and [PRODUCT.md](../PRODUCT.md) (the owner's rules; this system only points at them):

1. **Touch targets are at least 44 px** on every interactive admin element.
2. **Both languages, always.** Every admin string has English and Nepali; use `useTranslation()`; never hard-code display text. Nepal-facing numbers use lakh/crore grouping and Nepali numerals in Nepali.
3. **The public site never shows** profit, cost prices, weighted average cost, stock levels, staff data or internal IDs.
4. **Records are never hard-deleted**: removing something sets `deletedAt`. Screens may still say "Delete".
5. **Business colours come from the names** (`bg-petrol-600`, `text-core-800`), never from a raw palette colour, and never a new colour: see [CONSISTENCY.md](CONSISTENCY.md).

## Keeping it true

- The code is the source. When you change a colour, a font or a business accent: update `tokens.json`, run `node design-system/build.mjs` (rebuilds `TOKENS.md`, `index.html` and the previews' CSS), and update the component guide if the look changed.
- `samjhana-admin/src/__tests__/designSystem.test.js` fails when the code and `tokens.json` disagree, when `TOKENS.md` or `index.html` are stale, or when a component lacks a guide or preview.
- `samjhana-admin/src/__tests__/designDrift.test.js` fails when a change adds off-palette colours or new hard-coded hex values. [CONSISTENCY.md](CONSISTENCY.md) explains what to do instead.
- A new piece gets a folder in `components/` (guide + preview) and a line in `INVENTORY.md`.
- The previews contain sample text and prices only; they never carry real customer data or unapproved claims.
