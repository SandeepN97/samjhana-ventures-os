import axios from 'axios';

// In dev, Vite proxies /api → localhost:8080 (no baseURL needed).
// In production (Vercel), set VITE_API_URL to the Railway backend URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 ||
        (error.response?.status === 403 && !error.response?.data?.message)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
