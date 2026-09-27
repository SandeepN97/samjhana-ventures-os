/**
 * Everything this browser keeps that belongs to the signed-in person. Counter devices are shared,
 * so signing out must leave nothing behind for whoever signs in next — including the NEA rate
 * (what the station pays for electricity), which only admins and managers may see.
 */
export const SIGNED_IN_KEYS = ['token', 'user', 'ev_nea_rate'];

export function clearSignIn() {
  SIGNED_IN_KEYS.forEach((key) => localStorage.removeItem(key));
}
