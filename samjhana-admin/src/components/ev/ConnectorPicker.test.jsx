import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConnectorPicker from './ConnectorPicker';
import { renderWithProviders } from '../../test/test-utils';

function renderPicker(props = {}, locale = 'en') {
  const onSelect = vi.fn();
  renderWithProviders(
    <>
      <p id="label">Charging connector</p>
      <ConnectorPicker labelId="label" value="1" occupied={new Set()} onSelect={onSelect} {...props} />
    </>,
    { locale },
  );
  return onSelect;
}

describe('ConnectorPicker', () => {
  it('renders both connectors as free tap cards with the first selected', () => {
    renderPicker();
    expect(screen.getByRole('radiogroup', { name: 'Charging connector' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Connector 1, Free' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Connector 2, Free' })).toHaveAttribute('aria-checked', 'false');
  });

  it('reports the tapped connector', async () => {
    const onSelect = renderPicker();
    await userEvent.click(screen.getByRole('radio', { name: 'Connector 2, Free' }));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('shows an in-use connector as disabled and never selected', async () => {
    const onSelect = renderPicker({ occupied: new Set([1]) });
    const inUse = screen.getByRole('radio', { name: 'Connector 1, In use' });
    expect(inUse).toBeDisabled();
    expect(inUse).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(inUse);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disables both connectors until a charger is chosen', () => {
    renderPicker({ disabled: true });
    screen.getAllByRole('radio').forEach((card) => {
      expect(card).toBeDisabled();
      expect(card).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('keeps every card at least 44px tall for touch', () => {
    renderPicker();
    screen.getAllByRole('radio').forEach((card) => expect(card.className).toContain('min-h-[64px]'));
  });

  it('renders in Nepali with Nepali numerals', () => {
    renderPicker({ occupied: new Set([2]) }, 'ne');
    expect(screen.getByRole('radio', { name: 'कनेक्टर १, खाली' })).toBeEnabled();
    expect(screen.getByRole('radio', { name: 'कनेक्टर २, प्रयोगमा' })).toBeDisabled();
  });
});
