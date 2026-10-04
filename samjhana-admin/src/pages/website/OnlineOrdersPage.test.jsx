import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnlineOrdersPage from './OnlineOrdersPage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));

const order = (over = {}) => ({
  id: 'o1', orderNumber: 'SV-261003-AB2C', status: 'NEW', customerName: 'Hari Thapa', customerPhone: '9812345678',
  customerEmail: 'hari@example.com', fulfilment: 'DELIVERY', addressLine: 'Ward 3', city: 'Tamghas', landmark: 'Near the school',
  paymentMethod: 'CASH_ON_DELIVERY', customerNotes: 'Call first', internalNotes: null, subtotal: 1700, deliveryFee: 150, total: 1850,
  cancelReason: null, createdAt: '2026-10-03T05:30:00', items: [{ slug: 'honey', name: 'Wild Honey', quantity: 2, unitPrice: 850, lineTotal: 1700 }],
  ...over,
});
const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));

function mockApi(orders, counts = { NEW: 1, CONFIRMED: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 }) {
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes('summary') ? counts : orders }));
}

describe('OnlineOrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    as('STAFF');
  });
  afterEach(() => vi.useRealTimers());

  it('lists new orders with number, customer, items and total, and shows the count on the tab', async () => {
    mockApi([order()]);
    renderWithProviders(<OnlineOrdersPage />);
    expect(await screen.findByText('SV-261003-AB2C')).toBeInTheDocument();
    expect(screen.getByText(/Hari Thapa · 9812345678/)).toBeInTheDocument();
    expect(screen.getByText('2 × Wild Honey')).toBeInTheDocument();
    expect(screen.getByText('Rs 1,850')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /New/ })).getByText('1')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/api/shop-orders?status=NEW');
  });

  it('loads another status when its tab is chosen, and filters by search text', async () => {
    mockApi([order(), order({ id: 'o2', orderNumber: 'SV-261003-ZZZZ', customerName: 'Sita' })]);
    renderWithProviders(<OnlineOrdersPage />);
    await screen.findByText('SV-261003-AB2C');
    await userEvent.type(screen.getByLabelText('Search order, name or phone...'), 'sita');
    expect(screen.queryByText('SV-261003-AB2C')).not.toBeInTheDocument();
    expect(screen.getByText('SV-261003-ZZZZ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Completed/ }));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/shop-orders?status=COMPLETED'));
  });

  it('shows an empty state and an error with retry', async () => {
    mockApi([]);
    const { unmount } = renderWithProviders(<OnlineOrdersPage />);
    expect(await screen.findByText('No orders here')).toBeInTheDocument();
    unmount();

    api.get.mockRejectedValueOnce(new Error('down'));
    renderWithProviders(<OnlineOrdersPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load orders');
    mockApi([order()]);
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SV-261003-AB2C')).toBeInTheDocument();
  });

  it('opens the full order with a call link, the address, the notes and the totals', async () => {
    mockApi([order()]);
    renderWithProviders(<OnlineOrdersPage />);
    await userEvent.click(await screen.findByTestId('order-row'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('link', { name: /9812345678/ })).toHaveAttribute('href', 'tel:9812345678');
    expect(within(dialog).getByText('Ward 3, Tamghas, Near the school')).toBeInTheDocument();
    expect(within(dialog).getByText(/Call first/)).toBeInTheDocument();
    expect(within(dialog).getByText('Pay cash on delivery')).toBeInTheDocument();
    expect(within(dialog).getByText('Rs 150')).toBeInTheDocument();
  });

  it('moves a new order to confirmed, and offers only the next steps', async () => {
    mockApi([order()]);
    api.patch.mockResolvedValue({ data: { order: order({ status: 'CONFIRMED' }) } });
    renderWithProviders(<OnlineOrdersPage />);
    await userEvent.click(await screen.findByTestId('order-row'));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Complete (paid)' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();   // staff cannot cancel

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm order' }));
    expect(api.patch).toHaveBeenCalledWith('/api/shop-orders/o1/status', { status: 'CONFIRMED', reason: undefined });
    expect(await within(dialog).findByRole('button', { name: 'Mark ready' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Complete (paid)' })).toBeInTheDocument();
  });

  it('asks for a second tap before recording the sale', async () => {
    mockApi([order({ status: 'READY' })]);
    api.patch.mockResolvedValue({ data: { order: order({ status: 'COMPLETED' }) } });
    renderWithProviders(<OnlineOrdersPage />);
    await userEvent.click(await screen.findByTestId('order-row'));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Complete (paid)' }));
    expect(within(dialog).getByText(/records the sale in the books/)).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, completed and paid' }));
    expect(api.patch).toHaveBeenCalledWith('/api/shop-orders/o1/status', { status: 'COMPLETED', reason: undefined });
    await waitFor(() => expect(within(dialog).queryByRole('button', { name: 'Complete (paid)' })).not.toBeInTheDocument());
  });

  it('lets a manager cancel with a reason, and shows the server message when a step fails', async () => {
    as('MANAGER');
    mockApi([order()]);
    api.patch.mockRejectedValueOnce({ response: { data: { message: 'Day already closed: 2026-10-03' } } })
      .mockResolvedValueOnce({ data: { order: order({ status: 'CANCELLED', cancelReason: 'No answer' }) } });
    renderWithProviders(<OnlineOrdersPage />);
    await userEvent.click(await screen.findByTestId('order-row'));
    const dialog = screen.getByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }));
    await userEvent.type(within(dialog).getByLabelText(/Why is it being cancelled/), 'No answer');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel the order' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Day already closed');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Yes, cancel the order' }));
    await waitFor(() => expect(api.patch).toHaveBeenLastCalledWith('/api/shop-orders/o1/status', { status: 'CANCELLED', reason: 'No answer' }));
    expect(await within(dialog).findByText(/Cancelled because: No answer/)).toBeInTheDocument();
  });

  it('saves private notes', async () => {
    mockApi([order()]);
    api.patch.mockResolvedValue({ data: { order: order({ internalNotes: 'Regular customer' }) } });
    renderWithProviders(<OnlineOrdersPage />);
    await userEvent.click(await screen.findByTestId('order-row'));
    await userEvent.type(screen.getByLabelText('Private notes'), 'Regular customer');
    await userEvent.click(screen.getByRole('button', { name: 'Save notes' }));
    expect(api.patch).toHaveBeenCalledWith('/api/shop-orders/o1/notes', { notes: 'Regular customer' });
    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument();
  });

  it('checks for new orders every 30 seconds without showing a spinner', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockApi([order()]);
    renderWithProviders(<OnlineOrdersPage />);
    await screen.findByText('SV-261003-AB2C');
    const before = api.get.mock.calls.length;
    mockApi([order(), order({ id: 'o2', orderNumber: 'SV-261003-NEW2' })]);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_500); });
    expect(await screen.findByText('SV-261003-NEW2')).toBeInTheDocument();
    expect(api.get.mock.calls.length).toBeGreaterThan(before);
  });

  it('shows Nepali labels and Devanagari numerals', async () => {
    mockApi([order()], { NEW: 3, CONFIRMED: 0, READY: 0, COMPLETED: 0, CANCELLED: 0 });
    renderWithProviders(<OnlineOrdersPage />, { locale: 'ne' });
    expect(await screen.findByText('अनलाइन अर्डर')).toBeInTheDocument();
    expect(screen.getByText('रु १,८५०')).toBeInTheDocument();
    expect(within(screen.getByRole('tab', { name: /नयाँ/ })).getByText('३')).toBeInTheDocument();
  });
});
