import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyClosePage from './DailyClosePage';
import { renderWithProviders } from '../../test/test-utils';

const BUSINESS_DATE = '2026-03-19';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/api/daily-reports/business-date')) {
        return Promise.resolve({ data: { date: BUSINESS_DATE } });
      }
      if (url.includes('/api/daily-reports/today-summary')) {
        return Promise.resolve({
          data: {
            isClosed: false,
            totalSystemSales: 5000,
            totalCashSales: 3000,
            totalBankSales: 2000,
            transactionCount: 10,
          },
        });
      }
      if (url.includes('/api/daily-reports/recent')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/transactions')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('DailyClosePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders End of Day title after loading', async () => {
    renderWithProviders(<DailyClosePage />);
    await waitFor(() => {
      expect(screen.getAllByText('End of Day').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows Total Sales section after loading', async () => {
    renderWithProviders(<DailyClosePage />);
    await waitFor(() => {
      expect(screen.getByText('Total Sales')).toBeInTheDocument();
    });
  });

  it('shows End of Day and Reports tabs', async () => {
    renderWithProviders(<DailyClosePage />);
    await waitFor(() => {
      expect(screen.getAllByText('End of Day').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument();
    });
  });

  it('switches to Reports tab and shows Income/Expense', async () => {
    renderWithProviders(<DailyClosePage />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Reports' }));
    expect(screen.getByText('Income')).toBeInTheDocument();
    expect(screen.getByText('Expense')).toBeInTheDocument();
  });

  it('shows Count Your Cash section', async () => {
    renderWithProviders(<DailyClosePage />);
    await waitFor(() => {
      expect(screen.getByText('Count Your Cash')).toBeInTheDocument();
    });
  });

  it('shows transaction count from summary', async () => {
    renderWithProviders(<DailyClosePage />);
    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('shows Day Closed title when day is already closed', async () => {
    const { default: api } = await import('../utils/api');
    api.get.mockImplementation((url) => {
      if (url.includes('/api/daily-reports/business-date')) {
        return Promise.resolve({ data: { date: BUSINESS_DATE } });
      }
      if (url.includes('/api/daily-reports/today-summary')) {
        return Promise.resolve({
          data: {
            isClosed: true,
            closedReport: { closedBy: 'admin', notes: null, totalSystemSales: 5000 },
            totalSystemSales: 5000,
            totalCashSales: 3000,
            totalBankSales: 2000,
            transactionCount: 10,
          },
        });
      }
      if (url.includes('/api/daily-reports/recent')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/transactions')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithProviders(<DailyClosePage />);
    await waitFor(() => {
      expect(screen.getByText('Day Closed')).toBeInTheDocument();
    });
  });
});
