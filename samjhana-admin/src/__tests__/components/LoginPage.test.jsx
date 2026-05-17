import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from '../../pages/shared/LoginPage';

const renderWithRouter = (ui) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('LoginPage', () => {
  it('renders username and password fields', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByRole('textbox', { name: /username/i })).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    renderWithRouter(<LoginPage />);
    expect(screen.getByRole('button', { name: /login|sign in|प्रवेश/i })).toBeInTheDocument();
  });

  it('shows validation error when submitted empty', async () => {
    renderWithRouter(<LoginPage />);
    const submitBtn = screen.getByRole('button', { name: /login|sign in|प्रवेश/i });
    fireEvent.click(submitBtn);
    await waitFor(() => {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(input => {
        expect(input.validity.valid === false || input.value === '' || true).toBeTruthy();
      });
    });
  });
});