import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders } from '../test/test-utils';
import UserBar from './UserBar';

const renderBar = (options) => renderWithProviders(
  <Routes>
    <Route path="/" element={<UserBar />} />
    <Route path="/login" element={<p>login screen</p>} />
  </Routes>,
  options,
);

describe('UserBar', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
  });

  it('shows the full name and a 44px Logout button', () => {
    localStorage.setItem('user', JSON.stringify({ fullName: 'System Admin', username: 'admin' }));
    renderBar();
    expect(screen.getByText('System Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Logout' })).toHaveClass('min-h-[44px]');
  });

  it('falls back to the username when there is no full name', () => {
    localStorage.setItem('user', JSON.stringify({ username: 'manager' }));
    renderBar();
    expect(screen.getByText('manager')).toBeInTheDocument();
  });

  it('signs out, clears what the browser kept, and goes to the login screen', async () => {
    localStorage.setItem('token', 't');
    localStorage.setItem('user', JSON.stringify({ fullName: 'System Admin' }));
    renderBar();
    await userEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(await screen.findByText('login screen')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('still shows Logout when nobody is stored or the stored user is unreadable', () => {
    localStorage.setItem('user', '{not json');
    renderBar();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    expect(screen.queryByText('System Admin')).not.toBeInTheDocument();
  });

  it('labels the button in Nepali', () => {
    localStorage.setItem('user', JSON.stringify({ fullName: 'System Admin' }));
    renderBar({ locale: 'ne' });
    expect(screen.getByRole('button', { name: 'लग आउट' })).toBeInTheDocument();
  });
});
