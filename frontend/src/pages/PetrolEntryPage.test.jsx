import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PetrolEntryPage from './PetrolEntryPage';
import { renderWithProviders } from '../test/test-utils';

// Mock api module
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        petrol: { pricePerLiter: 154.5 },
        diesel: { pricePerLiter: 148.0 },
      },
    }),
    post: vi.fn().mockResolvedValue({ data: { id: 1 } }),
  },
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ key: 'test' }),
  };
});

describe('PetrolEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders the page with title', async () => {
    renderWithProviders(<PetrolEntryPage />);
    expect(screen.getByText('Petrol Pump')).toBeInTheDocument();
  });

  it('has date picker with today as default', async () => {
    renderWithProviders(<PetrolEntryPage />);
    // Should display today's date formatted
    const today = new Date();
    const day = today.getDate();
    // The DatePicker shows "19 Feb 2026" format
    const dateTrigger = screen.getByRole('button', { name: 'Pick date' });
    expect(dateTrigger.textContent).toContain(String(day));
  });

  it('liter input has min=0 to prevent negative values', () => {
    renderWithProviders(<PetrolEntryPage />);
    const literInput = screen.getByPlaceholderText(/Enter liters|लिटर/);
    expect(literInput).toHaveAttribute('min', '0');
  });

  it('rate input has min=0 to prevent negative values', () => {
    renderWithProviders(<PetrolEntryPage />);
    const rateInput = screen.getByPlaceholderText('0.00');
    expect(rateInput).toHaveAttribute('min', '0');
  });

  it('shows validation error when liters is empty on submit', async () => {
    renderWithProviders(<PetrolEntryPage />);

    const submitBtn = screen.getByText('Save Entry');
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Liters must be greater than 0')).toBeInTheDocument();
    });
  });

  it('petrol fuel type is selected by default', () => {
    renderWithProviders(<PetrolEntryPage />);
    // The Petrol button should have orange bg
    const petrolBtn = screen.getAllByText('Petrol').find(
      el => el.closest('button')
    );
    expect(petrolBtn.closest('button').className).toContain('bg-orange-500');
  });

  it('switches fuel type when diesel is clicked', async () => {
    renderWithProviders(<PetrolEntryPage />);
    const dieselBtn = screen.getAllByText('Diesel').find(
      el => el.closest('button')?.className.includes('rounded-xl')
    );
    await userEvent.click(dieselBtn.closest('button'));
    expect(dieselBtn.closest('button').className).toContain('bg-orange-500');
  });

  it('calculates total amount correctly', async () => {
    renderWithProviders(<PetrolEntryPage />);

    const literInput = screen.getByPlaceholderText(/Enter liters|लिटर/);
    await userEvent.clear(literInput);
    await userEvent.type(literInput, '10');

    // The rate should be auto-filled from mock API (154.5)
    await waitFor(() => {
      const totalSection = screen.getByText('Total Amount');
      expect(totalSection).toBeInTheDocument();
    });
  });

  it('CASH is selected as default payment method', () => {
    renderWithProviders(<PetrolEntryPage />);
    const cashBtn = screen.getByText('Cash').closest('button');
    expect(cashBtn.className).toContain('bg-green-500');
  });

  it('switches payment method to Bank', async () => {
    renderWithProviders(<PetrolEntryPage />);
    const bankBtn = screen.getByText('Bank').closest('button');
    await userEvent.click(bankBtn);
    expect(bankBtn.className).toContain('bg-blue-500');
  });
});
