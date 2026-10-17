# WebStoryModal

The short "story" pop-up opened from a [WebProductTile](../WebProductTile/README.md): a small label, a heading, a paragraph and one dark button, on a honey-yellow card.

Source: `samjhana-web/src/components/home/FeaturedTiles.jsx`; styles `story-modal-backdrop`, `story-modal` in `src/index.css`.

## Rules
- Backdrop: `rgba(30,18,6,.48)` with a 5 px blur, fixed over the page. Card: `#f4e9ae`, 24 px radius, up to 520 px wide, big soft shadow. It enters in 360 ms.
- A 44 × 44 px round close button sits top right (`story-modal-close`). A tap on the backdrop, or on the action, also closes it.
- `role="dialog"`, `aria-modal="true"` and the heading is the accessible name.
- Heading uses the serif face, fluid from 32 to 48 px. Keep the story to a few sentences; the text is edited in the admin.
- Animations stop when the visitor prefers reduced motion.
