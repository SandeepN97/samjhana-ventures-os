import axios from 'axios';

// The public site is its own static site in staging/prod, so it must call the backend by its full
// address (VITE_API_BASE, read at build time). Left unset, calls stay relative: `npm run dev`
// proxies /api to the local backend (vite.config.js).
export const API_ROOT = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
export const API_BASE = `${API_ROOT}/api/public`;

const api = axios.create({ baseURL: API_BASE });

// A static host answers unknown paths with the site's own index.html (status 200). Treat anything
// that isn't the expected JSON shape as a failed request, so pages show their empty/error state
// instead of crashing on e.g. "vehicles.map is not a function".
const list = (r) => {
  if (!Array.isArray(r.data)) throw new Error('Unexpected response from the server');
  return r.data;
};
const object = (r) => {
  if (r.data === null || typeof r.data !== 'object' || Array.isArray(r.data)) {
    throw new Error('Unexpected response from the server');
  }
  return r.data;
};

/** Where a picture can be shown. The API sends picture addresses as paths like /api/public/media/<id>. */
export function mediaUrl(path) {
  return path ? `${API_ROOT}${path}` : '';
}

/** The API path of a picture chosen by id in the website content (those fields hold ids, not paths). */
export function mediaPath(id) {
  return id ? `/api/public/media/${id}` : '';
}

/** The message the server gave for a refused request, or the fallback. */
export function errorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

export const siteApi = {
  get: () => api.get('/site').then(object),
};

export const shopApi = {
  /** params: type, category, q, minPrice, maxPrice, inStock, sort, page, size, slugs */
  products: (params = {}) => api.get('/shop/products', { params }).then(object),
  product: (slug) => api.get(`/shop/products/${encodeURIComponent(slug)}`).then(object),
};

export const restaurantApi = {
  menu: () => api.get('/restaurant').then(object),
};

export const ordersApi = {
  place: (order) => api.post('/shop/orders', order).then(object),
  track: (orderNumber, phone) =>
    api.get(`/shop/orders/${encodeURIComponent(orderNumber)}`, { params: { phone } }).then(object),
};

export const evApi = {
  getVehicles: () => api.get('/ev/rates').then(list),
};

export const fuelApi = {
  getCurrent: () => api.get('/fuel-prices/current').then(object),
};
