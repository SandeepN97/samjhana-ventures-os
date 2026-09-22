// Must match the server: AuthController (change password) and AdminController (create user) both
// reject a password shorter than this. Keeping the number in one place stops the screens drifting
// from the server, which is how the client came to allow 3 characters while the server needed 8.
export const MIN_PASSWORD_LENGTH = 8;

export function isAcceptableNewPassword(password) {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}
