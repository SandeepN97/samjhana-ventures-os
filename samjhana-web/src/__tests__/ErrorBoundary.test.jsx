import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ErrorBoundary from '../components/ErrorBoundary';

function Broken() {
  throw new Error('vehicles.map is not a function');
}

describe('ErrorBoundary', () => {
  it('shows its children when nothing goes wrong', () => {
    render(<ErrorBoundary><p>Fuel prices</p></ErrorBoundary>);
    expect(screen.getByText('Fuel prices')).toBeInTheDocument();
  });

  it('shows a short message instead of blanking the page when a child throws', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <ErrorBoundary><Broken /></ErrorBoundary>
        <p>Rest of the site</p>
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent("This section couldn't be shown right now.");
    expect(screen.getByText('Rest of the site')).toBeInTheDocument();
    quiet.mockRestore();
  });
});
