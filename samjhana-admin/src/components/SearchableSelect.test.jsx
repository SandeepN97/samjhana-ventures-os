import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchableSelect from './SearchableSelect';
import { renderWithProviders } from '../test/test-utils';

const SAMPLE_OPTIONS = [
  { value: '1', label: 'Toyota Corolla', subtitle: '60KW, 5 seats' },
  { value: '2', label: 'Nissan Leaf', subtitle: '40KW, 5 seats' },
  { value: '3', label: 'Tesla Model 3', subtitle: '75KW, 5 seats' },
];

describe('SearchableSelect', () => {
  it('renders placeholder when no value selected', () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} placeholder="Pick one" />
    );
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('shows selected option label', () => {
    renderWithProviders(
      <SearchableSelect value="2" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    expect(screen.getByText('Nissan Leaf')).toBeInTheDocument();
  });

  it('opens dropdown on click', async () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    expect(screen.getByText('Toyota Corolla')).toBeInTheDocument();
    expect(screen.getByText('Nissan Leaf')).toBeInTheDocument();
    expect(screen.getByText('Tesla Model 3')).toBeInTheDocument();
  });

  it('filters options by search text', async () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));

    const searchInput = screen.getByPlaceholderText('Search...');
    await userEvent.type(searchInput, 'tesla');

    expect(screen.getByText('Tesla Model 3')).toBeInTheDocument();
    expect(screen.queryByText('Toyota Corolla')).not.toBeInTheDocument();
    expect(screen.queryByText('Nissan Leaf')).not.toBeInTheDocument();
  });

  it('filters options by subtitle text', async () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));

    const searchInput = screen.getByPlaceholderText('Search...');
    await userEvent.type(searchInput, '40KW');

    expect(screen.getByText('Nissan Leaf')).toBeInTheDocument();
    expect(screen.queryByText('Toyota Corolla')).not.toBeInTheDocument();
  });

  it('shows "No options found" when search has no match', async () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));
    await userEvent.type(screen.getByPlaceholderText('Search...'), 'zzzzz');

    expect(screen.getByText('No options found')).toBeInTheDocument();
  });

  it('calls onChange when an option is clicked', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SearchableSelect value="" onChange={onChange} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));
    await userEvent.click(screen.getByText('Tesla Model 3'));

    expect(onChange).toHaveBeenCalledWith('3');
  });

  it('closes dropdown after selection', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <SearchableSelect value="" onChange={onChange} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Tesla Model 3'));
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('shows error border when error prop is set', () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} error="Required" />
    );
    const trigger = screen.getByRole('button', { name: 'Select option' });
    expect(trigger.className).toContain('border-red-500');
  });

  it('shows check mark on selected option', async () => {
    renderWithProviders(
      <SearchableSelect value="2" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));

    // The Nissan Leaf option in the dropdown should have green styling
    // The dropdown options are inside the dropdown list, not the trigger
    const dropdownButtons = screen.getAllByRole('button').filter(
      btn => btn.textContent.includes('Nissan Leaf') && btn.textContent.includes('40KW')
    );
    expect(dropdownButtons.length).toBeGreaterThan(0);
    expect(dropdownButtons[0].className).toContain('bg-green-50');
  });

  it('renders subtitles for options', async () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));

    expect(screen.getByText('60KW, 5 seats')).toBeInTheDocument();
    expect(screen.getByText('40KW, 5 seats')).toBeInTheDocument();
  });

  it('shows Nepali placeholder in ne locale', () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={SAMPLE_OPTIONS} />,
      { locale: 'ne' }
    );
    expect(screen.getByText('-- छान्नुहोस् --')).toBeInTheDocument();
  });

  it('handles empty options array', async () => {
    renderWithProviders(
      <SearchableSelect value="" onChange={() => {}} options={[]} />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Select option' }));
    expect(screen.getByText('No options found')).toBeInTheDocument();
  });
});
