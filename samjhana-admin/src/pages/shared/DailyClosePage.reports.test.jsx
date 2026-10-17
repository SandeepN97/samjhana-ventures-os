import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyClosePage from './DailyClosePage';
import { renderWithProviders } from '../../test/test-utils';

const sale = (id, businessCode, amount, customFields) => ({
  id, businessCode, businessName: businessCode, transactionType: 'SALE', amount, enteredByName: 'Una', createdAt: `2026-10-18T0${id}:00:00`, customFields: JSON.stringify(customFields),
});

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('business-date')) return Promise.resolve({ data: { date: '2026-10-18' } });
      if (url.includes('today-summary')) return Promise.resolve({ data: { isClosed: false, totalSystemSales: 5500, totalCashSales: 2500, totalBankSales: 3000, transactionCount: 4 } });
      if (url.includes('/recent')) return Promise.resolve({ data: [] });
      if (url.includes('/transactions')) {
        return Promise.resolve({
          data: [
            sale(1, 'petrol', 1500, { fuelType: 'Petrol', liters: 10, ratePerLiter: 150, purchaseRate: 140, paymentMethod: 'CASH' }),
            sale(2, 'petrol', 3000, { fuelType: 'Diesel', liters: 20, ratePerLiter: 150, purchaseRate: 140, paymentMethod: 'BANK' }),
            sale(3, 'ev', 1000, { unitsCharged: 5, profit: 300, paymentMethod: 'CASH' }),
            { id: 4, businessCode: 'petrol', businessName: 'Petrol Pump', transactionType: 'PURCHASE', amount: 2000, enteredByName: 'Ram', createdAt: '2026-10-18T04:00:00', customFields: null },
          ],
        });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const setDesktop = (on) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: on, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
};

const openReports = async (options) => {
  renderWithProviders(<DailyClosePage />, options);
  await userEvent.click(await screen.findByRole('button', { name: /Reports|रिपोर्ट/ }));
};

describe('End of Day, Reports tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });
  afterEach(() => { delete window.matchMedia; });

  it("shows the day's result: net, count, income, expense, cash and bank", async () => {
    await openReports();
    const result = (await screen.findByRole('heading', { name: 'Net Amount' })).closest('section');
    expect(within(result).getByText('+रु 3,500')).toBeInTheDocument();
    expect(within(result).getByText('4')).toBeInTheDocument();
    expect(within(result).getByText('रु 5,500')).toBeInTheDocument();
    expect(within(result).getByText('रु 2,000')).toBeInTheDocument();
    expect(within(result).getByText('रु 2,500')).toBeInTheDocument();
    expect(within(result).getByText('रु 3,000')).toBeInTheDocument();
  });

  it('shows a loss in a readable red on the dark panel', async () => {
    const api = (await import('../../utils/api')).default;
    const original = api.get.getMockImplementation();
    try {
      api.get.mockImplementation((url) => (url.includes('/transactions')
        ? Promise.resolve({ data: [{ id: 9, businessCode: 'petrol', businessName: 'Petrol Pump', transactionType: 'PURCHASE', amount: 800, enteredByName: 'Ram', customFields: null }] })
        : original(url)));
      await openReports();
      const result = (await screen.findByRole('heading', { name: 'Net Amount' })).closest('section');
      expect(within(result).getByText('−रु 800')).toHaveClass('text-red-300');
    } finally {
      api.get.mockImplementation(original);
    }
  });

  it('lists every transaction with its payment and a signed amount', async () => {
    await openReports();
    const ledger = (await screen.findByRole('heading', { name: /Today.s Transactions/i })).closest('section');
    const rows = within(ledger).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    // Sales come first, newest first; the expense comes last
    expect(within(rows[0]).getByText('03:00')).toBeInTheDocument();
    expect(within(rows[0]).getByText('+रु 1,000')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Cash')).toBeInTheDocument();
    expect(within(rows[1]).getByText('+रु 3,000')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Bank')).toBeInTheDocument();
    expect(within(rows[2]).getByText('+रु 1,500')).toBeInTheDocument();
    expect(within(rows[3]).getByText(/By: Ram/)).toBeInTheDocument();
    expect(within(rows[3]).getByText('Purchase')).toBeInTheDocument();
    const expense = within(ledger).getByText('−रु 2,000');
    expect(expense).toHaveClass('text-red-700');
  });

  it('opens a business in Records from its breakdown row, with a 44px target', async () => {
    await openReports();
    const biz = (await screen.findByRole('heading', { name: 'Business Breakdown' })).closest('section');
    const petrol = within(biz).getByRole('button', { name: /Petrol Pump/ });
    expect(petrol).toHaveClass('min-h-[56px]');
    await userEvent.click(petrol);
    expect(mockNavigate).toHaveBeenCalledWith('/records', { state: { filter: 'petrol' } });
  });

  it('shows profit to admins and managers, with the combined total', async () => {
    await openReports();
    const profit = (await screen.findByRole('heading', { name: 'Profit Summary' })).closest('section');
    // The combined profit is shown in the header and again in the total row
    expect(within(profit).getAllByText('+रु 600')).toHaveLength(2);
  });

  it('keeps profit away from staff', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 's' }));
    await openReports();
    await screen.findByRole('heading', { name: 'Net Amount' });
    expect(screen.queryByRole('heading', { name: 'Profit Summary' })).not.toBeInTheDocument();
  });

  it('puts the result and businesses in a column beside the ledger on a desktop', async () => {
    setDesktop(true);
    await openReports();
    const result = (await screen.findByRole('heading', { name: 'Net Amount' })).closest('div[class*="lg:col-start-2"]');
    expect(result).not.toBeNull();
    expect(result.className).toContain('lg:sticky');
    const ledger = screen.getByRole('heading', { name: /Today.s Transactions/i }).closest('section');
    expect(ledger.className).toContain('lg:col-start-1');
  });

  it('filters the ledger with chips and keeps the totals in step with what is shown', async () => {
    await openReports();
    const ledger = (await screen.findByRole('heading', { name: /Today.s Transactions/i })).closest('section');
    const chips = within(ledger).getByRole('group', { name: 'Filter transactions' });
    expect(within(chips).getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(chips).getByRole('button', { name: /Purchase/ }));
    expect(within(ledger).getAllByRole('listitem')).toHaveLength(1);
    expect(within(ledger).getByText('Net Amount').parentElement).toHaveTextContent('−रु 2,000');

    await userEvent.click(within(chips).getByRole('button', { name: /Cash/ }));
    expect(within(ledger).getAllByRole('listitem')).toHaveLength(2);
    expect(within(ledger).getByText('Net Amount').parentElement).toHaveTextContent('+रु 2,500');

    await userEvent.click(within(chips).getByRole('button', { name: /Bank/ }));
    expect(within(ledger).getAllByRole('listitem')).toHaveLength(1);

    await userEvent.click(within(chips).getByRole('button', { name: /All/ }));
    expect(within(ledger).getAllByRole('listitem')).toHaveLength(4);
    expect(within(ledger).getByText('Net Amount').parentElement).toHaveTextContent('+रु 3,500');
  });

  it('shows the cash and bank split under the result', async () => {
    await openReports();
    const result = (await screen.findByRole('heading', { name: 'Net Amount' })).closest('section');
    expect(within(result).getByRole('img', { name: /Cash 45%, Bank 55%/ })).toBeInTheDocument();
  });

  it('shows each business share of income, a plain count, and where a tap goes', async () => {
    await openReports();
    const biz = (await screen.findByRole('heading', { name: 'Business Breakdown' })).closest('section');
    expect(within(biz).getByText('Tap to open in Records')).toBeInTheDocument();
    expect(within(biz).getByText(/1 transaction · 18% of income/)).toBeInTheDocument();
    expect(within(biz).getByText(/3 transactions · 82% of income/)).toBeInTheDocument();
  });

  it('names the sales in the profit rows with a plain count', async () => {
    await openReports();
    const profit = (await screen.findByRole('heading', { name: 'Profit Summary' })).closest('section');
    expect(within(profit).getAllByText(/1 sale ·/).length).toBeGreaterThan(0);
  });

  it('writes the headings in Nepali', async () => {
    await openReports({ locale: 'ne' });
    expect(await screen.findByRole('heading', { name: 'खुद रकम' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'कारोबार छान्नुहोस्' })).toBeInTheDocument();
    expect(screen.getByText('रेकर्डमा हेर्न थिच्नुहोस्')).toBeInTheDocument();
  });
});
