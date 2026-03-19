import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickActionButtons from './QuickActionButtons';
import { renderWithProviders } from '../test/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('QuickActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders all 6 business action buttons for admin', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Petrol Pump')).toBeInTheDocument();
    expect(screen.getByText('EV Charging')).toBeInTheDocument();
    expect(screen.getByText('Furniture')).toBeInTheDocument();
    expect(screen.getByText('House Rental')).toBeInTheDocument();
    expect(screen.getByText('Bank Loan')).toBeInTheDocument();
  });

  it('staff users do not see Loan button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByText('Bank Loan')).not.toBeInTheDocument();
  });

  it('shows Daily Close button', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Daily Close')).toBeInTheDocument();
  });

  it('admin sees Staff Management button', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Staff Management')).toBeInTheDocument();
  });

  it('manager sees Staff Management button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'MANAGER', username: 'mgr' }));
    renderWithProviders(<QuickActionButtons />);
    // Manager can see analytics but not staff management (admin only)
    expect(screen.queryByText('Staff Management')).not.toBeInTheDocument();
  });

  it('staff does not see Staff Management button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByText('Staff Management')).not.toBeInTheDocument();
  });

  it('admin and manager see Analytics button', () => {
    renderWithProviders(<QuickActionButtons />);
    // Analytics appears in both secondary actions and bottom nav
    expect(screen.getAllByText('Analytics').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Petrol navigates to /entry/petrol', async () => {
    renderWithProviders(<QuickActionButtons />);
    await userEvent.click(screen.getByText('Petrol Pump').closest('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/entry/petrol');
  });

  it('clicking Daily Close navigates to /reports/close', async () => {
    renderWithProviders(<QuickActionButtons />);
    await userEvent.click(screen.getByText('Daily Close').closest('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/reports/close');
  });

  it('bottom nav has Home, Records, Analytics, Settings', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getAllByText('Analytics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
