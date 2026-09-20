/* eslint-env node */
import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * End-to-end tests for the EV charging screens.
 *
 * Playwright boots its OWN disposable stack so it never touches a developer's real data:
 *   - Spring Boot on :8181 (dev profile, in-memory H2 → DataSeeder creates admin/staff test users)
 *   - the Vite dev server on :5183, proxying /api, /ws to that backend
 * A simulated OCPP 2.0.1 charger (e2e/helpers/simulatedCharger.js) plays the physical hardware.
 *
 * Needs JDK 21 + Maven on the PATH.   Run:  npm run test:e2e
 */
const BACKEND_PORT = 8181;
const FRONTEND_PORT = 5183;
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..');

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.js',
  globalSetup: './e2e/global-setup.js',
  // One backend, one simulated charger: tests must not run in parallel.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // The app is mobile-first, so the main project is a phone.
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 5'] } }],
  webServer: [
    {
      command: 'mvn -q -Pdev spring-boot:run -Dspring-boot.run.profiles=dev',
      cwd: repoRoot,
      url: `http://localhost:${BACKEND_PORT}/api/public/ev/rates`,
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        ...process.env,
        PORT: String(BACKEND_PORT),
        SPRING_DATASOURCE_URL: 'jdbc:h2:mem:e2e;DB_CLOSE_DELAY=-1',
        SPRING_DATASOURCE_PASSWORD: '',
        SAMJHANA_FUEL_PRICE_SCRAPER_ENABLED: 'false',
        // The browser's Origin is the Vite port; the backend's CORS list (REST and WebSocket)
        // must include it or every login is answered 403.
        SAMJHANA_CORS_ALLOWED_ORIGINS: `http://localhost:${FRONTEND_PORT}`,
        SAMJHANA_STORAGE_IMAGES_PATH: path.join(os.tmpdir(), 'samjhana-e2e-images'),
      },
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT} --strictPort`,
      cwd: here,
      url: `http://localhost:${FRONTEND_PORT}`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { ...process.env, VITE_PROXY_TARGET: `http://localhost:${BACKEND_PORT}` },
    },
  ],
});
