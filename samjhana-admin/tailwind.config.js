import colors from 'tailwindcss/colors';

/**
 * Samjhana admin brand. Pages use these names, never raw palette colours, so each
 * business keeps one accent everywhere. Change a colour here and every screen follows.
 * `core` is Samjhana itself (login, dashboard, shared screens); the rest are the
 * business units. See src/brand/theme.js for how pages consume them.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        core: colors.slate,
        petrol: colors.orange,
        ev: colors.green,
        furniture: colors.amber,
        beekeeping: colors.yellow,
        rental: colors.blue,
        loans: colors.red,
      },
      keyframes: {
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};
