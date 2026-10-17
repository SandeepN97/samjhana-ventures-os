# WebButtons

The three button styles of the public website, defined once in `samjhana-web/src/index.css`: `btn-dark`, `btn-outline` and `btn-gold`.

| Class | Look | Use |
|---|---|---|
| `btn-dark` | near-black fill, white text, fades to 80 % on hover | the main action: "Talk to us", "See honey" |
| `btn-outline` | 1 px dark outline, fills dark on hover | a second choice beside the main action |
| `btn-gold` | brand gold fill, white text | a warm highlight such as an order button |

All three: `inline-flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded`. Add `w-full justify-center` on a phone. A small arrow icon (`ArrowUpRight`, 16 px) after the label marks a link that goes somewhere else.

## Rules
- One main (`btn-dark`) action per section.
- `btn-dark` fills with `#1a1a0e`, a near-black that is close to but not the same as the `dark` token (`#1e1206`). Keep it as is; do not add a third near-black.
- The buttons are about 40 px tall. The contact section raises them to 46 px (`min-height: 46px`) and the phone menu and cart buttons are 44 px. Where a button matters on a phone, add `min-h-[44px]` (see [REVIEW.md](../../REVIEW.md)).
- Labels are written in the admin's Website page, not in the code.
