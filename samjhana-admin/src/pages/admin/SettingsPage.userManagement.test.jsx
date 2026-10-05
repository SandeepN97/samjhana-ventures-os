import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';
import { renderWithProviders, testI18n } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../utils/api';

const admin = { id: 1, username: 'admin', fullName: 'Boss', role: 'ADMIN' };
const people = [
  { id: 1, username: 'admin', fullName: 'Boss', role: 'ADMIN' },
  { id: 2, username: 'sita', fullName: 'Sita', role: 'STAFF' },
];

describe('SettingsPage user management (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(admin));
    api.get.mockImplementation((url) =>
      Promise.resolve({ data: url === '/api/admin/users' ? people : [] }));
  });

  it('does not clip the staff dropdown: the user card is not overflow-hidden', async () => {
    renderWithProviders(<SettingsPage />);
    const heading = await screen.findByText(testI18n.t('settings.userManagement'));
    expect(heading.closest('.rounded-xl').className).not.toContain('overflow-hidden');
  });

  it('offers no reset or role change on your own row', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Sita');
    expect(screen.getAllByRole('button', { name: testI18n.t('settings.resetPassword') })).toHaveLength(1);
    expect(screen.getAllByRole('combobox', { name: /Change role/ }).length).toBe(1);
  });

  it('asks first, then shows the temporary password once', async () => {
    api.post.mockResolvedValue({ data: { username: 'sita', temporaryPassword: 'Abcd2345Efgh6789' } });
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Sita');
    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.resetPassword') }));
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.resetPasswordYes') }));
    await waitFor(() => expect(screen.getByTestId('temporary-password')).toHaveTextContent('Abcd2345Efgh6789'));
    expect(api.post).toHaveBeenCalledWith('/api/admin/users/sita/reset-password', null, expect.anything());

    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.done') }));
    expect(screen.queryByTestId('temporary-password')).not.toBeInTheDocument();
  });

  it('does nothing when the admin keeps the old password', async () => {
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Sita');
    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.resetPassword') }));
    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.keep') }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the server message when the reset fails', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'User is not active' } } });
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Sita');
    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.resetPassword') }));
    await userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.resetPasswordYes') }));
    expect(await screen.findByText('User is not active')).toBeInTheDocument();
    expect(screen.queryByTestId('temporary-password')).not.toBeInTheDocument();
  });

  it('changes a role through the server', async () => {
    api.put.mockResolvedValue({ data: {} });
    renderWithProviders(<SettingsPage />);
    await screen.findByText('Sita');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Change role for Sita/ }), 'MANAGER');
    expect(api.put).toHaveBeenCalledWith('/api/admin/users/sita/role', { role: 'MANAGER' }, expect.anything());
  });

  it('shows the Nepali words', async () => {
    renderWithProviders(<SettingsPage />, { locale: 'ne' });
    await screen.findByText('Sita');
    expect(screen.getByRole('button', { name: 'पासवर्ड रिसेट' })).toBeInTheDocument();
  });
});
