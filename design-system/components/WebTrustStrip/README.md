# WebTrustStrip

The row of numbers under the home page's two big panels: "16+ years in Gulmi", "4 ways to serve you", "2008 established".

Source: `samjhana-web/src/components/home/TrustStrip.jsx`; style `hub-trust` in `src/index.css`. The items come from the Website page in the admin (`trust`). Nothing is shown when staff have emptied it.

## Rules
- Four equal columns (two under 800 px) with a hairline bottom border. Number: Georgia serif 27 px, dark; label 12 px at 50 % dark.
- Only approved facts go here (Gulmi, established 2008, 16+ years, the 4.9★ food rating; see [PRODUCT.md](../../../PRODUCT.md)). Never invent a testimonial, a customer count or a review score.
- Fewer than four items leave empty columns on the right; that is how it looks today.
