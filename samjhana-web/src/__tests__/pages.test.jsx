import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderPage, product, SITE } from '../test/utils';

vi.mock('../api/api.js', async (orig) => {
  const real = await orig();
  return {
    ...real,
    shopApi: { products: vi.fn(), product: vi.fn() },
    ordersApi: { place: vi.fn(), track: vi.fn() },
    restaurantApi: { menu: vi.fn() },
    evApi: { getVehicles: vi.fn() },
    fuelApi: { getCurrent: vi.fn() },
    siteApi: { get: vi.fn() },
  };
});

import { shopApi, ordersApi, restaurantApi, evApi, fuelApi } from '../api/api.js';
import { forgetCatalogue } from '../data/catalogue';
import { useCartStore } from '../store/cartStore';
import BeekeepingPage from '../pages/BeekeepingPage';
import FurnitureCataloguePage from '../pages/FurnitureCataloguePage';
import FurnitureProductPage from '../pages/FurnitureProductPage';
import ShopOrderPage from '../pages/ShopOrderPage';
import HomePage from '../pages/HomePage';
import CartDrawer from '../components/CartDrawer';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const bee = (slug, category, name, price, details = {}, over = {}) =>
  product({ id: slug, category, name, nameNepali: `${name} (ne)`, price, details, ...over });

const BEE = [
  bee('hive-001', 'HIVE', 'Langstroth 10-Frame Hive', 4500, { type: 'Langstroth', specs: { dimensions: '51 × 42 cm', wood: 'Tuni' } }, { badge: 'Best seller' }),
  bee('hive-002', 'HIVE', 'Traditional Log Hive', 1800, { type: 'Log Hive', specs: {} }),
  bee('gear-001', 'GEAR', 'Full Bee Suit — Adult L', 3200),
  bee('tool-001', 'TOOL', 'Stainless Steel Bee Smoker', 1650, { category: 'inspection' }),
  bee('tool-003', 'TOOL', 'Queen Capture Cage (PVC)', 420, { category: 'queen' }),
  bee('honey-001', 'HONEY', 'Wildflower Raw Honey', 850, { unit: 'per 500g jar' }),
  bee('honey-002', 'HONEY', 'Dark Forest Honey', 950, { unit: 'per 500g jar' }, { stockStatus: 'OUT_OF_STOCK' }),
  bee('kit-001', 'KIT', 'Basic Starter Kit', 9500, { level: 'Beginner', includes: ['1× hive', '1× veil'], originalPrice: 11300, savings: 1800 }),
];
const FURN = [
  product({ id: 'oak-chair', type: 'FURNITURE', category: 'CHAIR', name: 'Oak Chair', price: 3200, images: [], image: null }),
  product({ id: 'teak-sofa', type: 'FURNITURE', category: 'SOFA', name: 'Teak Sofa', price: 42000, image: '/api/public/media/s1', images: ['/api/public/media/s1', '/api/public/media/s2'], stockStatus: 'LOW_STOCK' }),
  product({ id: 'old-bed', type: 'FURNITURE', category: 'BED', name: 'Old Bed', price: 18000, stockStatus: 'OUT_OF_STOCK' }),
];
const page = (items) => ({ items, total: items.length, page: 1, totalPages: 1, facets: {} });

beforeEach(() => {
  vi.clearAllMocks();
  forgetCatalogue();
  localStorage.clear();
  useCartStore.setState({ items: [], count: 0, total: 0, open: false });
  shopApi.products.mockImplementation(async (params = {}) => {
    if (params.type === 'BEEKEEPING') return page(BEE);
    if (params.type === 'FURNITURE') return page(FURN);
    if (params.slugs) return page([...BEE, ...FURN].filter((p) => params.slugs.split(',').includes(p.id)));
    return page([]);
  });
  restaurantApi.menu.mockResolvedValue({ dishes: [] });
  evApi.getVehicles.mockResolvedValue([]);
  fuelApi.getCurrent.mockResolvedValue({});
});

describe('Maurighar (beekeeping) page', () => {
  it('shows the hero from content and every section from the shop data, with real counts', async () => {
    renderPage(<BeekeepingPage />, { route: '/beekeeping' });
    expect(await screen.findByRole('heading', { name: /Honey and beekeeping/ })).toBeInTheDocument();
    expect(await screen.findAllByText('Langstroth 10-Frame Hive')).not.toHaveLength(0);
    expect(screen.getByText('Basic Starter Kit')).toBeInTheDocument();
    expect(screen.getByText('Wildflower Raw Honey')).toBeInTheDocument();
    expect(screen.getByText('How to start beekeeping in Nepal')).toBeInTheDocument();
    // the tabs count what is really there (2 hives, 1 kit), not a number written in the source
    expect(screen.getByRole('button', { name: /Hives\s*2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Starter kits\s*1/ })).toBeInTheDocument();
  });

  it('adds a product to the cart but not a sold-out one', async () => {
    renderPage(<BeekeepingPage />, { route: '/beekeeping' });
    await screen.findByText('Wildflower Raw Honey');
    await userEvent.click(screen.getAllByRole('button', { name: /मालमा थप्नुहोस्/ })[0]);
    expect(useCartStore.getState().items.map((i) => i.id)).toEqual(['honey-001']);
    expect(screen.getByText('Dark Forest Honey').closest('div').parentElement.querySelector('button[disabled]')).not.toBeNull();
  });

  it('orders the hive type that is selected, not always the first', async () => {
    renderPage(<BeekeepingPage />, { route: '/beekeeping' });
    await screen.findAllByText('Traditional Log Hive');
    await userEvent.click(screen.getAllByText('Traditional Log Hive')[0].closest('button'));
    await userEvent.click(screen.getByRole('button', { name: /Order now/ }));
    expect(useCartStore.getState().items[0].id).toBe('hive-002');
  });

  it('shows a retry when the shop cannot be loaded', async () => {
    shopApi.products.mockRejectedValueOnce(new Error('down'));
    renderPage(<BeekeepingPage />, { route: '/beekeeping' });
    await userEvent.click(await screen.findByRole('button', { name: /try again/i }));
    expect(await screen.findByText('Wildflower Raw Honey')).toBeInTheDocument();
  });

  it('opens and closes a FAQ answer', async () => {
    renderPage(<BeekeepingPage />, { route: '/beekeeping' });
    await userEvent.click(await screen.findByText('Do you offer training?'));
    expect(screen.getByText(/practical beekeeping workshops/)).toBeInTheDocument();
  });
});

describe('Furniture pages', () => {
  it('lists pieces from the shop, uses the uploaded picture and falls back to the drawing', async () => {
    const { container } = renderPage(<FurnitureCataloguePage />, { route: '/furniture' });
    expect(await screen.findAllByText('Teak Sofa')).not.toHaveLength(0);
    expect(screen.getByText('Oak Chair')).toBeInTheDocument();
    expect(container.querySelector('img[src*="/api/public/media/s1"]')).not.toBeNull();   // picture
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);                  // drawing for the chair
    expect(screen.queryByText(/Only \d+ left/)).toBeNull();                                // never a real count
    expect(screen.getByText('Only a few left')).toBeInTheDocument();
    expect(screen.getByText('Furniture for')).toBeInTheDocument();
  });

  it('filters by category and by search', async () => {
    renderPage(<FurnitureCataloguePage />, { route: '/furniture' });
    await screen.findByText('Oak Chair');
    await userEvent.click(screen.getByRole('button', { name: /^Chair/ }));
    expect(screen.queryByText('Teak Sofa')).toBeNull();
    await userEvent.type(screen.getByPlaceholderText(/Search chair/i), 'zzz');
    expect(await screen.findByText('No furniture matches')).toBeInTheDocument();
  });

  it('shows a product with a gallery, adds it, and leaves a sold-out one unbuyable', async () => {
    shopApi.product.mockResolvedValue({ ...FURN[1], related: [FURN[0]] });
    renderPage(<Routes><Route path="/furniture/:id" element={<FurnitureProductPage />} /></Routes>, { route: '/furniture/teak-sofa' });
    expect(await screen.findByRole('heading', { name: 'Teak Sofa' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show picture 2' })).toBeInTheDocument();
    expect(screen.getByText('Free delivery')).toBeInTheDocument();       // reasons to buy come from the content
    await userEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    expect(useCartStore.getState().items[0]).toMatchObject({ id: 'teak-sofa', price: 42000 });
  });

  it('says so when a piece is not found', async () => {
    shopApi.product.mockRejectedValue({ response: { status: 404 } });
    renderPage(<Routes><Route path="/furniture/:id" element={<FurnitureProductPage />} /></Routes>, { route: '/furniture/nope' });
    expect(await screen.findByText('Product not found')).toBeInTheDocument();
  });
});

describe('Shop & order page', () => {
  it('shows the chooser from content, with a few real pieces', async () => {
    renderPage(<ShopOrderPage />, { route: '/shop' });
    expect(screen.getByText('made to stay.')).toBeInTheDocument();
    expect(screen.getByText('Pieces for real homes.')).toBeInTheDocument();
    expect(await screen.findByText('Oak Chair')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Browse all furniture/ })).toHaveAttribute('href', '/furniture');
  });

  it('opens and closes the vehicle essentials story', async () => {
    renderPage(<ShopOrderPage />, { route: '/shop' });
    await userEvent.click(screen.getByRole('button', { name: /See how it works/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Tell us what the road needs.');
    await userEvent.click(screen.getByRole('button', { name: /Close vehicle essentials story/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Home page, header and footer', () => {
  it('builds the home page from content, including the furniture highlight', async () => {
    renderPage(<HomePage />);
    expect(screen.getByText('Come for the journey.')).toBeInTheDocument();
    expect(await screen.findAllByText('Teak Sofa')).not.toHaveLength(0);
    expect(screen.getByText('Petrol Pump & EV')).toBeInTheDocument();
    expect(screen.getAllByText(/Samjhana Ventures/).length).toBeGreaterThan(0);
  });

  it('header and footer take the name, phone and links from the content', () => {
    renderPage(<><Navbar /><Footer /></>);
    expect(screen.getAllByText(SITE.identity.name).length).toBeGreaterThan(1);
    expect(screen.getAllByRole('link', { name: /Call/ })[0]).toHaveAttribute('href', expect.stringContaining('tel:'));
    expect(screen.getByText(new RegExp(SITE.identity.copyrightName))).toBeInTheDocument();
  });

  it('shows the number of items in the header cart and opens the drawer', async () => {
    useCartStore.getState().addItem({ id: 'oak-chair', name: 'Oak Chair', price: 3200 }, 2, false);
    renderPage(<><Navbar /><CartDrawer /></>);
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    await userEvent.click(screen.getAllByRole('button', { name: 'Open cart' })[0]);
    expect(useCartStore.getState().open).toBe(true);
  });
});

describe('Cart drawer checkout', () => {
  const open = (items) => {
    items.forEach(([p, qty]) => useCartStore.getState().addItem(p, qty, false));
    useCartStore.setState({ open: true });
    return renderPage(<CartDrawer />);
  };

  it('refreshes prices from the shop when opened and never keeps a stale one', async () => {
    open([[{ id: 'oak-chair', name: 'Oak Chair', price: 1 }, 1]]);
    expect(await screen.findByText('Rs 3,200 each')).toBeInTheDocument();
  });

  it('flags a product that is no longer sold and blocks checkout', async () => {
    open([[{ id: 'old-bed', name: 'Old Bed', price: 18000 }, 1]]);
    expect(await screen.findByText(/No longer available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Checkout/ })).toBeDisabled();
  });

  it('sends only slugs and quantities, then shows the order number', async () => {
    ordersApi.place.mockResolvedValue({ orderNumber: 'SV-261003-AB2C', items: [] });
    open([[{ id: 'oak-chair', name: 'Oak Chair', price: 3200 }, 2]]);
    await userEvent.click(await screen.findByRole('button', { name: /^Checkout/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Sita Rana');
    await userEvent.type(screen.getByLabelText('Phone number'), '9812345678');
    await userEvent.click(screen.getByText('Pick up at the shop'));
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByText('Thank you!')).toBeInTheDocument();
    expect(screen.getByText('SV-261003-AB2C')).toBeInTheDocument();
    const sent = ordersApi.place.mock.calls[0][0];
    expect(sent.items).toEqual([{ slug: 'oak-chair', quantity: 2 }]);
    expect(sent.fulfilment).toBe('PICKUP');
    expect(JSON.stringify(sent)).not.toMatch(/price/i);
    expect(useCartStore.getState().items).toEqual([]);
  });

  it('validates the form before sending anything', async () => {
    open([[{ id: 'oak-chair', name: 'Oak Chair', price: 3200 }, 1]]);
    await userEvent.click(await screen.findByRole('button', { name: /^Checkout/ }));
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(screen.getByText('Enter the delivery address.')).toBeInTheDocument();
    expect(ordersApi.place).not.toHaveBeenCalled();
  });

  it('shows the server message when stock ran out and keeps the cart', async () => {
    ordersApi.place.mockRejectedValue({ response: { status: 409, data: { message: 'Oak Chair has only 1 left.' } } });
    open([[{ id: 'oak-chair', name: 'Oak Chair', price: 3200 }, 2]]);
    await userEvent.click(await screen.findByRole('button', { name: /^Checkout/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Sita Rana');
    await userEvent.type(screen.getByLabelText('Phone number'), '9812345678');
    await userEvent.type(screen.getByLabelText('Delivery address'), 'Ward 4');
    await userEvent.type(screen.getByLabelText('Town or city'), 'Gulmi');
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(await screen.findByText(/only 1 left/)).toBeInTheDocument();
    await waitFor(() => expect(useCartStore.getState().count).toBe(2));
  });
});
