# AdminCard

The standard white content card: `rounded-xl bg-white p-4 shadow-sm`. It holds one idea: a summary, a form section, a list row.

Source: `samjhana-admin/src/components/brand/Card.jsx` (`as` lets it be any element, such as `section`).

## Rules
- White card on the grey page (`bg-gray-100`), 16 px padding, the smallest shadow. Do not nest cards.
- The home screen's cash card is the one exception: `rounded-2xl shadow-md p-4` (see [AdminHomeScreen](../AdminHomeScreen/README.md)).
- Money uses lakh grouping and Nepali numerals in the Nepali language (see [README](../../README.md), "Numbers and dates").
- Most screens hand-write this card with the same classes; copy them rather than inventing a new surface.
