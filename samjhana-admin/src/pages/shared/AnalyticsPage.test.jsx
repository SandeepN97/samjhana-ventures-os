import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsPage from './AnalyticsPage';
import { renderWithProviders } from '../../test/test-utils';

const mock = { transactions: [] };
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/transactions') return Promise.resolve({ data: mock.transactions });
      if (url === '/api/rental-properties') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: {} });
    }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const txn = (id, status) => ({
  id, status, amount: '100', transactionType: 'SALE', businessCode: 'petrol',
  transactionDate: new Date().toISOString(),
});

describe('AnalyticsPage pending button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.transactions = [];
  });

  it('opens the pending review page at /pending when the pending pill is tapped', async () => {
    mock.transactions = [txn(1, 'PENDING'), txn(2, 'PENDING'), txn(3, 'VERIFIED')];
    renderWithProviders(<AnalyticsPage />);
    const pill = await screen.findByRole('button', { name: /2 pending/ });
    await userEvent.click(pill);
    expect(mockNavigate).toHaveBeenCalledWith('/pending');
    expect(mockNavigate).not.toHaveBeenCalledWith('/pending-review');
  });

  it('shows the pending pill in Nepali', async () => {
    mock.transactions = [txn(1, 'PENDING')];
    renderWithProviders(<AnalyticsPage />, { locale: 'ne' });
    expect(await screen.findByRole('button', { name: /पेन्डिङ/ })).toBeInTheDocument();
  });

  it('hides the pending pill when nothing is waiting for review', async () => {
    mock.transactions = [txn(1, 'VERIFIED')];
    renderWithProviders(<AnalyticsPage />);
    await screen.findByText('Dashboard');
    expect(screen.queryByRole('button', { name: /pending/ })).not.toBeInTheDocument();
  });
});
