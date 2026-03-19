import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from '../i18n/index.js';

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources,
  interpolation: { escapeValue: false },
});

export function renderWithProviders(ui, { locale = 'en', ...options } = {}) {
  testI18n.changeLanguage(locale);
  function Wrapper({ children }) {
    return (
      <I18nextProvider i18n={testI18n}>
        <BrowserRouter>{children}</BrowserRouter>
      </I18nextProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...options });
}

export { testI18n };
