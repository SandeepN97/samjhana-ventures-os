import React from 'react';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** "Samjhana Ventures" name mark, in the current language, for login and the dashboard. */
export default function Wordmark({ className = '', size = 'lg' }) {
  const { t } = useTranslation();
  const text = size === 'lg' ? 'text-2xl' : 'text-xl';
  return (
    <span className={`inline-flex items-center gap-2 font-bold ${text} ${className}`}>
      <Building2 className={size === 'lg' ? 'h-7 w-7' : 'h-6 w-6'} aria-hidden="true" />
      {t('home.title')}
    </span>
  );
}
