import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/test-utils';
import QuickActionButtons from './QuickActionButtons';

vi.mock('../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url.includes('business-date')) return Promise.resolve({ data: { date: '2026-10-17' } });
      if (url.includes('today-summary')) return Promise.resolve({ data: { totalCashSales: 12500 } });
      if (url.includes('shop-orders/summary')) return Promise.resolve({ data: { NEW: 3 } });
      if (url.includes('pending-payments')) return Promise.resolve({ data: { count: 2 } });
      return Promise.resolve({ data: {} });
    }),
  },
}));

const setDesktop = (on) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: on, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
};

describe('Home on a desktop', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('user', JSON.stringify({ role: 'ADMIN', username: 'admin', fullName: 'Una' }));
  });
  afterEach(() => { delete window.matchMedia; });

  it('shows today, waiting counts and one tile per business', async () => {
    setDesktop(true);
    renderWithProviders(<QuickActionButtons />);
    await waitFor(() => expect(screen.getByTestId('today-cash')).not.toHaveTextContent('—'));
    expect(screen.getByRole('heading', { name: 'Samjhana Multiproduct Pvt. Ltd.' }).parentElement).toHaveClass('pt-14', 'pb-8');
    expect(screen.getByRole('heading', { name: 'Businesses' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bank Loan/ })).toBeInTheDocument();
    expect(await screen.findByTestId('waiting-badge')).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Online Orders/ })).toHaveTextContent('3');
  });

  it('hides the loan tile from staff', async () => {
    setDesktop(true);
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF', username: 's' }));
    renderWithProviders(<QuickActionButtons />);
    await screen.findByRole('heading', { name: 'Businesses' });
    expect(screen.queryByRole('button', { name: /Bank Loan/ })).not.toBeInTheDocument();
  });

  it('keeps the phone home screen, with its bottom bar, below desktop width', async () => {
    setDesktop(false);
    renderWithProviders(<QuickActionButtons />);
    expect(await screen.findByTestId('today-cash')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Samjhana Multiproduct Pvt. Ltd.' }).closest('header')).toHaveClass('pt-14', 'pb-6');
    expect(screen.queryByRole('heading', { name: 'Businesses' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('writes the headings in Nepali', async () => {
    setDesktop(true);
    renderWithProviders(<QuickActionButtons />, { locale: 'ne' });
    expect(await screen.findByRole('heading', { name: 'व्यवसायहरू' })).toBeInTheDocument();
  });
});
