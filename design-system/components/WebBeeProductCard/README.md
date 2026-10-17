# WebBeeProductCard

A product card on the beekeeping page: picture area, optional badge, name, Nepali name, short description, price and a small cart button.

Source: `samjhana-web/src/components/beekeeping/ProductCard.jsx`. Products, prices and pictures come from the shop catalogue (the shop API), never from the code.

## Rules
- White `rounded-2xl` card with a soft honey-brown shadow that deepens and lifts 4 px on hover; picture area 144 px (`h-36`) on a 27 % wash of the product's own colour.
- Name: Playfair Display 16 px (two lines at most). Nepali name 11 px gold. Description 11 px at 50 %. Price: Playfair 18 px with "Rs".
- The cart button is 32 × 32 px (`w-8 h-8`), smaller than 44 px (see [REVIEW.md](../../REVIEW.md)); it turns honey amber on hover and shows a tick for 1.5 s after adding.
- Out of stock: a white veil with "उपलब्ध छैन" ("not available") and a disabled button. Stock counts are never shown to visitors.
- The preview uses a honeycomb icon instead of a product picture; the sample text and prices are placeholders.
