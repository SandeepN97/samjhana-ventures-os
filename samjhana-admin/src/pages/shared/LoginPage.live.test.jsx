// @vitest-environment jsdom
// @vitest-environment-options {"url": "http://localhost:5173/"}
/* eslint-env node */
/*
 * Live end-to-end check: the real LoginPage, its real axios instance and a REAL running backend, with
 * nothing mocked. Skipped unless E2E_BACKEND_URL is set, so `npm test` and CI are unaffected.
 *
 * The page runs at http://localhost:5173 (see the environment-options line above) because that origin
 * is on the backend's CORS allow-list. Run it against a disposable backend, never production:
 *   JWT_SECRET=$(openssl rand -base64 48) mvn spring-boot:run -Pdev -Dspring-boot.run.profiles=dev \
 *     -Dspring-boot.run.jvmArguments="-Dserver.port=8199 -Dspring.datasource.url=jdbc:h2:mem:live"
 *   E2E_BACKEND_URL=http://localhost:8199 E2E_USERNAME=<seeded user> E2E_PASSWORD=<its password> \
 *     VITE_API_URL=http://localhost:8199 npx vitest run src/pages/shared/LoginPage.live.test.jsx
 *
 * It changes the user's password and then changes it back, so it can be re-run.
 *
 * Run this file ALONE, not together with changePasswordFromLogin.live.test.js: both mutate the same
 * E2E_USERNAME account's password, and vitest runs separate test files in parallel by default, so
 * running them in one invocation races the two files against each other and can fail with a spurious
 * "Invalid username or password" if one file logs in while the other is mid-change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const backend = process.env.E2E_BACKEND_URL;
const username = process.env.E2E_USERNAME;
const originalPassword = process.env.E2E_PASSWORD;
const changedPassword = `live-changed-${Date.now()}`;

const loginStatus = async (password) =>
  (await axios.post(`${backend}/api/auth/login`, { username, password }, { validateStatus: () => true })).status;

async function changePasswordThroughThePage(current, next) {
  renderWithProviders(<LoginPage />);
  await userEvent.click(screen.getByText('Change Password'));
  await userEvent.type(screen.getByPlaceholderText('Enter username'), username);
  await userEvent.type(screen.getByPlaceholderText('Current password'), current);
  await userEvent.type(screen.getByPlaceholderText('New password'), next);
  await userEvent.type(screen.getByPlaceholderText('Confirm password'), next);
  await userEvent.click(screen.getByRole('button', { name: 'Change Password' }));
}

describe.skipIf(!backend || !username || !originalPassword)('LoginPage change password against a live backend', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('changes the password through the real page: old password dies, new one works, nobody is signed in', async () => {
    await changePasswordThroughThePage(originalPassword, changedPassword);

    expect(await screen.findByText('Password changed successfully!', {}, { timeout: 20000 })).toBeInTheDocument();
    expect(await loginStatus(originalPassword)).toBe(401);
    expect(await loginStatus(changedPassword)).toBe(200);
    expect(localStorage.getItem('token')).toBeNull();

    // put the password back so this test can be re-run against the same backend
    const { changePasswordFromLogin } = await import('../../utils/changePasswordFromLogin');
    await changePasswordFromLogin({ username, currentPassword: changedPassword, newPassword: originalPassword });
    expect(await loginStatus(originalPassword)).toBe(200);
  }, 60000);

  it('a wrong current password shows an error on the page, keeps the form, and changes nothing', async () => {
    await changePasswordThroughThePage('definitely-wrong-1', changedPassword);

    expect(await screen.findByText('Invalid username or password', {}, { timeout: 20000 })).toBeInTheDocument();
    // the form is still there with what the user typed: no page reload wiped it
    expect(screen.getByPlaceholderText('Enter username')).toHaveValue(username);
    expect(await loginStatus(originalPassword)).toBe(200);
  }, 60000);
});
