import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageToggle from '../LanguageToggle';
import { unitTheme } from '../../brand/theme';

/**
 * The coloured bar at the top of every admin screen: back button, optional icon, title,
 * optional subtitle, optional action buttons, and the language toggle. `unit` picks the
 * business colour; `children` render inside the bar below the title row (e.g. tabs).
 */
export default function PageHeader({
  unit = 'core',
  title,
  subtitle,
  icon: Icon,
  backTo = '/',
  onBack,
  actions,
  showLanguageToggle = true,
  children,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = unitTheme(unit);

  return (
    <header className={`${theme.header} px-4 py-4 text-white shadow-lg`} data-unit={unit}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            onClick={onBack ?? (() => navigate(backTo))}
            aria-label={t('common.goBack')}
            className={`-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${theme.headerHover}`}
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          {Icon && <Icon className="ml-2 h-8 w-8 shrink-0" aria-hidden="true" />}
          <div className="ml-3 min-w-0">
            <h1 className="text-xl font-bold leading-tight">{title}</h1>
            {subtitle && <p className={`mt-0.5 text-sm ${theme.headerSubtle}`}>{subtitle}</p>}
          </div>
        </div>
        {(actions || showLanguageToggle) && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {showLanguageToggle && <LanguageToggle />}
          </div>
        )}
      </div>
      {children}
    </header>
  );
}

/** A small icon-over-label button for the header's action area (e.g. "Vehicles", "Tenants"). */
export function HeaderAction({ unit = 'core', icon: Icon, label, onClick }) {
  const theme = unitTheme(unit);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 transition-colors ${theme.headerHover}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
