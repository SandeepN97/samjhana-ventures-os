import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from './SettingsPage';
import { renderWithProviders, testI18n } from '../../test/test-utils';

const mock = { demoReset: true, resetFails: false };

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/admin/features') return Promise.resolve({ data: { demoReset: mock.demoReset } });
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn((url) => {
      if (url === '/api/admin/demo-reset') {
        return mock.resetFails ? Promise.reject(new Error('boom')) : Promise.resolve({ data: {} });
      }
      return Promise.resolve({ data: {} });
    }),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import api from '../../utils/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const admin = { username: 'admin', fullName: 'Admin', role: 'ADMIN' };

describe('SettingsPage demo reset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.demoReset = true;
    mock.resetFails = false;
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify(admin));
    localStorage.setItem('token', 'admin-token');
  });

  it('shows the reset button where the server offers it', async () => {
    renderWithProviders(<SettingsPage />);
    expect(await screen.findByText('Reset to Demo Data')).toBeInTheDocument();
  });

  it('hides the reset button where the server does not offer it (prod)', async () => {
    mock.demoReset = false;
    renderWithProviders(<SettingsPage />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/admin/features', expect.anything()));
    expect(screen.queryByText('Reset to Demo Data')).not.toBeInTheDocument();
  });

  it('hides the reset button for managers without asking the server', async () => {
    localStorage.setItem('user', JSON.stringify({ ...admin, role: 'MANAGER' }));
    renderWithProviders(<SettingsPage />);
    await screen.findAllByText(testI18n.t('settings.logout'));
    expect(api.get).not.toHaveBeenCalledWith('/api/admin/features', expect.anything());
    expect(screen.queryByText('Reset to Demo Data')).not.toBeInTheDocument();
  });

  it('resets without logging in as a demo account and keeps the current login', async () => {
    renderWithProviders(<SettingsPage />);
    await userEvent.click(await screen.findByText('Reset to Demo Data'));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, Reset' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/admin/demo-reset', null, expect.anything()));
    expect(api.post).not.toHaveBeenCalledWith('/api/auth/login', expect.anything(), expect.anything());
    expect(localStorage.getItem('token')).toBe('admin-token');
    expect(await screen.findByText('Demo data loaded.')).toBeInTheDocument();
  });

  it('shows an error when the reset fails', async () => {
    mock.resetFails = true;
    renderWithProviders(<SettingsPage />);
    await userEvent.click(await screen.findByText('Reset to Demo Data'));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, Reset' }));
    expect(await screen.findByText('Demo data reset failed')).toBeInTheDocument();
  });

  it('shows the reset section in Nepali', async () => {
    renderWithProviders(<SettingsPage />, { locale: 'ne' });
    expect(await screen.findByText('डेमो डाटामा रिसेट गर्नुहोस्')).toBeInTheDocument();
    expect(screen.getByText('डेमो / परीक्षण')).toBeInTheDocument();
  });
});
