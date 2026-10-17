# Review: accessibility findings on today's screens

A review of the design as it is, measured on `staging` (commit `1b8fe1a`, 2026-10-17). **Nothing was changed**: the owner asked that the apps keep the look they have. Each finding says what a later fix could be; none is applied.

How it was measured: contrast is computed from the exact colours in [TOKENS.md](TOKENS.md) (WCAG 2: 4.5 : 1 for normal text, 3 : 1 for large text, meaning 24 px, or 18.7 px bold, and for icons and borders). Sizes were measured in a headless browser at 420 px wide on the previews in [components/](components/). Translucent colours were blended over the colour behind them.

## Admin

| # | Severity | Where | Finding | Measured | Fix for later |
|---|---|---|---|---|---|
| A1 | High | Home tiles ([AdminHomeScreen](components/AdminHomeScreen/README.md)) | White labels on the 500 shade are hard to read in daylight | white on: petrol 2.8, EV 2.3, furniture 2.1, beekeeping 1.9, rentals 3.7, loans 3.8 (core 10.4) | use the 700 shade for the tile, or dark text on the amber and yellow tiles |
| A2 | High | Beekeeping header and button | White on yellow-600 | 2.9 : 1 (the title is large bold text, so 3 : 1 is needed) | `yellow-700` gives 4.9 : 1 |
| A3 | Medium | Header subtitles (`text-<unit>-100` on `<unit>-600`) | Small text, too faint | petrol 3.1, EV 3.0, furniture 2.9, beekeeping 2.7, rentals 4.2, loans 4.0 (4.5 needed) | white subtitle |
| A4 | Medium | Business tabs and the language toggle (white on `bg-white/20`) | Small semibold text on a pale wash | petrol 2.8, EV 2.6, furniture 2.5, beekeeping 2.3, rentals 3.6, loans 3.8 (core 7.7) | a darker wash, or solid text on a 700 shade |
| A5 | Medium | Inactive bottom-nav items and helper text (`text-gray-400`) | 12 px grey on white | 2.5 : 1 on white, 2.3 : 1 on grey-100 (about 140 uses). `text-gray-500` is 4.8 : 1 | `text-gray-500` as the lightest text grey |
| A6 | Medium | Count badges | White on amber-500 (online orders in the tabs) and on red-500 (waiting loans) | amber 2.1, red 3.8 (4.5 needed at 14 px bold) | amber-700 (5.0), red-600 (4.8) |
| A7 | Medium | [AdminToast](components/AdminToast/README.md) close button | Smaller than the 44 px rule | 24 × 24 px | a 44 px hit area around the 24 px icon |
| A8 | Low | Native selects | A little under 44 px | 41 px high | `min-h-[44px]` |
| A9 | Low | Page language | `<html lang="ne">` is fixed; nothing updates it when staff switch to English, so a screen reader reads English text as Nepali | static in `samjhana-admin/index.html` | set `document.documentElement.lang` when the language changes |
| A10 | Info | Devanagari | No Devanagari web font is loaded; the device's own font is used, so Nepali text can look different from phone to phone | not applicable | none needed; check on the phones the staff really use |

Passing, for the record: status badges (6.4 to 9.4 : 1), dialog and form text (10 to 15 : 1), the core slate header and its tabs (14.6 and 7.7), the danger button (4.8), the home cash figure (green-600, 3.3 : 1, passes as 30 px bold), the page header back button (44 px), every shared button, tab and toggle (44 px or more), and reduced-motion handling.

## Public site

| # | Severity | Where | Finding | Measured | Fix for later |
|---|---|---|---|---|---|
| W1 | Medium | [WebFooter](components/WebFooter/README.md) | Muted white text on dark | links (`white/40`) 3.8, copyright and tagline (`white/30`) 2.7, gold section labels 3.6, closing note (`gold/60`) 2.1 | `white/70` (9.3 : 1) for links, `gold-light` for labels |
| W2 | Medium | Small captions | Dark at 50 % on cream | navbar tagline 3.4, "EN \| नेपाली" 4.0, home captions and trust labels 3.2 to 3.4 | 62 % dark or stronger gives 5.0 : 1 |
| W3 | Medium | Beekeeping cards ([WebBeeProductCard](components/WebBeeProductCard/README.md), [WebBadgePill](components/WebBadgePill/README.md)) | Faint description and stars count; white on amber for the "Best" badge | description 3.5, stars count 2.6, "Best" badge 2.2, gold on pale honey 4.4 (9 px text) | darker text, dark text on amber |
| W4 | Medium | Touch targets | Under 44 px on a phone | buttons 40 (outline 42), navbar links 36, icon links 33, cart 36, footer links 16 high, honey cart button 32, pills about 34 | `min-h-[44px]` where a phone is the main device |
| W5 | Low | Very small type | 9 to 11 px in badges, taglines and captions | not applicable | keep for decoration only; never the only place a fact appears |
| W6 | Low | Language label | "EN \| नेपाली" looks like a switch but is only text | not applicable | make it a real switch or remove it |

Passing, for the record: dark text on cream (16.6 : 1), gold on cream (4.6), white on the gold and dark buttons (5.1 and 17.5), nav links (`dark/70`, 6.5), the story pop-up text (5.8), and reduced-motion handling.

## Using this review

These are findings, not tasks. A fix changes how the apps look, so it is the owner's call; raise one as its own pull request and use the sizes and ratios above as the test.
