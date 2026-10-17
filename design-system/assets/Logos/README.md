# Logos

The marks the apps actually use. The admin has no image logo; the public site has one small vector mark.

| Mark | Where | File |
|---|---|---|
| **Grid mark**: four rounded squares in brand gold (`#8B6914`), the top-left and bottom-right solid, the other two at 50 % | the public website's top bar and its favicon | [grid-mark.svg](grid-mark.svg), a copy of `samjhana-web/public/favicon.svg`; the top bar draws the same shapes inline in `Navbar.jsx` |
| **Admin name mark**: a Lucide `Building2` icon and the name "Samjhana Ventures" / "सम्झना भेन्चर्स" | the admin login and home screen | `samjhana-admin/src/components/brand/Wordmark.jsx`, see [AdminWordmark](../../components/AdminWordmark/README.md) |

## As used today
- The grid mark is 28 px, gold, beside the name in the top bar on the cream background. The favicon uses the same shapes.
- The admin mark is white on the dark core bar (login and home) and takes its colour from its parent.
- Do not redraw either mark: copy the file or use the component.
- No other logo or lock-up is documented. If one is made, add it here.
