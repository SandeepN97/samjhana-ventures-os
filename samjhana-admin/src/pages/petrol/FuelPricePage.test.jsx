import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FuelPricePage from './FuelPricePage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/api/fuel-prices/current')) {
        return Promise.resolve({
          data: {
            petrol: { pricePerLiter: 154.5 },
            diesel: { pricePerLiter: 148.0 },
          },
        });
      }
      if (url === '/api/fuel-prices') {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('FuelPricePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders Fuel Prices title', () => {
    renderWithProviders(<FuelPricePage />);
    expect(screen.getByText('Fuel Prices')).toBeInTheDocument();
  });

  it('shows current petrol price after loading', async () => {
    renderWithProviders(<FuelPricePage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('154.5')).toBeInTheDocument();
    });
  });

  it('shows current diesel price after loading', async () => {
    renderWithProviders(<FuelPricePage />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('148')).toBeInTheDocument();
    });
  });

  it('admin sees Save Prices button', async () => {
    renderWithProviders(<FuelPricePage />);
    await waitFor(() => {
      expect(screen.getByText('Save Prices')).toBeInTheDocument();
    });
  });

  it('admin sees Fetch NOC Prices button', () => {
    renderWithProviders(<FuelPricePage />);
    expect(screen.getByText('Fetch NOC Prices')).toBeInTheDocument();
  });

  it('staff sees view-only notice instead of update form', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<FuelPricePage />);
    await waitFor(() => {
      expect(screen.getByText(/You can only view prices/)).toBeInTheDocument();
    });
  });

  it('staff does not see Save Prices button', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<FuelPricePage />);
    await waitFor(() => {
      expect(screen.queryByText('Save Prices')).not.toBeInTheDocument();
    });
  });

  it('shows Price History section', async () => {
    renderWithProviders(<FuelPricePage />);
    await waitFor(() => {
      expect(screen.getByText('Price History')).toBeInTheDocument();
    });
  });
});
