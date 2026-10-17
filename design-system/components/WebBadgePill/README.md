# WebBadgePill

A tiny uppercase badge on a beekeeping product: "Raw", "New", "Best seller" and so on.

Source: `samjhana-web/src/components/beekeeping/BadgePill.jsx` (colours: `amber`, `green`, `new`, `best`, `hot`, `raw`, `muted`).

## Rules
- Shape: `inline-block text-[9px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full border font-sans`.
- The colours use the honey palette (see [TOKENS.md](../../TOKENS.md), "Public site: colours in the code"); an unknown colour falls back to amber.
- 9 px text is very small. Use it for decoration around a name, never for the only copy of important information (see [REVIEW.md](../../REVIEW.md)).
- A badge is not tapped.
