/* eslint-env node */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import HubLanes from '../components/home/HubLanes';
import { SITE, renderPage } from '../test/utils';

const withCards = (cards) => ({ ...SITE, hub: { ...SITE.hub, shop: { ...SITE.hub.shop, cards } } });
const tile = (label) => screen.getByText(label).closest('a');

describe('HubLanes shop tiles', () => {
  it('shows a line icon on the honey and furniture tiles, with English and Nepali labels', () => {
    renderPage(<HubLanes />);
    [['Honey & beekeeping', 'मह र मौरीपालन', 'lucide-hexagon'], ['Furniture', 'फर्निचर', 'lucide-armchair']].forEach(([en, ne, cls]) => {
      const link = tile(en);
      expect(link.querySelector(`svg.${cls}`)).not.toBeNull();
      expect(link.querySelector('img')).toBeNull();
      expect(link).toHaveTextContent(ne);
    });
  });

  it('prefers the icon over a photo that is saved on the card', () => {
    const site = withCards([{ label: 'Furniture', nepali: 'फर्निचर', icon: 'chair', image: '/api/public/media/abc', href: '/furniture' }]);
    renderPage(<HubLanes />, { site });
    expect(tile('Furniture').querySelector('svg.lucide-armchair')).not.toBeNull();
    expect(tile('Furniture').querySelector('img')).toBeNull();
  });

  it('still picks the icon for older saved cards that have no icon key', () => {
    const site = withCards([
      { label: 'Honey & beekeeping', nepali: 'मह', image: '/api/public/media/1', href: '/beekeeping' },
      { label: 'Furniture', nepali: 'फर्निचर', image: '/api/public/media/2', href: '/furniture' },
    ]);
    renderPage(<HubLanes />, { site });
    expect(tile('Honey & beekeeping').querySelector('svg.lucide-hexagon')).not.toBeNull();
    expect(tile('Furniture').querySelector('svg.lucide-armchair')).not.toBeNull();
  });

  it('leaves the bike and car accessories tiles exactly as before', () => {
    const site = withCards([
      { label: 'Bike accessories', nepali: 'बाइक सामग्री', icon: 'bike', image: '/api/public/media/3', href: '@whatsapp' },
      { label: 'Car accessories', nepali: 'कार सामग्री', image: '', href: '@whatsapp' },
    ]);
    renderPage(<HubLanes />, { site });
    expect(tile('Bike accessories').querySelector('img')).not.toBeNull();
    expect(tile('Bike accessories').querySelector('svg.lucide-bike')).toBeNull();
    expect(tile('Car accessories').querySelector('svg.lucide-shopping-bag')).not.toBeNull();
  });

  it('keeps the photo, or the bag icon, for a card no icon matches', () => {
    const site = withCards([
      { label: 'Gifts', nepali: 'उपहार', image: '/api/public/media/9', href: '/gifts' },
      { label: 'Stationery', nepali: 'स्टेसनरी', image: '', href: '/stationery' },
    ]);
    renderPage(<HubLanes />, { site });
    expect(tile('Gifts').querySelector('img')).not.toBeNull();
    expect(tile('Stationery').querySelector('svg.lucide-shopping-bag')).not.toBeNull();
  });

  it('ignores an unknown icon key and falls back to the link', () => {
    const site = withCards([{ label: 'Furniture', nepali: 'फर्निचर', icon: 'nonsense', image: '', href: '/furniture' }]);
    renderPage(<HubLanes />, { site });
    expect(tile('Furniture').querySelector('svg.lucide-armchair')).not.toBeNull();
  });

  it('gives the icon of every tile, service and shop, the hover-animation class', () => {
    const site = withCards(SITE.hub.shop.cards.map((c) => (c.label === 'Bike accessories' ? { ...c, image: '/api/public/media/3' } : c)));
    renderPage(<HubLanes />, { site });
    const animated = [...document.querySelectorAll('.hub-link-card .hub-icon')];
    expect(animated).toHaveLength(SITE.hub.visit.services.length + SITE.hub.shop.cards.length);
    animated.filter((el) => el.tagName.toLowerCase() === 'svg').forEach((el) => expect(el).toHaveAttribute('aria-hidden', 'true'));
    ['Fuel', 'EV charging', 'Honey & beekeeping', 'Furniture', 'Bike accessories', 'Car accessories'].forEach((label) => {
      expect(tile(label).querySelector('.hub-icon')).not.toBeNull();
    });
  });

  it('turns the icon animation off for visitors who prefer reduced motion', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
    const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(reduced).toMatch(/\.hub-icon\s*\{\s*transition:\s*none/);
    expect(reduced).toMatch(/\.hub-link-card:hover \.hub-icon[^{]*\{\s*transform:\s*none/);
  });
});
