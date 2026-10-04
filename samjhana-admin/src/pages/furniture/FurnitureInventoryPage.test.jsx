import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FurnitureInventoryPage from './FurnitureInventoryPage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../../components/ImageUploader', () => ({
  default: ({ value, onChange }) => <button type="button" onClick={() => onChange(['pic-new'])}>pictures {value.join(',') || 'none'}</button>,
}));

const mock = { items: [] };
vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: mock.items })),
    post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
  },
}));

const sofa = (withCost) => ({
  id: 'i1', name: 'Sofa', sku: 'SOF-1', category: 'SOFA', sellingPrice: 45000,
  stockQty: 3, reorderLevel: 1, ...(withCost && { purchasePrice: 30000 }),
});

const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));

describe('FurnitureInventoryPage role rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows staff the selling price but no cost, and no price or stock controls', async () => {
    as('STAFF');
    mock.items = [sofa(false)];
    renderWithProviders(<FurnitureInventoryPage />);

    // The price line only exists once the item row has loaded ("Sofa" is also a category chip).
    expect(await screen.findByText(/Sell: रु 45,000/)).toBeInTheDocument();
    expect(screen.queryByText(/Buy:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Item' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').some((b) => b.className.includes('bg-green-100'))).toBe(false);
  });

  it('lets managers adjust stock and see cost, but not change prices', async () => {
    as('MANAGER');
    mock.items = [sofa(true)];
    renderWithProviders(<FurnitureInventoryPage />);

    expect(await screen.findByText(/Buy: रु 30,000/)).toBeInTheDocument();
    expect(screen.getAllByRole('button').some((b) => b.className.includes('bg-green-100'))).toBe(true);
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Item' })).not.toBeInTheDocument();
  });

  it('gives admins every control, at least 44px tall', async () => {
    as('ADMIN');
    mock.items = [sofa(true)];
    renderWithProviders(<FurnitureInventoryPage />);

    // "Add Item" renders straight away; the row buttons only appear once the items have loaded.
    const edit = await screen.findByRole('button', { name: 'Edit Item' });
    expect(screen.getByText('Add Item')).toBeInTheDocument();
    expect(edit.className).toContain('h-11');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('shows the staff view in Nepali without cost', async () => {
    as('STAFF');
    mock.items = [sofa(false)];
    renderWithProviders(<FurnitureInventoryPage />, { locale: 'ne' });

    expect(await screen.findByText(/बिक्री: रु 45,000/)).toBeInTheDocument();
    expect(screen.queryByText('नयाँ सामान')).not.toBeInTheDocument();
    expect(screen.queryByText(/खरिद:/)).not.toBeInTheDocument();
  });

  it('shows a cover picture in the list and saves pictures, badge and the website switch', async () => {
    as('ADMIN');
    mock.items = [{ ...sofa(true), imageIds: ['pic-1'], imageUrls: ['/api/public/media/pic-1'], showOnWebsite: true, badge: '' }];
    const api = (await import('../../utils/api')).default;
    api.put.mockResolvedValue({ data: {} });
    const { container } = renderWithProviders(<FurnitureInventoryPage />);

    await screen.findByText(/Sell: रु 45,000/);
    expect(container.querySelector('img')).toHaveAttribute('src', '/api/public/media/pic-1');

    await userEvent.click(screen.getByRole('button', { name: 'Edit Item' }));
    await userEvent.click(screen.getByRole('button', { name: 'pictures pic-1' }));
    await userEvent.type(screen.getByLabelText('Badge (optional)'), 'New');
    await userEvent.click(screen.getByLabelText('Show on website'));
    await userEvent.click(screen.getByRole('button', { name: 'Update Item' }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(api.put.mock.calls[0][1]).toMatchObject({ imageIds: ['pic-new'], badge: 'New', showOnWebsite: false });
  });
});
