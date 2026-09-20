/* eslint-env node */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The dev server proxies API + WebSocket traffic to the Spring Boot backend. Playwright
// points this at its own disposable backend via VITE_PROXY_TARGET; day-to-day dev keeps 8080.
const apiTarget = process.env.VITE_PROXY_TARGET || 'http://localhost:8080';
const wsTarget = apiTarget.replace(/^http/, 'ws');

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    // Playwright end-to-end specs run under `npm run test:e2e`, not Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: wsTarget,
        ws: true,
      },
    },
  },
});
