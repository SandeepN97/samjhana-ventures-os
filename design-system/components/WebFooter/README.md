# WebFooter

The dark footer of the public website: name and short blurb, three link columns (Shop, Visit, Contact) and a bottom line with the copyright and a closing note.

Source: `samjhana-web/src/components/Footer.jsx`. Name, tagline, blurb and closing note come from the Website page in the admin (`identity`); phone, WhatsApp and directions links come from `contact`.

## Rules
- `bg-dark text-white`; content width `max-w-7xl`; a four-column grid from 1024 px, two from 640 px, one below.
- Column headings: `text-xs font-semibold uppercase tracking-widest text-gold`. Links: `text-sm text-white/40`, white on hover.
- The brand name is `font-serif text-xl`. The closing note is `font-serif italic text-gold/60`.
- Muted white text (30 to 40 %) is low contrast on the dark background; keep it for secondary text only (see [REVIEW.md](../../REVIEW.md)).
- The year in the copyright is computed. Do not type it in.
