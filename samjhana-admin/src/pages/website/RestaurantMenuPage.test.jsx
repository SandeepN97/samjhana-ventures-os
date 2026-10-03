import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RestaurantMenuPage from './RestaurantMenuPage';
import { renderWithProviders } from '../../test/test-utils';
import api from '../../utils/api';

vi.mock('../../utils/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/ImageUploader', () => ({
  default: ({ value, onChange }) => <button type="button" onClick={() => onChange(['pic-1'])}>fake uploader {value.length}</button>,
}));

const dal = { id: 'd1', name: 'Dal Bhat Set', nameNepali: 'दाल भात', veg: true, course: 'MAIN', mealPeriods: ['LUNCH', 'DINNER'],
  price: 350, available: true, showOnWebsite: true, imageId: null };
const momo = { id: 'd2', name: 'Buff Momo', veg: false, course: 'SNACK', mealPeriods: ['LUNCH'], price: null, available: false, showOnWebsite: false };
const as = (role) => localStorage.setItem('user', JSON.stringify({ role, username: role.toLowerCase() }));

describe('RestaurantMenuPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    api.get.mockResolvedValue({ data: [dal, momo] });
  });

  it('lists dishes with their meals and price, and marks hidden and sold-out ones', async () => {
    as('STAFF');
    renderWithProviders(<RestaurantMenuPage />);
    expect(await screen.findByText('Dal Bhat Set')).toBeInTheDocument();
    expect(screen.getByText(/Lunch · Dinner · Rs 350/)).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Sold out today')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Non-vegetarian' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Dish' })).not.toBeInTheDocument();
  });

  it('filters by course', async () => {
    as('STAFF');
    renderWithProviders(<RestaurantMenuPage />);
    await screen.findByText('Dal Bhat Set');
    await userEvent.click(screen.getByRole('button', { name: 'Snacks' }));
    expect(screen.queryByText('Dal Bhat Set')).not.toBeInTheDocument();
    expect(screen.getByText('Buff Momo')).toBeInTheDocument();
  });

  it('lets a manager switch a dish off for today but not edit it', async () => {
    as('MANAGER');
    api.patch.mockResolvedValue({ data: {} });
    renderWithProviders(<RestaurantMenuPage />);
    await userEvent.click(await screen.findByLabelText('Dal Bhat Set available today'));
    expect(api.patch).toHaveBeenCalledWith('/api/restaurant/dishes/d1/available', { available: false });
    expect(screen.queryByRole('button', { name: 'Edit Dish' })).not.toBeInTheDocument();
  });

  it('shows the server message when switching availability fails', async () => {
    as('MANAGER');
    api.patch.mockRejectedValue({ response: { data: { message: 'Dish not found' } } });
    renderWithProviders(<RestaurantMenuPage />);
    await userEvent.click(await screen.findByLabelText('Dal Bhat Set available today'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dish not found');
  });

  it('lets an admin add a dish, checking the name and a meal first', async () => {
    as('ADMIN');
    api.post.mockResolvedValue({ data: {} });
    renderWithProviders(<RestaurantMenuPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add Dish' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Dish' }).at(-1));
    expect(await screen.findByText('Dish name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Dish name/), 'Thukpa');
    await userEvent.click(screen.getByLabelText('Lunch'));
    await userEvent.click(screen.getByLabelText('Dinner'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Dish' }).at(-1));
    expect(await screen.findByText('Choose at least one meal')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    await userEvent.click(screen.getByLabelText('Breakfast', { selector: 'input' }));
    await userEvent.type(screen.getByLabelText('Price (optional)'), '250');
    await userEvent.click(screen.getByRole('button', { name: /fake uploader/ }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Dish' }).at(-1));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post.mock.calls[0][0]).toBe('/api/restaurant/dishes');
    expect(api.post.mock.calls[0][1]).toMatchObject({
      name: 'Thukpa', price: 250, veg: true, course: 'MAIN', mealPeriods: ['BREAKFAST'], imageId: 'pic-1', showOnWebsite: true, available: true,
    });
    expect(await screen.findByText('Dish added!')).toBeInTheDocument();
  });

  it('shows the server message when saving fails', async () => {
    as('ADMIN');
    api.post.mockRejectedValue({ response: { data: { message: 'Price cannot be negative' } } });
    renderWithProviders(<RestaurantMenuPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add Dish' }));
    await userEvent.type(screen.getByLabelText(/Dish name/), 'X');
    await userEvent.click(screen.getAllByRole('button', { name: 'Add Dish' }).at(-1));
    expect(await screen.findByText('Price cannot be negative')).toBeInTheDocument();
  });

  it('edits a dish with its current values filled in', async () => {
    as('ADMIN');
    api.put.mockResolvedValue({ data: {} });
    renderWithProviders(<RestaurantMenuPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Edit Dish' }))[0]);
    expect(screen.getByLabelText(/Dish name/)).toHaveValue('Dal Bhat Set');
    expect(screen.getByLabelText('Price (optional)')).toHaveValue(350);
    await userEvent.click(screen.getByRole('button', { name: 'Update Dish' }));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/restaurant/dishes/d1', expect.objectContaining({ name: 'Dal Bhat Set', price: 350 })));
  });

  it('asks before removing a dish', async () => {
    as('ADMIN');
    api.delete.mockResolvedValue({ data: {} });
    renderWithProviders(<RestaurantMenuPage />);
    await userEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Remove Dal Bhat Set from the menu?');
    await userEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(api.delete).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(api.delete).toHaveBeenCalledWith('/api/restaurant/dishes/d1');
  });

  it('shows an error with retry, an empty state, and Nepali labels', async () => {
    as('STAFF');
    api.get.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ data: [] });
    renderWithProviders(<RestaurantMenuPage />, { locale: 'ne' });
    expect(await screen.findByRole('alert')).toHaveTextContent('मेनु लोड गर्न सकिएन');
    await userEvent.click(screen.getByRole('button', { name: 'फेरि प्रयास गर्नुहोस्' }));
    expect(await screen.findByText('यहाँ अहिलेसम्म कुनै परिकार छैन')).toBeInTheDocument();
    expect(screen.getByText('रेस्टुरेन्ट मेनु')).toBeInTheDocument();
  });
});
