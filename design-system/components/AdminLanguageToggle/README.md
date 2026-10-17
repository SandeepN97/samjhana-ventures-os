# AdminLanguageToggle

The pill that switches the admin between Nepali and English. It shows the language you would switch to: "ने" while the screen is in English, "EN" while it is in Nepali.

Source: `samjhana-admin/src/components/LanguageToggle.jsx`. It lives inside [AdminPageHeader](../AdminPageHeader/README.md) and on the home screen.

## Rules
- Nepali is the default language. The choice is kept in `localStorage` (`preferredLanguage`).
- Shape: `min-h-[44px] rounded-full px-3 py-2 bg-white/20 hover:bg-white/30 text-white font-medium text-sm`, a 16 px globe icon and a bold two-letter code. Pressed = `active:scale-95`.
- It is white-on-translucent, so it only works on a coloured bar. Do not put it on a white background.
- The accessible name is in the language you would switch to, so it is announced correctly.
