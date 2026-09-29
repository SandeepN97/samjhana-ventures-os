import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const api = vi.hoisted(() => ({
  getItems: vi.fn(), getItem: vi.fn(), getVehicles: vi.fn(), getCurrent: vi.fn(),
}));
vi.mock('../api/api.js', () => ({
  furnitureApi: { getItems: api.getItems, getItem: api.getItem },
  evApi: { getVehicles: api.getVehicles },
  fuelApi: { getCurrent: api.getCurrent },
}));

import { MainPage } from '../App';

const renderHome = () => render(<BrowserRouter><MainPage /></BrowserRouter>);

describe('Home page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('still renders every section when the API gives back the wrong thing', async () => {
    // What staging did: the static host answered API calls with its own HTML page.
    api.getItems.mockRejectedValue(new Error('Unexpected response from the server'));
    api.getVehicles.mockRejectedValue(new Error('Unexpected response from the server'));
    api.getCurrent.mockRejectedValue(new Error('Unexpected response from the server'));

    renderHome();

    await waitFor(() => expect(api.getVehicles).toHaveBeenCalled());
    expect(screen.getAllByText('Petrol').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('footer')).toBeInTheDocument();
  });

  it('shows real prices and EV rates when the API answers properly', async () => {
    api.getItems.mockResolvedValue([]);
    api.getCurrent.mockResolvedValue({ petrol: { pricePerLiter: 170 }, diesel: { pricePerLiter: 160 } });
    api.getVehicles.mockResolvedValue([
      { id: 'v1', vehicleName: 'Foton View', ratePerPercent: 14, batteryCapacityKw: 50, seatingCapacity: 14 },
    ]);

    renderHome();

    expect(await screen.findByText('Rs 170.0/L')).toBeInTheDocument();
    expect(screen.getByText('Rs 160.0/L')).toBeInTheDocument();
  });
});
