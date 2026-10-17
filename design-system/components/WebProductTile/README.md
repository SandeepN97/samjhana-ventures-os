# WebProductTile

The "From our shop" tiles on the home page: a soft green picture area with the product's picture (or a shopping-bag icon when there is none), the name and its Nepali name. Tapping a tile opens a [WebStoryModal](../WebStoryModal/README.md).

Source: `samjhana-web/src/components/home/FeaturedTiles.jsx`; styles `hub-product-grid`, `hub-product-card`, `hub-product-art` in `src/index.css`. Titles, pictures and stories come from the Website page in the admin (`featured`).

## Rules
- Four tiles per row, two under 800 px. The picture area is 210 px tall (150 px under 480 px), `#eef4e7`, 16 px radius.
- Pictures are cut-outs that sit on the green (`hub-isolated-art`, 88 % of the box, `object-fit: contain`); on hover they lift 4 px and grow 3 %.
- Name 15 px bold, Nepali name 13 px at 50 % dark.
- A tile is a button, not a link, because it opens a pop-up. Keep it a `<button>`.
- Without pictures staff still get a tidy tile (the bag icon); never leave an empty box.
