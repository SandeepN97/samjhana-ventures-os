import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders, testI18n as i18n } from '../test/test-utils';
import LanguageToggle from './LanguageToggle';

describe('LanguageToggle', () => {
  beforeEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('en');
  });

  it('shows both languages in a labelled group and marks the current one', () => {
    renderWithProviders(<LanguageToggle />);
    expect(screen.getByRole('group', { name: 'Choose language' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'नेपाली' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches to Nepali and back, and remembers the choice', async () => {
    renderWithProviders(<LanguageToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'नेपाली' }));
    expect(i18n.language).toBe('ne');
    expect(localStorage.getItem('preferredLanguage')).toBe('ne');
    expect(screen.getByRole('group', { name: 'भाषा छान्नुहोस्' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'नेपाली' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(i18n.language).toBe('en');
    expect(localStorage.getItem('preferredLanguage')).toBe('en');
  });

  it('keeps choosing the language that is already selected harmless', async () => {
    renderWithProviders(<LanguageToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(i18n.language).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps both sides 44px tall and falls back to the dark style for an unknown tone', () => {
    renderWithProviders(<LanguageToggle tone="nonsense" />);
    screen.getAllByRole('button').forEach((side) => expect(side.className).toContain('min-h-[44px]'));
    expect(screen.getByRole('button', { name: 'English' }).className).toContain('bg-white');
  });
});
