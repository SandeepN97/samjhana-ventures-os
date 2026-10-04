import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BeekeepingInventoryPage from '../pages/beekeeping/BeekeepingInventoryPage';
import FurnitureInventoryPage from '../pages/furniture/FurnitureInventoryPage';
import BusinessTabs from './BusinessTabs';
import { renderWithProviders } from '../test/test-utils';

vi.mock('./ImageUploader', () => ({
  default: ({ value, onChange }) => <button type="button" onClick={() => onChange(['pic-new'])}>pictures {value.join(',') || 'none'}</button>,
}));

vi.mock('../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(() => Promise.resolve({ data: {} })), patch: vi.fn(), delete: vi.fn() },
}));
import api from '../utils/api';

const item = (over) => ({
  id: 'i1', name: 'Wild Honey', sku: 'HONEY-1', category: 'HONEY', sellingPrice: 850, purchasePrice: 500,
  stockQty: 5, reorderLevel: 2, showOnWebsite: true, imageIds: ['p1'], imageUrls: ['/api/public/media/p1'], ...over,
});
const withPicture = item();
const noPicture = item({ id: 'i2', name: 'Bare Frame', sku: 'FR-1', imageIds: [], imageUrls: [] });
const hidden = item({ id: 'i3', name: 'Old Smoker', sku: 'SM-1', showOnWebsite: false });
const soldOut = item({ id: 'i4', name: 'Empty Jar', sku: 'JR-1', stockQty: 0 });

const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));
const cards = () => screen.getAllByTestId('product-row');

describe('product picture grid (beekeeping)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: [withPicture, noPicture, hidden, soldOut] });
  });

  it('shows every product as a card with its picture, or a "No picture" chip', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    expect(await screen.findByAltText('Wild Honey')).toHaveAttribute('src', expect.stringContaining('/api/public/media/p1'));
    expect(cards()).toHaveLength(4);
    expect(within(cards()[1]).getAllByText('No picture').length).toBeGreaterThan(0);
    expect(within(cards()[0]).queryByText('No picture')).toBeNull();
  });

  it('filters to the products that need a picture', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    await screen.findAllByTestId('product-row');
    await userEvent.click(screen.getByRole('button', { name: /Needs picture/ }));
    expect(cards()).toHaveLength(1);
    expect(screen.getByText('Bare Frame')).toBeInTheDocument();
  });

  it('filters Live, Hidden and Sold out, with a count on each', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    await screen.findAllByTestId('product-row');
    expect(screen.getByRole('button', { name: /^Hidden 1/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Hidden/ }));
    expect(screen.getByText('Old Smoker')).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: /^Sold out/ }));
    expect(screen.getByText('Empty Jar')).toBeInTheDocument();
  });

  it('switches a product on or off the website from the card', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Show Old Smoker on website' }));
    expect(api.put).toHaveBeenCalledWith('/api/beekeeping/items/i3', { showOnWebsite: true });
  });

  it('changes pictures from the card without opening the whole form', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Change pictures of Bare Frame' }));
    const dialog = screen.getByRole('dialog', { name: 'Bare Frame' });
    await userEvent.click(within(dialog).getByRole('button', { name: /pictures none/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save pictures' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/beekeeping/items/i2', { imageIds: ['pic-new'] }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Bare Frame' })).toBeNull());
  });

  it('shows the error and keeps the dialog open when saving the pictures fails', async () => {
    as('ADMIN');
    api.put.mockRejectedValueOnce({ response: { data: { message: 'Picture is gone' } } });
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Change pictures of Bare Frame' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save pictures' }));
    expect(await screen.findByText('Picture is gone')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Bare Frame' })).toBeInTheDocument();
  });

  it('refreshes in place when stock changes: the grid stays, there is no spinner, the page does not jump', async () => {
    as('MANAGER');
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingInventoryPage />);
    const before = (await screen.findAllByTestId('product-row'))[0];
    await userEvent.click(screen.getByRole('button', { name: 'Increase stock of Wild Honey' }));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('status')).toBeNull();                 // no loading spinner replaced the list
    expect(before.isConnected).toBe(true);                            // the same cards, not rebuilt
  });

  it('keeps the grid and shows an error when an in-place refresh fails', async () => {
    as('MANAGER');
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<BeekeepingInventoryPage />);
    await screen.findAllByTestId('product-row');
    api.get.mockRejectedValueOnce(new Error('down'));
    await userEvent.click(screen.getByRole('button', { name: 'Increase stock of Wild Honey' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getAllByTestId('product-row')).toHaveLength(4);
  });

  it('closes the photo window and the product form with Escape', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Change pictures of Bare Frame' }));
    expect(screen.getByRole('dialog', { name: 'Bare Frame' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Bare Frame' })).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: /Add Product/ })[0]);
    expect(screen.getByRole('dialog', { name: /Add New Product|Add Product/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the language toggle 44px tall', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />);
    await screen.findAllByTestId('product-row');
    expect(screen.getByRole('button', { name: /नेपालीमा बदल्नुहोस्|Switch to English/ })).toHaveClass('min-h-[44px]');
  });

  it('gives staff and managers no picture, switch or edit controls', async () => {
    as('MANAGER');
    renderWithProviders(<BeekeepingInventoryPage />);
    await screen.findAllByTestId('product-row');
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: /Change pictures/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Increase stock of Wild Honey' })).toBeInTheDocument();
  });

  it('shows the picture grid labels in Nepali', async () => {
    as('ADMIN');
    renderWithProviders(<BeekeepingInventoryPage />, { locale: 'ne' });
    expect((await screen.findAllByText('तस्बिर छैन')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /तस्बिर चाहिन्छ/ })).toBeInTheDocument();
  });
});

describe('product picture grid (furniture)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: [item({ name: 'Oak Chair', category: 'CHAIR' }), item({ id: 'f2', name: 'Plain Bed', category: 'BED', imageIds: [], imageUrls: [] })] });
  });

  it('shows a card per piece and filters the ones that need a picture', async () => {
    as('ADMIN');
    renderWithProviders(<FurnitureInventoryPage />);
    expect(await screen.findByAltText('Oak Chair')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Needs picture/ }));
    expect(cards()).toHaveLength(1);
    expect(screen.getByText('Plain Bed')).toBeInTheDocument();
  });

  it('puts the Pictures section first in the edit form', async () => {
    as('ADMIN');
    renderWithProviders(<FurnitureInventoryPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit Item' }))[0]);
    const form = document.querySelector('form');
    const first = form.firstElementChild.nextElementSibling;
    expect(form.textContent.indexOf('pictures')).toBeLessThan(form.textContent.indexOf('Item Name'));
    expect(first).not.toBeNull();
  });

  it('refreshes in place when stock changes, without the spinner', async () => {
    as('MANAGER');
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<FurnitureInventoryPage />);
    const before = (await screen.findAllByTestId('product-row'))[0];
    await userEvent.click(screen.getAllByRole('button').find((b) => b.className.includes('bg-green-100')));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(before.isConnected).toBe(true);
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('switches a piece off the website from the card', async () => {
    as('ADMIN');
    renderWithProviders(<FurnitureInventoryPage />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Show Oak Chair on website' }));
    expect(api.put).toHaveBeenCalledWith('/api/furniture/items/i1', { showOnWebsite: false });
  });
});

describe('business tabs', () => {
  const tabs = (business, path) => { window.history.pushState({}, '', path); return renderWithProviders(<BusinessTabs business={business} />); };

  it('lists the furniture tabs, highlights the open one and links to each', () => {
    as('ADMIN');
    tabs('furniture', '/furniture/inventory');
    const names = screen.getAllByRole('link').map((l) => l.textContent);
    expect(names).toEqual(['Overview', 'Products', 'New sale', 'Orders', 'Customers', 'Website page']);
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Website page' })).toHaveAttribute('href', '/furniture/website');
  });

  it('lists the beekeeping tabs without a Customers tab', () => {
    as('MANAGER');
    tabs('beekeeping', '/beekeeping/orders');
    expect(screen.getAllByRole('link').map((l) => l.textContent)).toEqual(['Overview', 'Products', 'New sale', 'Orders', 'Website page']);
  });

  it('hides the Website page tab from staff, who cannot edit it, and keeps tabs 44px tall', () => {
    as('STAFF');
    tabs('beekeeping', '/beekeeping/inventory');
    expect(screen.queryByRole('link', { name: 'Website page' })).toBeNull();
    screen.getAllByRole('link').forEach((l) => expect(l).toHaveClass('min-h-[44px]'));
  });

  it('shows the tabs in Nepali', () => {
    as('ADMIN');
    renderWithProviders(<BusinessTabs business="furniture" />, { locale: 'ne' });
    expect(screen.getByRole('link', { name: 'वेबसाइट पृष्ठ' })).toBeInTheDocument();
  });
});

describe('remove confirmation pop-up', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    as('ADMIN');
    api.get.mockResolvedValue({ data: [withPicture, noPicture] });
    api.delete.mockResolvedValue({ data: {} });
  });

  it('opens as a centred overlay on the screen, not inline at the top of the page', async () => {
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[1]);
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Remove Bare Frame? Its sales history is kept.');
    const overlay = dialog.parentElement;
    expect(overlay).toHaveClass('fixed', 'inset-0', 'items-center', 'justify-center');
  });

  it('keeps the product when cancelled, and focuses Keep first so Enter cannot delete', async () => {
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);
    expect(screen.getByRole('button', { name: 'Keep' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('closes when the dark background is tapped', async () => {
    renderWithProviders(<BeekeepingInventoryPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);
    await userEvent.click(screen.getByRole('alertdialog').parentElement);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('removes the furniture piece after confirming, and says it in Nepali', async () => {
    renderWithProviders(<FurnitureInventoryPage />, { locale: 'ne' });
    await userEvent.click((await screen.findAllByRole('button', { name: 'मेट्नुहोस्' }))[0]);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Wild Honey हटाउने?');
    await userEvent.click(screen.getByRole('button', { name: 'हटाउनुहोस्' }));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/api/furniture/items/i1'));
  });
});
