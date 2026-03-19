import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DatePicker from './DatePicker';
import { renderWithProviders } from '../test/test-utils';

describe('DatePicker', () => {
  it('renders with placeholder when no value', () => {
    renderWithProviders(<DatePicker value="" onChange={() => {}} />);
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('displays formatted date when value is set', () => {
    renderWithProviders(<DatePicker value="2026-02-19" onChange={() => {}} />);
    expect(screen.getByText('19 Feb 2026')).toBeInTheDocument();
  });

  it('opens calendar on click', async () => {
    renderWithProviders(<DatePicker value="2026-02-19" onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Pick date' });
    await userEvent.click(trigger);
    expect(screen.getByText('February 2026')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('navigates to previous month', async () => {
    renderWithProviders(<DatePicker value="2026-02-19" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date' }));
    expect(screen.getByText('February 2026')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Previous month'));
    expect(screen.getByText('January 2026')).toBeInTheDocument();
  });

  it('navigates to next month', async () => {
    renderWithProviders(<DatePicker value="2026-02-19" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date' }));

    await userEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getByText('March 2026')).toBeInTheDocument();
  });

  it('calls onChange with formatted date when a day is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DatePicker value="2026-02-19" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date' }));

    // Click on day 15
    const day15 = screen.getByText('15');
    await userEvent.click(day15);

    expect(onChange).toHaveBeenCalledWith('2026-02-15');
  });

  it('closes calendar after selecting a day', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DatePicker value="2026-02-19" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date' }));

    expect(screen.getByText('February 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByText('15'));
    expect(screen.queryByText('February 2026')).not.toBeInTheDocument();
  });

  it('shows error border when error prop is set', () => {
    renderWithProviders(<DatePicker value="" onChange={() => {}} error="Required" />);
    const trigger = screen.getByRole('button', { name: 'Pick date' });
    expect(trigger.className).toContain('border-red-500');
  });

  it('shows Nepali text in ne locale', () => {
    renderWithProviders(
      <DatePicker value="" onChange={() => {}} />,
      { locale: 'ne' }
    );
    expect(screen.getByText('मिति छान्नुहोस्')).toBeInTheDocument();
  });

  it('displays Nepali digits when locale is ne', () => {
    renderWithProviders(
      <DatePicker value="2026-02-19" onChange={() => {}} />,
      { locale: 'ne' }
    );
    // In Nepali mode the closed picker shows the BS date with Nepali digits
    // 2026-02-19 AD = 2082-11-07 BS, displayed as "७ फाल्गुन २०८२"
    expect(screen.getByRole('button', { name: 'Pick date' }).textContent).toMatch(/[०-९]/);
  });

  it('selects today when "Today" button is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(<DatePicker value="2026-01-01" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date' }));

    // Need to navigate to current month first since value is Jan 2026
    // Just click Today
    await userEvent.click(screen.getByText('Today'));
    expect(onChange).toHaveBeenCalled();
    // Verify it's a valid date string
    const calledDate = onChange.mock.calls[0][0];
    expect(calledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('renders all 7 day headers', async () => {
    renderWithProviders(<DatePicker value="2026-02-19" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Pick date' }));

    for (const day of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });
});
