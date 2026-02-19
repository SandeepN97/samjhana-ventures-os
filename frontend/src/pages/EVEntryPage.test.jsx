import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EVEntryPage from './EVEntryPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: [
        { id: 'v1', vehicleName: 'BYD E6', batteryCapacityKw: 80, seatingCapacity: 5, ratePerPercent: 15 },
        { id: 'v2', vehicleName: 'MG ZS EV', batteryCapacityKw: 50, seatingCapacity: 5, ratePerPercent: 12 },
      ],
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

  it('shows Meter Reading mode by default', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('Meter Reading')).toBeInTheDocument();
    expect(screen.getByText('Opening Meter')).toBeInTheDocument();
  });

  it('switches to Percentage mode', async () => {
    renderWithProviders(<EVEntryPage />);
    await userEvent.click(screen.getByText('Percentage Based'));
    expect(screen.getByText('Select Vehicle')).toBeInTheDocument();
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

  it('validates required fields in meter mode on submit', async () => {
    renderWithProviders(<EVEntryPage />);

    // Clear the opening meter and try to submit
    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Opening meter reading is required')).toBeInTheDocument();
    });
  });

  it('validates closing meter must be greater than opening', async () => {
    renderWithProviders(<EVEntryPage />);

    const [openingInput, closingInput] = screen.getAllByPlaceholderText('0.00').slice(0, 2);
    await userEvent.type(openingInput, '100');
    await userEvent.type(closingInput, '50');

    // Fill unit rate too
    const rateInput = screen.getAllByPlaceholderText('0.00')[2];
    if (rateInput) await userEvent.type(rateInput, '10');

    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Closing meter must be greater than opening')).toBeInTheDocument();
    });
  });

  it('shows vehicle dropdown in percentage mode with SearchableSelect', async () => {
    renderWithProviders(<EVEntryPage />);
    await userEvent.click(screen.getByText('Percentage Based'));

    await waitFor(() => {
      // SearchableSelect shows the placeholder
      expect(screen.getByText('-- Select Vehicle --')).toBeInTheDocument();
    });
  });

  it('validates vehicle selection in percentage mode', async () => {
    renderWithProviders(<EVEntryPage />);
    await userEvent.click(screen.getByText('Percentage Based'));

    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Select a vehicle')).toBeInTheDocument();
    });
  });

  it('validates start/end percentage in percentage mode', async () => {
    renderWithProviders(<EVEntryPage />);
    await userEvent.click(screen.getByText('Percentage Based'));

    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Start % is required')).toBeInTheDocument();
      expect(screen.getByText('End % is required')).toBeInTheDocument();
    });
  });

  it('calculates units charged in meter mode', async () => {
    renderWithProviders(<EVEntryPage />);

    const inputs = screen.getAllByPlaceholderText('0.00');
    await userEvent.type(inputs[0], '100'); // opening
    await userEvent.type(inputs[1], '150'); // closing

    await waitFor(() => {
      expect(screen.getByText('50.00 kWh')).toBeInTheDocument();
    });
  });

  it('has DC Fast and AC Slow charger options', () => {
    renderWithProviders(<EVEntryPage />);
    expect(screen.getByText('DC Fast')).toBeInTheDocument();
    expect(screen.getByText('AC Slow')).toBeInTheDocument();
  });
});
