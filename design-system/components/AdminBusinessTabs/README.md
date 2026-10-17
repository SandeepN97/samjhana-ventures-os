# AdminBusinessTabs

The row of pill tabs along the bottom of a business's header: Overview, Products, New sale, Orders, (Customers), Online orders and Website page.

Source: `samjhana-admin/src/components/BusinessTabs.jsx` (used by the furniture and beekeeping shops). It sits inside [AdminPageHeader](../AdminPageHeader/README.md) as `children`.

## Rules
- Pills are `min-h-[44px] rounded-full px-4 text-sm font-semibold`. The current tab is solid white with dark text; the others are `bg-white/20` with white text.
- The row scrolls sideways on a phone (`overflow-x-auto`, `min-w-max`); never wrap or shrink it.
- "Online orders" shows an amber `bg-amber-500` count of orders still waiting for staff. The count uses Nepali numerals in Nepali.
- "Website page" is only shown to managers and admins.
