import { describe, it, expect, afterEach } from 'vitest';
import i18n from './index';

describe('page language follows the language switch', () => {
  afterEach(async () => {
    await i18n.changeLanguage('ne');
  });

  it('marks the page as Nepali and as English as the switch changes', async () => {
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    await i18n.changeLanguage('ne');
    expect(document.documentElement.lang).toBe('ne');
  });

  it('treats any other language as English, so the Nepali fonts stay off', async () => {
    await i18n.changeLanguage('fr');
    expect(document.documentElement.lang).toBe('en');
  });
});
