import { describe, it, expect } from 'vitest';
import {
  ACTIVE_STATUSES, PAYMENT_STATUSES, OPEN_STATUSES, byRequestedAt, chargerState, clampPercent, formatElapsed,
} from './evSession';

describe('chargerState', () => {
  const online = { connectionStatus: 'ONLINE', connectorStatus: 'Available' };

  it('is ready when online and the connector is free', () => {
    expect(chargerState(online)).toBe('ready');
  });

  it('is ready when online and no connector status has been reported yet', () => {
    expect(chargerState({ connectionStatus: 'ONLINE' })).toBe('ready');
  });

  it('is offline when the charger is not connected, whatever else it reports', () => {
    expect(chargerState({ connectionStatus: 'OFFLINE', connectorStatus: 'Available' })).toBe('offline');
    expect(chargerState(undefined)).toBe('offline');
  });

  it.each(['Occupied', 'Charging', 'Reserved'])('is busy when the connector reports %s', (status) => {
    expect(chargerState({ ...online, connectorStatus: status })).toBe('busy');
  });

  it('is busy when the app has an open session on it, even if the connector still says Available', () => {
    expect(chargerState(online, true)).toBe('busy');
  });

  it.each(['Faulted', 'Unavailable'])('is unavailable when the connector is %s', (status) => {
    expect(chargerState({ ...online, connectorStatus: status })).toBe('unavailable');
  });
});

describe('formatElapsed', () => {
  const start = '2026-09-19T10:00:00';
  const at = (seconds) => new Date(start).getTime() + seconds * 1000;

  it('shows mm:ss under an hour', () => {
    expect(formatElapsed(start, at(65))).toBe('01:05');
    expect(formatElapsed(start, at(0))).toBe('00:00');
  });

  it('shows h:mm:ss from one hour', () => {
    expect(formatElapsed(start, at(3600 + 125))).toBe('1:02:05');
  });

  it('shows 00:00 until the charger reports a start time', () => {
    expect(formatElapsed(null)).toBe('00:00');
    expect(formatElapsed(undefined)).toBe('00:00');
  });

  it('never goes negative when the clocks disagree', () => {
    expect(formatElapsed(start, at(-30))).toBe('00:00');
  });

  it('shows 00:00 for an unparseable timestamp', () => {
    expect(formatElapsed('not-a-date')).toBe('00:00');
  });
});

describe('clampPercent', () => {
  it('keeps values inside 0..100', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42)).toBe(42);
    expect(clampPercent(150)).toBe(100);
  });
});

describe('session status groups', () => {
  it('puts every open status on exactly one tab', () => {
    expect(ACTIVE_STATUSES).toEqual(['STARTING', 'ACTIVE', 'STOP_REQUESTED']);
    expect(PAYMENT_STATUSES).toEqual(['AWAITING_PAYMENT', 'PAID', 'UNLOCK_REQUESTED']);
    expect(OPEN_STATUSES.size).toBe(6);
    ['CLOSED', 'FAILED', 'CANCELLED'].forEach((status) => expect(OPEN_STATUSES.has(status)).toBe(false));
  });
});

describe('byRequestedAt', () => {
  it('sorts oldest first and tolerates missing timestamps', () => {
    const sorted = [
      { id: 'b', requestedAt: '2026-09-19T10:05:00' },
      { id: 'a', requestedAt: '2026-09-19T10:00:00' },
      { id: 'c' },
    ].sort(byRequestedAt).map((item) => item.id);
    expect(sorted).toEqual(['c', 'a', 'b']);
  });
});
