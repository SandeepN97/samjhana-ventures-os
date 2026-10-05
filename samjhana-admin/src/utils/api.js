import axios from 'axios';
import { clearSignIn } from './session';

// In dev, Vite proxies /api → localhost:8080 (no baseURL needed).
// In production (Vercel), set VITE_API_URL to the Railway backend URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // An Authorization header the caller set explicitly wins, so a stale stored token cannot replace it.
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // skipAuthRedirect: true means this request handles auth errors itself — don't auto-logout
    // An admin reset this password: nothing works until the person has chosen their own.
    if (error.response?.status === 403 && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED') {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...user, mustChangePassword: true }));
      } catch { /* the page redirect below still happens */ }
      if (window.location.pathname !== '/change-password') window.location.href = '/change-password';
      return Promise.reject(error);
    }
    if (!error.config?.skipAuthRedirect) {
      if (error.response?.status === 401 ||
          (error.response?.status === 403 && !error.response?.data?.message)) {
        clearSignIn();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
