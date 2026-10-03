import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeekeepingOrderHistoryPage from './BeekeepingOrderHistoryPage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

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
    expect(api.get).toHaveBeenCalledWith('/api/beekeeping/orders');
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
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: orders });
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
});
