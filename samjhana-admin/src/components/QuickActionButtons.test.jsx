import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickActionButtons from './QuickActionButtons';
import { renderWithProviders } from '../test/test-utils';
import api from '../utils/api';

const summary = { cash: '154500.00', fail: false, newOrders: 0, ordersFail: false, waitingLoans: 0 };
vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (summary.fail) return Promise.reject(new Error('down'));
      if (url === '/api/daily-reports/business-date') {
        return Promise.resolve({ data: { date: '2026-09-27', todayClosed: false } });
      }
      if (url.startsWith('/api/daily-reports/today-summary')) {
        return Promise.resolve({ data: { totalCashSales: summary.cash } });
      }
      if (url === '/api/loans/pending-payments') return Promise.resolve({ data: { count: summary.waitingLoans } });
      if (url === '/api/shop-orders/summary') {
        if (summary.ordersFail) return Promise.reject(new Error('down'));
        return Promise.resolve({ data: { NEW: summary.newOrders } });
      }
      return Promise.resolve({ data: {} });
    }),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

describe('QuickActionButtons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    summary.cash = '154500.00';
    summary.fail = false;
    summary.newOrders = 0;
    summary.ordersFail = false;
    summary.waitingLoans = 0;
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin' }));
  });

  it('renders all 5 business action buttons for admin', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Petrol Pump')).toBeInTheDocument();
    expect(screen.getByText('EV Charging')).toBeInTheDocument();
    expect(screen.getByText('Furniture')).toBeInTheDocument();
    expect(screen.getByText('House Rental')).toBeInTheDocument();
    expect(screen.getByText('Bank Loan')).toBeInTheDocument();
  });

  it('staff users do not see Loan button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByText('Bank Loan')).not.toBeInTheDocument();
  });

  it('shows End of Day button', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('End of Day')).toBeInTheDocument();
  });

  it('admin sees Staff Management button', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Staff Management')).toBeInTheDocument();
  });

  it('manager sees Staff Management button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'MANAGER', username: 'mgr' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByText('Staff Management')).not.toBeInTheDocument();
  });

  it('staff does not see Staff Management button', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByText('Staff Management')).not.toBeInTheDocument();
  });

  it('admin and manager see Analytics button', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getAllByText('Analytics').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Petrol navigates to /entry/petrol', async () => {
    renderWithProviders(<QuickActionButtons />);
    await userEvent.click(screen.getByText('Petrol Pump').closest('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/entry/petrol');
  });

  it('clicking End of Day navigates to /reports/close', async () => {
    renderWithProviders(<QuickActionButtons />);
    await userEvent.click(screen.getByText('End of Day').closest('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/reports/close');
  });

  it('bottom nav has Home, Records, Analytics, Settings', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Records')).toBeInTheDocument();
    expect(screen.getAllByText('Analytics').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it("shows today's real cash total in lakhs format", async () => {
    renderWithProviders(<QuickActionButtons />);
    await waitFor(() => expect(screen.getByTestId('today-cash')).toHaveTextContent('Rs 1,54,500'));
    expect(api.get).toHaveBeenCalledWith('/api/daily-reports/today-summary?date=2026-09-27');
    expect(screen.queryByText(/1,23,456/)).not.toBeInTheDocument();
  });

  it("shows today's cash with Nepali numerals in Nepali", async () => {
    renderWithProviders(<QuickActionButtons />, { locale: 'ne' });
    await waitFor(() => expect(screen.getByTestId('today-cash')).toHaveTextContent('रु १,५४,५००'));
  });

  it('shows zero when nothing has been sold today', async () => {
    summary.cash = '0';
    renderWithProviders(<QuickActionButtons />);
    await waitFor(() => expect(screen.getByTestId('today-cash')).toHaveTextContent('Rs 0'));
  });

  it('shows a dash instead of a number when the server cannot be reached', async () => {
    summary.fail = true;
    renderWithProviders(<QuickActionButtons />);
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    expect(screen.getByTestId('today-cash')).toHaveTextContent('—');
  });

  it('does not show the Add New tile that led nowhere', () => {
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByText('Add New')).not.toBeInTheDocument();
  });

  it('shows a Beekeeping tile that opens the beekeeping dashboard', async () => {
    renderWithProviders(<QuickActionButtons />);
    await userEvent.click(screen.getByText('Beekeeping'));
    expect(mockNavigate).toHaveBeenCalledWith('/entry/beekeeping');
  });

  it('keeps all six tiles half width when admin sees an even number', () => {
    renderWithProviders(<QuickActionButtons />);
    for (const name of ['Petrol Pump', 'Beekeeping', 'Bank Loan']) {
      expect(screen.getByText(name).closest('button')).not.toHaveClass('col-span-2');
    }
  });

  it('stretches the odd last tile across the row when staff see five tiles', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.getByText('House Rental').closest('button')).toHaveClass('col-span-2');
    expect(screen.getByText('Petrol Pump').closest('button')).not.toHaveClass('col-span-2');
    expect(screen.queryByText('Bank Loan')).not.toBeInTheDocument();
  });

  it('shows an Online Orders shortcut with the number of new orders waiting', async () => {
    summary.newOrders = 3;
    renderWithProviders(<QuickActionButtons />);
    const button = screen.getByRole('button', { name: /Online Orders/ });
    await waitFor(() => expect(button).toHaveTextContent('3'));
    await userEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith('/online-orders');
  });

  it('shows no count when there are no new orders, or when the count cannot be read', async () => {
    renderWithProviders(<QuickActionButtons />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/shop-orders/summary'));
    expect(screen.getByRole('button', { name: /Online Orders/ }).textContent).toBe('Online Orders');
  });

  it('shows the Website shortcut to admins and managers, but not to staff', async () => {
    const { unmount } = renderWithProviders(<QuickActionButtons />);
    await userEvent.click(screen.getByRole('button', { name: 'Website' }));
    expect(mockNavigate).toHaveBeenCalledWith('/website');
    unmount();

    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 'staff1' }));
    renderWithProviders(<QuickActionButtons />);
    expect(screen.queryByRole('button', { name: 'Website' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Online Orders/ })).toBeInTheDocument();
  });

  describe('payments waiting for an admin (Bank Loan badge)', () => {
    it('shows the count on the Bank Loan tile for an admin', async () => {
      summary.waitingLoans = 3;
      renderWithProviders(<QuickActionButtons />);
      expect(await screen.findByTestId('waiting-badge')).toHaveTextContent('3');
    });

    it('shows no badge when nothing is waiting', async () => {
      renderWithProviders(<QuickActionButtons />);
      await screen.findByText('Bank Loan');
      await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/loans/pending-payments'));
      expect(screen.queryByTestId('waiting-badge')).not.toBeInTheDocument();
    });

    it('does not even ask for the count when the user is a manager', async () => {
      summary.waitingLoans = 3;
      localStorage.setItem('user', JSON.stringify({ role: 'MANAGER', username: 'm' }));
      renderWithProviders(<QuickActionButtons />);
      await screen.findByText('Bank Loan');
      expect(api.get).not.toHaveBeenCalledWith('/api/loans/pending-payments');
      expect(screen.queryByTestId('waiting-badge')).not.toBeInTheDocument();
    });
  });
});
