import { describe, it, expect, beforeEach } from 'vitest';
import { clearSignIn } from './session';

describe('clearSignIn', () => {
  beforeEach(() => localStorage.clear());

  it('removes the login and the cached NEA rate but keeps the language choice', () => {
    localStorage.setItem('token', 't');
    localStorage.setItem('user', '{}');
    localStorage.setItem('ev_nea_rate', '12.5');
    localStorage.setItem('preferredLanguage', 'ne');

    clearSignIn();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('ev_nea_rate')).toBeNull();
    expect(localStorage.getItem('preferredLanguage')).toBe('ne');
  });

  it('is safe to call when nobody is signed in', () => {
    expect(() => clearSignIn()).not.toThrow();
  });
});
