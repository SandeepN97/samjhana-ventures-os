/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gold:  { DEFAULT: '#8B6914', light: '#c4a45a', pale: '#f5edd8' },
        dark:  { DEFAULT: '#1e1206', soft: '#2d1a0a', muted: '#5a3a1a' },
        warm:  { DEFAULT: '#f7f3ed', soft: '#efe9e0', border: '#e0d5c5' },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:  ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'warm-gradient': 'linear-gradient(135deg, #f7f3ed 0%, #ede5d8 100%)',
      },
    },
  },
  plugins: [],
};