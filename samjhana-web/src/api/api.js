import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const furnitureApi = {
  getItems: (category) =>
    api.get('/furniture/items', { params: category && category !== 'ALL' ? { category } : {} })
      .then((r) => r.data),
  getItem: (id) => api.get(`/furniture/items/${id}`).then((r) => r.data),
};

export const evApi = {
  getVehicles: () => api.get('/ev-vehicles').then((r) => r.data),
};

export const fuelApi = {
  getCurrent: () => api.get('/fuel-prices/current').then((r) => r.data),
};