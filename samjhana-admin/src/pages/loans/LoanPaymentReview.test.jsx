import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoanEntryPage from './LoanEntryPage';
import { renderWithProviders, testI18n } from '../../test/test-utils';

vi.mock('../../utils/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
}));
vi.mock('../../utils/image', () => ({
  prepareImage: vi.fn(async (file) => {
    if (file.type === 'text/plain') throw new Error('type');
    return new Blob(['jpeg'], { type: 'image/jpeg' });
  }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

import api from '../../utils/api';

const loan = (extra = {}) => ({
  id: 'loan-1', status: 'APPROVED', transactionDate: '2026-01-01', amount: 500000,
  customFields: { loanType: 'NEW_LOAN', bankName: 'NIC Asia', loanAmount: 500000, interestRate: 11 }, ...extra,
});
const payment = (id, status, extra = {}, fields = {}) => ({
  id, status, transactionDate: '2026-03-01', amount: 25000, referenceNumber: 'REF-' + id, reviewNotes: null,
  customFields: { loanType: 'PAYMENT', loanId: 'loan-1', principalAmount: 20000, interestAmount: 5000,
    bankReference: 'REF-' + id, receiptId: 'rec-' + id, ...fields }, ...extra,
});

function serve(list) {
  api.get.mockImplementation((url) =>
    Promise.resolve({ data: url.startsWith('/api/transactions') ? list : {} }));
}
const asRole = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));
const money = (n) => `रु ${n.toLocaleString('en-IN')}`;

describe('LoanEntryPage payment review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    asRole('ADMIN');
  });

  it('counts an approved payment even when the list shows it before the loan (newest first)', async () => {
    serve([payment('p1', 'APPROVED'), loan()]);
    renderWithProviders(<LoanEntryPage />);
    await waitFor(() => expect(screen.getAllByText(money(480000)).length).toBeGreaterThan(0)); // 500000 - 20000 principal
  });

  it('keeps a waiting payment out of the totals and lists it as waiting', async () => {
    serve([payment('p2', 'PENDING_REVIEW'), loan()]);
    renderWithProviders(<LoanEntryPage />);
    const box = await screen.findByTestId('waiting-payments');
    expect(within(box).getByText(/REF-p2/)).toBeInTheDocument();
    expect(screen.getAllByText(money(500000)).length).toBeGreaterThan(0);   // nothing taken off the loan
    expect(screen.queryByText(money(480000))).not.toBeInTheDocument();
  });

  it('shows a rejected payment with the reason, not in the totals', async () => {
    serve([payment('p3', 'REJECTED', { reviewNotes: 'Wrong amount' }), loan()]);
    renderWithProviders(<LoanEntryPage />);
    const box = await screen.findByTestId('rejected-payments');
    expect(within(box).getByText(/Wrong amount/)).toBeInTheDocument();
    expect(screen.queryByText(money(480000))).not.toBeInTheDocument();
  });

  it('lets an admin approve a waiting payment', async () => {
    serve([payment('p4', 'PENDING_REVIEW'), loan()]);
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<LoanEntryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    expect(api.patch).toHaveBeenCalledWith('/api/transactions/p4/approve');
  });

  it('needs a reason to reject, then sends it', async () => {
    serve([payment('p5', 'PENDING_REVIEW'), loan()]);
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<LoanEntryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(api.patch).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Say why it is rejected');

    await userEvent.type(within(dialog).getByLabelText('Why is it rejected?'), 'Receipt unreadable');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }));
    expect(api.patch).toHaveBeenCalledWith('/api/transactions/p5/reject', { reason: 'Receipt unreadable' });
  });

  it('shows a manager the waiting payment and its receipt, but no approve or reject', async () => {
    asRole('MANAGER');
    serve([payment('p6', 'PENDING_REVIEW'), loan()]);
    renderWithProviders(<LoanEntryPage />);
    const box = await screen.findByTestId('waiting-payments');
    expect(within(box).getByRole('button', { name: 'View receipt' })).toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(within(box).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(within(box).getByText(/An admin must approve/)).toBeInTheDocument();
  });

  it('opens the receipt from the private address with the signed-in token', async () => {
    serve([payment('p7', 'PENDING_REVIEW'), loan()]);
    URL.createObjectURL = vi.fn(() => 'blob:receipt');
    URL.revokeObjectURL = vi.fn();
    api.get.mockImplementation((url) => url.startsWith('/api/loans/receipts/')
      ? Promise.resolve({ data: new Blob(['x'], { type: 'image/jpeg' }) })
      : Promise.resolve({ data: [payment('p7', 'PENDING_REVIEW'), loan()] }));
    renderWithProviders(<LoanEntryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'View receipt' }));
    expect(await screen.findByAltText('Photo of bank receipt')).toHaveAttribute('src', 'blob:receipt');
    expect(api.get).toHaveBeenCalledWith('/api/loans/receipts/rec-p7', expect.objectContaining({ responseType: 'blob' }));
  });

  it('says so when the receipt cannot be opened', async () => {
    api.get.mockImplementation((url) => url.startsWith('/api/loans/receipts/')
      ? Promise.reject(new Error('403'))
      : Promise.resolve({ data: [payment('p8', 'PENDING_REVIEW'), loan()] }));
    renderWithProviders(<LoanEntryPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'View receipt' }));
    expect(await screen.findByText('Could not open the receipt photo')).toBeInTheDocument();
  });

  // ---- the payment form ----

  async function openPaymentForm() {
    renderWithProviders(<LoanEntryPage />);
    await userEvent.click(await screen.findByText('Make Payment'));
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));
    await userEvent.click(await screen.findByText('NIC Asia'));
    await userEvent.type(screen.getAllByPlaceholderText('0.00')[0], '20000');
  }
  const save = () => userEvent.click(screen.getByRole('button', { name: /Save Payment/i }));
  const pick = (type = 'image/jpeg') =>
    userEvent.upload(screen.getByLabelText('Photo of bank receipt', { selector: 'input' }), new File(['x'], 'r.jpg', { type }));

  it('asks a manager for the bank reference and the receipt photo before sending anything', async () => {
    asRole('MANAGER');
    serve([loan()]);
    await openPaymentForm();
    await save();
    expect(screen.getByText("Enter the bank's reference number")).toBeInTheDocument();
    expect(screen.getByText('Add a photo of the bank receipt')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('uploads the photo first, then records the payment with its reference and receipt id', async () => {
    asRole('MANAGER');
    serve([loan()]);
    api.post.mockImplementation((url) => Promise.resolve({ data: url === '/api/loans/receipts' ? { receiptId: 'new-rec' } : { id: 'x' } }));
    await openPaymentForm();
    await userEvent.type(screen.getByLabelText(/Bank reference no./), 'NIC-778899');
    await pick();
    await save();

    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(api.post.mock.calls[0][0]).toBe('/api/loans/receipts');
    expect(api.post.mock.calls[0][1]).toBeInstanceOf(FormData);
    const [url, body] = api.post.mock.calls[1];
    expect(url).toBe('/api/transactions');
    expect(body.customFields).toMatchObject({ loanType: 'PAYMENT', loanId: 'loan-1', principalAmount: 20000,
      bankReference: 'NIC-778899', receiptId: 'new-rec' });
    expect(await screen.findByText('Saved. It is waiting for an admin to approve it.')).toBeInTheDocument();
  });

  it('lets an admin save a payment with a reference and no photo', async () => {
    serve([loan()]);
    api.post.mockResolvedValue({ data: { id: 'x' } });
    await openPaymentForm();
    await userEvent.type(screen.getByLabelText(/Bank reference no./), 'CHQ-5');
    await save();
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls[0][0]).toBe('/api/transactions');
    expect(api.post.mock.calls[0][1].customFields.receiptId).toBeUndefined();
  });

  it('refuses a file that is not a picture', async () => {
    asRole('MANAGER');
    serve([loan()]);
    await openPaymentForm();
    await userEvent.upload(screen.getByLabelText('Photo of bank receipt', { selector: 'input' }),
      new File(['x'], 'r.txt', { type: 'text/plain' }), { applyAccept: false });
    expect(await screen.findByText('Choose a JPEG or PNG photo')).toBeInTheDocument();
  });

  it('shows the Nepali words for the new fields', async () => {
    serve([loan()]);
    renderWithProviders(<LoanEntryPage />, { locale: 'ne' });
    await userEvent.click(await screen.findByText(testI18n.t('loan.makePayment')));
    expect(await screen.findByText(/बैंकको सन्दर्भ नं\./)).toBeInTheDocument();
    expect(screen.getByText(/बैंकको रसिदको फोटो/)).toBeInTheDocument();
  });
});
