import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import Navbar from '../components/Navbar';

const renderWithRouter = (ui) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('Navbar', () => {
  it('renders without crashing', () => {
    renderWithRouter(<Navbar />);
  });

  it('contains a navigation element', () => {
    renderWithRouter(<Navbar />);
    expect(document.querySelector('nav')).toBeInTheDocument();
  });
});