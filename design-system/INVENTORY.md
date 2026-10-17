# Inventory

Every piece of UI the two apps have, and whether this design system documents it yet. The first table is done; the second is the work that remains, so nothing is hidden.

## Documented

| Component | Area | Code | Guide and preview |
|---|---|---|---|
| AdminPageHeader (and `HeaderAction`) | Admin, navigation | `samjhana-admin/src/components/brand/PageHeader.jsx` | [components/AdminPageHeader/](components/AdminPageHeader/README.md) |
| AdminButton | Admin, actions | `components/brand/Button.jsx` | [components/AdminButton/](components/AdminButton/README.md) |
| AdminCard | Admin, containers | `components/brand/Card.jsx` | [components/AdminCard/](components/AdminCard/README.md) |
| AdminStatusBadge | Admin, status | `components/brand/StatusBadge.jsx` | [components/AdminStatusBadge/](components/AdminStatusBadge/README.md) |
| AdminWordmark | Admin, brand | `components/brand/Wordmark.jsx` | [components/AdminWordmark/](components/AdminWordmark/README.md) |
| AdminFormField | Admin, forms | labels and fields on every page; `.bill-input` in `src/index.css` | [components/AdminFormField/](components/AdminFormField/README.md) |
| AdminToast | Admin, feedback | `components/Toast.jsx` | [components/AdminToast/](components/AdminToast/README.md) |
| AdminConfirmDialog | Admin, feedback | `components/ConfirmDialog.jsx` | [components/AdminConfirmDialog/](components/AdminConfirmDialog/README.md) |
| AdminBusinessTabs | Admin, navigation | `components/BusinessTabs.jsx` | [components/AdminBusinessTabs/](components/AdminBusinessTabs/README.md) |
| AdminBottomNav | Admin, navigation | `components/BottomNav.jsx` | [components/AdminBottomNav/](components/AdminBottomNav/README.md) |
| AdminHomeScreen (tile, cash card, wide button) | Admin, screens | `components/QuickActionButtons.jsx` | [components/AdminHomeScreen/](components/AdminHomeScreen/README.md) |
| AdminLanguageToggle | Admin, navigation | `components/LanguageToggle.jsx` | [components/AdminLanguageToggle/](components/AdminLanguageToggle/README.md) |
| WebButtons (`btn-dark`, `btn-outline`, `btn-gold`) | Public, actions | `samjhana-web/src/index.css` | [components/WebButtons/](components/WebButtons/README.md) |
| WebPills (`pill`, `section-label`) | Public, actions | `src/index.css` | [components/WebPills/](components/WebPills/README.md) |
| WebNavbar | Public, navigation | `src/components/Navbar.jsx` | [components/WebNavbar/](components/WebNavbar/README.md) |
| WebFooter | Public, navigation | `src/components/Footer.jsx` | [components/WebFooter/](components/WebFooter/README.md) |
| WebHubLinkCard | Public, cards | `src/components/home/HubLanes.jsx` | [components/WebHubLinkCard/](components/WebHubLinkCard/README.md) |
| WebProductTile | Public, cards | `src/components/home/FeaturedTiles.jsx` | [components/WebProductTile/](components/WebProductTile/README.md) |
| WebStoryModal | Public, dialogs | `src/components/home/FeaturedTiles.jsx` | [components/WebStoryModal/](components/WebStoryModal/README.md) |
| WebTrustStrip | Public, sections | `src/components/home/TrustStrip.jsx` | [components/WebTrustStrip/](components/WebTrustStrip/README.md) |
| WebBadgePill | Public, status | `src/components/beekeeping/BadgePill.jsx` | [components/WebBadgePill/](components/WebBadgePill/README.md) |
| WebBeeProductCard | Public, cards | `src/components/beekeeping/ProductCard.jsx` | [components/WebBeeProductCard/](components/WebBeeProductCard/README.md) |

## Not documented yet

Add a folder to `components/` (guide + preview), and move the line up.

**Admin** (`samjhana-admin/src`)
- Form controls: `SearchableSelect`, `DatePicker` (Bikram Sambat), `NepalDateTime`, `ImageUploader`, `PhotoDialog`
- Business pieces: `ProductAdminCard`, `BusinessDrillSheet`, the EV cards (`ev/ChargerCard`, `ActiveSessionCard`, `ChargeTargetCard`, `ConnectorPicker`, `PaymentCard`, `RateBanner`, `VehiclePicker`), the loan dialogs (`loans/ReceiptDialog`, `RejectPaymentDialog`), `admin/TemporaryPasswordDialog`
- Screens: the Website editor (`pages/website`, redesigned on 2026-10-16), the analytics and daily-close pages, the login and change-password pages, tables and list rows

**Public site** (`samjhana-web/src`)
- Shop: `CartDrawer`, `ProductModal`, `CustomOrderModal`, `FurnitureSection`, `FurnitureIllustrations` (the drawn furniture has its own artwork colours), `ProductVisual`
- Home sections: `FuelEvSection`, `BikeRepairSection`, `RestaurantSection` (including the interactive bike and the meal tabs), `ContactSection` (map card)
- Beekeeping page: `BeeHero`, `BeeNav`, `BeeFooter`, `FeaturedHive`, `HiveGrid`, `HoneyProducts`, `StarterKits`, `ProtectiveGear`, `BeekeeperTools`, `BeekeeperEdu`, `SectionDivider`, `BeeImg`
- Helpers: `ui/Picture`, `ui/SmartLink`, `ErrorBoundary`
