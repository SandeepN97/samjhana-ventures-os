import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { testI18n } from '../test/test-utils';
import useLocaleFormat from './useLocaleFormat';

function formatWith(locale) {
  testI18n.changeLanguage(locale);
  let captured;
  function Probe() {
    captured = useLocaleFormat();
    return null;
  }
  render(<I18nextProvider i18n={testI18n}><Probe /></I18nextProvider>);
  return captured;
}

describe('useLocaleFormat', () => {
  describe('English', () => {
    it('writes money with "Rs" and Latin digits', () => {
      const { money, currency, isNepali } = formatWith('en');
      expect(isNepali).toBe(false);
      expect(currency).toBe('Rs');
      expect(money(480)).toBe('Rs 480');
    });

    it('groups amounts in lakhs and crores', () => {
      const { money } = formatWith('en');
      expect(money(123456)).toBe('Rs 1,23,456');
      expect(money(12345678)).toBe('Rs 1,23,45,678');
    });

    it('keeps decimals but drops a trailing .00', () => {
      const { money } = formatWith('en');
      expect(money(329.6)).toBe('Rs 329.6');
      expect(money('600.00')).toBe('Rs 600');
    });

    it('never contains the Nepali symbol', () => {
      const { money } = formatWith('en');
      expect(money(80)).not.toContain('रु');
    });

    it('leaves numbers in Latin digits', () => {
      expect(formatWith('en').num(80)).toBe('80');
    });
  });

  describe('Nepali', () => {
    it('writes money with "रु" and Devanagari digits', () => {
      const { money, currency, isNepali } = formatWith('ne');
      expect(isNepali).toBe(true);
      expect(currency).toBe('रु');
      expect(money(480)).toBe('रु ४८०');
    });

    it('groups amounts in lakhs and crores', () => {
      expect(formatWith('ne').money(123456)).toBe('रु १,२३,४५६');
    });

    it('never contains "Rs"', () => {
      expect(formatWith('ne').money(80)).not.toContain('Rs');
    });

    it('converts plain numbers to Devanagari', () => {
      expect(formatWith('ne').num(80)).toBe('८०');
    });
  });

  describe('empty values', () => {
    it.each([null, undefined, '', 'abc'])('returns an empty string for %s, never a lone symbol', (value) => {
      expect(formatWith('en').money(value)).toBe('');
      expect(formatWith('ne').money(value)).toBe('');
    });

    it('still formats zero', () => {
      expect(formatWith('en').money(0)).toBe('Rs 0');
    });
  });
});
