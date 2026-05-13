import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoanEntryPage from './LoanEntryPage';
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

describe('LoanEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders with Bank Loan title', async () => {
    renderWithProviders(<LoanEntryPage />);
    expect(screen.getByText('Bank Loan')).toBeInTheDocument();
  });

  it('shows summary view by default', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
      expect(screen.getByText('Make Payment')).toBeInTheDocument();
    });
  });

  it('shows Add Loan form when Add Loan is clicked', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Add Loan'));
    expect(screen.getByText('Add New Bank Loan')).toBeInTheDocument();
    expect(screen.getByText('Bank Name')).toBeInTheDocument();
  });

  it('validates bank name is required in add loan form', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Add Loan'));

    const submitButtons = screen.getAllByText('Add Loan');
    const formSubmitBtn = submitButtons[submitButtons.length - 1];
    await userEvent.click(formSubmitBtn);

    await waitFor(() => {
      expect(screen.getByText('Bank name is required')).toBeInTheDocument();
    });
  });

  it('validates loan amount is required', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Add Loan'));

    const bankInput = screen.getByPlaceholderText(/Nepal Bank/);
    await userEvent.type(bankInput, 'Test Bank');

    const submitButtons = screen.getAllByText('Add Loan');
    await userEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Loan amount must be greater than 0')).toBeInTheDocument();
    });
  });

  it('loan amount input has min=0', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('Add Loan')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText('Add Loan'));

    const amountInputs = screen.getAllByPlaceholderText('0.00');
    amountInputs.forEach(input => {
      if (input.type === 'number') {
        expect(input).toHaveAttribute('min', '0');
      }
    });
  });

  it('denies access to staff users', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<LoanEntryPage />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('shows summary cards for totals', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Borrowed')).toBeInTheDocument();
      expect(screen.getByText('Principal Paid')).toBeInTheDocument();
      expect(screen.getByText('Interest Paid')).toBeInTheDocument();
      expect(screen.getByText('Remaining Balance')).toBeInTheDocument();
    });
  });

  it('disables Make Payment when no loans exist', async () => {
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => {
      const paymentBtn = screen.getByText('Make Payment').closest('button');
      expect(paymentBtn).toBeDisabled();
    });
  });
});
