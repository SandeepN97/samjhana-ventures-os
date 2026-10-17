import React from 'react';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** The company name mark, in the current language, for login and the dashboard. */
export default function Wordmark({ className = '', size = 'lg' }) {
  const { t } = useTranslation();
  const text = size === 'lg' ? 'text-2xl' : 'text-base leading-tight';
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${text} ${className}`}>
      <Building2 className={`${size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'} shrink-0`} aria-hidden="true" />
      <span className={size === 'sm' ? 'min-w-0 text-left' : ''}>{t('home.title')}</span>
    </span>
  );
}
