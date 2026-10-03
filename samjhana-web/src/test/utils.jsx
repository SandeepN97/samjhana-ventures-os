import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SiteProvider } from '../site/SiteContext';

/** The website's content as the backend sends it, small enough for tests but with every section present. */
export const SITE = {
  identity: { name: 'Samjhana Ventures', tagline: 'Gulmi, Nepal · Est. 2008', established: 2008, footerBlurb: 'Where craft meets community.', footerNote: 'Proudly from Gulmi', copyrightName: 'Maurighar Ventures' },
  contact: { phone: '+977 9363147818', whatsapp: '9779363147818', email: '', addressLine: 'Gulmi, Nepal', latitude: 27.9922809, longitude: 83.3629821, mapsUrl: 'https://maps.example/x', eyebrow: 'Plan your stop', title: 'Make the stop easy.', copy: 'Call first.', hoursNote: 'Hours confirmed by phone' },
  hours: { fuelEv: '6am – 9pm', fuelEvSub: 'Every day', restaurantDaily: '6am–9pm', bikeRepair: '', shop: '' },
  hub: {
    visit: { eyebrow: 'Visit & services', title: 'Come for the journey.', nepali: 'यात्राका लागि आउनुहोस्।', copy: 'A stop here is part of the journey.', note: 'Gulmi note', image: 'img-visit', cta: 'See visit options', ctaHref: '#fuel-ev',
      services: [{ label: 'Fuel', nepali: 'पेट्रोल', icon: 'fuel', href: '#fuel-ev' }, { label: 'Restaurant', nepali: 'रेस्टुरेन्ट', icon: 'utensils', href: '#restaurant' }] },
    shop: { eyebrow: 'Shop & order', title: 'Take a little home.', nepali: 'घरमा', copy: 'Honey and furniture.', note: 'Browse', image: 'img-shop', cta: 'Browse shop & order', ctaHref: '/shop',
      cards: [{ label: 'Honey & beekeeping', nepali: 'मह', image: 'img-honey', href: '/shop?type=BEEKEEPING' }, { label: 'Bike accessories', nepali: 'बाइक', image: '', href: '@whatsapp' }] },
  },
  trust: { items: [{ value: '16+', label: 'years in Gulmi' }, { value: '2008', label: 'established' }] },
  featured: { eyebrow: 'From our shop', title: 'Made here. Ready for the road.', linkLabel: 'Ask on WhatsApp',
    tiles: [{ title: 'Honey, bottled with care', nepali: 'मह', image: 'img-tile', storyTitle: 'A little of the hillside.', storyBody: 'Local hives.', action: 'Explore Maurighar', href: '/shop?type=BEEKEEPING' }] },
  fuelEv: { eyebrow: 'Section 02', title: 'Petrol Pump & EV', evEyebrow: 'EV Charging Station', evTitle: 'Fast Charging', evCta: 'Call to check availability', priceNote: 'Source: NOC' },
  bike: { eyebrow: 'Section 03', titleLine1: 'Back on the', titleLine2: 'road again.', copy: 'Tap a part of the bike.', pills: ['All bikes', 'Scooters'], cta: 'Call about your bike', hint: 'Hover a part · tap on mobile', image: 'img-bike',
    services: [{ name: 'Tyre Change', time: '30 min', story: 'A quick change.', icon: 'disc', accent: '#d6b35c', x: 14, y: 74 }] },
  restaurant: { eyebrow: 'Section 04', kicker: 'Maurighar Restaurant', titleLine1: 'Taste of', titleLine2: 'the hills.', intro: 'Home-cooked Nepali food.', stats: [{ value: '10+', label: 'Years' }], ambience: ['Mountain view'], captionNote: 'Served warm in Gulmi',
    mainsNote: 'Served with rice or dhido', drinksNote: 'Hot & cold beverages', hoursTitle: 'Opening hours', hoursFooter: 'Walk-ins welcome', kitchenTitle: 'Our kitchen', kitchenQuote: 'गुल्मीको माटोको स्वाद।', kitchenQuoteEnglish: "The taste of Gulmi's soil.", locationLine: 'Gulmi, Baglung Highway', walkInNote: 'Walk-in only',
    meals: [{ id: 'breakfast', label: 'Breakfast', nepali: 'बिहान', story: 'Start early.', hours: '6:00 – 10:00 am', image: 'img-b' }, { id: 'lunch', label: 'Lunch', nepali: 'दिउँसो', story: 'Settle in.', hours: '11:00 am – 3:00 pm', image: 'img-l' }, { id: 'dinner', label: 'Dinner', nepali: 'बेलुका', story: 'End the day.', hours: '5:00 – 9:00 pm', image: '' }] },
  shop: { heading: 'Shop', intro: 'Honey and furniture from Gulmi.', deliveryFee: 150, freeDeliveryOver: 5000, deliveryNote: 'We deliver in Gulmi.', pickupNote: 'Collect from the shop.', paymentNote: 'Pay in cash on delivery, or at the shop.', customOrderTitle: 'Custom furniture', customOrderText: 'We build to your specifications.', customOrderCta: 'Ask for a quote' },
};

export function renderPage(ui, { route = '/', site = SITE } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SiteProvider initial={site}>{ui}</SiteProvider>
    </MemoryRouter>,
  );
}

export const product = (over = {}) => ({
  id: 'wild-honey', type: 'BEEKEEPING', typeLabel: 'Honey & beekeeping', category: 'HONEY', categoryLabel: 'Honey & wax', categoryLabelNepali: 'मह',
  name: 'Wild Honey', nameNepali: 'जंगली मह', description: 'Raw and unfiltered.', price: 850, badge: null,
  images: ['/api/public/media/p1', '/api/public/media/p2'], image: '/api/public/media/p1', stockStatus: 'IN_STOCK', details: { unit: 'per 500g jar' }, ...over,
});
