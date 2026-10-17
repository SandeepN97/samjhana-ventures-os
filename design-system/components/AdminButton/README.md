# AdminButton

The standard admin button: bold, `rounded-xl` and never shorter than 44 px. `primary` takes the colour of the business through `unit`; `secondary` and `danger` look the same everywhere.

Source: `samjhana-admin/src/components/brand/Button.jsx`.

## Classes
Every button: `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-6 py-3 font-bold transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50`.

| Variant | Adds |
|---|---|
| primary | the business's `button` classes and `text-white`, for example petrol: `bg-petrol-600 hover:bg-petrol-700 focus-visible:ring-petrol-400` (core: `bg-core-800 hover:bg-core-700 focus-visible:ring-core-500`) |
| secondary | `bg-white text-gray-800 border-2 border-gray-200 hover:bg-gray-50 focus-visible:ring-gray-400` |
| danger | `bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400` |

## Rules
- Never below 44 px: keep `min-h-[44px]`.
- One primary button per group of actions.
- Danger is for deleting or rejecting, and asks first with [AdminConfirmDialog](../AdminConfirmDialog/README.md).
- Disabled is 50 % opacity with `cursor-not-allowed`; disable while saving so a double tap cannot send twice.
- Most screens hand-write their buttons with these same classes. When you cannot use the component, copy the classes above. Do not invent new button styles.
