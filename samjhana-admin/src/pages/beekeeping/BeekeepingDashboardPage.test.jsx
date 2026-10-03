import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeekeepingDashboardPage from './BeekeepingDashboardPage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({ default: { get: vi.fn() } }));

const dashboard = {
  totalItems: 26,
  totalStockValue: 150000,
  lowStockCount: 1,
  lowStockItems: [{ id: 'p1', name: 'Wild Honey', stockQty: 1 }],
  todaySalesCount: 2,
  todayRevenue: 12500,
  recentOrders: [{ id: 'o1', customerName: 'Hari', transactionDate: '2026-10-03', amount: 1700 }],
};

describe('BeekeepingDashboardPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows stock value, today\'s sales, low stock and recent sales', async () => {
    api.get.mockResolvedValue({ data: dashboard });
    renderWithProviders(<BeekeepingDashboardPage />);

    expect(await screen.findByText('Rs 1,50,000')).toBeInTheDocument();
    expect(screen.getByText('Rs 12,500')).toBeInTheDocument();
    expect(screen.getByText('Beekeeping Shop')).toBeInTheDocument();
    expect(screen.getByText('Wild Honey')).toBeInTheDocument();
    expect(screen.getByText('Hari')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/beekeeping/dashboard');
  });

  it('shows a walk-in label and an empty state when there are no sales', async () => {
    api.get.mockResolvedValue({ data: { ...dashboard, lowStockItems: [], lowStockCount: 0, recentOrders: [] } });
    renderWithProviders(<BeekeepingDashboardPage />);
    expect(await screen.findByText('No sales yet')).toBeInTheDocument();
    expect(screen.queryByText('Low Stock Alert')).not.toBeInTheDocument();
  });

  it('shows Nepali labels with Devanagari numerals and Lakhs grouping', async () => {
    api.get.mockResolvedValue({ data: dashboard });
    renderWithProviders(<BeekeepingDashboardPage />, { locale: 'ne' });

    expect(await screen.findByText('मौरीपालन पसल')).toBeInTheDocument();
    expect(screen.getByText('रु १,५०,०००')).toBeInTheDocument();
    expect(screen.getByText('आजको बिक्री')).toBeInTheDocument();
  });

  it('shows an error with a retry button when the dashboard cannot load, and recovers', async () => {
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: dashboard });
    renderWithProviders(<BeekeepingDashboardPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the dashboard');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Rs 1,50,000')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps every action at least 44px tall', async () => {
    api.get.mockResolvedValue({ data: dashboard });
    renderWithProviders(<BeekeepingDashboardPage />);
    await screen.findByText('Rs 1,50,000');
    for (const name of ['New Sale', 'Inventory', 'Sales History']) {
      expect(screen.getByRole('button', { name })).toHaveClass('min-h-[44px]');
    }
  });
});
