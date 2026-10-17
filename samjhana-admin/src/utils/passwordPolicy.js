// The rule for a new password. The numbers and the codes match the server (PasswordPolicy in
// com.samjhana.security), which has the last word: it also refuses common passwords and ones that contain the
// username, and answers with a code so that every screen shows the reason in the language on screen. Keeping the
// numbers in one place stops the screens drifting from the server, which is how the client came to allow
// 3 characters while the server needed 8.
export const MIN_PASSWORD_LENGTH = 8;
// BCrypt can only use the first 72 bytes of a password, and a Nepali letter takes 3 of them.
export const MAX_PASSWORD_BYTES = 72;

const TOO_SHORT = 'PASSWORD_TOO_SHORT';
const TOO_LONG = 'PASSWORD_TOO_LONG';

const MESSAGE_KEYS = new Map([
  [TOO_LONG, 'passwordPolicy.tooLong'],
  ['PASSWORD_TOO_COMMON', 'passwordPolicy.tooCommon'],
  ['PASSWORD_HAS_USERNAME', 'passwordPolicy.hasUsername'],
]);

// What can be told without asking the server, as one of the server's codes (null when nothing is wrong).
// Length counts characters as people see them, so an emoji is one.
export function passwordProblem(password) {
  if (typeof password !== 'string' || Array.from(password).length < MIN_PASSWORD_LENGTH) return TOO_SHORT;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return TOO_LONG;
  return null;
}

export function isAcceptableNewPassword(password) {
  return passwordProblem(password) === null;
}

// The sentence for one of the server's codes, in the language of `t`. A short password uses the calling screen's
// own sentence (`shortKey`), which is worded for that screen. Null for a code it does not know.
export function passwordProblemMessage(t, code, shortKey) {
  if (code === TOO_SHORT) return t(shortKey);
  return MESSAGE_KEYS.has(code) ? t(MESSAGE_KEYS.get(code)) : null;
}

// What to show when the server refused the request: the reason in the language on screen when the server gave a
// password code, otherwise the server's own message, otherwise `fallback`.
export function serverPasswordMessage(error, t, shortKey, fallback) {
  const data = error?.response?.data;
  return passwordProblemMessage(t, data?.code, shortKey) || data?.message || fallback;
}
