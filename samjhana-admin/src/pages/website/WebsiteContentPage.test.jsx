import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WebsiteContentPage, { normalize } from './WebsiteContentPage';
import { TABS } from './websiteSchema';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../components/ImageUploader', () => ({
  default: ({ id, label, value, onChange }) => (
    <div data-testid={`uploader-${id}`}>
      <span>{label}: {value.join(',') || 'none'}</span>
      <button type="button" onClick={() => onChange(['new-pic'])}>pick for {id}</button>
    </div>
  ),
}));

const content = () => ({
  identity: { name: 'Samjhana Ventures', tagline: 'Gulmi', established: 2008, footerBlurb: 'b', footerNote: 'n', copyrightName: 'c' },
  contact: { phone: '+977 1', whatsapp: '9779800000000', email: '', addressLine: 'Gulmi', latitude: 27.99, longitude: 83.36, mapsUrl: 'https://maps.example', eyebrow: 'e', title: 't', copy: 'c', hoursNote: 'h' },
  hours: { fuelEv: '6am – 9pm', fuelEvSub: 'Every day', restaurantDaily: '6am–9pm', bikeRepair: '', shop: '' },
  hub: { visit: { eyebrow: '', title: 'Come for the journey.', nepali: '', copy: '', note: '', image: 'img-v', cta: '', ctaHref: '#fuel-ev',
    services: [{ label: 'Fuel', nepali: 'पेट्रोल', icon: 'fuel', href: '#fuel-ev' }, { label: 'Bike repair', nepali: '', icon: 'wrench', href: '#bike-repair' }] },
    shop: { eyebrow: '', title: '', nepali: '', copy: '', note: '', image: '', cta: '', ctaHref: '/shop', cards: [] } },
  trust: { items: [{ value: '16+', label: 'years' }] },
  featured: { eyebrow: '', title: '', linkLabel: '', tiles: [] },
  fuelEv: { eyebrow: '', title: 'Petrol Pump & EV', evEyebrow: '', evTitle: '', evCta: '', priceNote: '' },
  bike: { eyebrow: '', titleLine1: '', titleLine2: '', copy: '', pills: ['All bikes'], cta: '', hint: '', image: '', services: [] },
  restaurant: { eyebrow: '', kicker: '', titleLine1: '', titleLine2: '', intro: '', stats: [], ambience: [], captionNote: '', mainsNote: '', drinksNote: '', hoursTitle: '', hoursFooter: '', kitchenTitle: '', kitchenQuote: '', kitchenQuoteEnglish: '', locationLine: '', walkInNote: '',
    meals: [{ id: 'breakfast', label: 'Breakfast', nepali: 'बिहान', story: 's', hours: '6 – 10', image: 'img-b' }] },
  shop: { heading: 'Shop', intro: '', deliveryFee: 150, freeDeliveryOver: 5000, deliveryNote: '', pickupNote: '', paymentNote: '', customOrderTitle: '', customOrderText: '', customOrderCta: '' },
});
const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));

function mockApi() {
  api.get.mockImplementation((url) => Promise.resolve({ data: url.includes('summary') ? { NEW: 2 } : content() }));
}

describe('normalize', () => {
  it('turns number fields into numbers, empty ones into null, and trims text lists', () => {
    const fields = [{ name: 'fee', type: 'number' }, { name: 'late', type: 'number' }, { name: 'tags', type: 'strings' },
      { name: 'rows', type: 'list', fields: [{ name: 'x', type: 'number' }] }, { name: 'box', type: 'group', fields: [{ name: 'y', type: 'number' }] }];
    expect(normalize({ fee: '150', late: '', tags: [' a ', '', 'b'], rows: [{ x: '5' }], box: { y: '2.5' } }, fields))
      .toEqual({ fee: 150, late: null, tags: ['a', 'b'], rows: [{ x: 5 }], box: { y: 2.5 } });
  });
});

describe('WebsiteContentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    as('ADMIN');
    mockApi();
  });

  it('covers every section the server keeps, so nothing on the public site is uneditable', () => {
    const keys = TABS.flatMap((x) => x.sections.map((s) => s.key)).sort();
    expect(keys).toEqual(['beekeeping', 'bike', 'contact', 'featured', 'fuelEv', 'furniture', 'hours', 'hub', 'identity', 'restaurant', 'shop', 'shopHub', 'trust']);
  });

  it('shows the contact and hours fields filled in, and the shortcuts with the new-order count', async () => {
    renderWithProviders(<WebsiteContentPage />);
    expect(await screen.findByLabelText('Phone number')).toHaveValue('+977 1');
    expect(screen.getByLabelText('Fuel & EV hours (e.g. 6am – 9pm)')).toHaveValue('6am – 9pm');
    expect(screen.getByRole('link', { name: /Online orders/ })).toHaveTextContent('2 new');
    expect(screen.getByRole('link', { name: /Restaurant menu/ })).toHaveAttribute('href', '/restaurant-menu');
  });

  it('saves one section with the edited value and shows it saved', async () => {
    api.put.mockImplementation((url, body) => Promise.resolve({ data: { value: body } }));
    renderWithProviders(<WebsiteContentPage />);
    const phone = await screen.findByLabelText('Phone number');
    await userEvent.clear(phone);
    await userEvent.type(phone, '+977 9800000000');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    const section = screen.getByRole('region', { name: 'Contact details' });
    await userEvent.click(within(section).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/site-content/contact', expect.objectContaining({ phone: '+977 9800000000', latitude: 27.99 })));
    expect(await within(section).findByRole('status')).toHaveTextContent('Saved');
    expect(api.put).toHaveBeenCalledTimes(1);   // only that section
  });

  it('sends number fields as numbers', async () => {
    api.put.mockImplementation((url, body) => Promise.resolve({ data: { value: body } }));
    renderWithProviders(<WebsiteContentPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Shop & delivery' }));
    const fee = await screen.findByLabelText('Delivery fee (Rs)');
    await userEvent.clear(fee);
    await userEvent.type(fee, '200');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/site-content/shop', expect.objectContaining({ deliveryFee: 200, freeDeliveryOver: 5000 })));
  });

  it('shows the server message when a section is refused', async () => {
    api.put.mockRejectedValue({ response: { data: { message: "'mapsUrl' is not a safe link" } } });
    renderWithProviders(<WebsiteContentPage />);
    await userEvent.type(await screen.findByLabelText('Phone number'), '1');
    await userEvent.click(within(screen.getByRole('region', { name: 'Contact details' })).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("'mapsUrl' is not a safe link");
  });

  it('edits a picture field through the uploader', async () => {
    api.put.mockImplementation((url, body) => Promise.resolve({ data: { value: body } }));
    renderWithProviders(<WebsiteContentPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Home page' }));
    expect(await screen.findByText('Picture: img-v')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'pick for hub-visit-image' }));
    await userEvent.click(within(screen.getByRole('region', { name: 'Two big panels at the top' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/site-content/hub', expect.objectContaining({
      visit: expect.objectContaining({ image: 'new-pic' }),
    })));
  });

  it('adds, moves and removes list items', async () => {
    api.put.mockImplementation((url, body) => Promise.resolve({ data: { value: body } }));
    renderWithProviders(<WebsiteContentPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Home page' }));
    expect(await screen.findAllByTestId('list-item')).toHaveLength(3);          // 2 services + 1 number
    await userEvent.click(screen.getByRole('button', { name: 'Move Fuel down' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove Bike repair' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[0]);
    await userEvent.click(within(screen.getByRole('region', { name: 'Two big panels at the top' })).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.put).toHaveBeenCalled());
    const services = api.put.mock.calls[0][1].visit.services;
    expect(services.map((s) => s.label)).toEqual(['Fuel', '']);                  // Bike repair gone, a blank one added
  });

  it('lets text lists grow and shrink', async () => {
    api.put.mockImplementation((url, body) => Promise.resolve({ data: { value: body } }));
    renderWithProviders(<WebsiteContentPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Fuel, EV & bike repair' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add text' }));
    await userEvent.type(screen.getByLabelText('Bike types shown as tags 2'), 'Scooters');
    await userEvent.click(within(screen.getByRole('region', { name: 'Bike repair section' })).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/site-content/bike', expect.objectContaining({ pills: ['All bikes', 'Scooters'] })));
  });

  it('keeps the three meals fixed: no add, remove or reorder', async () => {
    renderWithProviders(<WebsiteContentPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Restaurant' }));
    const meals = await screen.findByRole('group', { name: 'Meals (breakfast, lunch, dinner)' });
    expect(within(meals).queryByRole('button', { name: /Remove|Move|Add$/ })).not.toBeInTheDocument();
    expect(within(meals).getByText('Picture for this meal: img-b')).toBeInTheDocument();
  });

  it('keeps staff out, with a message', () => {
    as('STAFF');
    renderWithProviders(<WebsiteContentPage />);
    expect(screen.getByRole('alert')).toHaveTextContent('Only an admin or a manager can change the website.');
    expect(api.get).not.toHaveBeenCalled();
  });

  it('shows an error with a retry when the content cannot load', async () => {
    api.get.mockRejectedValueOnce(new Error('down'));
    renderWithProviders(<WebsiteContentPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the website content');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Phone number')).toBeInTheDocument();
  });

  it('shows Nepali labels', async () => {
    renderWithProviders(<WebsiteContentPage />, { locale: 'ne' });
    expect(await screen.findByLabelText('फोन नम्बर')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'संपर्क र समय' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /रेस्टुरेन्ट मेनु/ })).toBeInTheDocument();
  });
});
