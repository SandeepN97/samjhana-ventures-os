/* eslint-env node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteProvider } from '../site/SiteContext';

// The website content exactly as a fresh install gets it from the backend (picture placeholders become empty).
const defaults = JSON.parse(readFileSync(resolve(process.cwd(), '../src/main/resources/seed/site-content-defaults.json'), 'utf8'));
const clean = (node) => {
  if (Array.isArray(node)) return node.map(clean);
  if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, clean(v)]));
  if (typeof node === 'string' && node.startsWith('@') && node !== '@whatsapp' && node !== '@phone') return '';
  return node;
};
export const SITE = clean(defaults);

export function renderPage(ui, { route = '/', site = SITE } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SiteProvider initial={site}>{ui}</SiteProvider>
    </MemoryRouter>,
  );
}

/** A product as the public shop API sends it. */
export const product = (over = {}) => ({
  id: 'honey-001', type: 'BEEKEEPING', typeLabel: 'Honey & beekeeping', category: 'HONEY', categoryLabel: 'Honey & wax', categoryLabelNepali: 'मह',
  name: 'Wild Honey', nameNepali: 'जंगली मह', description: 'Raw and unfiltered.', price: 850, badge: null,
  images: ['/api/public/media/p1'], image: '/api/public/media/p1', stockStatus: 'IN_STOCK', details: { unit: 'per 500g jar' }, ...over,
});
