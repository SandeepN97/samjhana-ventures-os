import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

/**
 * LanguageToggle - Switch between English and Nepali
 *
 * Displays current language and toggles on click
 * Dad-proof: Large touch target, clear visual feedback
 */
export default function LanguageToggle({ className = '' }) {
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';

  const toggleLanguage = () => {
    const newLang = isNepali ? 'en' : 'ne';
    i18n.changeLanguage(newLang);
    // Persist preference
    localStorage.setItem('preferredLanguage', newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`
        flex items-center gap-2 px-3 py-2
        bg-white/20 hover:bg-white/30
        rounded-full transition-all
        text-white font-medium text-sm
        active:scale-95
        ${className}
      `}
      aria-label={isNepali ? 'Switch to English' : 'नेपालीमा बदल्नुहोस्'}
    >
      <Globe className="w-4 h-4" />
      <span className="font-bold">
        {isNepali ? 'EN' : 'ने'}
      </span>
    </button>
  );
}
