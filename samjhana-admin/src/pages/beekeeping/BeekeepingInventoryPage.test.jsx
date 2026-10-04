import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeekeepingInventoryPage from './BeekeepingInventoryPage';
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

vi.mock('../../components/ImageUploader', () => ({
  default: ({ value, onChange }) => <button type="button" onClick={() => onChange(['pic-new'])}>pictures {value.join(',') || 'none'}</button>,
}));
vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const honey = (withCost) => ({
  id: 'h1', name: 'Wild Honey', sku: 'HONEY-001', category: 'HONEY', sellingPrice: 850,
  stockQty: 10, reorderLevel: 2, showOnWebsite: true, ...(withCost && { purchasePrice: 500 }),
});
const hive = { id: 'v1', name: 'Langstroth Hive', sku: 'HIVE-001', category: 'HIVE', sellingPrice: 4500, stockQty: 0, reorderLevel: 2 };
const lowJar = { id: 'j1', name: 'Dark Honey', sku: 'HONEY-002', category: 'HONEY', sellingPrice: 950, stockQty: 1, reorderLevel: 2 };

const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));

describe('BeekeepingInventoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: [honey(false)] });
  });

  it('shows staff the selling price and stock count, but no cost and no controls', async () => {
    as('STAFF');
    renderWithProviders(<BeekeepingInventoryPage />);

    expect(await screen.findByText(/Sell: Rs 850/)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText(/Buy:/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Product' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Increase stock/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Product' })).not.toBeInTheDocument();
  });

  it('lets managers see cost and adjust stock, but not change products', async () => {
    as('MANAGER');
    api.get.mockResolvedValue({ data: [honey(true)] });
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingInventoryPage />);

    expect(await screen.findByText(/Buy: Rs 500/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Product' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Increase stock of Wild Honey' }));
    expect(api.patch).toHaveBeenCalledWith('/api/beekeeping/items/h1/stock', { adjustment: 1 });
  });

  it('shows the server message when a stock change is refused', async () => {
    as('MANAGER');
    api.patch.mockRejectedValue({ response: { data: { message: 'Not enough stock for Wild Honey' } } });
    renderWithProviders(<BeekeepingInventoryPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Decrease stock of Wild Honey' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not enough stock for Wild Honey');
  });

  it('marks out-of-stock and low-stock products and blocks decreasing an empty one', async () => {
    as('MANAGER');
    api.get.mockResolvedValue({ data: [hive, lowJar] });
    renderWithProviders(<BeekeepingInventoryPage />);

    expect(await screen.findByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByText('Low Stock!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Decrease stock of Langstroth Hive' })).toBeDisabled();
  });

  it('lets an admin add a product, and checks the name first', async () => {
    as('ADMIN');
    api.post.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingInventoryPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add Product' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Product' }).at(-1));
    expect(await screen.findByText('Product name is required')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.type(screen.getByLabelText(/Product Name/), 'Beeswax Block');
    await userEvent.type(screen.getByLabelText('Selling Price'), '600');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Product' }).at(-1));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, body] = api.post.mock.calls[0];
    expect(url).toBe('/api/beekeeping/items');
    expect(body).toMatchObject({ name: 'Beeswax Block', sellingPrice: 600, stockQty: 0, showOnWebsite: true });
    expect(await screen.findByText('Product added!')).toBeInTheDocument();
  });

  it('shows the server message when saving fails', async () => {
    as('ADMIN');
    api.post.mockRejectedValue({ response: { data: { message: 'SKU already exists: X' } } });
    renderWithProviders(<BeekeepingInventoryPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add Product' }));
    await userEvent.type(screen.getByLabelText(/Product Name/), 'Jar');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Product' }).at(-1));
    expect(await screen.findByText('SKU already exists: X')).toBeInTheDocument();
  });

  it('asks before removing a product, and removes it only when confirmed', async () => {
    as('ADMIN');
    api.delete.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingInventoryPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Remove Wild Honey? Its sales history is kept.');
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(api.delete).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(api.delete).toHaveBeenCalledWith('/api/beekeeping/items/h1');
  });

  it('filters by category through the server and by search text on the page', async () => {
    as('STAFF');
    api.get.mockResolvedValue({ data: [honey(false), hive] });
    renderWithProviders(<BeekeepingInventoryPage />);

    await screen.findByText('Wild Honey');
    await userEvent.type(screen.getByLabelText('Search name or SKU...'), 'langs');
    expect(screen.queryByText('Wild Honey')).not.toBeInTheDocument();
    expect(screen.getByText('Langstroth Hive')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Hives' }));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/beekeeping/items?category=HIVE'));
  });

  it('shows an error with a retry when products cannot load', async () => {
    as('STAFF');
    failOnceThen([honey(false)]);
    renderWithProviders(<BeekeepingInventoryPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load products');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Wild Honey')).toBeInTheDocument();
  });

  it('shows Nepali labels and Devanagari numerals', async () => {
    as('MANAGER');
    api.get.mockResolvedValue({ data: [honey(true)] });
    renderWithProviders(<BeekeepingInventoryPage />, { locale: 'ne' });

    expect(await screen.findByText('मौरीपालन सामान सूची')).toBeInTheDocument();
    expect(screen.getByText(/बिक्री: रु ८५०/)).toBeInTheDocument();
    expect(screen.getByText('१०')).toBeInTheDocument();
    expect(screen.getByText('मह र मैन', { selector: 'span' })).toBeInTheDocument();
  });

  it('keeps stock buttons 44px', async () => {
    as('MANAGER');
    renderWithProviders(<BeekeepingInventoryPage />);
    expect(await screen.findByRole('button', { name: 'Increase stock of Wild Honey' })).toHaveClass('w-11', 'h-11');
  });

  it('shows a product\'s cover picture in the list', async () => {
    as('STAFF');
    api.get.mockResolvedValue({ data: [{ ...honey(false), imageUrls: ['/api/public/media/pic-1'] }] });
    const { container } = renderWithProviders(<BeekeepingInventoryPage />);
    await screen.findByText('Wild Honey');
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/public/media/pic-1');
  });

  it('saves the pictures and the show-on-website switch with the product', async () => {
    as('ADMIN');
    api.get.mockResolvedValue({ data: [{ ...honey(true), imageIds: ['pic-1'], imageUrls: ['/api/public/media/pic-1'] }] });
    api.put.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Product' }));
    expect(screen.getByRole('button', { name: 'pictures pic-1' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'pictures pic-1' }));
    await userEvent.click(screen.getByLabelText('Show on website'));
    await userEvent.click(screen.getByRole('button', { name: 'Update Product' }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(api.put.mock.calls[0][0]).toBe('/api/beekeeping/items/h1');
    expect(api.put.mock.calls[0][1]).toMatchObject({ imageIds: ['pic-new'], showOnWebsite: false });
  });
});
