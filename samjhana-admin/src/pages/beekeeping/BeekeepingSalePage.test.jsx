import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeekeepingSalePage from './BeekeepingSalePage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

const products = [
  { id: 'h1', name: 'Wild Honey', sellingPrice: 850, stockQty: 3 },
  { id: 'v1', name: 'Langstroth Hive', sellingPrice: 4500, stockQty: 0 },
];

async function addLine(productName) {
  await userEvent.click((await screen.findAllByRole('button', { name: 'Add' }))[0]);
  const lines = screen.getAllByTestId('sale-line');
  const line = lines[lines.length - 1];
  await userEvent.click(within(line).getByRole('button', { name: 'Select option' }));
  await userEvent.click(within(line).getByText(productName));
  return line;
}

describe('BeekeepingSalePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: products });
  });

  it('prices a line from the product and totals the sale', async () => {
    renderWithProviders(<BeekeepingSalePage />);
    const line = await addLine('Wild Honey');

    expect(within(line).getByLabelText('Unit Price')).toHaveValue(850);
    await userEvent.clear(within(line).getByLabelText('Qty'));
    await userEvent.type(within(line).getByLabelText('Qty'), '2');
    expect(screen.getAllByText('Rs 1,700').length).toBeGreaterThan(0);
  });

  it('saves the sale as a beekeeping transaction and goes to the history', async () => {
    api.post.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingSalePage />);
    const line = await addLine('Wild Honey');
    await userEvent.clear(within(line).getByLabelText('Qty'));
    await userEvent.type(within(line).getByLabelText('Qty'), '2');
    await userEvent.type(screen.getByLabelText('Customer name (optional)'), 'Hari');
    await userEvent.click(screen.getByRole('button', { name: 'Save Sale' }));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/api/transactions');
    expect(body).toMatchObject({ businessCode: 'beekeeping', transactionType: 'SALE', amount: 1700 });
    expect(body.customFields).toMatchObject({
      customerName: 'Hari', paymentMethod: 'CASH',
      items: [{ itemId: 'h1', itemName: 'Wild Honey', quantity: 2, unitPrice: 850, total: 1700 }],
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/beekeeping/orders'));
  });

  it('warns and blocks saving when the quantity is more than the stock', async () => {
    renderWithProviders(<BeekeepingSalePage />);
    const line = await addLine('Wild Honey');
    await userEvent.clear(within(line).getByLabelText('Qty'));
    await userEvent.type(within(line).getByLabelText('Qty'), '5');

    expect(screen.getByText('Only 3 in stock')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Sale' })).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('counts the same product on two lines against one stock', async () => {
    renderWithProviders(<BeekeepingSalePage />);
    const first = await addLine('Wild Honey');
    await userEvent.clear(within(first).getByLabelText('Qty'));
    await userEvent.type(within(first).getByLabelText('Qty'), '2');
    await addLine('Wild Honey');
    const second = screen.getAllByTestId('sale-line')[1];
    await userEvent.clear(within(second).getByLabelText('Qty'));
    await userEvent.type(within(second).getByLabelText('Qty'), '2');

    expect(screen.getAllByText('Only 3 in stock').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save Sale' })).toBeDisabled();
  });

  it('says out of stock for an empty product', async () => {
    renderWithProviders(<BeekeepingSalePage />);
    await addLine('Langstroth Hive');
    expect(screen.getByRole('alert')).toHaveTextContent('Out of stock');
    expect(screen.getByRole('button', { name: 'Save Sale' })).toBeDisabled();
  });

  it('asks for at least one product before saving', async () => {
    renderWithProviders(<BeekeepingSalePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Save Sale' }));
    expect(await screen.findByText('Add at least one product')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('shows the server message and reloads stock when the sale is refused', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'Not enough stock for Wild Honey' } } });
    renderWithProviders(<BeekeepingSalePage />);
    await addLine('Wild Honey');
    await userEvent.click(screen.getByRole('button', { name: 'Save Sale' }));

    expect(await screen.findByText('Not enough stock for Wild Honey')).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
    await waitFor(() => expect(api.get.mock.calls.filter(([url]) => url !== '/api/shop-orders/summary')).toHaveLength(2));
  });

  it('shows an error with a retry when the products cannot load', async () => {
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: products });
    renderWithProviders(<BeekeepingSalePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load products');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it('shows Nepali labels and Devanagari numerals', async () => {
    renderWithProviders(<BeekeepingSalePage />, { locale: 'ne' });
    const line = await (async () => {
      await userEvent.click((await screen.findAllByRole('button', { name: 'थप्नुहोस्' }))[0]);
      return screen.getByTestId('sale-line');
    })();
    await userEvent.click(within(line).getByRole('button', { name: 'Select option' }));
    expect(within(line).getByText('स्टक: ३')).toBeInTheDocument();
    expect(screen.getByText('नयाँ मौरीपालन बिक्री')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'बिक्री सेभ गर्नुहोस्' })).toBeInTheDocument();
  });
});
