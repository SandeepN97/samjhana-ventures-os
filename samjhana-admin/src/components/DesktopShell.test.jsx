import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, testI18n } from '../test/test-utils';
import DesktopShell from './DesktopShell';

vi.mock('../utils/api', () => ({ default: { get: vi.fn(() => Promise.resolve({ data: {} })) } }));
import api from '../utils/api';

const setDesktop = (on) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: on,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

const asUser = (role) => localStorage.setItem('user', JSON.stringify({ id: 1, username: 'u', fullName: 'Una Rai', role }));

const renderShell = (path = '/records', options) => {
  window.history.pushState({}, '', path);
  return renderWithProviders(
    <Routes>
      <Route path="*" element={<DesktopShell><p>page body</p></DesktopShell>} />
    </Routes>,
    options,
  );
};

describe('DesktopShell', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete window.matchMedia;
  });

  it('adds nothing around the page on a phone or tablet', () => {
    setDesktop(false);
    asUser('ADMIN');
    renderShell();
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('adds nothing when the browser cannot tell its width', () => {
    asUser('ADMIN');
    renderShell();
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows the side menu beside the page on a desktop', () => {
    setDesktop(true);
    asUser('ADMIN');
    renderShell();
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(screen.getByText('page body')).toBeInTheDocument();
    ['Home', 'Records', 'End of Day', 'Online Orders', 'Analytics', 'Website', 'Settings'].forEach((name) => {
      expect(within(menu).getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    });
    expect(within(menu).getAllByRole('link').length).toBeGreaterThan(10);
  });

  it('marks the page you are on, and keeps a business lit inside its own pages', () => {
    setDesktop(true);
    asUser('ADMIN');
    renderShell('/furniture/orders');
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    const current = within(menu).getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/entry/furniture');
  });

  it('shows each role only what it may open', () => {
    setDesktop(true);
    asUser('STAFF');
    renderShell();
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(menu).queryByRole('link', { name: /Analytics/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /Website/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /Staff/ })).not.toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /Loan/ })).not.toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /Records/ })).toBeInTheDocument();
  });

  it('lets a manager open analytics and the website but not staff management', () => {
    setDesktop(true);
    asUser('MANAGER');
    renderShell();
    const menu = screen.getByRole('navigation', { name: 'Main menu' });
    expect(within(menu).getByRole('link', { name: /Analytics/ })).toBeInTheDocument();
    expect(within(menu).getByRole('link', { name: /Loan/ })).toBeInTheDocument();
    expect(within(menu).queryByRole('link', { name: /Staff/ })).not.toBeInTheDocument();
  });

  it('carries the language switch and Logout, and asks the server for nothing', async () => {
    setDesktop(true);
    asUser('ADMIN');
    localStorage.setItem('token', 't');
    renderShell();
    expect(screen.getByRole('group', { name: 'Choose language' })).toBeInTheDocument();
    expect(screen.getByText('Una Rai')).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('labels the menu in Nepali', () => {
    setDesktop(true);
    asUser('ADMIN');
    renderShell('/records', { locale: 'ne' });
    expect(screen.getByRole('navigation', { name: testI18n.t('home.menuLabel', { lng: 'ne' }) })).toBeInTheDocument();
    expect(screen.getByText('व्यवसायहरू')).toBeInTheDocument();
  });
});
