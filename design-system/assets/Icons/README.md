# Icons

Both apps use [Lucide](https://lucide.dev) line icons through the `lucide-react` package (version 0.303 in both `package.json` files). Nothing is drawn by hand except the public site's grid mark.

## Rules
- Default look: 24 × 24 viewBox, 2 px stroke, round caps and joins, `currentColor`, so an icon takes the text colour of its parent.
- Sizes in use: 14 to 20 px beside text (`h-4 w-4` to `h-5 w-5`), 24 px for the back arrow, 32 px for the header icon, 48 px on home tiles; the public site passes `size={18}` to `size={34}`.
- Icons beside text are decoration: add `aria-hidden="true"`. An icon-only button gets an `aria-label`.
- The business icons never change: petrol `Fuel`, EV `Zap`, furniture `Sofa`, beekeeping `Hexagon` (a honeycomb, because Lucide has no bee), rentals `Home`, loans `Landmark`, navigation `Home`, `FileText`, `BarChart3`, `Settings`.
- Use Lucide for new icons so the set stays one family.
