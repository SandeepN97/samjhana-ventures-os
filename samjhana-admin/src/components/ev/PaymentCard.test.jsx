import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentCard from './PaymentCard';
import { renderWithProviders } from '../../test/test-utils';

const due = {
  id: 's1', status: 'AWAITING_PAYMENT', plateNumber: 'GA3KHA1187', chargerModel: 'HD-D140-E',
  evseId: 1, connectorId: 2,
  energyDeliveredKwh: 7.5, suggestedAmount: 600,
};

function renderCard(session = due, props = {}) {
  const onConfirm = vi.fn();
  const onRetryUnlock = vi.fn();
  renderWithProviders(<PaymentCard session={session} busy={false} onConfirm={onConfirm} onRetryUnlock={onRetryUnlock} {...props} />,
    { locale: props.locale || 'en' });
  return { onConfirm, onRetryUnlock };
}

describe('PaymentCard (awaiting payment)', () => {
  it('shows the locked-connector heading, summary and the large total', () => {
    renderCard();
    expect(screen.getByText('Awaiting payment — connector locked')).toBeInTheDocument();
    expect(screen.getByText('GA3KHA1187 · HD-D140-E · EVSE 1 · Connector 2 · 7.5 kWh delivered')).toBeInTheDocument();
    expect(screen.getByText('Rs 600')).toHaveClass('text-4xl', 'font-black');
  });

  it('shows the working: percent charged × the vehicle price per 1%', () => {
    renderCard({ ...due, percentCharged: 18, ratePerPercent: 14, suggestedAmount: 252 });
    expect(screen.getByText('18% charged × Rs 14 per 1%')).toBeInTheDocument();
    expect(screen.getByText('Rs 252')).toBeInTheDocument();
  });

  it('shows no working line for a walk-in with no vehicle type', () => {
    renderCard({ ...due, percentCharged: 18, ratePerPercent: null, suggestedAmount: null });
    expect(screen.queryByText(/per 1%/)).toBeNull();
  });

  it('shows no working line until the percent charged is known', () => {
    renderCard({ ...due, percentCharged: null, ratePerPercent: 14 });
    expect(screen.queryByText(/per 1%/)).toBeNull();
  });

  it('writes the working in Nepali with Devanagari numerals', () => {
    renderCard({ ...due, percentCharged: 18, ratePerPercent: 14, suggestedAmount: 252 }, { locale: 'ne' });
    expect(screen.getByText('१८% चार्ज × रु १४ प्रति १%')).toBeInTheDocument();
  });

  it('keeps the physical-lock notice visible', () => {
    renderCard();
    expect(screen.getByText('Connector stays physically locked until payment is confirmed here.')).toBeInTheDocument();
  });

  it('offers Cash, eSewa and Khalti with Cash selected by default', () => {
    renderCard();
    const methods = screen.getAllByRole('radio');
    expect(methods.map((m) => m.textContent)).toEqual(['Cash', 'eSewa', 'Khalti']);
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'true');
  });

  it('requires the customer amount before confirming payment', async () => {
    const { onConfirm } = renderCard();
    const confirm = screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
    expect(confirm).toBeDisabled();
    expect(screen.getByLabelText('Amount received (Rs)')).toHaveValue(null);

    await userEvent.type(screen.getByLabelText('Amount received (Rs)'), '600');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 600);
  });

  it('confirms with the chosen payment method', async () => {
    const { onConfirm } = renderCard();
    await userEvent.type(screen.getByLabelText('Amount received (Rs)'), '600');
    await userEvent.click(screen.getByRole('radio', { name: 'eSewa' }));
    expect(screen.getByRole('radio', { name: 'eSewa' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'ESEWA', 600);
  });

  it('submits the amount received from the customer', async () => {
    const { onConfirm } = renderCard();
    const input = screen.getByLabelText('Amount received (Rs)');
    await userEvent.type(input, '650');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 650);
  });

  it('asks staff to type the amount when no rate was configured, and blocks confirming until they do', async () => {
    const { onConfirm } = renderCard({ ...due, suggestedAmount: null });
    expect(screen.getByText('No vehicle type was chosen for this session, so enter the amount to collect.')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Amount received (Rs)'), '400');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 400);
  });

  it('blocks confirming a zero or negative amount', async () => {
    renderCard({ ...due, suggestedAmount: null });
    const confirm = screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
    await userEvent.type(screen.getByLabelText('Amount received (Rs)'), '0');
    expect(confirm).toBeDisabled();
  });

  it('disables the confirm button while a request is in flight', async () => {
    renderCard(due, { busy: true });
    await userEvent.type(screen.getByLabelText('Amount received (Rs)'), '600');
    expect(screen.getByRole('button', { name: 'Confirm Payment & Unlock' })).toBeDisabled();
  });

  it('formats large amounts in lakhs', () => {
    renderCard({ ...due, suggestedAmount: 123456 });
    expect(screen.getByText('Rs 1,23,456')).toBeInTheDocument();
  });

  it('uses 44px+ touch targets for the payment method buttons', () => {
    renderCard();
    screen.getAllByRole('radio').forEach((m) => expect(m).toHaveClass('min-h-[52px]'));
  });

  it('renders Nepali labels', () => {
    renderCard(due, { locale: 'ne' });
    expect(screen.getByText('भुक्तानी बाँकी — कनेक्टर लक छ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'भुक्तानी पुष्टि र अनलक' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'नगद' })).toBeInTheDocument();
    expect(screen.getByLabelText('प्राप्त रकम (रु)')).toBeInTheDocument();
    expect(screen.getByText('रु ६००')).toBeInTheDocument();
    expect(screen.queryByText(/Rs/)).toBeNull();
  });
});

describe('PaymentCard (after payment)', () => {
  it('shows unlock progress without a payment form', () => {
    renderCard({ ...due, status: 'UNLOCK_REQUESTED', statusMessage: 'Payment confirmed; unlock command sent' });
    expect(screen.getByText('Payment confirmed; unlock command sent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm Payment & Unlock' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry unlock' })).toBeNull();
  });

  it('offers a retry when the unlock failed and the session is PAID', async () => {
    const { onRetryUnlock } = renderCard({ ...due, status: 'PAID', statusMessage: 'Connector unlock failed; retry required' });
    await userEvent.click(screen.getByRole('button', { name: 'Retry unlock' }));
    expect(onRetryUnlock).toHaveBeenCalledWith('s1');
  });
});

describe('PaymentCard discount rule', () => {
  afterEach(() => localStorage.clear());

  async function typeAmount(value) {
    const input = screen.getByLabelText('Amount received (Rs)');
    await userEvent.type(input, value);
  }

  it('stops staff confirming less than the price and says a manager must do it', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF' }));
    const { onConfirm } = renderCard();
    await typeAmount('100');

    expect(screen.getByRole('alert')).toHaveTextContent('This is less than the price (Rs 600). Only a manager can give a discount.');
    const confirm = screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
    expect(confirm).toBeDisabled();
    await userEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('lets staff round the price down by up to one rupee', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF' }));
    const { onConfirm } = renderCard();
    await typeAmount('599');

    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 599);
  });

  it('lets a manager give a discount', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'MANAGER' }));
    const { onConfirm } = renderCard();
    await typeAmount('400');

    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 400);
  });

  it('explains the rule in Nepali', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF' }));
    renderCard(due, { locale: 'ne' });
    const input = screen.getByRole('spinbutton');
    await userEvent.type(input, '100');

    expect(screen.getByRole('alert')).toHaveTextContent('यो मूल्य (रु ६००) भन्दा कम छ। छुट प्रबन्धकले मात्र दिन सक्नुहुन्छ।');
  });
});
