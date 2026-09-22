import { describe, it, expect, beforeEach } from 'vitest';
import api from './api';

// Replace the network with an adapter that records the request config it is handed.
function captureRequests() {
  const seen = [];
  api.defaults.adapter = async (config) => {
    seen.push(config);
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
  };
  return seen;
}

describe('api request interceptor', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adds the stored token when the caller sets no Authorization header', async () => {
    localStorage.setItem('token', 'stored-token');
    const seen = captureRequests();

    await api.get('/api/anything');

    expect(seen[0].headers.get('Authorization')).toBe('Bearer stored-token');
  });

  it('does not overwrite an Authorization header the caller set explicitly', async () => {
    // A stale token left in localStorage must not defeat a fresh token passed for one request.
    localStorage.setItem('token', 'stale-token');
    const seen = captureRequests();

    await api.post('/api/anything', {}, { headers: { Authorization: 'Bearer fresh-token' } });

    expect(seen[0].headers.get('Authorization')).toBe('Bearer fresh-token');
  });

  it('sends no Authorization header when there is no stored token', async () => {
    const seen = captureRequests();

    await api.get('/api/anything');

    expect(seen[0].headers.get('Authorization')).toBeFalsy();
  });
});
