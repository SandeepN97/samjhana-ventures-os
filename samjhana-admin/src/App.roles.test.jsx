import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PrivateRoute } from './App';

const renderAt = (roles) => render(
  <MemoryRouter initialEntries={['/secret']}>
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route path="/login" element={<p>login</p>} />
      <Route path="/change-password" element={<p>change</p>} />
      <Route path="/secret" element={<PrivateRoute roles={roles}><p>secret</p></PrivateRoute>} />
    </Routes>
  </MemoryRouter>,
);
const signIn = (user) => { localStorage.setItem('token', 't'); localStorage.setItem('user', JSON.stringify(user)); };

describe('PrivateRoute', () => {
  beforeEach(() => localStorage.clear());

  it('sends a visitor with no token to login', () => {
    renderAt(['ADMIN']);
    expect(screen.getByText('login')).toBeInTheDocument();
  });
  it('lets an allowed role in', () => {
    signIn({ role: 'ADMIN' });
    renderAt(['ADMIN']);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('sends a role that is not allowed home', () => {
    signIn({ role: 'MANAGER' });
    renderAt(['ADMIN']);
    expect(screen.getByText('home')).toBeInTheDocument();
  });
  it('lets any signed-in role in when no roles are listed', () => {
    signIn({ role: 'STAFF' });
    renderAt(undefined);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
  it('forces a person with a temporary password to choose a new one', () => {
    signIn({ role: 'ADMIN', mustChangePassword: true });
    renderAt(['ADMIN']);
    expect(screen.getByText('change')).toBeInTheDocument();
  });
});
