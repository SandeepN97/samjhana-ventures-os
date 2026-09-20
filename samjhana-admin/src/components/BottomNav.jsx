import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BarChart3, FileText, Home, Settings } from 'lucide-react';

const ITEMS = [
  { key: 'home', icon: Home, path: '/', labelKey: 'nav.home' },
  { key: 'records', icon: FileText, path: '/records', labelKey: 'nav.records' },
  { key: 'analytics', icon: BarChart3, path: '/analytics', labelKey: 'nav.analytics' },
  { key: 'settings', icon: Settings, path: '/settings', labelKey: 'nav.settings' },
];

/** App-wide bottom navigation (Home / Records / Analytics / Settings). */
export default function BottomNav({ active = 'home' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('nav.home')}
      className="fixed bottom-0 left-0 right-0 z-30 flex justify-around border-t border-gray-200 bg-white px-4 py-2"
    >
      {ITEMS.map(({ key, icon: Icon, path, labelKey }) => (
        <button
          key={key}
          type="button"
          onClick={() => navigate(path)}
          aria-current={active === key ? 'page' : undefined}
          className={`flex min-h-[44px] min-w-[44px] flex-col items-center px-3 py-1 ${
            active === key ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <Icon className="h-5 w-5" />
          <span className="mt-1 text-xs">{t(labelKey)}</span>
        </button>
      ))}
    </nav>
  );
}
