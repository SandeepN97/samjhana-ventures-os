# AdminPageHeader

The coloured bar at the top of every admin screen: a back button, an optional icon, the title, an optional subtitle, optional actions and the language toggle. The colour tells staff which business they are in.

Source: `samjhana-admin/src/components/brand/PageHeader.jsx`, colours from `src/brand/theme.js`. It is the most consistently used piece of the admin.

## Use it when
On every full screen. Pass `unit` (`core`, `petrol`, `ev`, `furniture`, `beekeeping`, `rental`, `loans`) and the bar takes that business's colour. Tabs or filters go in `children`: they sit inside the bar under the title.

## Rules
- The back button is 44 × 44 px (`h-11 w-11`) with an `aria-label` from `common.goBack`. Keep both.
- Text is white on the business colour. Title: 20 px bold (large text). Contrast per business is in [TOKENS.md](../../TOKENS.md).
- The bar carries `data-unit` so tests and styles can find it.
- `HeaderAction` is an icon over a 10 px label and at least 44 × 44 px.
- The language toggle shows unless `showLanguageToggle={false}`.
- Classes: `{header} px-4 py-4 text-white shadow-lg`, where `{header}` is `bg-core-800` for core and `bg-<unit>-600` for a business.
