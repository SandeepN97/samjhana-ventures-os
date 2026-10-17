# AdminConfirmDialog

A question in a pop-up in the middle of the screen, used before anything that cannot be undone. It sits over a dimmed page wherever the page is scrolled to.

Source: `samjhana-admin/src/components/ConfirmDialog.jsx`.

## Rules
- Overlay: `fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4`. Panel: `w-full max-w-sm rounded-xl bg-white p-5 shadow-xl`. The preview shows the panel on the dim background without the fixed positioning.
- The message is a full sentence at `text-lg`. Two buttons side by side, each at least 44 px: the confirm button on the left (red when `danger`, which is the default) and "keep" on the right.
- Focus starts on "keep", so a stray Enter never deletes anything. Escape and a tap outside also cancel.
- `role="alertdialog"`, `aria-modal`, and the message is the accessible name.
- Use `danger={false}` (dark grey confirm button) for questions that are not destructive.
