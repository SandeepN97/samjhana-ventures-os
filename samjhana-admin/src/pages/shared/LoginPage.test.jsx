import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { renderWithProviders } from '../../test/test-utils';

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
    await userEvent.type(screen.getByPlaceholderText('Current password'), 'oldpass');
    await userEvent.type(screen.getByPlaceholderText('New password'), 'newpass');
    await userEvent.type(screen.getByPlaceholderText('Confirm password'), 'different');

    await userEvent.click(screen.getByRole('button', { name: 'Change Password' }));

    await waitFor(() => {
      expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
    });
  });

  it('can navigate back to login from change password form', async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(screen.getByText('Change Password'));
    expect(screen.getByText('Back to Login')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Back to Login'));
    expect(screen.getByRole('button', { name: 'Login' })).toBeInTheDocument();
  });
});
