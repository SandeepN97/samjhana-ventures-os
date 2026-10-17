# WebPills

Rounded filter pills and the small uppercase label that opens a section.

Source: `samjhana-web/src/index.css` (`pill`, `pill-active`, `pill-inactive`, `section-label`).

| Class | Look |
|---|---|
| `pill` | `px-4 py-1.5 rounded-full text-sm font-medium border`, always used with one of the next two |
| `pill-active` | dark fill, white text: the chosen filter |
| `pill-inactive` | white fill, dark text, warm border; the border darkens on hover |
| `section-label` | `text-xs font-semibold uppercase tracking-[0.2em] text-gold`: the small gold word above a heading |

## Rules
- Pills are about 34 px tall. On a phone, give them more height (`min-h-[44px]`) when they are the main way to filter (see [REVIEW.md](../../REVIEW.md)).
- Exactly one pill is active at a time. The active pill is dark, never gold.
- `section-label` text is short (one to three words), in the current language.
