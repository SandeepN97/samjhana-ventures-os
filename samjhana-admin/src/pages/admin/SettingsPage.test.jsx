import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';
import { renderWithProviders, testI18n } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../utils/api';

const staffUser = { username: 'staff', fullName: 'Staff Member', role: 'STAFF' };

// The server (AuthController) rejects a new password shorter than 8 characters, so the screen must
// say so up front instead of accepting 3+ characters and letting the server refuse it.
describe('SettingsPage change password', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(staffUser));
  });

  async function openChangePassword(options) {
    renderWithProviders(<SettingsPage />, options);
    await userEvent.click(screen.getByText(testI18n.t('settings.changePassword')));
  }

  async function fill({ current = 'old-pass-123', next, confirm = next }) {
    const [currentInput, newInput, confirmInput] = screen.getAllByPlaceholderText('••••••');
    await userEvent.type(currentInput, current);
    await userEvent.type(newInput, next);
    await userEvent.type(confirmInput, confirm);
  }

  const submit = () =>
    userEvent.click(screen.getByRole('button', { name: testI18n.t('settings.changePasswordBtn') }));

  it('refuses a 7-character new password and does not call the server', async () => {
    await openChangePassword();
    await fill({ next: '1234567' });
    await submit();

    await waitFor(() => {
      expect(screen.getByText('New password must be at least 8 characters')).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('no longer accepts the old 3-character minimum', async () => {
    await openChangePassword();
    await fill({ next: 'abc' });
    await submit();

    await waitFor(() => {
      expect(screen.getByText('New password must be at least 8 characters')).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends the change when the new password is exactly 8 characters', async () => {
    api.post.mockResolvedValue({ data: { message: 'Password changed successfully' } });
    await openChangePassword();
    await fill({ next: '12345678' });
    await submit();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/auth/change-password', {
        username: 'staff',
        currentPassword: 'old-pass-123',
        newPassword: '12345678',
      });
    });
    expect(await screen.findByText('Password changed successfully!')).toBeInTheDocument();
  });

  it('states the 8-character rule in Nepali with a Devanagari numeral', async () => {
    await openChangePassword({ locale: 'ne' });
    await fill({ next: '1234567' });
    await submit();

    await waitFor(() => {
      expect(screen.getByText('नयाँ पासवर्ड कम्तिमा ८ अक्षर हुनुपर्छ')).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });
});
