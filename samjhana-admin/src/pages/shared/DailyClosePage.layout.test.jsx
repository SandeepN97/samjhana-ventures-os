import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyClosePage from './DailyClosePage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('business-date')) return Promise.resolve({ data: { date: '2026-10-18' } });
      if (url.includes('today-summary')) {
        return Promise.resolve({
          data: {
            isClosed: false,
            petrolSales: 13899, petrolLiters: 82,
            dieselSales: 13072, dieselLiters: 86,
            evSales: 3540, evUnits: 0,
            totalSystemSales: 30511, totalCashSales: 16159, totalBankSales: 14352,
            transactionCount: 7,
          },
        });
      }
      if (url.includes('/recent')) return Promise.resolve({ data: [{ reportDate: '2026-10-17', totalSystemSales: 79408.7 }] });
      if (url.includes('/transactions')) {
        return Promise.resolve({
          data: Array.from({ length: 7 }, (_, i) => ({
            id: i + 1, businessCode: 'petrol', businessName: 'Petrol pump', transactionType: 'SALE', amount: 1000 + i, enteredByName: `Clerk ${i + 1}`, createdAt: `2026-10-18T0${i + 1}:15:30`, customFields: JSON.stringify({ fuelType: 'Petrol', liters: 8, ratePerLiter: 150, paymentMethod: i % 2 ? 'BANK' : 'CASH' }),
          })),
        });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const setDesktop = (on) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: on, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
};

describe('End of Day, open day layout', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });
  afterEach(() => { delete window.matchMedia; });

  describe('on a phone', () => {
    it('uses a compact day switch instead of a full-width page header', async () => {
      renderWithProviders(<DailyClosePage />);
      const switcher = await screen.findByRole('group', { name: 'Reports' });
      expect(within(switcher).getByRole('button', { name: 'End of Day' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });

    it('leads with the dark total, then the businesses with their share', async () => {
      renderWithProviders(<DailyClosePage />);
      expect(await screen.findByText('Total Sales')).toBeInTheDocument();
      const list = screen.getByRole('heading', { name: 'Business Breakdown' }).closest('section');
      expect(within(list).getByText('रु 13,899')).toBeInTheDocument();
      expect(within(list).getByText(/82\.0 L · 45\.6%/)).toBeInTheDocument();
      expect(within(list).getByText(/0\.0 kWh · 11\.6%/)).toBeInTheDocument();
      expect(within(list).getByRole('img', { name: /Petrol 45\.6%, Diesel 42\.8%/ })).toBeInTheDocument();
    });

    it('keeps the transactions folded until they are asked for', async () => {
      renderWithProviders(<DailyClosePage />);
      const toggle = await screen.findByRole('button', { name: /Review Transactions/i });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(/Clerk 1/)).not.toBeInTheDocument();
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/Clerk 7/)).toBeInTheDocument();
    });

    it('puts the close button in a bar fixed to the bottom of the screen', async () => {
      renderWithProviders(<DailyClosePage />);
      const close = await screen.findByRole('button', { name: 'Close the day' });
      expect(close.closest('.fixed')).not.toBeNull();
      expect(close).toHaveClass('min-h-[56px]');
    });
  });

  describe('on a desktop', () => {
    beforeEach(() => setDesktop(true));

    it('places the date and day switch directly above the closing panel', async () => {
      renderWithProviders(<DailyClosePage />);
      const panel = (await screen.findByRole('heading', { name: 'Close the day' })).closest('section');
      const rail = panel.parentElement;
      expect(within(rail).getByRole('group', { name: 'Date' })).toHaveTextContent('Today');
      expect(within(rail).getByRole('group', { name: 'Date' })).toHaveTextContent('1 Kartik 2083');
      expect(within(rail).getByRole('group', { name: 'Reports' })).toBeInTheDocument();
      expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    });

    it('draws the sales as one panel with a share bar and a ruled table', async () => {
      renderWithProviders(<DailyClosePage />);
      const panel = (await screen.findByRole('heading', { name: 'Total Sales' })).closest('section');
      ['Business', 'Quantity', 'Amount', 'Share'].forEach((name) => {
        expect(within(panel).getByRole('columnheader', { name })).toBeInTheDocument();
      });
      const petrol = within(panel).getByRole('row', { name: /Petrol/ });
      expect(within(petrol).getByText('82.0 L')).toBeInTheDocument();
      expect(within(petrol).getByText('रु 13,899')).toBeInTheDocument();
      expect(within(petrol).getByText('45.6%')).toBeInTheDocument();
      expect(within(panel).getByText('रु 16,159')).toBeInTheDocument();
      expect(within(panel).getByText('रु 14,352')).toBeInTheDocument();
    });

    it('shows five transactions and expands to all of them', async () => {
      renderWithProviders(<DailyClosePage />);
      await screen.findByText(/Clerk 1/);
      expect(screen.getByText(/Clerk 5/)).toBeInTheDocument();
      expect(screen.queryByText(/Clerk 6/)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Show all 7 transactions' }));
      expect(screen.getByText(/Clerk 7/)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
      expect(screen.queryByText(/Clerk 6/)).not.toBeInTheDocument();
    });

    it('keeps counting, the result and the close button together in one panel', async () => {
      renderWithProviders(<DailyClosePage />);
      const panel = (await screen.findByRole('heading', { name: 'Close the day' })).closest('section');
      await userEvent.type(within(panel).getByLabelText('Count Your Cash'), '15500');
      expect(within(panel).getByRole('status')).toHaveTextContent('SHORT');
      expect(within(panel).getByRole('status')).toHaveTextContent('−रु 659');
      expect(within(panel).getByLabelText(/Reason for Short/i)).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: 'Close the day' })).toBeEnabled();
      expect(within(panel).getByText(/Closes 2026-10-18 · 7 transactions/)).toBeInTheDocument();
    });

    it('shows an over count and a matching count in their own words', async () => {
      renderWithProviders(<DailyClosePage />);
      const input = await screen.findByLabelText('Count Your Cash');
      await userEvent.type(input, '16200');
      expect(screen.getByRole('status')).toHaveTextContent('+रु 41');
      await userEvent.clear(input);
      await userEvent.type(input, '16159');
      expect(screen.getByRole('status')).toHaveTextContent('Cash matches');
    });
  });

  it('groups the Nepali and English dates into a readable day card', async () => {
    renderWithProviders(<DailyClosePage />);
    const date = await screen.findByRole('group', { name: 'Date' });
    expect(within(date).getByText('Today')).toBeInTheDocument();
    expect(within(date).getByText('1 Kartik 2083')).toBeInTheDocument();
    expect(within(date).getByText('2026-10-18')).toHaveAttribute('datetime', '2026-10-18');
  });

  it('shows each review row on one line: time, what it was, who entered it, payment tag, amount', async () => {
    setDesktop(true);
    renderWithProviders(<DailyClosePage />);
    const first = (await screen.findByText(/Clerk 1/)).closest('li');
    expect(within(first).getByText('01:15')).toBeInTheDocument();
    expect(within(first).getByText(/Petrol — 8\.00L @ रु150\.00/)).toBeInTheDocument();
    expect(within(first).getByText('Cash')).toBeInTheDocument();
    expect(within(first).getByText('+रु 1,000')).toBeInTheDocument();
    expect(within(first).getByRole('button', { name: 'Edit Transaction' })).toHaveClass('h-11');
    const second = screen.getByText(/Clerk 2/).closest('li');
    expect(within(second).getByText('Bank')).toBeInTheDocument();
  });

  it('gives staff the review rows without an edit button', async () => {
    setDesktop(true);
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 's' }));
    renderWithProviders(<DailyClosePage />);
    await screen.findByText(/Clerk 1/);
    expect(screen.queryByRole('button', { name: 'Edit Transaction' })).not.toBeInTheDocument();
  });

  it('writes the close button and its summary in Nepali', async () => {
    renderWithProviders(<DailyClosePage />, { locale: 'ne' });
    const close = await screen.findByRole('button', { name: 'दिन बन्द गर्नुहोस्' });
    expect(close).toBeDisabled();
    await userEvent.type(screen.getByRole('spinbutton'), '1000');
    expect(screen.getByText(/बन्द हुँदै · ७ कारोबार/)).toBeInTheDocument();
  });
});
