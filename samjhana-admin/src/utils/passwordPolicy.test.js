import { describe, it, expect } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
  isAcceptableNewPassword,
  passwordProblem,
  passwordProblemMessage,
  serverPasswordMessage,
} from './passwordPolicy';
import { testI18n } from '../test/test-utils';

const seventyTwoBytes = 'Qx7!'.repeat(18);
const twentyFourNepaliLetters = 'कखगघङचछजझञटठडढणतथदधनपफबभ'; // 3 bytes each = 72

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

  it('rejects a password over the 72 bytes the server can use', () => {
    expect(isAcceptableNewPassword(seventyTwoBytes)).toBe(true);
    expect(isAcceptableNewPassword(`${seventyTwoBytes}z`)).toBe(false);
  });
});

describe('passwordProblem', () => {
  it('has the same limits as the server', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(MAX_PASSWORD_BYTES).toBe(72);
  });

  it('finds nothing wrong with an ordinary password', () => {
    expect(passwordProblem('k7Qm2xPv')).toBeNull();
  });

  it.each(['1234567', '', undefined, null, 12345678])('calls %s too short', (bad) => {
    expect(passwordProblem(bad)).toBe('PASSWORD_TOO_SHORT');
  });

  it('counts a character as a person sees it, not as two UTF-16 units', () => {
    expect(passwordProblem('😀😀😀😀ab')).toBe('PASSWORD_TOO_SHORT'); // 6 characters
    expect(passwordProblem('😀😀😀😀Qx7!')).toBeNull(); // 8 characters
  });

  it('allows up to 72 bytes and no more', () => {
    expect(passwordProblem(seventyTwoBytes)).toBeNull();
    expect(passwordProblem(`${seventyTwoBytes}z`)).toBe('PASSWORD_TOO_LONG');
  });

  it('counts each Nepali letter as three bytes', () => {
    expect(passwordProblem(twentyFourNepaliLetters)).toBeNull();
    expect(passwordProblem(`${twentyFourNepaliLetters}म`)).toBe('PASSWORD_TOO_LONG');
  });
});

describe('passwordProblemMessage', () => {
  const en = testI18n.getFixedT('en');
  const ne = testI18n.getFixedT('ne');

  it("uses the screen's own sentence for a short password", () => {
    expect(passwordProblemMessage(en, 'PASSWORD_TOO_SHORT', 'settings.newPasswordMin8'))
      .toBe('New password must be at least 8 characters');
    expect(passwordProblemMessage(ne, 'PASSWORD_TOO_SHORT', 'settings.newPasswordMin8'))
      .toBe('नयाँ पासवर्ड कम्तिमा ८ अक्षर हुनुपर्छ');
  });

  it.each([
    ['PASSWORD_TOO_LONG', 'Password is too long. Use at most 72 characters (a Nepali letter counts as 3)',
      'पासवर्ड धेरै लामो छ। बढीमा ७२ अक्षर प्रयोग गर्नुहोस् (नेपाली अक्षरले ३ गनिन्छ)'],
    ['PASSWORD_TOO_COMMON', 'Password is too common or too easy to guess. Choose something less obvious',
      'पासवर्ड धेरै चलनचल्तीको वा सजिलै अनुमान गर्न सकिने छ। अलि फरक पासवर्ड रोज्नुहोस्'],
    ['PASSWORD_HAS_USERNAME', 'Password must not contain the username',
      'पासवर्डमा प्रयोगकर्ता नाम हुनु हुँदैन'],
  ])('says %s in both languages', (code, english, nepali) => {
    expect(passwordProblemMessage(en, code, 'settings.newPasswordMin8')).toBe(english);
    expect(passwordProblemMessage(ne, code, 'settings.newPasswordMin8')).toBe(nepali);
  });

  it('returns nothing for a code it does not know', () => {
    expect(passwordProblemMessage(en, 'SOMETHING_ELSE', 'settings.newPasswordMin8')).toBeNull();
    expect(passwordProblemMessage(en, undefined, 'settings.newPasswordMin8')).toBeNull();
  });
});

describe('serverPasswordMessage', () => {
  const ne = testI18n.getFixedT('ne');

  it('shows a refusal the server gave a code for in the language on screen, not the server English', () => {
    const error = { response: { status: 400, data: { code: 'PASSWORD_TOO_COMMON', message: 'New password is too common' } } };

    expect(serverPasswordMessage(error, ne, 'settings.newPasswordMin8', 'Failed'))
      .toBe('पासवर्ड धेरै चलनचल्तीको वा सजिलै अनुमान गर्न सकिने छ। अलि फरक पासवर्ड रोज्नुहोस्');
  });

  it("uses the screen's own sentence when the server says the password is too short", () => {
    const error = { response: { status: 400, data: { code: 'PASSWORD_TOO_SHORT', message: 'New password must be at least 8 characters' } } };

    expect(serverPasswordMessage(error, ne, 'settings.newPasswordMin8', 'Failed')).toBe('नयाँ पासवर्ड कम्तिमा ८ अक्षर हुनुपर्छ');
  });

  it('keeps the server message when it has no password code', () => {
    const error = { response: { status: 400, data: { code: 'BAD_REQUEST', message: 'Current password is incorrect' } } };

    expect(serverPasswordMessage(error, ne, 'settings.newPasswordMin8', 'Failed')).toBe('Current password is incorrect');
  });

  it("falls back to the caller's text when the server said nothing useful", () => {
    expect(serverPasswordMessage({ response: { status: 500 } }, ne, 'settings.newPasswordMin8', 'Failed')).toBe('Failed');
    expect(serverPasswordMessage(new Error('Network Error'), ne, 'settings.newPasswordMin8', 'Failed')).toBe('Failed');
    expect(serverPasswordMessage(undefined, ne, 'settings.newPasswordMin8', 'Failed')).toBe('Failed');
  });
});
