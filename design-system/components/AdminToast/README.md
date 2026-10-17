# AdminToast

A short message that appears near the bottom of the screen after something happened, then goes away by itself: success (green), error (red) or info (blue).

Source: `samjhana-admin/src/components/Toast.jsx` (`ToastContainer`, shown 96 px above the bottom edge so it clears the bottom navigation).

## Rules
- Shape: white `rounded-xl shadow-xl` card with a 4 px coloured left edge, a round icon, one line of text and a thin progress bar that counts down (2 s by default; errors may use longer).
- It slides up in 0.2 s (`animate-slide-up`).
- Say what happened in one short sentence, in the current language.
- The close button is 24 × 24 px, smaller than the 44 px rule. It is a known gap (see [REVIEW.md](../../REVIEW.md)); the toast also closes by itself.
- Use a toast for results, an alert banner inside the form for problems the person must fix, and [AdminConfirmDialog](../AdminConfirmDialog/README.md) for questions.
