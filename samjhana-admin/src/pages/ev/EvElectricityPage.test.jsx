import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvElectricityPage from './EvElectricityPage';
import api from '../../utils/api';
import { renderWithProviders } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const BILL = {
  id: 'bill-1', periodStart: '2026-08-01', periodEnd: '2026-08-31', billedKwh: 1500,
  amountPaid: 18000, referenceNumber: 'NEA-1', createdByName: 'Manager',
};

function signInAs(role) {
  localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));
}

describe('EvElectricityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => Promise.resolve({
      data: url.endsWith('/reconciliation')
        ? { periodStart: '2026-08-01', periodEnd: '2026-08-31', soldKwh: 1400, billedKwh: 1500, profit: 5000, profitPercent: 20, byChargePoint: [] }
        : [BILL],
    }));
  });

  it('shows staff a managers-only message and never asks for the bills', () => {
    signInAs('STAFF');
    renderWithProviders(<EvElectricityPage />);

    expect(screen.getByText('Electricity bills and EV profit are only available to managers and administrators.')).toBeInTheDocument();
    expect(screen.queryByText('NEA-1')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows the managers-only message in Nepali', () => {
    signInAs('STAFF');
    renderWithProviders(<EvElectricityPage />, { locale: 'ne' });

    expect(screen.getByText('बिजुली बिल र EV नाफा प्रबन्धक र एडमिनले मात्र हेर्न सक्छन्।')).toBeInTheDocument();
  });

  it('lists the bills and opens the profit reconciliation for a manager', async () => {
    signInAs('MANAGER');
    renderWithProviders(<EvElectricityPage />);

    await userEvent.click(await screen.findByText('NEA-1'));

    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/ev/electricity-bills/bill-1/reconciliation'));
    expect(await screen.findByText('Energy reconciliation')).toBeInTheDocument();
    expect(screen.getByText('Add billing period')).toBeInTheDocument();
  });

  it('shows an error message when the bills cannot be loaded', async () => {
    signInAs('ADMIN');
    api.get.mockRejectedValueOnce({ response: { data: { message: 'Admin or manager access required' } } });
    renderWithProviders(<EvElectricityPage />);

    expect(await screen.findByText('Admin or manager access required')).toBeInTheDocument();
  });
});
