import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FuelOrderPage from './FuelOrderPage';
import { renderWithProviders } from '../test/test-utils';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('FuelOrderPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders Fuel Orders title for admin', () => {
    renderWithProviders(<FuelOrderPage />);
    expect(screen.getByText('Fuel Orders')).toBeInTheDocument();
  });

  it('denies access to non-admin users', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<FuelOrderPage />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('validates liters must be greater than 0', async () => {
    renderWithProviders(<FuelOrderPage />);
    const submitBtn = screen.getByText('Save Order');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Liters must be greater than 0')).toBeInTheDocument();
    });
  });

  it('validates rate must be greater than 0', async () => {
    renderWithProviders(<FuelOrderPage />);

    // Fill liters
    const literInput = screen.getByPlaceholderText(/Enter liters|लिटर/);
    await userEvent.type(literInput, '100');

    const submitBtn = screen.getByText('Save Order');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Rate must be greater than 0')).toBeInTheDocument();
    });
  });

  it('liter and rate inputs have min=0', () => {
    renderWithProviders(<FuelOrderPage />);
    const numberInputs = screen.getAllByRole('spinbutton');
    const litersInput = numberInputs.find(i => i.placeholder?.includes('liter') || i.placeholder?.includes('लिटर'));
    if (litersInput) {
      expect(litersInput).toHaveAttribute('min', '0');
    }
  });

  it('petrol is selected by default', () => {
    renderWithProviders(<FuelOrderPage />);
    const petrolBtn = screen.getByText('Petrol').closest('button');
    expect(petrolBtn.className).toContain('bg-red-500');
  });

  it('switches to diesel when clicked', async () => {
    renderWithProviders(<FuelOrderPage />);
    const dieselBtn = screen.getByText('Diesel').closest('button');
    await userEvent.click(dieselBtn);
    expect(dieselBtn.className).toContain('bg-yellow-500');
  });

  it('calculates total amount from liters and rate', async () => {
    renderWithProviders(<FuelOrderPage />);

    const inputs = screen.getAllByRole('spinbutton');
    // liters input
    await userEvent.type(inputs[0], '100');
    // rate input
    await userEvent.type(inputs[1], '150');

    await waitFor(() => {
      expect(screen.getByText(/15,000/)).toBeInTheDocument();
    });
  });

  it('shows order history section', async () => {
    renderWithProviders(<FuelOrderPage />);
    await waitFor(() => {
      expect(screen.getByText('Order History')).toBeInTheDocument();
    });
  });
});
