import { describe, it, expect } from 'vitest';
import { nepalToday, nepalTodayDate, toDateStr, addDays } from './businessDay';

describe('businessDay', () => {
  it("is already tomorrow in Nepal when it's the evening before in the US", () => {
    // 22:40 UTC on 27 Sep = 04:25 on 28 Sep in Kathmandu (UTC+5:45) = 18:40 on 27 Sep in New York.
    expect(nepalToday(new Date('2026-09-27T22:40:00Z'))).toBe('2026-09-28');
  });

  it('is the same day in Nepal later in the UTC morning', () => {
    expect(nepalToday(new Date('2026-09-28T06:00:00Z'))).toBe('2026-09-28');
  });

  it('switches to the next day at midnight Nepal time, not midnight UTC', () => {
    expect(nepalToday(new Date('2026-09-27T18:14:00Z'))).toBe('2026-09-27'); // 23:59 NPT
    expect(nepalToday(new Date('2026-09-27T18:15:00Z'))).toBe('2026-09-28'); // 00:00 NPT
  });

  it('gives the Nepal calendar date as a local-midnight Date', () => {
    const d = nepalTodayDate(new Date('2026-09-27T22:40:00Z'));
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours()]).toEqual([2026, 9, 28, 0]);
  });

  it('formats a calendar date without shifting it through UTC', () => {
    expect(toDateStr(new Date(2026, 8, 28))).toBe('2026-09-28');
  });

  it('adds and subtracts days across month ends', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
  });
});
