import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalyticsPage from './AnalyticsPage';
import { renderWithProviders } from '../../test/test-utils';
import { nepalTodayDate, toDateStr } from '../../utils/businessDay';

const mock = { transactions: [], summary: {} };
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/transactions') return Promise.resolve({ data: mock.transactions });
      if (url.startsWith('/api/analytics/summary')) return Promise.resolve({ data: mock.summary });
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

const setDesktop = (on) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: on,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

describe('AnalyticsPage pending button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mock.transactions = [];
    mock.summary = {};
  });

  afterEach(() => delete window.matchMedia);

  it('does not repeat the summary title or language switch beside the desktop sidebar', async () => {
    setDesktop(true);
    renderWithProviders(<AnalyticsPage />);

    expect(await screen.findByRole('heading', { name: 'Business Summary' })).toHaveClass('sr-only');
    expect(screen.queryByRole('group', { name: 'Choose language' })).not.toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it('groups the period controls into the same card treatment as the dashboard', async () => {
    setDesktop(true);
    renderWithProviders(<AnalyticsPage />);

    const panel = await screen.findByRole('region', { name: 'Time period' });
    expect(panel).toHaveClass('rounded-2xl', 'bg-white', 'shadow-sm', 'ring-1');
    ['Today', 'Week', 'Month', 'Prev', 'Next'].forEach((name) => {
      expect(within(panel).getByRole('button', { name: new RegExp(name) })).toBeInTheDocument();
    });
  });

  it('opens the pending review page at /pending when the pending pill is tapped', async () => {
    mock.transactions = [txn(1, 'PENDING_REVIEW'), txn(2, 'PENDING_REVIEW'), txn(3, 'APPROVED')];
    renderWithProviders(<AnalyticsPage />);
    const pill = await screen.findByRole('button', { name: /2 pending/ });
    await userEvent.click(pill);
    expect(mockNavigate).toHaveBeenCalledWith('/pending');
    expect(mockNavigate).not.toHaveBeenCalledWith('/pending-review');
  });

  it('shows the pending pill in Nepali', async () => {
    mock.transactions = [txn(1, 'PENDING_REVIEW')];
    renderWithProviders(<AnalyticsPage />, { locale: 'ne' });
    expect(await screen.findByRole('button', { name: /पेन्डिङ/ })).toBeInTheDocument();
  });

  it('hides the pending pill when nothing is waiting for review', async () => {
    mock.transactions = [txn(1, 'APPROVED')];
    renderWithProviders(<AnalyticsPage />);
    await screen.findByText('Business Summary');
    expect(screen.queryByRole('button', { name: /pending/ })).not.toBeInTheDocument();
  });

  it('explains the main numbers in plain language', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
    renderWithProviders(<AnalyticsPage />);
    expect(await screen.findByText('Money in')).toBeInTheDocument();
    expect(screen.getByText('Money out')).toBeInTheDocument();
    expect(screen.getByText('Gross profit')).toBeInTheDocument();
    expect(screen.getByText('Sales minus known direct costs')).toBeInTheDocument();
    expect(screen.getByText('Where did the money come from?')).toBeInTheDocument();
    expect(screen.queryByText('More useful details')).not.toBeInTheDocument();
  });

  it('shows the revenue trend and ranks the businesses that earned the money', async () => {
    const today = toDateStr(nepalTodayDate());
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
    mock.transactions = [
      { ...txn(1, 'APPROVED'), transactionDate: today, amount: '20000', businessCode: 'petrol' },
      { ...txn(2, 'APPROVED'), transactionDate: today, amount: '16000', transactionType: 'PAYMENT', businessCode: 'ev' },
    ];
    mock.summary = {
      totalRevenue: 36000,
      totalExpenses: 10000,
      totalProfit: 26000,
      transactionCount: 2,
      businesses: {
        petrol: { revenue: 20000, profit: 12000 },
        ev: { revenue: 16000, profit: 14000 },
        rental: { revenue: 0, profit: 0 },
      },
    };

    renderWithProviders(<AnalyticsPage />);

    expect(await screen.findByText('Revenue · 7 days')).toBeInTheDocument();
    expect(screen.getByText('Where did the money come from?')).toBeInTheDocument();
    expect(screen.getByText('Petrol Pump')).toBeInTheDocument();
    expect(screen.getByText('EV')).toBeInTheDocument();
    expect(screen.queryByText('Rental')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /रु 36,000/ })).toBeInTheDocument();
    expect(screen.getByText('रु 26,000')).toBeInTheDocument();
  });

  it('translates the key analytics story into Nepali', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
    renderWithProviders(<AnalyticsPage />, { locale: 'ne' });
    expect(await screen.findByText('भित्र आएको पैसा')).toBeInTheDocument();
    expect(screen.getByText('कुल नाफा')).toBeInTheDocument();
    expect(screen.getByText('आम्दानी · ७ दिन')).toBeInTheDocument();
    expect(screen.getByText('पैसा कहाँबाट आयो?')).toBeInTheDocument();
  });
});
