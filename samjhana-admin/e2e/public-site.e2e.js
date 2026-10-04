/* eslint-env node */
import { expect, test } from '@playwright/test';

const PUBLIC_SITE = 'http://localhost:5185';
const BACKEND = 'http://localhost:8181';

test.describe.configure({ mode: 'serial' });

async function token(username, password) {
  const response = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }),
  });
  return (await response.json()).token;
}
const authed = (jwt) => ({ Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' });

test.describe('public website', () => {
  test('renders the home page from admin-managed content and loads fuel and EV data', async ({ page }) => {
    const siteResponse = page.waitForResponse((r) => r.url().includes('/api/public/site'));
    const fuelResponse = page.waitForResponse((r) => r.url().includes('/api/public/fuel-prices/current'));
    const evResponse = page.waitForResponse((r) => r.url().includes('/api/public/ev/rates'));

    await page.goto(PUBLIC_SITE);

    await expect(page.getByRole('heading', { name: /Come for the journey/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Petrol Pump & EV' })).toBeVisible();
    expect((await siteResponse).status()).toBe(200);
    expect((await fuelResponse).status()).toBe(200);
    expect((await evResponse).status()).toBe(200);
  });

  test('the shop & order page lets the customer pick furniture or beekeeping', async ({ page }) => {
    await page.goto(`${PUBLIC_SITE}/shop`);
    await expect(page.getByRole('heading', { name: /Useful things/i })).toBeVisible();
    await page.getByRole('link', { name: /Browse all furniture/i }).click();
    await expect(page).toHaveURL(/\/furniture$/);
    await expect(page.getByRole('heading', { name: /Furniture for/i })).toBeVisible();
    await page.goto(`${PUBLIC_SITE}/beekeeping`);
    await expect(page.getByRole('heading', { name: /Honey and beekeeping/i })).toBeVisible();
  });

  test('furniture search finds nothing for nonsense and recovers', async ({ page }) => {
    await page.goto(`${PUBLIC_SITE}/furniture`);
    const search = page.getByPlaceholder(/Search furniture/i);
    await search.fill('zzzz no such thing');
    await expect(page.getByText('No furniture matches')).toBeVisible();
    await page.getByRole('button', { name: 'Show all furniture' }).click();
    await expect(search).toHaveValue('');
  });

  test('the phone menu stacks its links, sits above the page and closes after any navigation', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 851 });
    await page.goto(PUBLIC_SITE);
    await page.getByRole('button', { name: 'Menu' }).click();
    const tops = await page.locator('header a:visible').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)).filter((t) => t > 70));
    expect(new Set(tops).size).toBeGreaterThanOrEqual(4);                          // one under another, not one row
    const header = await page.locator('header').boundingBox();
    const callBtn = await page.getByRole('link', { name: 'Call or WhatsApp' }).boundingBox();
    expect(header.y + header.height).toBeGreaterThanOrEqual(callBtn.y + callBtn.height - 1);   // the panel really contains its links
    await page.getByRole('link', { name: 'Browse shop & order' }).click({ force: true }).catch(() => {});
    await page.goto(PUBLIC_SITE);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.locator('header').getByRole('link', { name: 'Shop & order' }).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(page.locator('header').getByRole('link', { name: 'Shop & order' })).toHaveCount(0);   // menu closed
  });

  test('a furniture piece with an uploaded picture shows the picture and sells through the cart', async ({ page }) => {
    const admin = await token('admin', 'admin');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'chair.png');
    const media = await fetch(`${BACKEND}/api/media`, { method: 'POST', headers: { Authorization: `Bearer ${admin}` }, body: form });
    expect(media.status).toBe(200);
    const picture = await media.json();
    const created = await fetch(`${BACKEND}/api/furniture/items`, {
      method: 'POST', headers: authed(admin),
      body: JSON.stringify({ name: 'E2E Oak Chair', category: 'CHAIR', purchasePrice: 1000, sellingPrice: 3200, stockQty: 4, imageIds: [picture.id] }),
    });
    expect(created.status).toBeLessThan(300);

    await page.goto(`${PUBLIC_SITE}/furniture`);
    const card = page.getByText('E2E Oak Chair').first();
    await expect(card).toBeVisible();
    await expect(page.getByRole('img', { name: 'E2E Oak Chair' }).first()).toBeVisible();
    await card.click();
    await expect(page).toHaveURL(/\/furniture\/[a-z0-9-]+$/);
    await page.getByRole('button', { name: /add to cart/i }).first().click();
    await page.getByRole('button', { name: 'Open cart' }).click();
    await expect(page.getByText('E2E Oak Chair').first()).toBeVisible();
  });

  test('a customer orders a product the admin stocked, and staff complete it', async ({ page }) => {
    const admin = await token('admin', 'admin');

    // Admin puts honey on the shelf (the imported shop starts at zero stock).
    const items = await (await fetch(`${BACKEND}/api/beekeeping/items`, { headers: authed(admin) })).json();
    const list = Array.isArray(items) ? items : items.items;
    const honey = list.find((i) => i.sku === 'HONEY-001') || list[0];
    const stocked = await fetch(`${BACKEND}/api/beekeeping/items/${honey.id}/stock`, {
      method: 'PATCH', headers: authed(admin), body: JSON.stringify({ adjustment: 5 }),
    });
    expect(stocked.status).toBe(200);

    // Customer adds it from the Maurighar page and checks out for pickup in the cart drawer.
    await page.goto(`${PUBLIC_SITE}/beekeeping`);
    await expect(page.getByText(honey.name).first()).toBeVisible();
    await page.getByRole('button', { name: /मालमा थप्नुहोस्/ }).first().click();
    await page.getByRole('button', { name: 'Open cart' }).click();
    await expect(page.getByText(honey.name).first()).toBeVisible();
    await page.getByRole('button', { name: /^Checkout/ }).click();

    await page.getByLabel('Full name').fill('Sita Rana');
    await page.getByLabel('Phone number').fill('9812345678');
    await page.getByText('Pick up at the shop').click();
    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page.getByText('Thank you!')).toBeVisible();
    const orderNumber = (await page.locator('span.font-mono').first().textContent()).trim();
    expect(orderNumber).toMatch(/^SV-/);

    // Staff see it and walk it through to completed.
    const orders = await (await fetch(`${BACKEND}/api/shop-orders`, { headers: authed(admin) })).json();
    const mine = (Array.isArray(orders) ? orders : orders.items || orders.orders).find((o) => o.orderNumber === orderNumber);
    expect(mine).toBeTruthy();
    for (const status of ['CONFIRMED', 'READY', 'COMPLETED']) {
      const moved = await fetch(`${BACKEND}/api/shop-orders/${mine.id}/status`, {
        method: 'PATCH', headers: authed(admin), body: JSON.stringify({ status }),
      });
      expect(moved.status).toBe(200);
    }

    // The customer's tracking page now shows it finished.
    await page.goto(`${PUBLIC_SITE}/track`);
    await page.getByLabel('Order number').fill(orderNumber);
    await page.getByLabel(/phone number on the order/i).fill('9812345678');
    await page.getByRole('button', { name: /show my order/i }).click();
    await expect(page).toHaveURL(new RegExp(`/order/${orderNumber}`));
    await expect(page.getByLabel('Order status')).toContainText(/completed/i);
  });
});
