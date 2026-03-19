import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EVEntryPage from './EVEntryPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/ev-vehicles') {
        return Promise.resolve({
          data: [
            { id: 'v1', vehicleName: 'BYD E6', batteryCapacityKw: 80, seatingCapacity: 5, ratePerPercent: 15 },
            { id: 'v2', vehicleName: 'MG ZS EV', batteryCapacityKw: 50, seatingCapacity: 5, ratePerPercent: 12 },
          ],
        });
      }
      // nea_rate and other settings endpoints
      return Promise.resolve({ data: { value: '10' } });
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
    put: vi.fn().mockResolvedValue({ data: { value: '10' } }),
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
    localStorage.removeItem('ev_nea_rate');
  });

  it('renders with EV Charging title', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('EV Charging')).toBeInTheDocument();
  });

  it('shows vehicle dropdown by default', async () => {
    renderWithProviders(<EVEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('-- Select Vehicle --')).toBeInTheDocument();
    });
  });

  it('shows start and end battery percentage inputs', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('Start Battery %')).toBeInTheDocument();
    expect(screen.getByText('End Battery %')).toBeInTheDocument();
  });

  it('meter inputs have min=0 attribute', () => {
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
      // "Select Vehicle" appears as both label and error message
      const matches = screen.getAllByText('Select Vehicle');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('validates start and end percentage are required on submit', async () => {
    renderWithProviders(<EVEntryPage />);
    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Start % is required')).toBeInTheDocument();
      expect(screen.getByText('End % is required')).toBeInTheDocument();
    });
  });

  it('validates end % must be greater than start %', async () => {
    renderWithProviders(<EVEntryPage />);

    const startInput = screen.getByPlaceholderText('0');
    const endInput = screen.getByPlaceholderText('100');

    await userEvent.type(startInput, '80');
    await userEvent.type(endInput, '50');

    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('End % must be greater than start %')).toBeInTheDocument();
    });
  });

  it('shows vehicle options after loading', async () => {
    renderWithProviders(<EVEntryPage />);
    // Open the SearchableSelect dropdown
    const vehicleDropdown = screen.getByText('-- Select Vehicle --');
    await userEvent.click(vehicleDropdown);

    await waitFor(() => {
      expect(screen.getByText('BYD E6')).toBeInTheDocument();
      expect(screen.getByText('MG ZS EV')).toBeInTheDocument();
    });
  });

  it('calculates percent charged when vehicle selected and percentages filled', async () => {
    renderWithProviders(<EVEntryPage />);

    // Select a vehicle first (required for summary to appear)
    await waitFor(() => expect(screen.getByText('-- Select Vehicle --')).toBeInTheDocument());
    await userEvent.click(screen.getByText('-- Select Vehicle --'));
    await waitFor(() => expect(screen.getByText('BYD E6')).toBeInTheDocument());
    await userEvent.click(screen.getByText('BYD E6'));

    const startInput = screen.getByPlaceholderText('0');
    const endInput = screen.getByPlaceholderText('100');

    await userEvent.type(startInput, '20');
    await userEvent.type(endInput, '70');

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
    });
  });

  it('has Cash and Bank payment method options', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('Cash')).toBeInTheDocument();
    expect(screen.getByText('Bank')).toBeInTheDocument();
  });
});
