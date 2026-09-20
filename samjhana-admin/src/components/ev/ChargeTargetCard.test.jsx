import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChargeTargetCard from './ChargeTargetCard';
import { renderWithProviders } from '../../test/test-utils';

function Harness({ initial = '80', currentSoc, onValue }) {
  const [value, setValue] = useState(initial);
  return (
    <ChargeTargetCard
      value={value}
      currentSoc={currentSoc}
      onChange={(next) => { setValue(next); onValue?.(next); }}
    />
  );
}

const input = () => screen.getByRole('spinbutton', { name: 'Target battery %' });
const preset = (name) => screen.getByRole('button', { name });

describe('ChargeTargetCard', () => {
  it('highlights the preset that matches the current value', () => {
    renderWithProviders(<Harness initial="80" />);
    expect(preset('80%')).toHaveAttribute('aria-pressed', 'true');
    expect(preset('80%')).toHaveClass('bg-green-500', 'text-white');
    expect(preset('50%')).toHaveAttribute('aria-pressed', 'false');
    expect(preset('Full')).toHaveAttribute('aria-pressed', 'false');
  });

  it('sets the number when a preset is tapped', async () => {
    renderWithProviders(<Harness initial="80" />);
    await userEvent.click(preset('Full'));
    expect(input()).toHaveValue(100);
    expect(preset('Full')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(preset('50%'));
    expect(input()).toHaveValue(50);
    expect(preset('80%')).toHaveAttribute('aria-pressed', 'false');
  });

  it('steps by 5 with the − and + buttons', async () => {
    renderWithProviders(<Harness initial="80" />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase target by 5%' }));
    expect(input()).toHaveValue(85);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease target by 5%' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease target by 5%' }));
    expect(input()).toHaveValue(75);
  });

  it('clamps the stepper at 100', async () => {
    renderWithProviders(<Harness initial="98" />);
    await userEvent.click(screen.getByRole('button', { name: 'Increase target by 5%' }));
    expect(input()).toHaveValue(100);
  });

  it('clamps the stepper at 0', async () => {
    renderWithProviders(<Harness initial="3" />);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease target by 5%' }));
    expect(input()).toHaveValue(0);
  });

  it('highlights a preset when the typed number matches it, and clears the highlight otherwise', async () => {
    renderWithProviders(<Harness initial="80" />);
    await userEvent.clear(input());
    await userEvent.type(input(), '50');
    expect(preset('50%')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.clear(input());
    await userEvent.type(input(), '63');
    ['50%', '80%', 'Full'].forEach((name) => expect(preset(name)).toHaveAttribute('aria-pressed', 'false'));
  });

  it('clamps an out-of-range typed number', async () => {
    renderWithProviders(<Harness initial="80" />);
    await userEvent.clear(input());
    await userEvent.type(input(), '250');
    expect(input()).toHaveValue(100);
  });

  it('lets the box be empty while typing and starts stepping from zero', async () => {
    const seen = [];
    renderWithProviders(<Harness initial="80" onValue={(v) => seen.push(v)} />);
    await userEvent.clear(input());
    expect(input()).toHaveValue(null);
    await userEvent.click(screen.getByRole('button', { name: 'Increase target by 5%' }));
    expect(input()).toHaveValue(5);
    expect(seen).toContain('');
  });

  it('shows the charger-reported battery once known, and a dash while it is not', () => {
    const { unmount } = renderWithProviders(<Harness currentSoc={32} />);
    expect(screen.getByText('32%')).toBeInTheDocument();
    unmount();
    renderWithProviders(<Harness />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText(/reported by the charger once charging starts/)).toBeInTheDocument();
  });

  it('uses no slider', () => {
    renderWithProviders(<Harness />);
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('makes presets and stepper buttons at least 44px', () => {
    renderWithProviders(<Harness />);
    ['50%', '80%', 'Full'].forEach((name) => expect(preset(name)).toHaveClass('min-h-[44px]'));
    expect(screen.getByRole('button', { name: 'Increase target by 5%' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Decrease target by 5%' })).toHaveClass('h-11', 'w-11');
  });

  it('renders Nepali labels', () => {
    renderWithProviders(<Harness />, { locale: 'ne' });
    expect(screen.getByText('चार्ज लक्ष्य')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'फुल' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '८०%' })).toBeInTheDocument();
  });
});
