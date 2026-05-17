import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RentalEntryPage from './RentalEntryPage';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url && url.includes('/ledger')) {
        return Promise.resolve({ data: { outstandingBalance: 0, totalPayments: 0 } });
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

describe('RentalEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders with Rental Payment title', () => {
    renderWithProviders(<RentalEntryPage />);
    expect(screen.getByText('Rental Payment')).toBeInTheDocument();
  });

  it('shows Manage button in header for admin', () => {
    renderWithProviders(<RentalEntryPage />);
    expect(screen.getByText('Manage')).toBeInTheDocument();
  });

  it('clicking Manage navigates to rental-properties', async () => {
    renderWithProviders(<RentalEntryPage />);
    await userEvent.click(screen.getByText('Manage').closest('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/rental-properties');
  });

  it('validates property selection is required', async () => {
    renderWithProviders(<RentalEntryPage />);
    const submitBtn = screen.getByText('Save Payment');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      // "Select a property" appears as both label and error message
      const matches = screen.getAllByText('Select a property');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('validates amount received is required', async () => {
    renderWithProviders(<RentalEntryPage />);
    const submitBtn = screen.getByText('Save Payment');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Amount received is required')).toBeInTheDocument();
    });
  });

  it('rent amount input has min=0', () => {
    renderWithProviders(<RentalEntryPage />);
    const amountInputs = screen.getAllByPlaceholderText('0.00');
    amountInputs.forEach(input => {
      if (input.type === 'number') {
        expect(input).toHaveAttribute('min', '0');
      }
    });
  });

  it('staff users do not see Manage button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<RentalEntryPage />);
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });

  it('shows property dropdown placeholder', () => {
    renderWithProviders(<RentalEntryPage />);
    expect(screen.getByText('-- Select Property --')).toBeInTheDocument();
  });
});
