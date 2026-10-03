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

  it('confirms with the default method and the suggested amount', async () => {
    const { onConfirm } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 600);
  });

  it('confirms with the chosen payment method', async () => {
    const { onConfirm } = renderCard();
    await userEvent.click(screen.getByRole('radio', { name: 'eSewa' }));
    expect(screen.getByRole('radio', { name: 'eSewa' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Cash' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'ESEWA', 600);
  });

  it('lets staff change the amount before confirming', async () => {
    const { onConfirm } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Change amount' }));
    const input = screen.getByLabelText('Amount (Rs)');
    await userEvent.clear(input);
    await userEvent.type(input, '650');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 650);
  });

  it('asks staff to type the amount when no rate was configured, and blocks confirming until they do', async () => {
    const { onConfirm } = renderCard({ ...due, suggestedAmount: null });
    expect(screen.getByText('No vehicle type was chosen for this session, so enter the amount to collect.')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Amount (Rs)'), '400');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 400);
  });

  it('blocks confirming a zero or negative amount', async () => {
    renderCard({ ...due, suggestedAmount: null });
    const confirm = screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
    await userEvent.type(screen.getByLabelText('Amount (Rs)'), '0');
    expect(confirm).toBeDisabled();
  });

  it('disables the confirm button while a request is in flight', () => {
    renderCard(due, { busy: true });
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
    await userEvent.click(screen.getByRole('button', { name: 'Change amount' }));
    const input = screen.getByLabelText('Amount (Rs)');
    await userEvent.clear(input);
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
    await userEvent.click(screen.getByRole('button', { name: 'रकम परिवर्तन' }));
    const input = screen.getByLabelText('रकम (रु)');
    await userEvent.clear(input);
    await userEvent.type(input, '100');

    expect(screen.getByRole('alert')).toHaveTextContent('यो मूल्य (रु ६००) भन्दा कम छ। छुट प्रबन्धकले मात्र दिन सक्नुहुन्छ।');
  });
});

describe('PaymentCard cash received, change and shortfall', () => {
  afterEach(() => localStorage.clear());

  const confirmButton = () => screen.getByRole('button', { name: 'Confirm Payment & Unlock' });
  const typeReceived = (value) => userEvent.type(screen.getByLabelText('Cash received (Rs)'), value);

  it('shows the cash received box for Cash and hides it for eSewa and Khalti', async () => {
    renderCard();
    expect(screen.getByLabelText('Cash received (Rs)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'eSewa' }));
    expect(screen.queryByLabelText('Cash received (Rs)')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'Khalti' }));
    expect(screen.queryByLabelText('Cash received (Rs)')).toBeNull();
  });

  it('shows nothing and still allows confirming while no cash has been entered', async () => {
    const { onConfirm } = renderCard();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 600);
  });

  it('shows the change to return in green when the customer pays more', async () => {
    renderCard();
    await typeReceived('1000');
    expect(screen.getByRole('status')).toHaveTextContent('Change to return: Rs 400');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows Rs 0 change when the customer pays exactly', async () => {
    renderCard();
    await typeReceived('600');
    expect(screen.getByRole('status')).toHaveTextContent('Change to return: Rs 0');
  });

  it('records the price as the sale, not the cash handed over', async () => {
    const { onConfirm } = renderCard();
    await typeReceived('1000');
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 600);
  });

  it('flags a shortfall in red with the amount owed and blocks confirming', async () => {
    const { onConfirm } = renderCard();
    await typeReceived('450');
    expect(screen.getByRole('alert')).toHaveTextContent('Short by Rs 150 — the customer still owes this.');
    expect(screen.getByLabelText('Cash received (Rs)')).toHaveClass('border-red-500');
    expect(screen.queryByRole('status')).toBeNull();
    expect(confirmButton()).toBeDisabled();
    await userEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('clears the shortfall and re-enables confirming once the rest is paid', async () => {
    renderCard();
    const input = screen.getByLabelText('Cash received (Rs)');
    await userEvent.type(input, '450');
    expect(confirmButton()).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, '700');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Change to return: Rs 100');
    expect(confirmButton()).toBeEnabled();
  });

  it('does not invent change from floating-point noise', async () => {
    renderCard({ ...due, suggestedAmount: 0.3 });
    await typeReceived('0.1');
    expect(screen.getByRole('alert')).toHaveTextContent('Short by Rs 0.2');
  });

  it('ignores cash entered earlier once the method is switched to eSewa', async () => {
    const { onConfirm } = renderCard();
    await typeReceived('450');
    expect(confirmButton()).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'eSewa' }));
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith('s1', 'ESEWA', 600);
  });

  it('lets a manager lower the amount, then checks the cash against the new amount', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'MANAGER' }));
    const { onConfirm } = renderCard();
    await typeReceived('450');
    expect(confirmButton()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Change amount' }));
    const amount = screen.getByLabelText('Amount (Rs)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '450');
    expect(screen.getByRole('status')).toHaveTextContent('Change to return: Rs 0');
    await userEvent.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith('s1', 'CASH', 450);
  });

  it('keeps staff from lowering the amount to match a short payment', async () => {
    localStorage.setItem('user', JSON.stringify({ role: 'STAFF' }));
    const { onConfirm } = renderCard();
    await typeReceived('450');
    await userEvent.click(screen.getByRole('button', { name: 'Change amount' }));
    const amount = screen.getByLabelText('Amount (Rs)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '450');
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Only a manager can give a discount.');
    await userEvent.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('treats a corrupt cached user as having no special rights instead of crashing', async () => {
    localStorage.setItem('user', '{not json');
    renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Change amount' }));
    const amount = screen.getByLabelText('Amount (Rs)');
    await userEvent.clear(amount);
    await userEvent.type(amount, '100');
    expect(screen.getByRole('alert')).toHaveTextContent('Only a manager can give a discount.');
  });

  it('keeps the cash box at least 44px tall', () => {
    renderCard();
    expect(screen.getByLabelText('Cash received (Rs)')).toHaveClass('min-h-[44px]');
  });

  it('shows change and shortfall in Nepali with Devanagari numerals', async () => {
    renderCard(due, { locale: 'ne' });
    const input = screen.getByLabelText('नगद प्राप्त (रु)');
    await userEvent.type(input, '1000');
    expect(screen.getByRole('status')).toHaveTextContent('फिर्ता दिनुपर्ने: रु ४००');
    await userEvent.clear(input);
    await userEvent.type(input, '450');
    expect(screen.getByRole('alert')).toHaveTextContent('रु १५० कम — ग्राहकले बाँकी तिर्नुपर्छ।');
    expect(screen.queryByText(/Rs/)).toBeNull();
  });
});
