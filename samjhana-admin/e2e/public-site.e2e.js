import { expect, test } from '@playwright/test';

const PUBLIC_SITE = 'http://localhost:5185';

test.describe('public website', () => {
  test('renders the home page and loads public fuel and EV data from the test backend', async ({ page }) => {
    const fuelResponse = page.waitForResponse((response) =>
      response.url().includes('/api/public/fuel-prices/current'));
    const evResponse = page.waitForResponse((response) =>
      response.url().includes('/api/public/ev/rates'));

    await page.goto(PUBLIC_SITE);

    await expect(page.getByRole('heading', { name: /Where craft meets community/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Petrol Pump & EV' })).toBeVisible();
    expect((await fuelResponse).status()).toBe(200);
    expect((await evResponse).status()).toBe(200);
  });

  test('opens and searches the public furniture catalogue', async ({ page }) => {
    const catalogueResponse = page.waitForResponse((response) =>
      response.url().includes('/api/public/furniture/catalogue'));

    await page.goto(`${PUBLIC_SITE}/furniture`);

    await expect(page.getByRole('heading', { name: /Built to last/i })).toBeVisible();
    expect((await catalogueResponse).status()).toBe(200);

    const search = page.getByPlaceholder(/Search furniture/i);
    await search.fill('no matching item');
    await expect(page.getByText('No matches found')).toBeVisible();
    await page.getByRole('button', { name: 'Show all furniture' }).click();
    await expect(search).toHaveValue('');
  });
});
