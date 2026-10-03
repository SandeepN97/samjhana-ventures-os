import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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
import { useCartStore } from '../store/cartStore';
import ShopPage from '../pages/ShopPage';
import ProductPage from '../pages/ProductPage';
import CartPage, { deliveryFeeFor } from '../pages/CartPage';
import CheckoutPage, { validate } from '../pages/CheckoutPage';
import OrderPage from '../pages/OrderPage';
import Header from '../components/Header';
import RestaurantSection from '../components/home/RestaurantSection';
import FuelEvSection from '../components/home/FuelEvSection';
import HubLanes from '../components/home/HubLanes';
import { resolveLink, whatsappLink, mapEmbedUrl } from '../site/links';
import { formatMoney } from '../utils/format';

const honey = product();
const stool = product({ id: 'oak-stool', type: 'FURNITURE', category: 'STOOL', name: 'Oak Stool', price: 3200, images: [], image: null, stockStatus: 'LOW_STOCK' });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useCartStore.setState({ items: [], count: 0, lastAdded: null });
  shopApi.products.mockResolvedValue({ items: [honey, stool], total: 2, page: 1, totalPages: 1, facets: { types: [], categories: [] } });
});

describe('helpers', () => {
  it('formats money in lakhs', () => expect(formatMoney(150000)).toBe('Rs 1,50,000'));
  it('turns link tokens into real addresses and refuses nothing it does not know', () => {
    expect(resolveLink('@whatsapp', SITE.contact)).toBe('https://wa.me/9779363147818');
    expect(resolveLink('@phone', SITE.contact)).toBe('tel:+9779363147818');
    expect(resolveLink('/shop')).toBe('/shop');
    expect(whatsappLink(SITE.contact, 'Hi there')).toContain('?text=Hi%20there');
  });
  it('gives no map without coordinates', () => {
    expect(mapEmbedUrl({})).toBe('');
    expect(mapEmbedUrl(SITE.contact)).toContain('27.9922809');
  });
  it('charges delivery below the free threshold only', () => {
    expect(deliveryFeeFor(1000, SITE.shop)).toBe(150);
    expect(deliveryFeeFor(5000, SITE.shop)).toBe(0);
    expect(deliveryFeeFor(100, { deliveryFee: 0 })).toBe(0);
  });
});

describe('cart store', () => {
  it('adds, merges, limits, and removes lines', () => {
    const { add, setQty, remove } = useCartStore.getState();
    add('a', 2); add('a', 1); add('b');
    expect(useCartStore.getState().count).toBe(4);
    setQty('a', 9999);
    expect(useCartStore.getState().items.find((i) => i.slug === 'a').qty).toBe(50);
    remove('a');
    expect(useCartStore.getState().items).toEqual([{ slug: 'b', qty: 1 }]);
  });
  it('keeps only slug and quantity, never a price', () => {
    useCartStore.getState().add('a', 1);
    expect(Object.keys(useCartStore.getState().items[0]).sort()).toEqual(['qty', 'slug']);
  });
});

describe('Shop page', () => {
  it('lists products from the API with status and price', async () => {
    renderPage(<ShopPage />, { route: '/shop' });
    expect(await screen.findByText('Wild Honey')).toBeInTheDocument();
    expect(screen.getByText('Oak Stool')).toBeInTheDocument();
    expect(screen.getByText('Only a few left')).toBeInTheDocument();
    expect(screen.getByText(/Rs 850/)).toBeInTheDocument();
  });
  it('passes the type from the address to the API', async () => {
    renderPage(<ShopPage />, { route: '/shop?type=FURNITURE' });
    await waitFor(() => expect(shopApi.products).toHaveBeenCalled());
    expect(shopApi.products.mock.calls[0][0]).toMatchObject({ type: 'FURNITURE' });
  });
  it('shows an error with retry when the API fails', async () => {
    shopApi.products.mockRejectedValueOnce(new Error('down'));
    renderPage(<ShopPage />, { route: '/shop' });
    const retry = await screen.findByRole('button', { name: /try again/i });
    await userEvent.click(retry);
    expect(await screen.findByText('Wild Honey')).toBeInTheDocument();
  });
  it('adds a product to the cart from the grid', async () => {
    renderPage(<ShopPage />, { route: '/shop' });
    await screen.findByText('Wild Honey');
    await userEvent.click(screen.getAllByRole('button', { name: /add to cart/i })[0]);
    expect(useCartStore.getState().items[0]).toEqual({ slug: 'wild-honey', qty: 1 });
  });
});

describe('Product page', () => {
  const renderProduct = () => renderPage(
    <Routes><Route path="/product/:slug" element={<ProductPage />} /></Routes>,
    { route: '/product/wild-honey' },
  );
  it('shows the product, its details and adds it to the cart', async () => {
    shopApi.product.mockResolvedValue({ ...honey, related: [] });
    renderProduct();
    expect(await screen.findByRole('heading', { name: 'Wild Honey' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^add to cart/i }));
    expect(useCartStore.getState().count).toBe(1);
  });
  it('says so when the product is not found', async () => {
    shopApi.product.mockRejectedValue({ response: { status: 404 } });
    renderProduct();
    expect(await screen.findByText(/can.t find that product/i)).toBeInTheDocument();
  });
  it('does not allow buying a sold-out product', async () => {
    shopApi.product.mockResolvedValue({ ...honey, stockStatus: 'OUT_OF_STOCK', related: [] });
    renderProduct();
    await screen.findByRole('heading', { name: 'Wild Honey' });
    expect(screen.getByRole('button', { name: /out of stock/i })).toBeDisabled();
  });
});

describe('Cart page', () => {
  it('shows an empty cart message', () => {
    renderPage(<CartPage />, { route: '/cart' });
    expect(screen.getByText(/cart is empty/i)).toBeInTheDocument();
  });
  it('shows lines with fresh prices from the shop and the delivery note', async () => {
    useCartStore.getState().add('wild-honey', 2);
    renderPage(<CartPage />, { route: '/cart' });
    expect(await screen.findByText('Wild Honey')).toBeInTheDocument();
    expect(shopApi.products.mock.calls[0][0]).toMatchObject({ slugs: 'wild-honey' });
    expect(screen.getAllByText(/Rs 1,700/).length).toBeGreaterThan(0);
  });
});

describe('Checkout', () => {
  it('validates the form', () => {
    const empty = { customerName: '', customerPhone: '', customerEmail: '', fulfilment: 'DELIVERY', addressLine: '', city: '' };
    expect(Object.keys(validate(empty)).sort()).toEqual(['addressLine', 'city', 'customerName', 'customerPhone']);
    expect(validate({ ...empty, fulfilment: 'PICKUP', customerName: 'Sita', customerPhone: '+977 9812345678' })).toEqual({});
    expect(validate({ ...empty, fulfilment: 'PICKUP', customerName: 'Sita', customerPhone: '9812345678', customerEmail: 'nope' }).customerEmail).toBeTruthy();
  });

  async function fillAndSubmit() {
    useCartStore.getState().add('wild-honey', 2);
    renderPage(<Routes><Route path="/checkout" element={<CheckoutPage />} /><Route path="/order/:orderNumber" element={<div>order placed</div>} /></Routes>, { route: '/checkout' });
    await screen.findByText(/Wild Honey/);
    await userEvent.type(screen.getByLabelText('Full name'), 'Sita Rana');
    await userEvent.type(screen.getByLabelText('Phone'), '9812345678');
    await userEvent.click(screen.getByLabelText(/Pick up/));
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
  }

  it('places a pickup order with only slugs and quantities, then clears the cart', async () => {
    ordersApi.place.mockResolvedValue({ orderNumber: 'SV-1', lines: [] });
    await fillAndSubmit();
    expect(await screen.findByText('order placed')).toBeInTheDocument();
    const sent = ordersApi.place.mock.calls[0][0];
    expect(sent.items).toEqual([{ slug: 'wild-honey', quantity: 2 }]);
    expect(sent.fulfilment).toBe('PICKUP');
    expect(JSON.stringify(sent)).not.toMatch(/price/i);
    expect(useCartStore.getState().items).toEqual([]);
  });
  it('shows the server message when stock ran out and keeps the cart', async () => {
    ordersApi.place.mockRejectedValue({ response: { status: 409, data: { message: 'Wild Honey has only 1 left.' } } });
    await fillAndSubmit();
    expect(await screen.findByText(/only 1 left/)).toBeInTheDocument();
    expect(useCartStore.getState().count).toBe(2);
  });
  it('blocks submission and shows field errors when the form is empty', async () => {
    useCartStore.getState().add('wild-honey', 1);
    renderPage(<CheckoutPage />, { route: '/checkout' });
    await screen.findByText(/Wild Honey/);
    await userEvent.click(screen.getByRole('button', { name: /place order/i }));
    expect(screen.getByText('Enter your name.')).toBeInTheDocument();
    expect(ordersApi.place).not.toHaveBeenCalled();
  });
});

describe('Order tracking', () => {
  it('asks for the phone number and shows the order when it matches', async () => {
    ordersApi.track.mockResolvedValue({ orderNumber: 'SV-261003-AB2C', status: 'CONFIRMED', fulfilment: 'PICKUP', items: [], customerName: 'Sita', customerPhone: '9812345678', subtotal: 850, deliveryFee: 0, total: 850 });
    renderPage(<Routes><Route path="/order/:orderNumber" element={<OrderPage />} /></Routes>, { route: '/order/SV-261003-AB2C' });
    await userEvent.type(screen.getByLabelText(/phone number on the order/i), '9812345678');
    await userEvent.click(screen.getByRole('button', { name: /show my order/i }));
    expect(await screen.findByText(/SV-261003-AB2C/)).toBeInTheDocument();
    expect(ordersApi.track).toHaveBeenCalledWith('SV-261003-AB2C', '9812345678');
  });
  it('shows the server message for a wrong phone number', async () => {
    ordersApi.track.mockRejectedValue({ response: { data: { message: 'We could not find that order.' } } });
    renderPage(<Routes><Route path="/order/:orderNumber" element={<OrderPage />} /></Routes>, { route: '/order/SV-1' });
    await userEvent.type(screen.getByLabelText(/phone number on the order/i), '1');
    await userEvent.click(screen.getByRole('button', { name: /show my order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not find');
  });
});

describe('Header', () => {
  it('shows the business name from the content and the cart count', () => {
    useCartStore.getState().add('a', 3);
    renderPage(<Header />);
    expect(screen.getByLabelText('Samjhana Ventures')).toBeInTheDocument();
    expect(screen.getByLabelText(/Cart, 3 items/)).toBeInTheDocument();
  });
  it('searches the shop', async () => {
    renderPage(<Routes><Route path="/" element={<Header />} /><Route path="/shop" element={<div>shop results</div>} /></Routes>);
    await userEvent.type(screen.getByRole('searchbox'), 'honey{enter}');
    expect(await screen.findByText('shop results')).toBeInTheDocument();
  });
});

describe('Home sections', () => {
  it('renders the hub from content with no built-in text', () => {
    renderPage(<HubLanes />);
    expect(screen.getByText('Come for the journey.')).toBeInTheDocument();
    expect(screen.getByText('Take a little home.')).toBeInTheDocument();
  });
  it('shows restaurant dishes from the API, grouped, marking sold-out and pricing only when set', async () => {
    restaurantApi.menu.mockResolvedValue({ dishes: [
      { id: 'd1', name: 'Dal Bhat', course: 'MAIN', veg: true, available: true, price: 250 },
      { id: 'd2', name: 'Sekuwa', course: 'MAIN', veg: false, available: false, price: null },
    ] });
    renderPage(<RestaurantSection />);
    expect(await screen.findByText('Dal Bhat')).toBeInTheDocument();
    expect(screen.getByText('Rs 250')).toBeInTheDocument();
    expect(screen.getByText('Sold out today')).toBeInTheDocument();
    expect(screen.getByText('Served with rice or dhido')).toBeInTheDocument();
  });
  it('switches meal period', async () => {
    restaurantApi.menu.mockResolvedValue({ dishes: [] });
    renderPage(<RestaurantSection />);
    await userEvent.click(screen.getByRole('tab', { name: /Lunch/ }));
    expect(screen.getByText('Settle in.')).toBeInTheDocument();
    expect(await screen.findByText(/menu is being updated/i)).toBeInTheDocument();
  });
  it('shows live fuel prices and EV rates, and filters vehicles', async () => {
    fuelApi.getCurrent.mockResolvedValue({ petrol: { pricePerLiter: 182.5, effectiveDate: '2026-10-01' }, diesel: { pricePerLiter: 171 } });
    evApi.getVehicles.mockResolvedValue([
      { id: '1', vehicleName: 'Foton Bus', ratePerPercent: 14 }, { id: '2', vehicleName: 'Tata Nexon', ratePerPercent: 9 },
    ]);
    renderPage(<FuelEvSection />);
    expect(await screen.findByText('Rs 182.5/L')).toBeInTheDocument();
    expect(await screen.findByText('Foton Bus')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Search vehicle'), 'nexon');
    expect(screen.queryByText('Foton Bus')).not.toBeInTheDocument();
    expect(within(document.body).getByText('Tata Nexon')).toBeInTheDocument();
  });
  it('still renders when the live prices cannot be loaded', async () => {
    fuelApi.getCurrent.mockRejectedValue(new Error('x'));
    evApi.getVehicles.mockRejectedValue(new Error('x'));
    renderPage(<FuelEvSection />);
    expect(await screen.findByText('Petrol Pump & EV')).toBeInTheDocument();
  });
});
