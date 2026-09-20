import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActiveSessionCard from './ActiveSessionCard';
import { renderWithProviders } from '../../test/test-utils';

const base = {
  id: 's1', status: 'ACTIVE', plateNumber: 'GA3KHA1187', chargerModel: 'HD-D140-E',
  vehicleCatalogName: 'Foton', currentSoc: 22, startSoc: 10, targetPercent: 100,
  energyDeliveredKwh: 4.12, suggestedAmount: 329.6, startedAt: '2026-09-19T10:00:00',
};
const now = new Date('2026-09-19T10:03:05').getTime();

function renderCard(overrides = {}, props = {}) {
  const onStop = vi.fn();
  renderWithProviders(<ActiveSessionCard session={{ ...base, ...overrides }} now={now} busy={false} onStop={onStop} {...props} />,
    { locale: props.locale || 'en' });
  return { onStop };
}

describe('ActiveSessionCard', () => {
  it('shows the plate chip, elapsed time, charger and vehicle', () => {
    renderCard();
    expect(screen.getByText('GA3KHA1187')).toHaveClass('bg-gray-900', 'text-green-400', 'font-mono');
    expect(screen.getByLabelText('Elapsed time')).toHaveTextContent('03:05');
    expect(screen.getByText('HD-D140-E · Foton')).toBeInTheDocument();
  });

  it('shows progress toward the target with the current and target percentages', () => {
    renderCard();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '22');
    expect(screen.getByText('22%')).toBeInTheDocument();
    expect(screen.getByText('Target 100%')).toBeInTheDocument();
  });

  it('shows live kWh and the running cost in rupees', () => {
    renderCard();
    expect(screen.getByText('4.1')).toBeInTheDocument();
    expect(screen.getByText('Rs 329.6')).toBeInTheDocument();
  });

  it('shows dashes when the charger has not reported SoC or a price is unknown', () => {
    renderCard({ currentSoc: null, startSoc: null, suggestedAmount: null });
    expect(screen.getAllByText('—').length).toBe(2);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('offers "Stop & Lock for Payment" while charging and calls onStop with the session id', async () => {
    const { onStop } = renderCard();
    const stop = screen.getByRole('button', { name: 'Stop & Lock for Payment' });
    expect(stop).toHaveClass('bg-gray-900', 'min-h-[44px]');
    await userEvent.click(stop);
    expect(onStop).toHaveBeenCalledWith('s1');
  });

  it('disables the stop button while a stop is in flight', () => {
    renderCard({}, { busy: true });
    expect(screen.getByRole('button', { name: 'Stop & Lock for Payment' })).toBeDisabled();
  });

  it('shows a waiting message instead of a stop button while STARTING', () => {
    renderCard({ status: 'STARTING', statusMessage: 'Start command sent to charger' });
    expect(screen.getByText('Start command sent to charger')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop & Lock for Payment' })).toBeNull();
  });

  it('shows a disabled "Stopping…" button once a stop was requested', () => {
    renderCard({ status: 'STOP_REQUESTED' });
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled();
  });

  it('clamps the progress bar for out-of-range SoC values', () => {
    renderCard({ currentSoc: 140 });
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders Nepali labels and Devanagari numerals', () => {
    renderCard({}, { locale: 'ne' });
    expect(screen.getByText('लक्ष्य १००%')).toBeInTheDocument();
    expect(screen.getByText('रु ३२९.६')).toBeInTheDocument();
    expect(screen.getByLabelText('बितेको समय')).toHaveTextContent('०३:०५');
    expect(screen.getByRole('button', { name: 'रोक्नुहोस् र भुक्तानीका लागि लक गर्नुहोस्' })).toBeInTheDocument();
  });
});
