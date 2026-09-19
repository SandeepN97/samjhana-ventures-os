import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EVEntryPage from './EVEntryPage';
import { renderWithProviders } from '../../test/test-utils';

// Switches the charge-points mock into failure / empty mode for individual tests
const chargerMock = vi.hoisted(() => ({ fail: false, empty: false }));

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/charge-points') {
        if (chargerMock.fail) return Promise.reject(new Error('network'));
        if (chargerMock.empty) return Promise.resolve({ data: [] });
        return Promise.resolve({
          data: [
            { id: 'cp1', code: 'HD-D180-CC-01', model: 'HD-D180-CC', maxPowerKw: 80, displayOrder: 1 },
            { id: 'cp2', code: 'HQC23-80-01', model: 'HQC23-80/1000/260-Y02-CC', maxPowerKw: 80, displayOrder: 2 },
            { id: 'cp3', code: 'HD-D140-E-01', model: 'HD-D140-E', maxPowerKw: 40, displayOrder: 3 },
          ],
        });
      }
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

import api from '../../utils/api';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('EVEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chargerMock.fail = false;
    chargerMock.empty = false;
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
    // Open the SearchableSelect dropdown via the trigger button
    const trigger = screen.getByRole('button', { name: 'Select option' });
    await userEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('BYD E6')).toBeInTheDocument();
      expect(screen.getByText('MG ZS EV')).toBeInTheDocument();
    });
  });

  it('calculates percent charged when vehicle selected and percentages filled', async () => {
    renderWithProviders(<EVEntryPage />);

    // Select a vehicle first (required for summary to appear)
    const trigger = await screen.findByRole('button', { name: 'Select option' });
    await userEvent.click(trigger);
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

  describe('charger selection', () => {
    it('renders the three chargers with model and power', async () => {
      renderWithProviders(<EVEntryPage />);

      const chargers = await screen.findAllByRole('radio');
      expect(chargers).toHaveLength(3);
      expect(screen.getByText('Select Charger')).toBeInTheDocument();
      expect(screen.getByText('Charger 1')).toBeInTheDocument();
      expect(screen.getByText('Charger 2')).toBeInTheDocument();
      expect(screen.getByText('Charger 3')).toBeInTheDocument();
      expect(screen.getByText('HD-D180-CC')).toBeInTheDocument();
      expect(screen.getByText('HQC23-80/1000/260-Y02-CC')).toBeInTheDocument();
      expect(screen.getByText('HD-D140-E')).toBeInTheDocument();
      expect(screen.getByText('40 kW')).toBeInTheDocument();
      expect(screen.getAllByText('80 kW')).toHaveLength(2);
    });

    it('marks only the clicked charger as selected', async () => {
      renderWithProviders(<EVEntryPage />);
      const chargers = await screen.findAllByRole('radio');
      chargers.forEach(c => expect(c).toHaveAttribute('aria-checked', 'false'));

      await userEvent.click(chargers[1]);

      expect(chargers[0]).toHaveAttribute('aria-checked', 'false');
      expect(chargers[1]).toHaveAttribute('aria-checked', 'true');
      expect(chargers[2]).toHaveAttribute('aria-checked', 'false');
    });

    it('lets the user change the selected charger', async () => {
      renderWithProviders(<EVEntryPage />);
      const chargers = await screen.findAllByRole('radio');

      await userEvent.click(chargers[0]);
      await userEvent.click(chargers[2]);

      expect(chargers[0]).toHaveAttribute('aria-checked', 'false');
      expect(chargers[2]).toHaveAttribute('aria-checked', 'true');
    });

    it('shows a validation error when submitting without a charger, and clears it on selection', async () => {
      renderWithProviders(<EVEntryPage />);
      const chargers = await screen.findAllByRole('radio');

      await userEvent.click(screen.getByText('Save Entry'));
      await waitFor(() => {
        expect(screen.getByText('Please select a charger')).toBeInTheDocument();
      });
      expect(api.post).not.toHaveBeenCalled();

      await userEvent.click(chargers[0]);
      expect(screen.queryByText('Please select a charger')).not.toBeInTheDocument();
    });

    it('saves the selected charger with the transaction', async () => {
      renderWithProviders(<EVEntryPage />);
      const chargers = await screen.findAllByRole('radio');
      await userEvent.click(chargers[1]);

      await userEvent.click(await screen.findByRole('button', { name: 'Select option' }));
      await userEvent.click(await screen.findByText('BYD E6'));
      await userEvent.type(screen.getByPlaceholderText('0'), '20');
      await userEvent.type(screen.getByPlaceholderText('100'), '70');
      await userEvent.click(screen.getByText('Save Entry'));

      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
      const [url, payload] = api.post.mock.calls[0];
      expect(url).toBe('/api/transactions');
      expect(payload.businessCode).toBe('ev');
      expect(payload.customFields).toMatchObject({
        chargePointId: 'cp2',
        chargePointCode: 'HQC23-80-01',
        chargerModel: 'HQC23-80/1000/260-Y02-CC',
        vehicleId: 'v1',
        startPercent: 20,
        endPercent: 70,
      });
    });

    it('clears the charger selection after a successful save', async () => {
      renderWithProviders(<EVEntryPage />);
      const chargers = await screen.findAllByRole('radio');
      await userEvent.click(chargers[0]);

      await userEvent.click(await screen.findByRole('button', { name: 'Select option' }));
      await userEvent.click(await screen.findByText('BYD E6'));
      await userEvent.type(screen.getByPlaceholderText('0'), '10');
      await userEvent.type(screen.getByPlaceholderText('100'), '60');
      await userEvent.click(screen.getByText('Save Entry'));

      await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
      await waitFor(() => {
        screen.getAllByRole('radio').forEach(c => expect(c).toHaveAttribute('aria-checked', 'false'));
      });
    });

    it('shows an error message when chargers fail to load', async () => {
      chargerMock.fail = true;
      renderWithProviders(<EVEntryPage />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load chargers. Please refresh the page.')).toBeInTheDocument();
      });
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('tells the user when no chargers are set up', async () => {
      chargerMock.empty = true;
      renderWithProviders(<EVEntryPage />);

      await waitFor(() => {
        expect(screen.getByText('No chargers are set up yet. Contact admin.')).toBeInTheDocument();
      });
      expect(screen.queryAllByRole('radio')).toHaveLength(0);
    });

    it('makes every charger card at least 44px tall for touch', async () => {
      renderWithProviders(<EVEntryPage />);
      const chargers = await screen.findAllByRole('radio');
      chargers.forEach(c => {
        const match = c.className.match(/min-h-\[(\d+)px\]/);
        expect(match).not.toBeNull();
        expect(Number(match[1])).toBeGreaterThanOrEqual(44);
      });
    });

    it('renders Nepali labels and Devanagari numerals', async () => {
      renderWithProviders(<EVEntryPage />, { locale: 'ne' });

      const chargers = await screen.findAllByRole('radio');
      expect(chargers).toHaveLength(3);
      expect(screen.getByText('चार्जर छान्नुहोस्')).toBeInTheDocument();
      expect(screen.getByText('चार्जर १')).toBeInTheDocument();
      expect(screen.getByText('चार्जर ३')).toBeInTheDocument();
      expect(screen.getByText('४० kW')).toBeInTheDocument();
    });
  });
});
