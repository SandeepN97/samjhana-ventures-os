import React from 'react';
import { useTranslation } from 'react-i18next';

const TONES = {
  // For header bars and other dark or coloured backgrounds.
  onDark: {
    frame: 'ring-white/30',
    active: 'bg-white text-core-800',
    idle: 'text-white/80 hover:bg-white/10',
    focus: 'focus-visible:ring-white',
  },
  // For white or light grey backgrounds.
  onLight: {
    frame: 'ring-gray-300',
    active: 'bg-core-800 text-white',
    idle: 'text-gray-600 hover:bg-gray-100',
    focus: 'focus-visible:ring-core-500',
  },
};

/**
 * LanguageToggle - English | नेपाली switch, shown the same way on every admin screen.
 * Both languages are always visible and the current one is highlighted, so staff
 * never have to guess which way a tap will go. Each side is a 44px touch target.
 */
export default function LanguageToggle({ className = '', tone = 'onDark' }) {
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const style = TONES[tone] ?? TONES.onDark;

  const setLanguage = (language) => {
    i18n.changeLanguage(language);
    // Persist preference
    localStorage.setItem('preferredLanguage', language);
  };

  const side = (language, label, selected) => (
    <button
      type="button"
      onClick={() => setLanguage(language)}
      aria-pressed={selected}
      className={`min-h-[44px] px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-4 ${style.focus} ${selected ? style.active : style.idle}`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="group"
      aria-label={isNepali ? 'भाषा छान्नुहोस्' : 'Choose language'}
      className={`flex shrink-0 overflow-hidden rounded-xl ring-1 ring-inset ${style.frame} ${className}`}
    >
      {side('en', 'English', !isNepali)}
      {side('ne', 'नेपाली', isNepali)}
    </div>
  );
}
