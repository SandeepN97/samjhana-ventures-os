import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChangePasswordRequiredPage from './ChangePasswordRequiredPage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({ default: { post: vi.fn() } }));
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import api from '../../utils/api';

const fill = async (temp, next, again) => {
  const boxes = document.querySelectorAll('input');
  await userEvent.type(boxes[0], temp);
  await userEvent.type(boxes[1], next);
  await userEvent.type(boxes[2], again);
  await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
};

describe('ChangePasswordRequiredPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'old');
    localStorage.setItem('user', JSON.stringify({ username: 'sita', role: 'STAFF', mustChangePassword: true }));
  });

  it('refuses a short password without calling the server', async () => {
    renderWithProviders(<ChangePasswordRequiredPage />);
    await fill('Temp1234', 'short', 'short');
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('refuses when the two new passwords differ', async () => {
    renderWithProviders(<ChangePasswordRequiredPage />);
    await fill('Temp1234', 'newpass-123', 'newpass-124');
    expect(screen.getByRole('alert')).toHaveTextContent('do not match');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('refuses reusing the temporary password', async () => {
    renderWithProviders(<ChangePasswordRequiredPage />);
    await fill('Temp12345', 'Temp12345', 'Temp12345');
    expect(screen.getByRole('alert')).toHaveTextContent('different password');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('saves, stores the new token, clears the flag and goes home', async () => {
    api.post.mockResolvedValue({ data: { token: 'fresh' } });
    renderWithProviders(<ChangePasswordRequiredPage />);
    await fill('Temp1234', 'newpass-123', 'newpass-123');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(localStorage.getItem('token')).toBe('fresh');
    expect(JSON.parse(localStorage.getItem('user')).mustChangePassword).toBe(false);
  });

  it('shows the server message on a wrong temporary password', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Current password is incorrect' } } });
    renderWithProviders(<ChangePasswordRequiredPage />);
    await fill('wrong-temp', 'newpass-123', 'newpass-123');
    expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows Nepali text', () => {
    renderWithProviders(<ChangePasswordRequiredPage />, { locale: 'ne' });
    expect(screen.getByText('नयाँ पासवर्ड रोज्नुहोस्')).toBeInTheDocument();
  });
});
