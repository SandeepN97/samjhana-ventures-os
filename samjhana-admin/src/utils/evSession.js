// Pure helpers for the EV charging screens (kept free of React so they're trivial to test).

/** Sessions the kiosk still has to act on, grouped by the tab they belong to. */
export const ACTIVE_STATUSES = ['STARTING', 'ACTIVE', 'STOP_REQUESTED'];
export const PAYMENT_STATUSES = ['AWAITING_PAYMENT', 'PAID', 'UNLOCK_REQUESTED'];
export const OPEN_STATUSES = new Set([...ACTIVE_STATUSES, ...PAYMENT_STATUSES]);

/**
 * Charger cards represent the physical unit, not an individual connector. Its single
 * connectorStatus field cannot identify which of its nozzles is in use, so connector
 * availability is determined from the open sessions after the unit is selected.
 */
export function chargerState(charger) {
  if (!charger || charger.connectionStatus !== 'ONLINE') return 'offline';
  return 'ready';
}

/** mm:ss, or h:mm:ss once past an hour. Returns 00:00 until the charger reports a start time. */
export function formatElapsed(startedAt, nowMs = Date.now()) {
  if (!startedAt) return '00:00';
  const start = new Date(startedAt).getTime();
  if (Number.isNaN(start)) return '00:00';
  const total = Math.max(0, Math.floor((nowMs - start) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

export function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

/** Newest-last ordering used for the session lists. */
export function byRequestedAt(a, b) {
  return String(a.requestedAt || '').localeCompare(String(b.requestedAt || ''));
}
