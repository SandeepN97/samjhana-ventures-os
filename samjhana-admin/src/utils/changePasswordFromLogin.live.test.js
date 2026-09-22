// @vitest-environment node
/* eslint-env node */
/*
 * Live end-to-end check of the login screen's "change password" flow against a REAL running backend.
 * It is skipped unless E2E_BACKEND_URL is set, so `npm test` and CI are unaffected.
 *
 * Run it against a disposable backend (never production), for example:
 *   JWT_SECRET=$(openssl rand -base64 48) mvn spring-boot:run -Pdev -Dspring-boot.run.profiles=dev \
 *     -Dspring-boot.run.jvmArguments="-Dserver.port=8199 -Dspring.datasource.url=jdbc:h2:mem:live"
 *   E2E_BACKEND_URL=http://localhost:8199 E2E_USERNAME=<seeded user> E2E_PASSWORD=<its password> \
 *     VITE_API_URL=http://localhost:8199 npx vitest run src/utils/changePasswordFromLogin.live.test.js
 *
 * The test changes the user's password and then changes it back, so it can be re-run.
 *
 * Run this file ALONE, not together with ../pages/shared/LoginPage.live.test.jsx: both mutate the
 * same E2E_USERNAME account's password, and vitest runs separate test files in parallel by default,
 * so running them in one invocation races the two files against each other.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import axios from 'axios';

const backend = process.env.E2E_BACKEND_URL;
const username = process.env.E2E_USERNAME;
const originalPassword = process.env.E2E_PASSWORD;
const changedPassword = `live-changed-${Date.now()}`;

describe.skipIf(!backend || !username || !originalPassword)('login-screen change password (live backend)', () => {
  let changePasswordFromLogin;

  beforeAll(async () => {
    // api.js reads localStorage; a Node process has none, so give it an empty one.
    const store = new Map();
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    };
    ({ changePasswordFromLogin } = await import('./changePasswordFromLogin.js'));
  });

  const loginStatus = async (password) => {
    const res = await axios.post(`${backend}/api/auth/login`, { username, password }, { validateStatus: () => true });
    return res.status;
  };

  it('the pre-fix page behaviour (no token) is refused with 401 and changes nothing', async () => {
    const res = await axios.post(
      `${backend}/api/auth/change-password`,
      { username, currentPassword: originalPassword, newPassword: changedPassword },
      { validateStatus: () => true }
    );

    expect(res.status).toBe(401);
    expect(await loginStatus(originalPassword)).toBe(200);
  });

  it('the fixed flow changes the password, the old one stops working and the new one works', async () => {
    const result = await changePasswordFromLogin({
      username,
      currentPassword: originalPassword,
      newPassword: changedPassword,
    });

    expect(result.message).toBe('Password changed successfully');
    expect(await loginStatus(originalPassword)).toBe(401);
    expect(await loginStatus(changedPassword)).toBe(200);
    expect(globalThis.localStorage.getItem('token')).toBeNull();

    // put it back so the test can be re-run against the same backend
    await changePasswordFromLogin({ username, currentPassword: changedPassword, newPassword: originalPassword });
    expect(await loginStatus(originalPassword)).toBe(200);
  });

  it('a wrong current password fails at the login step and changes nothing', async () => {
    await expect(
      changePasswordFromLogin({ username, currentPassword: 'definitely-wrong-1', newPassword: changedPassword })
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(await loginStatus(originalPassword)).toBe(200);
  });
});
