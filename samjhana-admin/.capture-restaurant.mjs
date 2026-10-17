import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:5183';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
await page.addInitScript(() => localStorage.setItem('preferredLanguage', 'en'));
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(`${baseUrl}/login`);
await page.locator('input[autocomplete="username"]').fill('admin');
await page.locator('input[autocomplete="current-password"]').fill('admin');
await page.locator('button[type="submit"]').click();
await page.waitForURL(`${baseUrl}/`);
await page.goto(`${baseUrl}/restaurant-menu`);
await page.waitForTimeout(1500);
console.log(JSON.stringify({ url: page.url(), errors, text: (await page.locator('body').innerText()).slice(0, 1200) }, null, 2));
await page.screenshot({ path: '../.impeccable/review/restaurant-debug.png', fullPage: true });
await browser.close();
