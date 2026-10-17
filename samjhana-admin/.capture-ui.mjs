import { chromium } from '@playwright/test';

const baseUrl = 'http://127.0.0.1:5183';
const reviewDir = '../.impeccable/review';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];

await page.addInitScript(() => localStorage.setItem('preferredLanguage', 'en'));

page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

await page.goto(`${baseUrl}/login`);
await page.locator('input[autocomplete="username"]').fill('admin');
await page.locator('input[autocomplete="current-password"]').fill('admin');
await page.locator('button[type="submit"]').click();
await page.waitForURL(`${baseUrl}/`);
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${reviewDir}/dashboard-mobile.png`, fullPage: true });

await page.setViewportSize({ width: 1440, height: 1100 });
await page.goto(`${baseUrl}/website`);
await page.getByRole('heading', { name: 'Website' }).waitFor();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${reviewDir}/website-no-orders.png`, fullPage: true });

const sampleOrder = {
  id: 'visual-order-1',
  orderNumber: 'SV-261016-MH4R',
  status: 'NEW',
  customerName: 'Sita Rana',
  customerPhone: '9812345678',
  customerEmail: 'sita@example.com',
  fulfilment: 'DELIVERY',
  addressLine: 'Ward 3',
  city: 'Tamghas',
  landmark: 'Near the school',
  paymentMethod: 'CASH_ON_DELIVERY',
  customerNotes: 'Please call before delivery',
  internalNotes: '',
  subtotal: 1700,
  deliveryFee: 150,
  total: 1850,
  cancelReason: null,
  createdAt: '2026-10-16T05:30:00',
  items: [
    { slug: 'wild-honey', name: 'Wild Honey', quantity: 2, unitPrice: 850, lineTotal: 1700 },
  ],
};
await page.route('**/api/shop-orders**', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (request.method() !== 'GET') return route.continue();
  if (url.pathname.endsWith('/summary')) {
    return route.fulfill({ json: { NEW: 3, CONFIRMED: 2, READY: 1, COMPLETED: 8, CANCELLED: 1 } });
  }
  return route.fulfill({ json: [sampleOrder] });
});

await page.goto(`${baseUrl}/online-orders`);
await page.getByRole('heading', { name: 'Order desk' }).waitFor();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${reviewDir}/online-orders-desktop.png`, fullPage: true });
await page.getByTestId('order-row').click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: `${reviewDir}/online-order-detail.png`, fullPage: true });
await page.keyboard.press('Escape');

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${reviewDir}/online-orders-mobile.png`, fullPage: true });
await page.getByTestId('order-row').click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: `${reviewDir}/online-order-detail-mobile.png`, fullPage: true });
await page.keyboard.press('Escape');

await page.setViewportSize({ width: 1440, height: 1100 });
await page.goto(`${baseUrl}/restaurant-menu`);
await page.getByRole('heading', { name: "Today's menu board" }).waitFor();
await page.waitForLoadState('networkidle');
await page.screenshot({ path: `${reviewDir}/desktop.png`, fullPage: true });
await page.getByRole('button', { name: 'Add Dish' }).first().click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: `${reviewDir}/restaurant-dialog.png`, fullPage: true });
await page.keyboard.press('Escape');

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${reviewDir}/mobile.png`, fullPage: true });
await page.getByRole('button', { name: 'Add Dish' }).first().click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: `${reviewDir}/restaurant-dialog-mobile.png`, fullPage: true });

const metrics = await page.evaluate(() => ({
  clientWidth: document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  activeElement: document.activeElement?.id || document.activeElement?.tagName,
}));

console.log(JSON.stringify({ errors, metrics }, null, 2));
await browser.close();
