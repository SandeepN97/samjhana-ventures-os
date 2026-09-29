import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const get = vi.fn();
const create = vi.fn(() => ({ get }));
vi.mock('axios', () => ({ default: { create } }));

// What a static host sends back for an unknown path: the site's own page, with status 200.
const INDEX_HTML = '<!doctype html><html><body><div id="root"></div></body></html>';

async function loadApi(apiBase) {
  vi.resetModules();
  if (apiBase === undefined) vi.stubEnv('VITE_API_BASE', '');
  else vi.stubEnv('VITE_API_BASE', apiBase);
  return import('../api/api.js');
}

describe('public API client', () => {
  beforeEach(() => { get.mockReset(); create.mockClear(); });
  afterEach(() => vi.unstubAllEnvs());

  it('calls the backend at VITE_API_BASE when it is set', async () => {
    const { API_BASE } = await loadApi('https://backend-staging.example.com/');
    expect(API_BASE).toBe('https://backend-staging.example.com/api/public');
    expect(create).toHaveBeenCalledWith({ baseURL: 'https://backend-staging.example.com/api/public' });
  });

  it('keeps relative calls for local dev when VITE_API_BASE is not set', async () => {
    const { API_BASE } = await loadApi();
    expect(API_BASE).toBe('/api/public');
  });

  it('returns the list when the server sends one', async () => {
    const { evApi } = await loadApi();
    get.mockResolvedValue({ data: [{ id: 'v1', vehicleName: 'Foton', ratePerPercent: 14 }] });
    await expect(evApi.getVehicles()).resolves.toHaveLength(1);
  });

  it('rejects an HTML page instead of passing it on as data', async () => {
    const { evApi, furnitureApi, fuelApi } = await loadApi();
    get.mockResolvedValue({ data: INDEX_HTML });
    await expect(evApi.getVehicles()).rejects.toThrow('Unexpected response');
    await expect(furnitureApi.getItems()).rejects.toThrow('Unexpected response');
    await expect(furnitureApi.getItem('x')).rejects.toThrow('Unexpected response');
    await expect(fuelApi.getCurrent()).rejects.toThrow('Unexpected response');
  });

  it('rejects a list where one item was expected', async () => {
    const { fuelApi } = await loadApi();
    get.mockResolvedValue({ data: [] });
    await expect(fuelApi.getCurrent()).rejects.toThrow('Unexpected response');
  });

  it('passes the category filter through, but not "ALL"', async () => {
    const { furnitureApi } = await loadApi();
    get.mockResolvedValue({ data: [] });
    await furnitureApi.getItems('SOFA');
    await furnitureApi.getItems('ALL');
    expect(get).toHaveBeenNthCalledWith(1, '/furniture/catalogue', { params: { category: 'SOFA' } });
    expect(get).toHaveBeenNthCalledWith(2, '/furniture/catalogue', { params: {} });
  });
});
