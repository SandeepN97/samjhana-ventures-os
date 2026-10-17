# Fonts

No font files are bundled here, because the apps do not bundle any either.

| Where | Font | How it loads |
|---|---|---|
| Public website, headings | Playfair Display (400 to 700, with italics) | Google Fonts `<link>` in `samjhana-web/index.html` |
| Public website, text | DM Sans (300 to 600) | the same link |
| Admin, all text | the system font (Tailwind's default sans: `ui-sans-serif, system-ui, sans-serif`, plus emoji fonts) | nothing to load |
| Nepali (Devanagari), everywhere | the device's own Devanagari font | nothing to load |

The home page also uses Georgia (a system serif) directly for the trust numbers and a few captions (`font: 1.7rem/1.1 Georgia, serif` in `samjhana-web/src/index.css`).

Notes
- Previews in this folder link the same Google Fonts. Offline they fall back to Georgia and the system sans.
- Because Devanagari comes from the device, Nepali text can differ slightly between phones. Check changes to Nepali text on the phones staff really use.
- Playfair Display and DM Sans are open fonts (SIL Open Font License). If the public site ever needs to work offline or avoid Google, add the files here and list them in `tokens.json` under `type.fonts`.
