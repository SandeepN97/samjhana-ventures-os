import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { renderWithProviders, testI18n } from '../../test/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../../utils/api', () => ({
  default: {
    post: vi.fn(),
  },
}));

import api from '../../utils/api';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form with username and password fields', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
  });

  it('password field has type="password" for security', () => {
    renderWithProviders(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('navigates to home on successful login', async () => {
    api.post.mockResolvedValue({
      data: { token: 'test-token', user: { role: 'ADMIN', username: 'admin' } },
    });

    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Enter password'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
    expect(localStorage.getItem('token')).toBe('test-token');
  });

  it('shows error on invalid credentials (401)', async () => {
    api.post.mockRejectedValue({ response: { status: 401 } });

    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'wrong');
    await userEvent.type(screen.getByPlaceholderText('Enter password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
  });

  it('shows generic error on non-401 failure', async () => {
    api.post.mockRejectedValue({ response: { status: 500 } });

    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Enter password'), 'admin');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('switches to change password form when link clicked', async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByText('Change Password'));
    expect(screen.getByText('Change Password', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Current password')).toBeInTheDocument();
  });

  it('validates passwords must match in change password form', async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByText('Change Password'));

    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Current password'), 'oldpass123');
    await userEvent.type(screen.getByPlaceholderText('New password'), 'newpass456');
    await userEvent.type(screen.getByPlaceholderText('Confirm password'), 'different789');

    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
    });
  });

  // /api/auth/change-password requires a JWT, but on this screen nobody is signed in yet. The page
  // proves who the user is by logging in with the current password first, and uses that token once.
  describe('change password from the login screen', () => {
    const LOGIN = '/api/auth/login';
    const CHANGE = '/api/auth/change-password';

    function serverAccepts() {
      api.post.mockImplementation(async (url) =>
        url === LOGIN
          ? { data: { token: 'token-from-login', user: { username: 'staff', role: 'STAFF' } } }
          : { data: { message: 'Password changed successfully' } }
      );
    }

    async function openChangeForm(options) {
      renderWithProviders(<LoginPage />, options);
      await userEvent.click(screen.getByText(testI18n.t('login.changePasswordLink')));
    }

    async function fillForm({ username = 'staff', current = 'oldpass123', next = 'newpass456', confirm = next } = {}) {
      await userEvent.type(screen.getByPlaceholderText(testI18n.t('login.usernamePlaceholder')), username);
      await userEvent.type(screen.getByPlaceholderText(testI18n.t('login.currentPasswordPlaceholder')), current);
      await userEvent.type(screen.getByPlaceholderText(testI18n.t('login.newPasswordPlaceholder')), next);
      await userEvent.type(screen.getByPlaceholderText(testI18n.t('login.confirmPlaceholder')), confirm);
    }

    const submit = () =>
      userEvent.click(screen.getByRole('button', { name: testI18n.t('login.changePasswordBtn') }));

    it('authenticates first, then changes the password with that token', async () => {
      serverAccepts();
      await openChangeForm();
      await fillForm();
      await submit();

      await waitFor(() => {
        expect(screen.getByText('Password changed successfully!')).toBeInTheDocument();
      });
      expect(api.post).toHaveBeenCalledTimes(2);
      expect(api.post).toHaveBeenNthCalledWith(
        1,
        LOGIN,
        { username: 'staff', password: 'oldpass123' },
        { skipAuthRedirect: true }
      );
      expect(api.post).toHaveBeenNthCalledWith(
        2,
        CHANGE,
        { currentPassword: 'oldpass123', newPassword: 'newpass456' },
        { skipAuthRedirect: true, headers: { Authorization: 'Bearer token-from-login' } }
      );
    });

    it('does not sign the user in: the token is used once and never stored', async () => {
      serverAccepts();
      await openChangeForm();
      await fillForm();
      await submit();

      await waitFor(() => {
        expect(screen.getByText('Password changed successfully!')).toBeInTheDocument();
      });
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('returns to the login form after a successful change', async () => {
      serverAccepts();
      await openChangeForm();
      await fillForm();
      await submit();

      expect(await screen.findByRole('button', { name: 'Login' }, { timeout: 3500 })).toBeInTheDocument();
    });

    it('reports wrong credentials and changes nothing when the current password is wrong', async () => {
      api.post.mockRejectedValue({ response: { status: 401 } });
      await openChangeForm();
      await fillForm({ current: 'not-my-password' });
      await submit();

      await waitFor(() => {
        expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
      });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post).toHaveBeenCalledWith(LOGIN, expect.anything(), { skipAuthRedirect: true });
    });

    it('shows the way the server refuses the change itself', async () => {
      api.post
        .mockResolvedValueOnce({ data: { token: 'token-from-login', user: {} } })
        .mockRejectedValueOnce({ response: { status: 400, data: { message: 'Current password is incorrect' } } });
      await openChangeForm();
      await fillForm();
      await submit();

      await waitFor(() => {
        expect(screen.getByText('Current password is incorrect')).toBeInTheDocument();
      });
    });

    it('refuses a new password shorter than 8 characters without calling the server', async () => {
      await openChangeForm();
      await fillForm({ next: '1234567' });
      await submit();

      await waitFor(() => {
        expect(screen.getByText('New password must be at least 8 characters')).toBeInTheDocument();
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('accepts a new password of exactly 8 characters', async () => {
      serverAccepts();
      await openChangeForm();
      await fillForm({ next: '12345678' });
      await submit();

      await waitFor(() => {
        expect(screen.getByText('Password changed successfully!')).toBeInTheDocument();
      });
    });

    it('states the 8-character rule in Nepali with a Devanagari numeral', async () => {
      await openChangeForm({ locale: 'ne' });
      await fillForm({ next: '1234567' });
      await submit();

      await waitFor(() => {
        expect(screen.getByText('नयाँ पासवर्ड कम्तिमा ८ अक्षर हुनुपर्छ')).toBeInTheDocument();
      });
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  it('can navigate back to login from change password form', async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByText('Change Password'));
    expect(screen.getByText('Back to Login')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Back to Login'));
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });

  it('passes skipAuthRedirect on the login call so a 401 does not reload the page', async () => {
    api.post.mockResolvedValue({
      data: { token: 'test-token', user: { role: 'ADMIN', username: 'admin' } },
    });

    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Enter password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/auth/login',
        { username: 'admin', password: 'secret123' },
        { skipAuthRedirect: true }
      );
    });
  });

  it('keeps the typed username and password after a 401 so the user can retry', async () => {
    api.post.mockRejectedValue({ response: { status: 401 } });

    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('Enter password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText('Enter username')).toHaveValue('admin');
    expect(screen.getByPlaceholderText('Enter password')).toHaveValue('wrong');
  });

  describe('show/hide password toggle', () => {
    it('hides the password by default with a "Show password" button', () => {
      renderWithProviders(<LoginPage />);
      expect(screen.getByPlaceholderText('Enter password')).toHaveAttribute('type', 'password');
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('reveals the typed password when the eye is clicked and hides it again on second click', async () => {
      renderWithProviders(<LoginPage />);
      const input = screen.getByPlaceholderText('Enter password');
      await userEvent.type(input, 'MySecret22');

      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveValue('MySecret22');
      const hideBtn = screen.getByRole('button', { name: 'Hide password' });
      expect(hideBtn).toHaveAttribute('aria-pressed', 'true');

      await userEvent.click(hideBtn);
      expect(input).toHaveAttribute('type', 'password');
      expect(input).toHaveValue('MySecret22');
      expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    });

    it('does not submit the form when the eye is clicked', async () => {
      renderWithProviders(<LoginPage />);
      await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
      await userEvent.type(screen.getByPlaceholderText('Enter password'), 'secret123');

      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));

      expect(api.post).not.toHaveBeenCalled();
    });

    it('meets the 44px minimum touch target', () => {
      renderWithProviders(<LoginPage />);
      const toggle = screen.getByRole('button', { name: 'Show password' });
      expect(toggle).toHaveClass('min-h-[44px]', 'min-w-[44px]');
    });

    it('still works after a failed login shows an error', async () => {
      api.post.mockRejectedValue({ response: { status: 401 } });

      renderWithProviders(<LoginPage />);
      await userEvent.type(screen.getByPlaceholderText('Enter username'), 'admin');
      await userEvent.type(screen.getByPlaceholderText('Enter password'), 'admin');
      await userEvent.click(screen.getByRole('button', { name: 'Login' }));
      await waitFor(() => {
        expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(screen.getByPlaceholderText('Enter password')).toHaveAttribute('type', 'text');
      expect(screen.getByPlaceholderText('Enter password')).toHaveValue('admin');
    });

    it('is hidden again after switching to change password and back', async () => {
      renderWithProviders(<LoginPage />);
      await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
      expect(screen.getByPlaceholderText('Enter password')).toHaveAttribute('type', 'text');

      await userEvent.click(screen.getByText('Change Password'));
      await userEvent.click(screen.getByText('Back to Login'));

      expect(screen.getByPlaceholderText('Enter password')).toHaveAttribute('type', 'password');
      expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
    });

    it('renders Nepali labels for the toggle', async () => {
      renderWithProviders(<LoginPage />, { locale: 'ne' });
      const showBtn = screen.getByRole('button', { name: 'पासवर्ड देखाउनुहोस्' });
      await userEvent.click(showBtn);
      expect(screen.getByRole('button', { name: 'पासवर्ड लुकाउनुहोस्' })).toBeInTheDocument();
    });
  });
});
