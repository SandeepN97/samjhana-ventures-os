# AdminBottomNav

The bar fixed to the bottom of the screen with four places: Home, Records, Analytics and Settings.

Source: `samjhana-admin/src/components/BottomNav.jsx`. The home screen builds the same bar itself inside `QuickActionButtons.jsx`.

## Rules
- White bar with a `border-t border-gray-200`, `fixed bottom-0`, `z-30`. Pages that show it leave room with `pb-20`.
- Each item is at least 44 × 44 px: a 20 px icon over a 12 px label. The current place is `text-core-800` with `aria-current="page"`; the others are `text-gray-400`.
- The bar is always core slate, not the business colour, because it belongs to the whole app.
- Inactive grey is 2.5:1 on white, which is low for 12 px text (see [REVIEW.md](../../REVIEW.md)).
