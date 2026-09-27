import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Fuel,
  Zap,
  Sofa,
  Home,
  Landmark,
  Plus,
  FileText,
  Settings,
  Users,
  BarChart3,
} from 'lucide-react';
import { Wordmark } from './brand';
import { unitTheme } from '../brand/theme';

/**
 * QuickActionButtons - The "Dad-Proof" mobile home screen.
 *
 * Features:
 * - 6 large buttons (2x3 grid) for common actions
 * - Each button ~120px with clear icon and bilingual label
 * - High contrast colors for easy visibility
 * - Touch-friendly with visual feedback
 */

const BUSINESS_BUTTONS = [
  {
    code: 'petrol',
    icon: Fuel,
    tKey: 'business.petrol',
    unit: 'petrol',
    path: '/entry/petrol',
  },
  {
    code: 'ev',
    icon: Zap,
    tKey: 'business.ev',
    unit: 'ev',
    path: '/entry/ev',
  },
  {
    code: 'furniture',
    icon: Sofa,
    tKey: 'business.furniture',
    unit: 'furniture',
    path: '/entry/furniture',
  },
  {
    code: 'rental',
    icon: Home,
    tKey: 'business.rental',
    unit: 'rental',
    path: '/entry/rental',
  },
  {
    code: 'loan',
    icon: Landmark,
    tKey: 'business.loan',
    unit: 'loans',
    path: '/entry/loan',
  },
  {
    code: 'add',
    icon: Plus,
    tKey: 'home.addNew',
    unit: 'core',
    path: '/add',
  },
];

export default function QuickActionButtons() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';
  const isStaff = user.role === 'STAFF';
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';
  const canViewAnalytics = canManage;

  const visibleButtons = isStaff
    ? BUSINESS_BUTTONS.filter((b) => b.code !== 'loan')
    : BUSINESS_BUTTONS;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <header className="bg-core-800 text-white px-4 pt-14 pb-6 shadow-lg">
        <h1 className="text-center">
          <Wordmark />
        </h1>
        <p className="text-center text-core-300 mt-1">
          {t('home.welcome')}
        </p>
      </header>

      {/* Quick Cash Display */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-md p-4">
        <p className="text-gray-500 text-sm text-center">
          {t('home.todayCash')}
        </p>
        <p className="text-3xl font-bold text-center text-green-600 mt-1">
          रु 1,23,456
        </p>
      </div>

      {/* Main Action Buttons - 2x3 Grid */}
      <div className="grid grid-cols-2 gap-4 p-4 mt-4">
        {visibleButtons.map((button) => (
          <QuickButton
            key={button.code}
            button={button}
            onClick={() => navigate(button.path)}
          />
        ))}
      </div>

      {/* Secondary Actions */}
      <div className="px-4 mt-6 space-y-3">
        <SecondaryButton
          icon={FileText}
          label={t('home.dailyClose')}
          onClick={() => navigate('/reports/close')}
        />
        {isAdmin && (
          <SecondaryButton
            icon={Users}
            label={t('home.staffManagement')}
            onClick={() => navigate('/staff')}
          />
        )}
        {canViewAnalytics && (
          <SecondaryButton
            icon={BarChart3}
            label={t('home.analytics')}
            onClick={() => navigate('/analytics')}
          />
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-around">
        <NavButton
          icon={Home}
          label={t('nav.home')}
          active
          onClick={() => navigate('/')}
        />
        <NavButton
          icon={FileText}
          label={t('nav.records')}
          onClick={() => navigate('/records')}
        />
        <NavButton
          icon={BarChart3}
          label={t('nav.analytics')}
          onClick={() => navigate('/analytics')}
        />
        <NavButton
          icon={Settings}
          label={t('nav.settings')}
          onClick={() => navigate('/settings')}
        />
      </nav>
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function QuickButton({ button, onClick }) {
  const { t } = useTranslation();
  const Icon = button.icon;
  const label = t(button.tKey);

  return (
    <button
      onClick={onClick}
      className={`
        ${unitTheme(button.unit).tile}
        flex flex-col items-center justify-center
        h-32 rounded-2xl shadow-lg
        transform transition-all duration-150
        active:scale-95 active:shadow-md
        text-white
      `}
    >
      <Icon className="w-12 h-12 mb-2" strokeWidth={2} />
      <span className="text-lg font-bold text-center px-2 leading-tight">
        {label}
      </span>
    </button>
  );
}

function SecondaryButton({ icon: Icon, label, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between bg-white rounded-xl px-4 py-4 shadow-md active:bg-gray-50 transition-colors"
    >
      <div className="flex items-center">
        <Icon className="w-6 h-6 text-gray-600 mr-3" />
        <span className="text-lg text-gray-700">{label}</span>
      </div>
      {badge && (
        <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

function NavButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center py-1 px-3
        ${active ? 'text-core-800' : 'text-gray-400'}
        hover:text-core-600 transition-colors
      `}
    >
      <Icon className="w-6 h-6" />
      <span className="text-xs mt-1">{label}</span>
    </button>
  );
}
