import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import useDesktop from '../hooks/useDesktop';

export default function LedgerPageHeader({ title, hideWhenSidebarShows = false }) {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const desktop = useDesktop();

  const setLanguage = (language) => {
    i18n.changeLanguage(language);
    localStorage.setItem('preferredLanguage', language);
  };

  if (desktop && hideWhenSidebarShows) {
    return <h1 className="sr-only">{title}</h1>;
  }

  return (
    <header className="bg-core-800 text-white">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-3 px-4 md:min-h-[128px] md:px-7 lg:px-8 xl:min-h-[76px]">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={isNepali ? 'पछाडि जानुहोस्' : 'Go back'}
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 xl:flex"
          >
            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
          </button>
          <h1 className="truncate text-[22px] font-bold leading-none tracking-[-0.035em] sm:text-[28px] md:text-[50px] xl:text-[26px]">
            {title}
          </h1>
        </div>

        <div
          role="group"
          aria-label={isNepali ? 'भाषा छान्नुहोस्' : 'Choose language'}
          className="flex shrink-0 overflow-hidden rounded-xl ring-1 ring-inset ring-white/30"
        >
          <button
            type="button"
            onClick={() => setLanguage('en')}
            aria-pressed={!isNepali}
            className={`min-h-[44px] px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200 sm:px-4 md:min-h-[64px] md:px-7 md:text-xl xl:min-h-[44px] xl:px-4 xl:text-sm ${!isNepali ? 'bg-blue-500 text-white' : 'text-white/75 hover:bg-white/10'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ne')}
            aria-pressed={isNepali}
            className={`min-h-[44px] px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200 sm:px-4 md:min-h-[64px] md:px-7 md:text-xl xl:min-h-[44px] xl:px-4 xl:text-sm ${isNepali ? 'bg-blue-500 text-white' : 'text-white/75 hover:bg-white/10'}`}
          >
            नेपाली
          </button>
        </div>
      </div>
    </header>
  );
}
