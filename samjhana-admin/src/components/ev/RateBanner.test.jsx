import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RateBanner from './RateBanner';
import { renderWithProviders } from '../../test/test-utils';

const settings = vi.hoisted(() => ({ values: {}, failPut: false, failGet: false }));

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (settings.failGet) return Promise.reject(new Error('down'));
      const key = url.split('/').pop();
      return Promise.resolve({ data: { key, value: settings.values[key] || '' } });
    }),
    put: vi.fn((url, body) => {
      if (settings.failPut) return Promise.reject({ response: { data: { message: 'Admin or manager access required' } } });
      settings.values[url.split('/').pop()] = body.value;
      return Promise.resolve({ data: { value: body.value } });
    }),
  },
}));

import api from '../../utils/api';

describe('RateBanner (NEA rate — admins and managers)', () => {
  const showToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    settings.values = { nea_rate: '12.5' };
    settings.failPut = false;
    settings.failGet = false;
  });

  it('shows only the NEA rate, not a customer rate', async () => {
    renderWithProviders(<RateBanner showToast={showToast} />);
    expect(screen.getByText(/NEA Rate per Unit/)).toBeInTheDocument();
    expect(await screen.findByText('12.50')).toBeInTheDocument();
    expect(screen.getByText(/\/kWh \(Rs\)/)).toBeInTheDocument();
    // Customers are charged by car type and percentage, so there is no per-kWh price row.
    expect(screen.queryByText(/Rate charged per kWh/)).toBeNull();
    expect(screen.getAllByRole('button', { name: /Update/ })).toHaveLength(1);
  });

  it('loads the rate from the NEA setting only', async () => {
    renderWithProviders(<RateBanner showToast={showToast} />);
    await screen.findByText('12.50');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith('/api/settings/nea_rate', { skipAuthRedirect: true });
  });

  it('shows a dash when no rate has been set yet', async () => {
    settings.values = {};
    renderWithProviders(<RateBanner showToast={showToast} />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('lets an admin edit and save the rate, with the Rs prefix', async () => {
    renderWithProviders(<RateBanner showToast={showToast} />);
    await screen.findByText('12.50');

    await userEvent.click(screen.getByRole('button', { name: /Update/ }));
    expect(screen.getByText('Rs')).toBeInTheDocument();
    const input = screen.getByRole('spinbutton', { name: /NEA Rate per Unit/ });
    await userEvent.clear(input);
    await userEvent.type(input, '13.25');
    await userEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/settings/nea_rate', { value: '13.25' }, { skipAuthRedirect: true }));
    expect(await screen.findByText('13.25')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Rate updated', 'success');
    expect(localStorage.getItem('ev_nea_rate')).toBe('13.25');
  });

  it('saves with the Enter key and cancels with Escape', async () => {
    renderWithProviders(<RateBanner showToast={showToast} />);
    await screen.findByText('12.50');

    await userEvent.click(screen.getByRole('button', { name: /Update/ }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(api.put).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /Update/ }));
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '14{Enter}');
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/settings/nea_rate', { value: '14' }, { skipAuthRedirect: true }));
  });

  it('does not save an empty or non-positive rate', async () => {
    renderWithProviders(<RateBanner showToast={showToast} />);
    await screen.findByText('12.50');
    await userEvent.click(screen.getByRole('button', { name: /Update/ }));
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Save rate' }));
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    expect(api.put).not.toHaveBeenCalled();
  });

  it('keeps editing and shows the server message when saving fails', async () => {
    settings.failPut = true;
    renderWithProviders(<RateBanner showToast={showToast} />);
    await screen.findByText('12.50');
    await userEvent.click(screen.getByRole('button', { name: /Update/ }));
    const input = screen.getByRole('spinbutton');
    await userEvent.clear(input);
    await userEvent.type(input, '99');
    await userEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Admin or manager access required', 'error'));
    expect(screen.getByRole('spinbutton')).toBeInTheDocument();
  });

  it('falls back to the cached rate when the server is unreachable', async () => {
    localStorage.setItem('ev_nea_rate', '11');
    settings.failGet = true;
    renderWithProviders(<RateBanner showToast={showToast} />);
    expect(await screen.findByText('11.00')).toBeInTheDocument();
  });

  it('can be shown read-only', async () => {
    renderWithProviders(<RateBanner canEdit={false} showToast={showToast} />);
    await screen.findByText('12.50');
    expect(screen.queryByRole('button', { name: /Update/ })).toBeNull();
  });

  it('links to the NEA bills page when a handler is provided', async () => {
    const onOpenBills = vi.fn();
    renderWithProviders(<RateBanner showToast={showToast} onOpenBills={onOpenBills} />);
    await userEvent.click(screen.getByRole('button', { name: /NEA bills & reconciliation/ }));
    expect(onOpenBills).toHaveBeenCalled();
  });

  it('prefixes the rate box with "रु" and shows Devanagari numerals in Nepali', async () => {
    renderWithProviders(<RateBanner showToast={showToast} />, { locale: 'ne' });
    expect(await screen.findByText('१२.५०')).toBeInTheDocument();
    expect(screen.getByText(/\/kWh \(रु\)/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /बदल्नुहोस्/ }));
    expect(screen.getByText('रु')).toBeInTheDocument();
    expect(screen.queryByText('Rs')).toBeNull();
  });
});
