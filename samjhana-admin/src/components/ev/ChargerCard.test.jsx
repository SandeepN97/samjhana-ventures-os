import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChargerCard from './ChargerCard';
import { renderWithProviders } from '../../test/test-utils';

const charger = { id: 'cp1', code: 'HD-D180-CC-01', model: 'HD-D180-CC', maxPowerKw: 80, displayOrder: 1 };

function renderCard(props = {}) {
  const onSelect = vi.fn();
  const view = renderWithProviders(
    <ChargerCard charger={charger} state="ready" selected={false} onSelect={onSelect} {...props} />,
    { locale: props.locale || 'en' },
  );
  return { onSelect, ...view };
}

describe('ChargerCard', () => {
  it('shows the model, power and a green Ready pill for a free charger', () => {
    renderCard();
    expect(screen.getByText('HD-D180-CC')).toBeInTheDocument();
    expect(screen.getByText('80kW')).toBeInTheDocument();
    expect(screen.getByText('● Ready')).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('calls onSelect with the charger id when a ready card is tapped', async () => {
    const { onSelect } = renderCard();
    await userEvent.click(screen.getByRole('radio'));
    expect(onSelect).toHaveBeenCalledWith('cp1');
  });

  it('marks the selected card with aria-checked, a green border and a checkmark badge', () => {
    const { container } = renderCard({ selected: true });
    const card = screen.getByRole('radio');
    expect(card).toHaveAttribute('aria-checked', 'true');
    expect(card).toHaveClass('border-green-500', 'bg-green-50');
    expect(container.querySelector('svg.lucide-check')).not.toBeNull();
  });

  it('does not show the checkmark on an unselected card', () => {
    const { container } = renderCard();
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
    expect(container.querySelector('svg.lucide-check')).toBeNull();
  });

  it('renders a busy charger disabled with an amber Charging pill and a pulsing LED', async () => {
    const { onSelect, container } = renderCard({ state: 'busy' });
    const card = screen.getByRole('radio');
    expect(card).toBeDisabled();
    expect(card).toHaveClass('opacity-60', 'cursor-not-allowed');
    expect(screen.getByText('● Charging')).toHaveClass('bg-amber-100', 'text-amber-700');
    expect(container.querySelector('.charger-led-pulse')).not.toBeNull();
    await userEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders an offline charger disabled with a grey pill and no pulse', () => {
    const { container } = renderCard({ state: 'offline' });
    expect(screen.getByRole('radio')).toBeDisabled();
    expect(screen.getByText('● Offline')).toHaveClass('bg-gray-100', 'text-gray-500');
    expect(container.querySelector('.charger-led-pulse')).toBeNull();
  });

  it('renders an unavailable (faulted) charger disabled', () => {
    renderCard({ state: 'unavailable' });
    expect(screen.getByRole('radio')).toBeDisabled();
    expect(screen.getByText('● Unavailable')).toBeInTheDocument();
  });

  it('never lets a disabled charger look selected', () => {
    renderCard({ state: 'busy', selected: false });
    expect(screen.getByRole('radio')).toHaveAttribute('aria-checked', 'false');
  });

  it('has an accessible name with charger number, model, power and status', () => {
    renderCard();
    expect(screen.getByRole('radio', { name: 'Charger 1, HD-D180-CC, 80 kW, Ready' })).toBeInTheDocument();
  });

  it('shows a red border when flagged invalid and unselected', () => {
    renderCard({ invalid: true });
    expect(screen.getByRole('radio')).toHaveClass('border-red-400');
  });

  it('is at least 44px tall for touch', () => {
    renderCard();
    expect(screen.getByRole('radio')).toHaveClass('min-h-[44px]');
  });

  it('renders Nepali labels with Devanagari numerals', () => {
    renderCard({ locale: 'ne' });
    expect(screen.getByText('८०kW')).toBeInTheDocument();
    expect(screen.getByText('● तयार')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'चार्जर १, HD-D180-CC, ८० kW, तयार' })).toBeInTheDocument();
  });
});
