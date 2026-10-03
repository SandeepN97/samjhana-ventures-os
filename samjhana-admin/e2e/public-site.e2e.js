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

  test('old catalogue addresses open the shop', async ({ page }) => {
    await page.goto(`${PUBLIC_SITE}/furniture`);
    await expect(page).toHaveURL(/\/shop\?type=FURNITURE/);
    await page.goto(`${PUBLIC_SITE}/beekeeping`);
    await expect(page).toHaveURL(/\/shop\?type=BEEKEEPING/);
  });

  test('shop search finds nothing for nonsense and recovers', async ({ page }) => {
    await page.goto(`${PUBLIC_SITE}/shop`);
    await page.getByRole('searchbox').fill('zzzz no such thing');
    await page.getByRole('searchbox').press('Enter');
    await expect(page).toHaveURL(/q=zzzz/);
    await expect(page.getByText(/no products|nothing matches|didn.t find/i)).toBeVisible();
  });

  test('a customer orders a product the admin stocked, and staff complete it', async ({ page }) => {
    const admin = await token('admin', 'admin');

    // Admin puts honey on the shelf (the imported shop starts at zero stock).
    const items = await (await fetch(`${BACKEND}/api/beekeeping/items`, { headers: authed(admin) })).json();
    const list = Array.isArray(items) ? items : items.items;
    const honey = list.find((i) => /honey/i.test(i.name) && i.showOnWebsite !== false) || list[0];
    const stocked = await fetch(`${BACKEND}/api/beekeeping/items/${honey.id}/stock`, {
      method: 'PATCH', headers: authed(admin), body: JSON.stringify({ adjustment: 5 }),
    });
    expect(stocked.status).toBe(200);

    // Customer finds it, adds to cart, checks out for pickup.
    await page.goto(`${PUBLIC_SITE}/shop?type=BEEKEEPING`);
    await page.getByRole('link', { name: honey.name }).first().click();
    await page.getByRole('button', { name: /^add to cart/i }).click();
    await page.goto(`${PUBLIC_SITE}/cart`);
    await expect(page.getByText(honey.name).first()).toBeVisible();
    await page.getByRole('button', { name: /proceed to checkout/i }).click();

    await page.getByLabel('Full name').fill('Sita Rana');
    await page.getByLabel('Phone', { exact: true }).fill('9812345678');
    await page.getByLabel(/Pick up at the shop/).check();
    await page.getByRole('button', { name: /place order/i }).click();

    await expect(page).toHaveURL(/\/order\/SV-/);
    const orderNumber = page.url().split('/order/')[1];
    await expect(page.getByText(orderNumber).first()).toBeVisible();

    // Staff see it and walk it through to completed.
    const staff = await token('admin', 'admin');
    const orders = await (await fetch(`${BACKEND}/api/shop-orders`, { headers: authed(staff) })).json();
    const mine = (Array.isArray(orders) ? orders : orders.items || orders.orders).find((o) => o.orderNumber === orderNumber);
    expect(mine).toBeTruthy();
    for (const status of ['CONFIRMED', 'READY', 'COMPLETED']) {
      const moved = await fetch(`${BACKEND}/api/shop-orders/${mine.id}/status`, {
        method: 'PATCH', headers: authed(staff), body: JSON.stringify({ status }),
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
