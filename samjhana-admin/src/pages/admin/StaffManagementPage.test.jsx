import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffManagementPage from './StaffManagementPage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import api from '../../utils/api';

const people = [
  { id: 1, fullName: 'Sita Rai', fullNameNepali: 'सीता राई', businessUnit: 'PETROL', staffRole: 'OPERATOR', phoneNumber: '9800000001' },
  { id: 2, fullName: 'Ram Thapa', businessUnit: 'FURNITURE', staffRole: 'MANAGER', phoneNumber: '9800000002' },
];

describe('StaffManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ id: 9, username: 'admin', role: 'ADMIN' }));
    api.get.mockResolvedValue({ data: people });
  });

  it('keeps everyone but admins out, with a message', () => {
    localStorage.setItem('user', JSON.stringify({ id: 9, username: 'm', role: 'MANAGER' }));
    renderWithProviders(<StaffManagementPage />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('lists the staff in cards with a letter avatar', async () => {
    renderWithProviders(<StaffManagementPage />);
    expect(await screen.findByRole('heading', { name: 'Sita Rai' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ram Thapa' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/staff');
  });

  it('filters by business with a swipe chip row, and starts on all staff', async () => {
    renderWithProviders(<StaffManagementPage />);
    await screen.findByRole('heading', { name: 'Sita Rai' });
    const chips = screen.getByRole('group', { name: 'Business' });
    expect(within(chips).getByRole('button', { name: 'All staff' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(chips).getByRole('button', { name: 'Furniture' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/staff?businessUnit=FURNITURE'));
    expect(within(chips).getByRole('button', { name: 'Furniture' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(within(chips).getByRole('button', { name: 'All staff' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/staff'));
  });

  it('searches by name', async () => {
    renderWithProviders(<StaffManagementPage />);
    await screen.findByRole('heading', { name: 'Sita Rai' });
    await userEvent.type(screen.getByLabelText('Search name or phone...'), 'ram');
    expect(screen.queryByRole('heading', { name: 'Sita Rai' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ram Thapa' })).toBeInTheDocument();
  });

  it('gives each person 44px edit and remove buttons that name them', async () => {
    renderWithProviders(<StaffManagementPage />);
    await screen.findByRole('heading', { name: 'Sita Rai' });
    ['Edit: Sita Rai', 'Delete: Sita Rai'].forEach((name) => {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveClass('h-11');
      expect(button).toHaveClass('w-11');
    });
  });

  it('opens the add form from the panel and closes it with a 44px button', async () => {
    renderWithProviders(<StaffManagementPage />);
    await screen.findByRole('heading', { name: 'Sita Rai' });
    await userEvent.click(screen.getByRole('button', { name: 'Add Staff' }));
    expect(screen.getByRole('heading', { name: 'Add New Staff' })).toBeInTheDocument();
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close).toHaveClass('h-11');
    await userEvent.click(close);
    expect(screen.queryByRole('heading', { name: 'Add New Staff' })).not.toBeInTheDocument();
  });

  it('shows the empty state when nobody matches', async () => {
    api.get.mockResolvedValue({ data: [] });
    renderWithProviders(<StaffManagementPage />);
    expect(await screen.findByText('No staff found')).toBeInTheDocument();
  });

  it('writes the filter chips in Nepali', async () => {
    renderWithProviders(<StaffManagementPage />, { locale: 'ne' });
    const chips = await screen.findByRole('group', { name: 'व्यवसाय' });
    expect(within(chips).getByRole('button', { name: 'सबै कर्मचारी' })).toBeInTheDocument();
    expect(within(chips).getByRole('button', { name: 'फर्निचर' })).toBeInTheDocument();
  });
});
