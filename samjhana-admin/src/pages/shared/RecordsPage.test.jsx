import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RecordsPage from './RecordsPage';
import { renderWithProviders } from '../../test/test-utils';
import { nepalToday } from '../../utils/businessDay';

const mock = { transactions: [] };

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: mock.transactions })),
  },
}));

function record(overrides) {
  return {
    id: crypto.randomUUID(),
    businessCode: 'rental',
    businessName: 'Rental Home',
    transactionType: 'PAYMENT',
    transactionDate: nepalToday(),
    amount: '15000',
    status: 'APPROVED',
    enteredByName: 'Maya',
    customFields: null,
    ...overrides,
  };
}

describe('RecordsPage ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mock.transactions = [
      record({ id: 'rent-payment' }),
      record({
        id: 'furniture-purchase',
        businessCode: 'furniture',
        businessName: 'Furniture Workshop',
        transactionType: 'PURCHASE',
        amount: '9000',
        status: 'PENDING_REVIEW',
        enteredByName: 'Sita',
      }),
      record({
        id: 'petrol-sale',
        businessCode: 'petrol',
        businessName: 'Petrol Pump',
        transactionType: 'SALE',
        amount: '5000',
        customFields: JSON.stringify({ fuelType: 'petrol', liters: 28, ratePerLiter: 178.57, paymentMethod: 'CASH' }),
      }),
      record({
        id: 'diesel-sale',
        businessCode: 'petrol',
        businessName: 'Petrol Pump',
        transactionType: 'SALE',
        amount: '7000',
        customFields: JSON.stringify({ fuelType: 'diesel', liters: 42, ratePerLiter: 166.67, paymentMethod: 'BANK' }),
      }),
    ];
  });

  it('presents one chronological ledger and classifies every money direction truthfully', async () => {
    renderWithProviders(<RecordsPage />);

    expect(await screen.findByText('Rental Home')).toBeInTheDocument();
    expect(screen.getByText('+रु 15,000')).toHaveClass('text-emerald-700');
    expect(screen.getByText('−रु 9,000')).toHaveClass('text-rose-700');
    expect(screen.getByText('Payment')).toBeInTheDocument();
    expect(screen.getByText('Purchase')).toBeInTheDocument();
    expect(screen.getByText('Showing 4 of 4 records')).toBeInTheDocument();

    const recordsNav = screen.getByRole('button', { name: 'Records' });
    expect(recordsNav).toHaveAttribute('aria-current', 'page');
  });

  it('searches the visible ledger and applies the petrol/diesel subfilter', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RecordsPage />);
    await screen.findByText('Rental Home');

    await user.type(screen.getByRole('searchbox', { name: 'Find a record' }), 'Furniture');
    expect(screen.getByText('Furniture Workshop')).toBeInTheDocument();
    expect(screen.queryByText('Rental Home')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Find a record' }));
    await user.click(screen.getByRole('button', { name: 'Diesel' }));
    await waitFor(() => expect(screen.queryByText('Petrol', { selector: 'p' })).not.toBeInTheDocument());
    expect(screen.getByText('Diesel', { selector: 'p' })).toBeInTheDocument();
  });

  it('keeps every quick filter at the required touch size', async () => {
    renderWithProviders(<RecordsPage />);
    await screen.findByText('Rental Home');

    const dateGroup = screen.getByRole('group', { name: 'Date range' });
    within(dateGroup).getAllByRole('button').forEach((button) => {
      expect(button).toHaveClass('min-h-[44px]');
    });

    const businessGroup = screen.getByRole('group', { name: 'Business' });
    within(businessGroup).getAllByRole('button').forEach((button) => {
      expect(button).toHaveClass('min-h-[44px]');
    });
  });

  it('localizes the ledger story and money digits in Nepali', async () => {
    renderWithProviders(<RecordsPage />, { locale: 'ne' });

    expect(await screen.findByText('पछिल्ला रेकर्डहरू')).toBeInTheDocument();
    expect(screen.getByText('+रु १५,०००')).toBeInTheDocument();
    expect(screen.getByText('भुक्तानी')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'रेकर्डहरू' })).toHaveAttribute('aria-current', 'page');
  });
});
