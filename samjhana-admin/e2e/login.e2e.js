import { expect, test } from '@playwright/test';

test.describe('admin authentication', () => {
  test('redirects an unauthenticated operator from a protected page to login', async ({ page }) => {
    await page.goto('/entry/ev');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('input[autocomplete="username"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="current-password"]')).toBeVisible();
  });

  test('shows a generic error for invalid credentials without creating a session', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'EN' }).click();
    await page.locator('input[autocomplete="username"]').fill('not-a-real-user');
    await page.locator('input[autocomplete="current-password"]').fill('invalid-password');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Invalid username or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page).toHaveTitle(/Samjhana/i);
    await expect(page.evaluate(() => localStorage.getItem('token'))).resolves.toBeNull();
  });

  test('logs in against the disposable seeded admin, then logs out and clears credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'EN' }).click();
    await page.locator('input[autocomplete="username"]').fill('admin');
    await page.locator('input[autocomplete="current-password"]').fill('admin');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('System Admin')).toBeVisible();
    await expect(page.evaluate(() => localStorage.getItem('token'))).resolves.toBeTruthy();
    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.evaluate(() => localStorage.getItem('token'))).resolves.toBeNull();
    await expect(page.evaluate(() => localStorage.getItem('user'))).resolves.toBeNull();
  });
});
