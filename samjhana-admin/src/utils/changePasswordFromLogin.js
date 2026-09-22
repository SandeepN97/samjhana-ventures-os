import api from './api';

/**
 * Change a password from the login screen, where nobody is signed in yet.
 *
 * /api/auth/change-password needs a JWT, so first prove who the user is by logging in with the current
 * password. That token is used for this one request and is never stored: the user is not signed in
 * afterwards and goes back to the login form. Both calls skip the global 401 handling, because a wrong
 * password here must show a message instead of reloading /login and wiping the form.
 *
 * Rejects with the original axios error, so the caller can tell a failed login (401) from a refused change.
 */
export async function changePasswordFromLogin({ username, currentPassword, newPassword }) {
  const login = await api.post(
    '/api/auth/login',
    { username, password: currentPassword },
    { skipAuthRedirect: true }
  );

  // No username in the body: the token identifies the user, so this is always a change of their own password.
  const response = await api.post(
    '/api/auth/change-password',
    { currentPassword, newPassword },
    { skipAuthRedirect: true, headers: { Authorization: `Bearer ${login.data.token}` } }
  );
  return response.data;
}
