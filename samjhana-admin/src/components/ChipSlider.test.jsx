import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Bell } from 'lucide-react';
import ChipSlider from './ChipSlider';

const items = [
  { value: 'ALL', label: 'All' },
  { value: 'NEW', label: 'New', icon: Bell, count: '3' },
  { value: 'DONE', label: 'Done', count: '0' },
];

describe('ChipSlider', () => {
  it('renders one chip per item in a labelled group and marks the chosen one', () => {
    render(<ChipSlider label="Filter" items={items} value="NEW" onChange={() => {}} />);
    const group = screen.getByRole('group', { name: 'Filter' });
    expect(group.querySelectorAll('button')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /New/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the value of the chip that was tapped', async () => {
    const onChange = vi.fn();
    render(<ChipSlider label="Filter" items={items} value="ALL" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Done/ }));
    expect(onChange).toHaveBeenCalledWith('DONE');
  });

  it('shows the count and keeps every chip at least 44px tall', () => {
    render(<ChipSlider label="Filter" items={items} value="ALL" onChange={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
    screen.getAllByRole('button').forEach((chip) => expect(chip.className).toContain('min-h-[44px]'));
  });

  it('draws the chip icon, hidden from screen readers, only on chips that have one', () => {
    render(<ChipSlider label="Filter" items={items} value="ALL" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /New/ }).querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'All' }).querySelector('svg')).toBeNull();
  });

  it('renders nothing selectable when there are no items', () => {
    render(<ChipSlider label="Filter" items={[]} value="ALL" onChange={() => {}} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
