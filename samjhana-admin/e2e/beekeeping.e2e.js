/* eslint-env node */
import { test, expect } from '@playwright/test';

// Test users created by the backend's dev-profile DataSeeder (disposable in-memory database).
const ADMIN = { username: 'admin', password: 'admin' };
const STAFF = { username: 'staff', password: 'staff123' };
const BACKEND = 'http://localhost:8181';

// One of the 26 products the BeekeepingProductSeeder loads (selling price Rs 4,500, stock starts at 0).
const HIVE = 'Langstroth 10-Frame Hive';

test.describe.configure({ mode: 'serial' });

async function login(page, { username, password }) {
  await page.addInitScript(() => localStorage.setItem('preferredLanguage', 'en'));
  await page.goto('/login');
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/$/);
}

const row = (page, name) => page.getByTestId('product-row').filter({ hasText: name });

async function startSaleOfHive(page, quantity) {
  await page.goto('/beekeeping/orders/new');
  await page.getByRole('button', { name: 'Add', exact: true }).first().click();
  const line = page.getByTestId('sale-line');
  await line.getByRole('button', { name: 'Select option' }).click();
  await line.getByRole('button', { name: new RegExp(HIVE) }).click();
  await line.getByLabel('Qty').fill(String(quantity));
  return line;
}

test('admin stocks a product, sells it, and the stock drops', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await login(page, ADMIN);

  // The imported shop starts with zero stock for every product.
  await page.goto('/entry/beekeeping');
  await expect(page.getByText('Beekeeping Shop').first()).toBeVisible();

  await page.goto('/beekeeping/inventory');
  await expect(row(page, HIVE)).toContainText('Out of stock');

  // Admin sets the real cost and the real count.
  await row(page, HIVE).getByRole('button', { name: 'Edit Product' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit Product' });
  await dialog.getByLabel('Purchase Price').fill('3000');
  await dialog.getByLabel('Stock Count').fill('5');
  await dialog.getByRole('button', { name: 'Update Product' }).click();
  await expect(dialog.getByText('Product updated!')).toBeVisible();
  await expect(dialog).toBeHidden();
  await expect(row(page, HIVE)).toContainText('Buy: Rs 3,000');
  await expect(row(page, HIVE).getByText('5', { exact: true })).toBeVisible();

  // Sell two: the sale is recorded and shows in the history.
  const line = await startSaleOfHive(page, 2);
  await expect(line.getByLabel('Unit Price')).toHaveValue('4500');
  await page.getByLabel('Customer name (optional)').fill('Hari Thapa');
  await page.getByRole('button', { name: 'Save Sale' }).click();
  await expect(page).toHaveURL(/\/beekeeping\/orders$/);
  await expect(page.getByTestId('sale-row').first()).toContainText('Hari Thapa');
  await expect(page.getByTestId('sale-row').first()).toContainText('Rs 9,000');
  await expect(page.getByTestId('sale-row').first()).toContainText(`${HIVE} × 2`);

  // Real stock went down.
  await page.goto('/beekeeping/inventory');
  await expect(row(page, HIVE).getByText('3', { exact: true })).toBeVisible();

  // More than the shop has: warned, and the sale can't be saved.
  await startSaleOfHive(page, 4);
  await expect(page.getByText('Only 3 in stock')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Sale' })).toBeDisabled();

  expect(pageErrors).toEqual([]);
});

test('the public site API shows a status, never cost or the real count', async ({ request }) => {
  const response = await request.get(`${BACKEND}/api/public/beekeeping`);
  expect(response.ok()).toBe(true);
  const body = await response.text();
  const hive = JSON.parse(body).find((p) => p.id === 'hive-001');

  expect(hive).toMatchObject({ name: HIVE, sellingPrice: 4500, stockStatus: 'IN_STOCK' });
  expect(body).not.toContain('purchasePrice');
  expect(body).not.toContain('stockQty');
  expect(body).not.toContain('3000');
});

test('staff can see stock but not cost, and cannot change products', async ({ page }) => {
  await login(page, STAFF);
  await page.goto('/beekeeping/inventory');

  await expect(row(page, HIVE)).toBeVisible();
  await expect(row(page, HIVE)).not.toContainText('Buy:');
  await expect(page.getByRole('button', { name: 'Add Product' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Increase stock/ })).toHaveCount(0);
});

test('fits a phone screen and keeps touch targets at least 44px on the beekeeping screens', async ({ page }) => {
  await login(page, ADMIN);
  for (const path of ['/entry/beekeeping', '/beekeeping/inventory', '/beekeeping/orders/new', '/beekeeping/orders']) {
    await page.goto(path);
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0); // finished loading

    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noHorizontalScroll, `${path} scrolls horizontally`).toBe(true);

    const tooSmall = await page.evaluate(() => {
      const targets = document.querySelectorAll('button:not(header button[aria-label*="Switch"]):not(header button[aria-label*="नेपाली"]), [role="button"]');
      return [...targets]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => Math.min(box.width, box.height) < 43.5)
        .map(({ el, box }) => `${el.textContent.trim().slice(0, 30) || el.getAttribute('aria-label')} (${Math.round(box.width)}x${Math.round(box.height)})`);
    });
    expect(tooSmall, `${path} has undersized touch targets`).toEqual([]);
  }
});
