import axios from 'axios';

const api = axios.create({ baseURL: '/api/public' });

export const furnitureApi = {
  getItems: (category) =>
    api.get('/furniture/catalogue', { params: category && category !== 'ALL' ? { category } : {} })
      .then((r) => r.data),
  getItem: (id) => api.get(`/furniture/catalogue/${id}`).then((r) => r.data),
};

export const evApi = {
  getVehicles: () => api.get('/ev/rates').then((r) => r.data),
};

export const fuelApi = {
  getCurrent: () => api.get('/fuel-prices/current').then((r) => r.data),
};