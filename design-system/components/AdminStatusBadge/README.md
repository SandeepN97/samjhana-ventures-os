# AdminStatusBadge

A small rounded pill that says what state something is in. The same five colours mean the same thing on every screen, so "paid", "pending" and "failed" always look alike.

Source: `samjhana-admin/src/components/brand/StatusBadge.jsx`, colours in `STATUS_STYLES` of `src/brand/theme.js`.

| Tone | Classes | Means |
|---|---|---|
| success | `bg-green-100 text-green-800` | paid, done, approved |
| warning | `bg-amber-100 text-amber-800` | waiting, needs a look |
| danger | `bg-red-100 text-red-800` | failed, rejected, overdue |
| info | `bg-blue-100 text-blue-800` | information |
| neutral | `bg-gray-100 text-gray-700` | no state |

## Rules
- Shape: `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold`.
- Always put the state in words as well as colour. Never rely on colour alone.
- A badge is not a button. It is not tapped.
- Some screens still hand-make these pills; use the five tones above, not new colours.
