import { describe, it, expect } from 'vitest';
import { MIN_PASSWORD_LENGTH, isAcceptableNewPassword } from './passwordPolicy';

describe('passwordPolicy', () => {
  it('matches the 8-character minimum the server enforces', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it('rejects 7 characters and accepts exactly 8', () => {
    expect(isAcceptableNewPassword('1234567')).toBe(false);
    expect(isAcceptableNewPassword('12345678')).toBe(true);
  });

  it('rejects the old 3-character minimum', () => {
    expect(isAcceptableNewPassword('abc')).toBe(false);
  });

  it('accepts longer passwords, including Devanagari characters', () => {
    expect(isAcceptableNewPassword('a-much-longer-passphrase')).toBe(true);
    expect(isAcceptableNewPassword('पासवर्ड१२३४५')).toBe(true);
  });

  it('rejects empty, missing and non-string values', () => {
    expect(isAcceptableNewPassword('')).toBe(false);
    expect(isAcceptableNewPassword(undefined)).toBe(false);
    expect(isAcceptableNewPassword(null)).toBe(false);
    expect(isAcceptableNewPassword(12345678)).toBe(false);
  });
});
