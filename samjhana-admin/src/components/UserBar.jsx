import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogOut, User } from 'lucide-react';
import { clearSignIn } from '../utils/session';

/**
 * UserBar - who is signed in, and the way out. Drawn like LanguageToggle (same outline,
 * corners and bold text) so the two read as a matching pair on a coloured bar.
 * The name is a label; Logout is a 44px button.
 */
export default function UserBar({ className = '', showName = true, compact = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  let user = {};
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}') || {};
  } catch {
    user = {};
  }
  const name = user.fullName || user.username;

  const logout = () => {
    clearSignIn();
    navigate('/login', { replace: true });
  };

  return (
    <div className={`flex min-w-0 ${compact ? '' : 'overflow-hidden rounded-xl ring-1 ring-inset ring-white/30'} ${className}`}>
      {showName && name ? (
        <span className="flex min-h-[44px] min-w-0 items-center gap-2 px-3 text-sm font-bold text-white/80 sm:px-4">
          <User className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{name}</span>
        </span>
      ) : null}
      <button
        type="button"
        onClick={logout}
        aria-label={compact ? t('nav.logout') : undefined}
        title={compact ? t('nav.logout') : undefined}
        className={`flex min-h-[44px] shrink-0 items-center gap-2 bg-white text-sm font-bold text-core-800 transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core-500 ${compact ? 'w-11 justify-center rounded-xl p-0' : `px-3 sm:px-4 ${showName && name ? 'border-l border-white/30' : ''}`}`}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {!compact && t('nav.logout')}
      </button>
    </div>
  );
}
