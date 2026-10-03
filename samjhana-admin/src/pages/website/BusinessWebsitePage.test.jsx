import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BusinessWebsitePage from './BusinessWebsitePage';
import WebsiteContentPage from './WebsiteContentPage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../components/ImageUploader', () => ({ default: ({ label }) => <span>{label}</span> }));

const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));
const content = () => ({
  furniture: { barTitle: 'Furniture studio', eyebrow: 'Gulmi', titleLine1: 'Furniture for', titleLine2: 'real homes.', intro: 'i', trustBadges: [], customCardTitle: 'Custom build' },
  beekeeping: { hero: { eyebrow: 'Gulmi', titleLine1: 'Honey and beekeeping', titleLine2: 'from Gulmi.', tagline: 't', copy: 'c', hivesCta: 'Browse hives', kitsCta: 'Kits', learnCta: 'Learn', tiles: [], stats: [] } },
  contact: { phone: '+977 1', whatsapp: '9779800000000', email: '', addressLine: 'Gulmi', latitude: 1, longitude: 1, mapsUrl: 'https://m.example', eyebrow: '', title: '', copy: '', hoursNote: '' },
});

describe('Website page tab inside a business', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    as('ADMIN');
    api.get.mockImplementation(() => Promise.resolve({ data: content() }));
    api.put.mockImplementation((url, body) => Promise.resolve({ data: { value: body } }));
  });

  it('shows only the furniture page text inside Furniture, with the business tabs', async () => {
    renderWithProviders(<BusinessWebsitePage business="furniture" />);
    expect(await screen.findByLabelText('Title, first line')).toHaveValue('Furniture for');
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/furniture/inventory');
    expect(screen.queryByLabelText('Phone number')).toBeNull();           // the shared contact section is not here
    expect(screen.queryByRole('tab')).toBeNull();                         // a single section needs no sub-tabs
  });

  it('saves the section it shows', async () => {
    renderWithProviders(<BusinessWebsitePage business="furniture" />);
    const title = await screen.findByLabelText('Title, first line');
    await userEvent.clear(title);
    await userEvent.type(title, 'Chairs for');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/site-content/furniture', expect.objectContaining({ titleLine1: 'Chairs for' })));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('shows the Maurighar page text inside Beekeeping', async () => {
    renderWithProviders(<BusinessWebsitePage business="beekeeping" />);
    expect(await screen.findByDisplayValue('Honey and beekeeping')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/beekeeping/orders');
  });

  it('tells staff they cannot edit it', async () => {
    as('STAFF');
    renderWithProviders(<BusinessWebsitePage business="furniture" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Only an admin or a manager');
  });

  it('keeps these business pages out of the shared Website screen', async () => {
    renderWithProviders(<WebsiteContentPage />);
    await screen.findByLabelText('Phone number');
    expect(screen.queryByRole('tab', { name: 'Furniture pages' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Beekeeping page' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Shop & order page' })).toBeInTheDocument();
  });
});
