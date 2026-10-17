# Consistency: use this, not that

How the two apps stay looking like one family as they grow. The numbers below were measured on `staging` (commit `1b8fe1a`, 2026-10-17). Nothing here asks anyone to restyle an existing screen.

## Admin: use this, not that

| Instead of | Use |
|---|---|
| a raw palette colour for a business (`bg-orange-600` for petrol, `bg-slate-800` for core) | the business name: `bg-petrol-600`, `bg-core-800` (see `src/brand/theme.js`) |
| emerald, violet, rose, purple, indigo, pink, cyan, sky, lime, fuchsia, teal, stone, zinc or neutral | a business colour or a status colour from [TOKENS.md](TOKENS.md) |
| a hex colour in a class or a style | a named colour |
| a hand-made white box | [AdminCard](components/AdminCard/README.md): `rounded-xl bg-white p-4 shadow-sm` |
| a hand-made button | [AdminButton](components/AdminButton/README.md) or exactly its classes |
| a hand-made status pill | [AdminStatusBadge](components/AdminStatusBadge/README.md) and its five tones |
| a control under 44 px | `min-h-[44px]` (and `min-w-[44px]` for icons) |
| text typed into a screen | the translations, English and Nepali |
| number formatting by hand | `useLocaleFormat` (lakh grouping, Nepali numerals) |

## Public site: use this, not that

| Instead of | Use |
|---|---|
| `#8B6914`, `#c4a45a`, `#f5edd8` | `text-gold`, `text-gold-light`, `bg-gold-pale` |
| `#1e1206`, `#2d1a0a`, `#5a3a1a` | `text-dark`, `bg-dark-soft`, `text-dark-muted` |
| `#f7f3ed`, `#efe9e0`, `#e0d5c5` | `bg-warm`, `bg-warm-soft`, `border-warm-border` |
| a new near-black or a new cream | the three families above |
| a new honey or green shade | the `web-bee-*` and `web-hub-*` colours in [TOKENS.md](TOKENS.md) |
| a new button style | [WebButtons](components/WebButtons/README.md): `btn-dark`, `btn-outline`, `btn-gold` |

## Where things stand today

| Measure | Admin | Public site |
|---|---|---|
| Hard-coded hex values | 55 (19 different) | 736 (86 different) |
| Of those, equal to a colour that already has a token | not applicable | 388 |
| Uses of off-palette colour classes | 28 (emerald 23, violet 3, rose 1, purple 1) | not applicable |
| Screens using the shared page header | 29 of 34 page files | not applicable |
| Shared `Button`, `Card`, `StatusBadge` in screens | 2, 2 and 0 uses, against about 268 hand-written buttons, about 104 hand-written cards and about 8 hand-made pills | the `btn-*` classes 33 times against 73 hand-written buttons |

The hand-written pieces mostly look alike because they were copied. The risk is not that they look wrong today; it is that a change to the shared piece will not reach them.

## The guard

`samjhana-admin/src/__tests__/designDrift.test.js` measures six numbers (the ones in the table above that have a count) and compares them with [drift-baseline.json](drift-baseline.json). A number may stay the same or go down. It may not go up, so new work uses the named colours and the existing screens are left exactly as they are.

When the guard fails:
1. **Use a named colour or token** instead of the new hex or off-palette class. That is almost always the right fix.
2. If the higher number is deliberate, raise it in `drift-baseline.json` **in the same pull request** and say why in the description. The change is then visible to the reviewer.
3. When you remove some, **lower the number** so the saving cannot be spent again.

Print today's numbers: `cd samjhana-admin && node src/__tests__/designSystemMetrics.js`.

What the guard does not do: it does not count buttons or cards, does not check contrast (see [REVIEW.md](REVIEW.md)), and does not restyle anything.

## Adopting the shared pieces gradually

When you touch a screen for another reason you may swap its hand-written buttons or cards for the shared ones, as long as the classes match so the look does not change. Do it in its own commit, so a reviewer can see that nothing moved.
