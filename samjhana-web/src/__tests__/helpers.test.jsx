import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderPage, SITE } from '../test/utils';

vi.mock('../api/api.js', async (orig) => ({ ...(await orig()), ordersApi: { place: vi.fn(), track: vi.fn() } }));
import { ordersApi } from '../api/api.js';
import { useCartStore } from '../store/cartStore';
import OrderPage from '../pages/OrderPage';
import { resolveLink, whatsappLink, mapEmbedUrl } from '../site/links';
import { formatMoney } from '../utils/format';
import { deliveryFeeFor } from '../utils/delivery';
import { toBee, groupBee, toFurniture } from '../data/catalogue';

beforeEach(() => { vi.clearAllMocks(); useCartStore.setState({ items: [], count: 0, total: 0, open: false }); });

describe('helpers', () => {
  it('formats money in lakhs', () => expect(formatMoney(150000)).toBe('Rs 1,50,000'));
  it('turns link tokens into real addresses', () => {
    expect(resolveLink('@whatsapp', SITE.contact)).toMatch(/^https:\/\/wa\.me\/\d+$/);
    expect(resolveLink('@phone', SITE.contact)).toMatch(/^tel:\+?\d+$/);
    expect(resolveLink('/shop')).toBe('/shop');
    expect(whatsappLink(SITE.contact, 'Hi there')).toContain('?text=Hi%20there');
  });
  it('gives no map without coordinates', () => {
    expect(mapEmbedUrl({})).toBe('');
    expect(mapEmbedUrl(SITE.contact)).toContain(String(SITE.contact.latitude));
  });
  it('charges delivery below the free threshold only', () => {
    expect(deliveryFeeFor(1000, { deliveryFee: 150, freeDeliveryOver: 5000 })).toBe(150);
    expect(deliveryFeeFor(5000, { deliveryFee: 150, freeDeliveryOver: 5000 })).toBe(0);
    expect(deliveryFeeFor(100, { deliveryFee: 0 })).toBe(0);
  });
});

describe('product adapters', () => {
  const api = (id, category, details = {}, over = {}) => ({ id, category, name: id, price: '100', stockStatus: 'IN_STOCK', image: '/api/public/media/x', details, ...over });
  it('keeps products in product-code order and groups them by section', () => {
    const g = groupBee([api('hive-002', 'HIVE'), api('kit-001', 'KIT'), api('hive-001', 'HIVE'), api('tool-001', 'TOOL', { category: 'queen' }), api('honey-001', 'HONEY')]);
    expect(g.hives.map((h) => h.id)).toEqual(['hive-001', 'hive-002']);
    expect(g.starterKits).toHaveLength(1);
    expect(g.queenDevices.map((t) => t.id)).toEqual(['tool-001']);
  });
  it('maps details and stock without ever exposing a count', () => {
    const bee = toBee(api('kit-001', 'KIT', { includes: ['a'], originalPrice: 200, savings: 100 }, { stockStatus: 'OUT_OF_STOCK' }));
    expect(bee).toMatchObject({ inStock: false, includes: ['a'], savings: 100, price: 100 });
    expect(toFurniture(api('c', 'CHAIR', {}, { stockStatus: 'LOW_STOCK' }))).toMatchObject({ lowStock: true, inStock: true });
  });
});

describe('cart store', () => {
  const chair = { id: 'oak-chair', name: 'Oak Chair', price: 3200, stockQty: 99, purchasePrice: 5 };
  it('adds, merges, limits and removes lines, keeping only what the cart shows', () => {
    const { addItem, updateQty, removeItem } = useCartStore.getState();
    addItem(chair, 2, false); addItem(chair, 1, false);
    expect(useCartStore.getState().count).toBe(3);
    expect(Object.keys(useCartStore.getState().items[0]).sort()).toEqual(['id', 'imageUrl', 'name', 'price', 'qty']);
    updateQty('oak-chair', 9999);
    expect(useCartStore.getState().items[0].qty).toBe(50);
    removeItem('oak-chair');
    expect(useCartStore.getState().items).toEqual([]);
  });
  it('syncProducts updates prices and marks a product that is gone', () => {
    const { addItem, syncProducts } = useCartStore.getState();
    addItem(chair, 1, false); addItem({ id: 'gone', name: 'Gone', price: 5 }, 1, false);
    syncProducts([{ id: 'oak-chair', name: 'Oak Chair', price: 3500, stockStatus: 'IN_STOCK', image: null }]);
    const items = useCartStore.getState().items;
    expect(items[0].price).toBe(3500);
    expect(items[1].unavailable).toBe(true);
    expect(useCartStore.getState().total).toBe(3500);
  });
});

describe('Order tracking', () => {
  const route = () => <Routes><Route path="/order/:orderNumber" element={<OrderPage />} /></Routes>;
  it('asks for the phone number and shows the order when it matches', async () => {
    ordersApi.track.mockResolvedValue({ orderNumber: 'SV-261003-AB2C', status: 'CONFIRMED', fulfilment: 'PICKUP', items: [], customerName: 'Sita', customerPhone: '9812345678', subtotal: 850, deliveryFee: 0, total: 850 });
    renderPage(route(), { route: '/order/SV-261003-AB2C' });
    await userEvent.type(screen.getByLabelText(/phone number on the order/i), '9812345678');
    await userEvent.click(screen.getByRole('button', { name: /show my order/i }));
    expect(await screen.findByText(/SV-261003-AB2C/)).toBeInTheDocument();
    expect(ordersApi.track).toHaveBeenCalledWith('SV-261003-AB2C', '9812345678');
  });
  it('shows the server message for a wrong phone number', async () => {
    ordersApi.track.mockRejectedValue({ response: { data: { message: 'We could not find that order.' } } });
    renderPage(route(), { route: '/order/SV-1' });
    await userEvent.type(screen.getByLabelText(/phone number on the order/i), '1');
    await userEvent.click(screen.getByRole('button', { name: /show my order/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not find');
  });
});
