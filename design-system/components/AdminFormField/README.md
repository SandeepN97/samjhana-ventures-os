# AdminFormField

A label above a field. There is no shared form component yet; the same classes are written out on every screen, so this page is the reference.

Sources: labels and fields across `samjhana-admin/src/pages`; the large field `.bill-input` in `src/index.css`.

## Classes
| Part | Classes |
|---|---|
| Label (normal) | `block text-sm font-medium text-gray-700 mb-1` |
| Label (large screens for pump and charger entry) | `block text-lg font-medium text-gray-700 mb-2` |
| Field (normal) | `w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-core-500` |
| Field (large) | `w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-core-500` |
| Number entry | `.bill-input`: `min-h-[48px] w-full rounded-xl border-2 border-gray-300 bg-white px-3 text-gray-800 outline-none transition focus:border-ev-500` |
| Field error | `text-red-500 text-sm mt-1` under the field |
| Alert banner | `bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm` |

## Rules
- The field's focus border takes the business colour of the screen: `focus:border-furniture-500`, `focus:border-rental-500`, `focus:border-ev-500`; `focus:border-core-500` elsewhere.
- Fields are about 44 px tall or more. Text in fields is at least 16 px: a global rule in `index.css` (`font-size: max(16px, 1em)`) stops iPhones zooming in.
- Number inputs have no spinner arrows and do not change when scrolled or arrowed (also in `index.css`).
- Every field has a visible label from the translations; the error explains what to fix, in both languages.
- Do not rely on placeholder text instead of a label.
