import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./api', () => ({
  default: { post: vi.fn() },
}));

import api from './api';
import { changePasswordFromLogin } from './changePasswordFromLogin';

const LOGIN = '/api/auth/login';
const CHANGE = '/api/auth/change-password';
const credentials = { username: 'staff', currentPassword: 'old-pass-123', newPassword: 'new-pass-4567' };

function serverAccepts() {
  api.post.mockImplementation(async (url) =>
    url === LOGIN
      ? { data: { token: 'token-from-login', user: { username: 'staff' } } }
      : { data: { message: 'Password changed successfully' } }
  );
}

describe('changePasswordFromLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('logs in with the current password first, then changes the password with that token', async () => {
    serverAccepts();

    const result = await changePasswordFromLogin(credentials);

    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenNthCalledWith(
      1,
      LOGIN,
      { username: 'staff', password: 'old-pass-123' },
      { skipAuthRedirect: true }
    );
    expect(api.post).toHaveBeenNthCalledWith(
      2,
      CHANGE,
      { currentPassword: 'old-pass-123', newPassword: 'new-pass-4567' },
      { skipAuthRedirect: true, headers: { Authorization: 'Bearer token-from-login' } }
    );
    expect(result).toEqual({ message: 'Password changed successfully' });
  });

  it('never stores the token, so the user is not signed in afterwards', async () => {
    serverAccepts();

    await changePasswordFromLogin(credentials);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('does not send a username to change-password: the token already identifies the user', async () => {
    serverAccepts();

    await changePasswordFromLogin(credentials);

    const body = api.post.mock.calls[1][1];
    expect(body).not.toHaveProperty('username');
  });

  it('skips the auth redirect on both calls so a wrong password cannot reload the page', async () => {
    serverAccepts();

    await changePasswordFromLogin(credentials);

    expect(api.post.mock.calls[0][2].skipAuthRedirect).toBe(true);
    expect(api.post.mock.calls[1][2].skipAuthRedirect).toBe(true);
  });

  it('does not attempt the change when the login step fails', async () => {
    const wrongPassword = { response: { status: 401 } };
    api.post.mockRejectedValueOnce(wrongPassword);

    await expect(changePasswordFromLogin(credentials)).rejects.toBe(wrongPassword);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(LOGIN, expect.anything(), expect.anything());
  });

  it('passes the server refusal from the change step back to the caller', async () => {
    const refusal = { response: { status: 400, data: { message: 'New password must be at least 8 characters' } } };
    api.post.mockResolvedValueOnce({ data: { token: 'token-from-login' } }).mockRejectedValueOnce(refusal);

    await expect(changePasswordFromLogin(credentials)).rejects.toBe(refusal);

    expect(api.post).toHaveBeenCalledTimes(2);
  });
});
