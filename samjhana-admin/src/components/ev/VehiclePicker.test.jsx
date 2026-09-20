import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VehiclePicker from './VehiclePicker';
import { renderWithProviders } from '../../test/test-utils';

const VEHICLES = [
  { id: 'v1', vehicleName: 'Higer (100KW)', batteryCapacityKw: 100, seatingCapacity: 16, ratePerPercent: 16 },
  { id: 'v2', vehicleName: 'Foton', batteryCapacityKw: 50.23, seatingCapacity: 16, ratePerPercent: 9 },
  { id: 'v3', vehicleName: 'Sokon', batteryCapacityKw: 42, seatingCapacity: 11, ratePerPercent: 7 },
  { id: 'v4', vehicleName: 'Kama', batteryCapacityKw: 42, seatingCapacity: 14, ratePerPercent: 14 },
];

function Harness({ vehicles = VEHICLES, initial = '', onChange }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <span id="lbl">Vehicle</span>
      <VehiclePicker
        id="picker"
        labelledBy="lbl"
        vehicles={vehicles}
        value={value}
        onChange={(next) => { setValue(next); onChange?.(next); }}
      />
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: /^Vehicle/, expanded: undefined });
const openPicker = async () => { await userEvent.click(screen.getByRole('button', { name: /^Vehicle/ })); return screen.findByRole('dialog'); };
const optionNames = () => screen.getAllByRole('option').map((o) => o.textContent);
// The row text runs name and pills together ("Foton50.23 kW…"), so pull just the leading vehicle name.
const vehicleNames = () => screen.getAllByRole('option')
  .map((o) => (o.textContent.match(/^(Higer|Foton|Sokon|Kama)/) || [])[1])
  .filter(Boolean);

describe('VehiclePicker (closed)', () => {
  it('shows the placeholder when nothing is chosen', () => {
    renderWithProviders(<Harness />);
    expect(trigger()).toHaveTextContent('Select vehicle...');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear vehicle' })).toBeNull();
  });

  it('shows the chosen vehicle with its kW, seats and price', () => {
    renderWithProviders(<Harness initial="v1" />);
    expect(trigger()).toHaveTextContent('Higer (100KW)');
    expect(trigger()).toHaveTextContent('100 kW');
    expect(trigger()).toHaveTextContent('16 seats');
    expect(trigger()).toHaveTextContent('Rs 16');
    expect(trigger().textContent).not.toContain('/%');
  });

  it('is named by its label and is at least 44px tall', () => {
    renderWithProviders(<Harness />);
    expect(screen.getByRole('button', { name: /^Vehicle/ })).toHaveClass('min-h-[64px]');
  });
});

describe('VehiclePicker (open)', () => {
  it('opens a bottom sheet listing every vehicle with a walk-in row first', async () => {
    renderWithProviders(<Harness />);
    const sheet = await openPicker();
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    expect(within(sheet).getByRole('heading', { name: 'Choose vehicle' })).toBeInTheDocument();
    const names = optionNames();
    expect(names[0]).toContain('No vehicle (walk-in)');
    expect(vehicleNames()).toEqual(['Higer', 'Foton', 'Sokon', 'Kama']);
    expect(screen.getByText('4 vehicles')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows the price as a green pill on every row', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    const foton = screen.getByRole('option', { name: /Foton/ });
    expect(within(foton).getByText('Rs 9')).toHaveClass('bg-green-100', 'text-green-700');
    expect(foton.textContent).not.toContain('/%');
    expect(within(foton).getByText('50.23 kW')).toBeInTheDocument();
    expect(within(foton).getByText(/16 seats/)).toBeInTheDocument();
  });

  it('never prints "undefined" for a vehicle without a rate', async () => {
    renderWithProviders(<Harness vehicles={[{ id: 'v9', vehicleName: 'Mystery', batteryCapacityKw: 30, seatingCapacity: 4 }]} />);
    await openPicker();
    const row = screen.getByRole('option', { name: /Mystery/ });
    expect(row.textContent).not.toMatch(/undefined|NaN|null/);
    expect(within(row).queryByText(/^Rs /)).toBeNull(); // no price pill at all
  });

  it('chooses a vehicle, closes the sheet and shows it on the field', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    await openPicker();
    await userEvent.click(screen.getByRole('option', { name: /Sokon/ }));

    expect(onChange).toHaveBeenCalledWith('v3');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveTextContent('Sokon');
    expect(trigger()).toHaveTextContent('Rs 7');
  });

  it('marks the current vehicle as selected when reopened', async () => {
    renderWithProviders(<Harness initial="v2" />);
    await openPicker();
    expect(screen.getByRole('option', { name: /Foton/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /Sokon/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('option', { name: /No vehicle/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('marks the walk-in row as selected when no vehicle is chosen', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    expect(screen.getByRole('option', { name: /No vehicle/ })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('VehiclePicker (clearing)', () => {
  it('clears the choice with the walk-in row', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial="v1" onChange={onChange} />);
    await openPicker();
    await userEvent.click(screen.getByRole('option', { name: /No vehicle/ }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(trigger()).toHaveTextContent('Select vehicle...');
  });

  it('clears the choice with the × on the field without opening the sheet', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial="v1" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear vehicle' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear vehicle' })).toBeNull();
  });

  it('makes the clear button a 44px target', () => {
    renderWithProviders(<Harness initial="v1" />);
    expect(screen.getByRole('button', { name: 'Clear vehicle' })).toHaveClass('h-11', 'w-11');
  });
});

describe('VehiclePicker (search)', () => {
  it('filters by name and reports how many matched', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by name, kW or price' }), 'kam');
    expect(optionNames()).toHaveLength(1);
    expect(screen.getByRole('option', { name: /Kama/ })).toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 4 vehicles')).toBeInTheDocument();
  });

  it('highlights the matching part of the name', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    await userEvent.type(screen.getByRole('searchbox'), 'fot');
    expect(screen.getByRole('option', { name: /Foton/ }).querySelector('mark')).toHaveTextContent('Fot');
  });

  it('finds vehicles by seats, battery kW or price', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    const search = screen.getByRole('searchbox');
    await userEvent.type(search, '14');
    expect(vehicleNames()).toEqual(['Kama']);
    await userEvent.clear(search);
    await userEvent.type(search, '42');
    expect(optionNames()).toHaveLength(2); // Sokon and Kama are both 42 kW
  });

  it('accepts Devanagari digits in the search box', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    await userEvent.type(screen.getByRole('searchbox'), '१४');
    expect(screen.getByRole('option', { name: /Kama/ })).toBeInTheDocument();
  });

  it('clears the search text with our own × and keeps focus in the box', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    const search = screen.getByRole('searchbox');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
    await userEvent.type(search, 'kam');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(optionNames()).toHaveLength(5);
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });

  it('hides the browser’s own cancel button so only the branded × shows', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    expect(screen.getByRole('searchbox').className).toContain('[&::-webkit-search-cancel-button]:hidden');
  });

  it('hides the walk-in row while searching and says so when nothing matches', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    await userEvent.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('No vehicle matches “zzz”')).toBeInTheDocument();
  });

  it('starts empty each time it opens', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    await userEvent.type(screen.getByRole('searchbox'), 'kam');
    await userEvent.keyboard('{Escape}');
    await openPicker();
    expect(screen.getByRole('searchbox')).toHaveValue('');
    expect(optionNames()).toHaveLength(5);
  });

  it('focuses the search box as soon as the sheet opens', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });
});

describe('VehiclePicker (closing)', () => {
  it('closes on Escape and returns focus to the field', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger()).toHaveFocus();
  });

  it('closes with the close button and does not change the choice', async () => {
    const onChange = vi.fn();
    renderWithProviders(<Harness initial="v1" onChange={onChange} />);
    await openPicker();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes when the dimmed backdrop is tapped but not when the sheet is', async () => {
    renderWithProviders(<Harness />);
    const sheet = await openPicker();
    await userEvent.click(sheet);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.mouseDown(sheet.parentElement);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('locks page scrolling while open and restores it after', async () => {
    renderWithProviders(<Harness />);
    document.body.style.overflow = 'auto';
    await openPicker();
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(document.body.style.overflow).toBe('auto');
  });

  it('makes close, search and option rows comfortable touch targets', async () => {
    renderWithProviders(<Harness />);
    await openPicker();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('searchbox')).toHaveClass('min-h-[48px]');
    screen.getAllByRole('option').forEach((o) => expect(o.className).toMatch(/min-h-\[(56|64)px\]/));
  });
});

describe('VehiclePicker (empty list and Nepali)', () => {
  it('explains when no vehicles are set up', async () => {
    renderWithProviders(<Harness vehicles={[]} />);
    await openPicker();
    expect(screen.getByText('No vehicles are set up yet.')).toBeInTheDocument();
  });

  it('renders Nepali labels and Devanagari numerals', async () => {
    renderWithProviders(<Harness initial="v1" />, { locale: 'ne' });
    expect(screen.getByRole('button', { name: /गाडी हटाउनुहोस्/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Vehicle/ })).toHaveTextContent('रु १६');
    expect(screen.getByRole('button', { name: /^Vehicle/ }).textContent).not.toContain('Rs');
    expect(screen.getByRole('button', { name: /^Vehicle/ }).textContent).not.toContain('/%');
    await userEvent.click(screen.getByRole('button', { name: /^Vehicle/ }));
    expect(await screen.findByRole('heading', { name: 'गाडी छान्नुहोस्' })).toBeInTheDocument();
    expect(screen.getByText('जम्मा ४ गाडी')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /गाडी छैन/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Foton/ })).toHaveTextContent('५०.२३ kW');
  });
});
