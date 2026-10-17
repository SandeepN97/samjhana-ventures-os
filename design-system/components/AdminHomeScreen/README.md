# AdminHomeScreen

The "Dad-proof" home screen: the name mark, today's cash, one big tile per business, a few wide buttons and the bottom bar. Built for one thumb on a shared phone.

Source: `samjhana-admin/src/components/QuickActionButtons.jsx` (`DashboardPage` adds the language toggle and sign-out).

## Parts
| Part | Classes |
|---|---|
| Page | `min-h-screen bg-gray-100 pb-20` |
| Header | `bg-core-800 text-white px-4 pt-14 pb-6 shadow-lg`, [AdminWordmark](../AdminWordmark/README.md) centred, welcome line `text-core-300` |
| Cash card | `mx-4 mt-4 bg-white rounded-2xl shadow-md p-4`; label `text-gray-500 text-sm`; amount `text-3xl font-bold text-green-600` (a dash while loading, never an invented number) |
| Tile grid | `grid grid-cols-2 gap-4 p-4 mt-4`; an odd last tile is `col-span-2` |
| Tile | `{tile} h-32 rounded-2xl shadow-lg text-white`: a 48 px icon over an 18 px bold label; pressed = `active:scale-95`. `{tile}` is `bg-<unit>-500 hover:bg-<unit>-600` (core: `bg-core-700`) |
| Waiting badge | `bg-yellow-400 text-gray-900 text-sm font-bold` in the tile's top-right corner (loan payments waiting for an admin) |
| Wide buttons | `w-full flex items-center justify-between bg-white rounded-xl px-4 py-4 shadow-md`, 24 px grey icon, `text-lg` label, red count badge |

## Rules
- Staff do not see the Bank loans tile; managers and admins see more wide buttons (website, analytics, staff).
- The tile order and colours are fixed: petrol, EV, furniture, beekeeping, rentals, loans.
- Labels are translations; amounts use `useLocaleFormat` (lakh grouping, Nepali numerals).
