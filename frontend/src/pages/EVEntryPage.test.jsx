import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EVEntryPage from './EVEntryPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('/api/ev-vehicles')) {
        return Promise.resolve({
          data: [
            { id: 'v1', vehicleName: 'BYD E6', batteryCapacityKw: 80, seatingCapacity: 5, ratePerPercent: 15 },
            { id: 'v2', vehicleName: 'MG ZS EV', batteryCapacityKw: 50, seatingCapacity: 5, ratePerPercent: 12 },
          ],
        });
      }
      if (url.includes('/api/settings/nea_rate')) {
        return Promise.resolve({ data: { value: '12.5' } });
      }
      return Promise.resolve({ data: [] });
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('EVEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders with EV Charging title', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('EV Charging')).toBeInTheDocument();
  });

  it('shows vehicle selection by default', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('Select Vehicle')).toBeInTheDocument();
  });

  it('shows vehicle dropdown with SearchableSelect', async () => {
    renderWithProviders(<EVEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('-- Select Vehicle --')).toBeInTheDocument();
    });
  });

  it('number inputs have min=0 attribute', () => {
    renderWithProviders(<EVEntryPage />);
    const numberInputs = screen.getAllByRole('spinbutton');
    numberInputs.forEach(input => {
      if (input.getAttribute('min') !== null) {
        expect(Number(input.getAttribute('min'))).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('validates vehicle selection is required on submit', async () => {
    renderWithProviders(<EVEntryPage />);
    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      // Text appears as both label and error message
      expect(screen.getAllByText('Select Vehicle').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('validates start and end percentage are required', async () => {
    renderWithProviders(<EVEntryPage />);
    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Start % is required')).toBeInTheDocument();
      expect(screen.getByText('End % is required')).toBeInTheDocument();
    });
  });

  it('shows NEA rate section', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText(/NEA Rate per Unit/)).toBeInTheDocument();
  });

  it('shows Manage Vehicles button for admin', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('Manage Vehicles')).toBeInTheDocument();
  });
});
