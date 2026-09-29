import axios from 'axios';

// The public site is its own static site in staging/prod, so it must call the backend by its full
// address (VITE_API_BASE, read at build time). Left unset, calls stay relative: `npm run dev`
// proxies /api to the local backend (vite.config.js).
export const API_BASE = `${(import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')}/api/public`;

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

export const furnitureApi = {
  getItems: (category) =>
    api.get('/furniture/catalogue', { params: category && category !== 'ALL' ? { category } : {} })
      .then(list),
  getItem: (id) => api.get(`/furniture/catalogue/${id}`).then(object),
};

export const evApi = {
  getVehicles: () => api.get('/ev/rates').then(list),
};

export const fuelApi = {
  getCurrent: () => api.get('/fuel-prices/current').then(object),
};
