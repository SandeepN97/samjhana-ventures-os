/* eslint-env node */

const API = 'http://localhost:8181';

async function canLogin(username, password) {
  try {
    const response = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The backend starts answering HTTP a moment before its DataSeeder has created the test
 * users, so "server is up" is not enough. Wait until the seeded logins really work.
 */
export default async function globalSetup() {
  const deadline = Date.now() + 60_000;
  const users = [['admin', 'admin'], ['staff', 'staff123']];
  for (;;) {
    const ready = await Promise.all(users.map(([username, password]) => canLogin(username, password)));
    if (ready.every(Boolean)) return;
    if (Date.now() > deadline) {
      throw new Error('Backend is up but the seeded test users (admin, staff) cannot log in — is the dev profile active?');
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
