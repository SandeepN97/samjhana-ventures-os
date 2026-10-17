import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';
import { renderWithProviders, testI18n } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../utils/api';

const asUser = (role) => localStorage.setItem('user', JSON.stringify({ id: 1, username: 'u', fullName: 'Una', role }));

describe('SettingsPage sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockImplementation((url) => Promise.resolve({ data: url === '/api/admin/features' ? { demoReset: true } : [] }));
  });

  it('shows no section chooser to staff, who only have the general settings', () => {
    asUser('STAFF');
    renderWithProviders(<SettingsPage />);
    expect(screen.queryByRole('group', { name: 'Settings' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: testI18n.t('settings.userManagement') })).not.toBeInTheDocument();
  });

  it('gives an admin a swipe chooser, opening on General', async () => {
    asUser('ADMIN');
    renderWithProviders(<SettingsPage />);
    const chooser = screen.getByRole('group', { name: 'Settings' });
    expect(within(chooser).getByRole('button', { name: 'General' })).toHaveAttribute('aria-pressed', 'true');
    expect(await within(chooser).findByRole('button', { name: 'Demo / Testing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
  });

  it('shows one group at a time as the admin changes section', async () => {
    asUser('ADMIN');
    renderWithProviders(<SettingsPage />);
    const chooser = screen.getByRole('group', { name: 'Settings' });
    await userEvent.click(within(chooser).getByRole('button', { name: testI18n.t('settings.userManagement') }));
    expect(screen.getByRole('heading', { name: testI18n.t('settings.userManagement') })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Preferences' })).not.toBeInTheDocument();
    await userEvent.click(within(chooser).getByRole('button', { name: 'General' }));
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
  });

  it('labels the sections in Nepali', () => {
    asUser('ADMIN');
    renderWithProviders(<SettingsPage />, { locale: 'ne' });
    const chooser = screen.getByRole('group', { name: testI18n.t('settings.title', { lng: 'ne' }) });
    expect(within(chooser).getByRole('button', { name: 'सामान्य' })).toBeInTheDocument();
  });

  it('puts the English | Nepali switch on the Language row as well as in the header', () => {
    asUser('STAFF');
    renderWithProviders(<SettingsPage />);
    expect(screen.getAllByRole('group', { name: 'Choose language' })).toHaveLength(2);
  });
});
