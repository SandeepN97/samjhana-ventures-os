import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeekeepingOrderHistoryPage from './BeekeepingOrderHistoryPage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

// The tab bar also asks for the new-order count. Answer that separately so a one-time failure or
// the call counts in these tests are about the page's own data.
const failOnceThen = (data) => {
  let failed = false;
  api.get.mockImplementation((url) => {
    if (url === '/api/shop-orders/summary') return Promise.resolve({ data: {} });
    if (!failed) { failed = true; return Promise.reject(new Error('down')); }
    return Promise.resolve({ data });
  });
};

vi.mock('../../utils/api', () => ({ default: { get: vi.fn() } }));

const orders = [
  { id: 'o1', customerName: 'Hari', amount: 1700, transactionDate: '2026-10-03', paymentMethod: 'CASH',
    items: [{ itemName: 'Wild Honey', quantity: 2 }] },
  { id: 'o2', customerName: 'Sita', amount: 4500, transactionDate: '2026-10-02', paymentMethod: 'BANK',
    items: [{ itemName: 'A', quantity: 1 }, { itemName: 'B', quantity: 1 }, { itemName: 'C', quantity: 1 }, { itemName: 'D', quantity: 1 }] },
];

describe('BeekeepingOrderHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: orders });
  });

  it('lists sales with customer, total, payment and the products sold', async () => {
    renderWithProviders(<BeekeepingOrderHistoryPage />);

    expect(await screen.findByText('Hari')).toBeInTheDocument();
    expect(screen.getByText('Rs 1,700')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-03 · Cash/)).toBeInTheDocument();
    expect(screen.getByText('Wild Honey × 2')).toBeInTheDocument();
    expect(screen.getByText(/2026-10-02 · Bank/)).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/beekeeping/orders?page=0&size=50');
  });

  it('filters by customer name', async () => {
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Hari');
    await userEvent.type(screen.getByLabelText('Search by customer name...'), 'sit');
    expect(screen.queryByText('Hari')).not.toBeInTheDocument();
    expect(screen.getByText('Sita')).toBeInTheDocument();
  });

  it('shows an empty state with a way to record the first sale', async () => {
    api.get.mockResolvedValue({ data: [] });
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    expect(await screen.findByText('No sales found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record First Sale' })).toHaveClass('min-h-[44px]');
  });

  it('shows an error with a retry when sales cannot load', async () => {
    failOnceThen(orders);
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load products');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Hari')).toBeInTheDocument();
  });

  it('shows Nepali labels and Devanagari numerals', async () => {
    renderWithProviders(<BeekeepingOrderHistoryPage />, { locale: 'ne' });
    expect(await screen.findByText('मौरीपालन बिक्री')).toBeInTheDocument();
    expect(screen.getByText('रु १,७००')).toBeInTheDocument();
    expect(screen.getByText('Wild Honey × २')).toBeInTheDocument();
  });

  // ---- the server sends 50 sales at a time (finding K-02) ----

  const sale = (n) => ({ id: `s${n}`, customerName: `Customer ${n}`, amount: 100 + n, transactionDate: '2026-10-01',
    paymentMethod: 'CASH', items: [{ itemName: 'Wild Honey', quantity: 1 }] });
  const salesFrom = (first, count) => Array.from({ length: count }, (_, i) => sale(first + i));

  /** Answers each page request from the list given (page 0, page 1, ...); the tab bar's count request gets an empty answer. */
  const mockPages = (pages) => {
    api.get.mockImplementation((url) => {
      if (url === '/api/shop-orders/summary') return Promise.resolve({ data: {} });
      const page = Number(new URL(url, 'http://x').searchParams.get('page'));
      const answer = pages[page];
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve({ data: answer ?? [] });
    });
  };

  it('offers older sales only when the last page was full', async () => {
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Hari');
    expect(screen.queryByRole('button', { name: 'Show older sales' })).not.toBeInTheDocument();
  });

  it('adds the next page under the list when "Show older sales" is pressed, then hides the button when the page is short', async () => {
    mockPages([salesFrom(0, 50), salesFrom(50, 3)]);
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Customer 0');
    expect(screen.getAllByTestId('sale-row')).toHaveLength(50);
    const more = screen.getByRole('button', { name: 'Show older sales' });
    expect(more).toHaveClass('min-h-[44px]');

    await userEvent.click(more);

    expect(api.get).toHaveBeenCalledWith('/api/beekeeping/orders?page=1&size=50');
    expect(await screen.findByText('Customer 52')).toBeInTheDocument();
    expect(screen.getAllByTestId('sale-row')).toHaveLength(53);
    expect(screen.getByText('Customer 0')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show older sales' })).not.toBeInTheDocument();
  });

  it('keeps asking for the next page while each page comes back full', async () => {
    mockPages([salesFrom(0, 50), salesFrom(50, 50), []]);
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Customer 0');
    await userEvent.click(screen.getByRole('button', { name: 'Show older sales' }));
    await screen.findByText('Customer 99');
    await userEvent.click(screen.getByRole('button', { name: 'Show older sales' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/beekeeping/orders?page=2&size=50'));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show older sales' })).not.toBeInTheDocument());
    expect(screen.getAllByTestId('sale-row')).toHaveLength(100);
  });

  it('does not show a sale twice when a new sale pushed it onto the next page', async () => {
    mockPages([salesFrom(0, 50), salesFrom(49, 2)]);   // sale 49 is the last of page 0 and the first of page 1
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Customer 0');
    await userEvent.click(screen.getByRole('button', { name: 'Show older sales' }));
    await screen.findByText('Customer 50');
    expect(screen.getAllByText('Customer 49')).toHaveLength(1);
    expect(screen.getAllByTestId('sale-row')).toHaveLength(51);
  });

  it('keeps the button and says so when older sales cannot be loaded', async () => {
    mockPages([salesFrom(0, 50), new Error('down')]);
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Customer 0');
    await userEvent.click(screen.getByRole('button', { name: 'Show older sales' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load older sales');
    expect(screen.getAllByTestId('sale-row')).toHaveLength(50);

    mockPages([salesFrom(0, 50), salesFrom(50, 2)]);
    await userEvent.click(screen.getByRole('button', { name: 'Show older sales' }));
    expect(await screen.findByText('Customer 51')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still offers older sales when a search finds nothing among the sales shown so far', async () => {
    mockPages([salesFrom(0, 50), [{ ...sale(77), customerName: 'Zed Findme' }]]);
    renderWithProviders(<BeekeepingOrderHistoryPage />);
    await screen.findByText('Customer 0');
    await userEvent.type(screen.getByLabelText('Search by customer name...'), 'findme');
    expect(await screen.findByText('No sales found')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show older sales' }));
    expect(await screen.findByText('Zed Findme')).toBeInTheDocument();
  });

  it('shows the older-sales button and its error in Nepali', async () => {
    mockPages([salesFrom(0, 50), new Error('down')]);
    renderWithProviders(<BeekeepingOrderHistoryPage />, { locale: 'ne' });
    await screen.findByText('Customer 0');
    await userEvent.click(screen.getByRole('button', { name: 'पुराना बिक्री देखाउनुहोस्' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('पुराना बिक्री लोड गर्न सकिएन');
  });
});
