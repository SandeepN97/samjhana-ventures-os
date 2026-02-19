import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RentalEntryPage from './RentalEntryPage';
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

describe('RentalEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders with Rental title', () => {
    renderWithProviders(<RentalEntryPage />);
    expect(screen.getByText('Rental')).toBeInTheDocument();
  });

  it('shows mode toggle for admin', () => {
    renderWithProviders(<RentalEntryPage />);
    expect(screen.getByText('Add Payment')).toBeInTheDocument();
    expect(screen.getByText('Manage')).toBeInTheDocument();
  });

  it('validates property name is required', async () => {
    renderWithProviders(<RentalEntryPage />);
    const submitBtn = screen.getByText('Save Payment');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Property name is required')).toBeInTheDocument();
    });
  });

  it('validates rent amount must be greater than 0', async () => {
    renderWithProviders(<RentalEntryPage />);

    // Fill property name
    const propInput = screen.getByPlaceholderText(/Room No/);
    await userEvent.type(propInput, 'Room 101');

    const submitBtn = screen.getByText('Save Payment');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Amount must be greater than 0')).toBeInTheDocument();
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

  it('staff users see info banner', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<RentalEntryPage />);
    expect(screen.getByText(/You can only record rent payments received/)).toBeInTheDocument();
  });

  it('staff users do not see mode toggle', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<RentalEntryPage />);
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
  });

  it('shows manage form when Manage tab is clicked', async () => {
    renderWithProviders(<RentalEntryPage />);
    await userEvent.click(screen.getByText('Manage'));
    expect(screen.getByText('Transaction Type')).toBeInTheDocument();
    expect(screen.getByText('Rent Received')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });
});
