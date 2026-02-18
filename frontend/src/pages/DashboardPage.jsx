import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QuickActionButtons from '../components/QuickActionButtons';
import LanguageToggle from '../components/LanguageToggle';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div className="relative">
      {/* Top bar with language toggle and user info */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2">
        {/* Language Toggle */}
        <LanguageToggle />

        {/* User info & Logout */}
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium opacity-80">
            {user.fullName || user.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-white text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
          >
            {isNepali ? 'लग आउट' : 'Logout'}
          </button>
        </div>
      </div>

      <QuickActionButtons />
    </div>
  );
}
