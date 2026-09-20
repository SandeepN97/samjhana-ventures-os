import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EVEntryPage from './EVEntryPage';
import { renderWithProviders } from '../../test/test-utils';

// Everything the page talks to is faked: REST (api), the live WebSocket hook and the router.
const mock = vi.hoisted(() => ({
  chargers: [], vehicles: [], sessions: [], settings: {},
  failChargers: false,
  hold: null, // when set, /api/charge-points answers only once hold.promise resolves
  live: { handler: null, connected: true },
}));

vi.mock('../../hooks/useEvLiveUpdates', () => ({
  default: (onEvent) => { mock.live.handler = onEvent; return mock.live.connected; },
}));

vi.mock('../../utils/api', () => ({
  default: {
    get: vi.fn((url) => {
      if (url === '/api/charge-points') {
        if (mock.failChargers) return Promise.reject(new Error('down'));
        const snapshot = mock.chargers; // what the server said at the moment it was asked
        return mock.hold ? mock.hold.promise.then(() => ({ data: snapshot })) : Promise.resolve({ data: snapshot });
      }
      if (url === '/api/ev-vehicles') return Promise.resolve({ data: mock.vehicles });
      if (url === '/api/ev/sessions/active') return Promise.resolve({ data: mock.sessions });
      if (url === '/api/daily-reports/business-date') {
        return Promise.resolve({ data: { date: '2026-09-19', todayClosed: false } });
      }
      if (url.startsWith('/api/settings/')) {
        return Promise.resolve({ data: { value: mock.settings[url.split('/').pop()] || '' } });
      }
      return Promise.resolve({ data: {} });
    }),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import api from '../../utils/api';

// ---------------------------------------------------------------- fixtures

const CHARGERS = () => [
  { id: 'cp1', code: 'HD-D180-CC-01', model: 'HD-D180-CC', maxPowerKw: 80, displayOrder: 1, connectionStatus: 'ONLINE', connectorStatus: 'Available' },
  { id: 'cp2', code: 'HQC23-80-01', model: 'HQC23-80/1000/260-Y02-CC', maxPowerKw: 80, displayOrder: 2, connectionStatus: 'ONLINE', connectorStatus: 'Occupied' },
  { id: 'cp3', code: 'HD-D140-E-01', model: 'HD-D140-E', maxPowerKw: 40, displayOrder: 3, connectionStatus: 'OFFLINE', connectorStatus: null },
];
const VEHICLES = () => [
  { id: 'v1', vehicleName: 'Higer (100KW)', batteryCapacityKw: 100, seatingCapacity: 16, ratePerPercent: 16 },
  { id: 'v2', vehicleName: 'Foton', batteryCapacityKw: 50.23, seatingCapacity: 16, ratePerPercent: 9 },
];
const session = (overrides = {}) => ({
  id: 's1', status: 'ACTIVE', plateNumber: 'BA1PA4521', chargePointId: 'cp1', chargePointCode: 'HD-D180-CC-01',
  chargerModel: 'HD-D180-CC', targetPercent: 80, startSoc: 30, currentSoc: 45, energyDeliveredKwh: 3.2,
  suggestedAmount: 256, requestedAt: '2026-09-19T10:00:00', startedAt: '2026-09-19T10:00:05', ...overrides,
});

function setRole(role) {
  localStorage.setItem('user', JSON.stringify({ role, username: 'tester' }));
}
async function renderPage(locale = 'en') {
  const view = renderWithProviders(<EVEntryPage />, { locale });
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/ev/sessions/active'));
  return view;
}
const fireLive = (event) => act(() => { mock.live.handler(event); });
const tab = (name) => screen.getByRole('tab', { name: new RegExp(name) });
const chargerCards = () => screen.findAllByRole('radio', { name: /Charger \d/ });
const vehicleField = () => screen.getByRole('button', { name: /^Vehicle \(optional/ });
async function pickVehicle(name) {
  await userEvent.click(vehicleField());
  await userEvent.click(await screen.findByRole('option', { name: new RegExp(name) }));
}

describe('EVEntryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setRole('ADMIN');
    mock.chargers = CHARGERS();
    mock.vehicles = VEHICLES();
    mock.sessions = [];
    mock.settings = { nea_rate: '12.5' };
    mock.failChargers = false;
    mock.hold = null;
    mock.live.connected = true;
    mock.live.handler = null;
  });

  // ------------------------------------------------------------ layout

  describe('layout', () => {
    it('renders the green header with the back arrow, bolt and title', async () => {
      await renderPage();
      const header = screen.getByRole('banner');
      expect(header).toHaveClass('bg-green-500', 'text-white');
      expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent('EV Charging');
      await userEvent.click(within(header).getByRole('button', { name: 'Go Back' }));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('sits on the light gray page background with no dark theme', async () => {
      const { container } = await renderPage();
      expect(container.firstChild).toHaveClass('bg-gray-100');
      expect(container.querySelector('[class*="bg-[#09110e]"]')).toBeNull();
    });

    it.each(['ADMIN', 'MANAGER'])('shows the Vehicles button to %s', async (role) => {
      setRole(role);
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /Vehicles/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/ev-vehicles');
    });

    it('hides the Vehicles button from staff', async () => {
      setRole('STAFF');
      await renderPage();
      expect(screen.queryByRole('button', { name: /Vehicles/ })).toBeNull();
    });

    it('has a language toggle in the header', async () => {
      await renderPage();
      expect(within(screen.getByRole('banner')).getByRole('button', { name: /नेपालीमा/ })).toBeInTheDocument();
    });

    it('shows Start Session, Active and Payment tabs with Start selected first', async () => {
      await renderPage();
      expect(screen.getAllByRole('tab').map((t) => t.textContent.replace(/\d+$/, ''))).toEqual(['Start Session', 'Active', 'Payment']);
      expect(tab('Start Session')).toHaveAttribute('aria-selected', 'true');
      expect(tab('Start Session')).toHaveClass('border-green-600', 'text-green-600');
      expect(tab('Active')).toHaveAttribute('aria-selected', 'false');
    });

    it('lays the start screen out in the specified order', async () => {
      await renderPage();
      await chargerCards();
      const order = [
        screen.getByText(/NEA Rate per Unit/),
        screen.getByText('Select charger'),
        screen.getByLabelText(/^Date/),
        vehicleField(),
        screen.getByText('Vehicle plate'),
        screen.getByText('Charge target'),
        screen.getByRole('button', { name: 'Start Charging →' }),
      ];
      for (let i = 0; i < order.length - 1; i += 1) {
        expect(order[i].compareDocumentPosition(order[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    });

    it('shows the bottom navigation and navigates from it', async () => {
      await renderPage();
      const nav = screen.getByRole('navigation');
      ['Home', 'Records', 'Analytics', 'Settings'].forEach((label) => expect(within(nav).getByText(label)).toBeInTheDocument());
      expect(within(nav).getByRole('button', { name: 'Home' })).toHaveClass('text-blue-600');
      expect(within(nav).getByRole('button', { name: 'Records' })).toHaveClass('text-gray-400');
      await userEvent.click(within(nav).getByRole('button', { name: 'Records' }));
      expect(mockNavigate).toHaveBeenCalledWith('/records');
    });

    it('makes the tabs and the start button comfortable touch targets', async () => {
      await renderPage();
      screen.getAllByRole('tab').forEach((t) => expect(t).toHaveClass('min-h-[44px]'));
      expect(screen.getByRole('button', { name: 'Start Charging →' })).toHaveClass('py-5', 'text-xl', 'bg-green-600');
    });
  });

  // ------------------------------------------------------------ chargers

  describe('charger selection', () => {
    it('shows one card per charger in a three-across grid', async () => {
      await renderPage();
      const cards = await chargerCards();
      expect(cards).toHaveLength(3);
      expect(screen.getByRole('radiogroup', { name: 'Chargers' })).toHaveClass('grid-cols-3');
    });

    it('marks a free charger Ready, an occupied one Charging and an unconnected one Offline', async () => {
      await renderPage();
      await chargerCards();
      expect(screen.getByRole('radio', { name: /HD-D180-CC, 80 kW, Ready/ })).toBeEnabled();
      expect(screen.getByRole('radio', { name: /Charger 2.*Charging/ })).toBeDisabled();
      expect(screen.getByRole('radio', { name: /Charger 3.*Offline/ })).toBeDisabled();
    });

    it('selects a ready charger and lets the user switch to a different ready one', async () => {
      mock.chargers[1].connectorStatus = 'Available';
      await renderPage();
      const [first, second] = await chargerCards();
      await userEvent.click(first);
      expect(first).toHaveAttribute('aria-checked', 'true');
      await userEvent.click(second);
      expect(first).toHaveAttribute('aria-checked', 'false');
      expect(second).toHaveAttribute('aria-checked', 'true');
    });

    it('ignores taps on a busy or offline charger', async () => {
      await renderPage();
      const cards = await chargerCards();
      await userEvent.click(cards[1]);
      await userEvent.click(cards[2]);
      cards.forEach((c) => expect(c).toHaveAttribute('aria-checked', 'false'));
    });

    it('treats a charger with an open session as busy even if it still reports Available', async () => {
      mock.sessions = [session({ chargePointId: 'cp1' })];
      await renderPage();
      const cards = await chargerCards();
      await waitFor(() => expect(cards[0]).toBeDisabled());
    });

    it('updates a card live when the charger goes offline', async () => {
      await renderPage();
      const cards = await chargerCards();
      expect(cards[0]).toBeEnabled();
      fireLive({ type: 'CHARGE_POINT_UPDATED', payload: { ...CHARGERS()[0], connectionStatus: 'OFFLINE' } });
      await waitFor(() => expect(screen.getByRole('radio', { name: /Charger 1.*Offline/ })).toBeDisabled());
    });

    it('warns when no charger is online', async () => {
      mock.chargers = CHARGERS().map((c) => ({ ...c, connectionStatus: 'OFFLINE' }));
      await renderPage();
      expect(await screen.findByText('No charger is online. Check Ethernet and power at the charger.')).toBeInTheDocument();
    });

    it('shows an error when the chargers cannot be loaded', async () => {
      mock.failChargers = true;
      await renderPage();
      expect(await screen.findByText('Failed to load chargers. Please refresh the page.')).toBeInTheDocument();
      expect(screen.queryAllByRole('radio', { name: /Charger \d/ })).toHaveLength(0);
    });

    it('tells the user when no chargers are set up', async () => {
      mock.chargers = [];
      await renderPage();
      expect(await screen.findByText('No chargers are set up yet.')).toBeInTheDocument();
    });
  });

  // ------------------------------------------------------------ fields

  describe('start form fields', () => {
    it('auto-fills today’s business date and keeps it editable', async () => {
      await renderPage();
      const date = screen.getByLabelText(/^Date/);
      await waitFor(() => expect(date).toHaveValue('2026-09-19'));
      await userEvent.clear(date);
      await userEvent.type(date, '2026-09-18');
      expect(date).toHaveValue('2026-09-18');
    });

    it('shows an optional vehicle field that starts empty', async () => {
      await renderPage();
      expect(vehicleField()).toHaveTextContent('Select vehicle...');
      expect(screen.getByText('(optional — for repeat-customer lookup)')).toBeInTheDocument();
    });

    it('lists the real vehicles from the API with their price when the field is opened', async () => {
      await renderPage();
      await userEvent.click(vehicleField());
      const higer = await screen.findByRole('option', { name: /Higer \(100KW\)/ });
      expect(higer).toHaveTextContent('100 kW');
      expect(higer).toHaveTextContent('16 seats');
      expect(higer).toHaveTextContent('Rs 16');
      expect(higer.textContent).not.toContain('/%');
      expect(screen.getByRole('option', { name: /Foton/ })).toHaveTextContent('Rs 9');
      expect(screen.getByRole('option', { name: /No vehicle \(walk-in\)/ })).toBeInTheDocument();
    });

    it('shows the chosen vehicle and its price on the field, and lets staff clear it', async () => {
      await renderPage();
      await pickVehicle('Foton');
      expect(vehicleField()).toHaveTextContent('Foton');
      expect(vehicleField()).toHaveTextContent('Rs 9');
      await userEvent.click(screen.getByRole('button', { name: 'Clear vehicle' }));
      expect(vehicleField()).toHaveTextContent('Select vehicle...');
    });

    it('upper-cases the plate number as the user types', async () => {
      await renderPage();
      const plate = screen.getByLabelText(/^Plate number/);
      await userEvent.type(plate, 'ba 1 pa 4521');
      expect(plate).toHaveValue('BA 1 PA 4521');
      expect(screen.getByText(/the photo alone isn't searchable/)).toBeInTheDocument();
    });

    it('starts with an 80% target', async () => {
      await renderPage();
      expect(screen.getByRole('spinbutton', { name: 'Target battery %' })).toHaveValue(80);
      expect(screen.getByRole('button', { name: '80%' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('confirms a captured plate photo by name', async () => {
      await renderPage();
      const file = new File(['x'], 'plate.png', { type: 'image/png' });
      await userEvent.upload(document.getElementById('ev-plate-photo'), file);
      expect(await screen.findByText('✓ plate.png captured — tap to retake')).toBeInTheDocument();
      expect(document.getElementById('ev-plate-photo')).toHaveAttribute('capture', 'environment');
    });

    it('rejects a photo that is not JPEG, PNG or WebP', async () => {
      await renderPage();
      await userEvent.upload(document.getElementById('ev-plate-photo'),
        new File(['x'], 'plate.gif', { type: 'image/gif' }), { applyAccept: false });
      expect(await screen.findByText('Plate photo must be a JPEG, PNG or WebP image.')).toBeInTheDocument();
      expect(screen.getByText('Tap to photograph plate')).toBeInTheDocument();
    });

    it('rejects a photo larger than 5 MB', async () => {
      await renderPage();
      const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
      Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 });
      await userEvent.upload(document.getElementById('ev-plate-photo'), big);
      expect(await screen.findByText('Plate photo must be 5 MB or smaller.')).toBeInTheDocument();
    });

    it('shows the NEA rate to an admin', async () => {
      await renderPage();
      expect(await screen.findByText('12.50')).toBeInTheDocument();
      expect(screen.getByText(/NEA Rate per Unit/)).toBeInTheDocument();
    });

    it('shows the NEA rate to a manager too', async () => {
      setRole('MANAGER');
      await renderPage();
      expect(await screen.findByText('12.50')).toBeInTheDocument();
    });

    it('has no per-kWh customer rate: customers are charged by car type and percentage', async () => {
      await renderPage();
      await screen.findByText('12.50');
      expect(screen.queryByText(/Rate charged per kWh/)).toBeNull();
      expect(api.get).not.toHaveBeenCalledWith('/api/settings/ev_rate_per_kwh', expect.anything());
    });

    it('links to the NEA bills page for admins only', async () => {
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /NEA bills & reconciliation/ }));
      expect(mockNavigate).toHaveBeenCalledWith('/ev-electricity');
    });

    it('hides the NEA rate, its Update button and the bills link from staff', async () => {
      setRole('STAFF');
      await renderPage();
      await chargerCards();
      expect(screen.queryByText(/NEA Rate per Unit/)).toBeNull();
      expect(screen.queryByText('12.50')).toBeNull();
      expect(screen.queryByRole('button', { name: /Update/ })).toBeNull();
      expect(screen.queryByRole('button', { name: /NEA bills/ })).toBeNull();
    });

    it('never even asks the server for the NEA rate when the user is staff', async () => {
      setRole('STAFF');
      localStorage.setItem('ev_nea_rate', '12.5'); // left behind in this browser by an earlier admin session
      await renderPage();
      await chargerCards();
      expect(api.get).not.toHaveBeenCalledWith('/api/settings/nea_rate', expect.anything());
      expect(screen.queryByText('12.50')).toBeNull();
    });
  });

  // ------------------------------------------------------------ starting

  describe('starting a session', () => {
    async function fillValidForm() {
      const [first] = await chargerCards();
      await userEvent.click(first);
      await userEvent.type(screen.getByLabelText(/^Plate number/), 'ba 1 pa 4521');
    }

    it('asks for a charger first and sends nothing', async () => {
      await renderPage();
      await userEvent.type(screen.getByLabelText(/^Plate number/), 'BA 1');
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      expect(await screen.findByText('Select a charger first')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('asks for the plate number and flags the field', async () => {
      await renderPage();
      const [first] = await chargerCards();
      await userEvent.click(first);
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      expect(await screen.findByText('Enter the plate number')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Plate number/)).toHaveAttribute('aria-invalid', 'true');
      expect(api.post).not.toHaveBeenCalled();
    });

    it('rejects a target of 0%', async () => {
      await renderPage();
      await fillValidForm();
      const target = screen.getByRole('spinbutton', { name: 'Target battery %' });
      await userEvent.clear(target);
      await userEvent.type(target, '0');
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      expect(await screen.findByText('Target must be between 1% and 100%')).toBeInTheDocument();
      expect(api.post).not.toHaveBeenCalled();
    });

    it('sends the start request, confirms with a toast and jumps to the Active tab', async () => {
      api.post.mockResolvedValue({ data: session({ status: 'STARTING', currentSoc: null, startSoc: null }) });
      await renderPage();
      await fillValidForm();
      await pickVehicle('Foton');
      await userEvent.click(screen.getByRole('button', { name: '50%' }));

      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/ev/sessions/start', {
        chargePointId: 'cp1', plateNumber: 'BA 1 PA 4521', vehicleCatalogId: 'v2',
        platePhotoDataUrl: null, targetPercent: 50,
      }));
      expect(await screen.findByText('Session started on Charger 1')).toBeInTheDocument();
      expect(tab('Active')).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByTestId('active-session')).toHaveTextContent('BA1PA4521');
    });

    it('sends no vehicle when none is chosen (the field is optional)', async () => {
      api.post.mockResolvedValue({ data: session({ status: 'STARTING' }) });
      await renderPage();
      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post.mock.calls[0][1].vehicleCatalogId).toBeNull();
    });

    it('sends no vehicle after the choice was cleared again', async () => {
      api.post.mockResolvedValue({ data: session({ status: 'STARTING' }) });
      await renderPage();
      await fillValidForm();
      await pickVehicle('Higer');
      await userEvent.click(screen.getByRole('button', { name: 'Clear vehicle' }));
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post.mock.calls[0][1].vehicleCatalogId).toBeNull();
    });

    it('sends the captured plate photo as a data URL', async () => {
      api.post.mockResolvedValue({ data: session({ status: 'STARTING' }) });
      await renderPage();
      await fillValidForm();
      await userEvent.upload(document.getElementById('ev-plate-photo'), new File(['abc'], 'plate.jpg', { type: 'image/jpeg' }));
      await screen.findByText('✓ plate.jpg captured — tap to retake');
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      await waitFor(() => expect(api.post).toHaveBeenCalled());
      expect(api.post.mock.calls[0][1].platePhotoDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    });

    it('resets the form after a successful start', async () => {
      api.post.mockResolvedValue({ data: session({ status: 'STARTING' }) });
      await renderPage();
      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      await screen.findByTestId('active-session');
      await userEvent.click(tab('Start Session'));
      expect(screen.getByLabelText(/^Plate number/)).toHaveValue('');
      expect(screen.getByRole('spinbutton', { name: 'Target battery %' })).toHaveValue(80);
    });

    it('shows the server’s message and stays on the form when the start is refused', async () => {
      api.post.mockRejectedValue({ response: { data: { message: 'Charger HD-D180-CC-01 is offline' } } });
      await renderPage();
      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      expect(await screen.findByText('Charger HD-D180-CC-01 is offline')).toBeInTheDocument();
      expect(tab('Start Session')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByLabelText(/^Plate number/)).toHaveValue('BA 1 PA 4521');
    });

    it('falls back to a generic message when the server gives none', async () => {
      api.post.mockRejectedValue(new Error('network'));
      await renderPage();
      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      expect(await screen.findByText('Could not start the charging session.')).toBeInTheDocument();
    });

    it('disables the button while the request is in flight so it cannot be sent twice', async () => {
      let release;
      api.post.mockReturnValue(new Promise((resolve) => { release = resolve; }));
      await renderPage();
      await fillValidForm();
      await userEvent.click(screen.getByRole('button', { name: 'Start Charging →' }));
      const sending = await screen.findByRole('button', { name: 'Sending…' });
      expect(sending).toBeDisabled();
      await userEvent.click(sending);
      expect(api.post).toHaveBeenCalledTimes(1);
      await act(async () => { release({ data: session({ status: 'STARTING' }) }); });
    });
  });

  // ------------------------------------------------------------ active + payment

  describe('active sessions and payment', () => {
    it('shows an empty hint on the Active and Payment tabs', async () => {
      await renderPage();
      await userEvent.click(tab('Active'));
      expect(screen.getByText('No active sessions. Start one from the Start Session tab.')).toBeInTheDocument();
      await userEvent.click(tab('Payment'));
      expect(screen.getByText('Nothing awaiting payment. Stop a session from the Active tab first.')).toBeInTheDocument();
    });

    it('lists open sessions with a count badge on the tab', async () => {
      mock.sessions = [session(), session({ id: 's2', plateNumber: 'GA3KHA1187', chargePointId: 'cp2' })];
      await renderPage();
      await waitFor(() => expect(tab('Active')).toHaveTextContent('2'));
      await userEvent.click(tab('Active'));
      expect(screen.getAllByTestId('active-session')).toHaveLength(2);
    });

    it('stops a session and locks it for payment when staff tap Stop', async () => {
      mock.sessions = [session()];
      api.post.mockResolvedValue({ data: session({ status: 'STOP_REQUESTED' }) });
      await renderPage();
      await userEvent.click(tab('Active'));
      await userEvent.click(await screen.findByRole('button', { name: 'Stop & Lock for Payment' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/ev/sessions/s1/stop', undefined));
      expect(await screen.findByText('Stop sent — waiting for the charger')).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Stopping…' })).toBeDisabled();
    });

    it('moves a stopped session to the Payment tab when the charger confirms it has stopped', async () => {
      mock.sessions = [session()];
      await renderPage();
      await userEvent.click(tab('Active'));
      await screen.findByTestId('active-session');

      fireLive({ type: 'CHARGE_SESSION_UPDATED', payload: session({ status: 'AWAITING_PAYMENT', energyDeliveredKwh: 7.5, suggestedAmount: 600 }) });

      expect(await screen.findByText('BA1PA4521 stopped — awaiting payment')).toBeInTheDocument();
      expect(tab('Payment')).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByText('Awaiting payment — connector locked')).toBeInTheDocument();
      expect(screen.getByText('Rs 600')).toBeInTheDocument();
      expect(screen.getByText('Connector stays physically locked until payment is confirmed here.')).toBeInTheDocument();
    });

    it('shows how the amount was worked out: percent charged × the vehicle price per 1%', async () => {
      mock.sessions = [session({ status: 'AWAITING_PAYMENT', ratePerPercent: 14, percentCharged: 18, suggestedAmount: 252 })];
      await renderPage();
      await userEvent.click(tab('Payment'));
      expect(await screen.findByText('18% charged × Rs 14 per 1%')).toBeInTheDocument();
      expect(screen.getByText('Rs 252')).toBeInTheDocument();
    });

    it('asks staff for the amount when the session has no vehicle type', async () => {
      mock.sessions = [session({ status: 'AWAITING_PAYMENT', ratePerPercent: null, percentCharged: 18, suggestedAmount: null })];
      await renderPage();
      await userEvent.click(tab('Payment'));
      expect(await screen.findByText('No vehicle type was chosen for this session, so enter the amount to collect.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm Payment & Unlock' })).toBeDisabled();
    });

    it('does not yank the user away from another tab when a session reaches payment', async () => {
      mock.sessions = [session()];
      await renderPage();
      fireLive({ type: 'CHARGE_SESSION_UPDATED', payload: session({ status: 'AWAITING_PAYMENT' }) });
      await waitFor(() => expect(tab('Payment')).toHaveTextContent('1'));
      expect(tab('Start Session')).toHaveAttribute('aria-selected', 'true');
    });

    it('confirms payment with the chosen method and amount', async () => {
      mock.sessions = [session({ status: 'AWAITING_PAYMENT', suggestedAmount: 600, energyDeliveredKwh: 7.5 })];
      api.post.mockResolvedValue({ data: session({ status: 'UNLOCK_REQUESTED', statusMessage: 'Payment confirmed; unlock command sent' }) });
      await renderPage();
      await userEvent.click(tab('Payment'));
      await userEvent.click(await screen.findByRole('radio', { name: 'eSewa' }));
      await userEvent.click(screen.getByRole('button', { name: 'Confirm Payment & Unlock' }));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/ev/sessions/s1/mark-paid', { method: 'ESEWA', amount: 600 }));
      expect(await screen.findByText('Payment confirmed for BA1PA4521 — unlocking')).toBeInTheDocument();
      expect(await screen.findByText('Payment confirmed; unlock command sent')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Confirm Payment & Unlock' })).toBeNull();
    });

    it('removes the card and confirms when the connector is finally unlocked', async () => {
      mock.sessions = [session({ status: 'UNLOCK_REQUESTED' })];
      await renderPage();
      await userEvent.click(tab('Payment'));
      await screen.findByTestId('payment-progress');

      fireLive({ type: 'CHARGE_SESSION_UPDATED', payload: session({ status: 'CLOSED' }) });

      expect(await screen.findByText('Connector unlocked for BA1PA4521')).toBeInTheDocument();
      expect(screen.getByText('Nothing awaiting payment. Stop a session from the Active tab first.')).toBeInTheDocument();
    });

    it('offers Retry unlock when the charger could not unlock a paid session', async () => {
      mock.sessions = [session({ status: 'PAID', statusMessage: 'Connector unlock failed; retry required' })];
      api.post.mockResolvedValue({ data: session({ status: 'UNLOCK_REQUESTED' }) });
      await renderPage();
      await userEvent.click(tab('Payment'));
      await userEvent.click(await screen.findByRole('button', { name: 'Retry unlock' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/ev/sessions/s1/unlock', undefined));
    });

    it('reports a failed session and removes it from the board', async () => {
      mock.sessions = [session({ status: 'STARTING' })];
      await renderPage();
      await userEvent.click(tab('Active'));
      await screen.findByTestId('active-session');

      fireLive({ type: 'CHARGE_SESSION_UPDATED', payload: session({ status: 'FAILED', statusMessage: 'Charger rejected the start command' }) });

      expect(await screen.findByText('Session failed: Charger rejected the start command')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByTestId('active-session')).toBeNull());
    });

    it('shows the server message when an action is refused', async () => {
      mock.sessions = [session()];
      api.post.mockRejectedValue({ response: { data: { message: 'Session must be ACTIVE but is STARTING' } } });
      await renderPage();
      await userEvent.click(tab('Active'));
      await userEvent.click(await screen.findByRole('button', { name: 'Stop & Lock for Payment' }));
      expect(await screen.findByText('Session must be ACTIVE but is STARTING')).toBeInTheDocument();
    });

    it('applies live progress updates to a running session', async () => {
      mock.sessions = [session({ currentSoc: 45 })];
      await renderPage();
      await userEvent.click(tab('Active'));
      await screen.findByText('45%');
      fireLive({ type: 'CHARGE_SESSION_UPDATED', payload: session({ currentSoc: 62, energyDeliveredKwh: 9.9 }) });
      expect(await screen.findByText('62%')).toBeInTheDocument();
      expect(screen.getByText('9.9')).toBeInTheDocument();
    });

    it('ignores live events it does not understand', async () => {
      mock.sessions = [session()];
      await renderPage();
      fireLive({ type: 'SOMETHING_ELSE', payload: { id: 'x' } });
      fireLive({ type: 'CONNECTED' });
      await userEvent.click(tab('Active'));
      expect(screen.getAllByTestId('active-session')).toHaveLength(1);
    });
  });

  // ------------------------------------------------------------ connection

  describe('live connection', () => {
    it('is quiet while the live socket is connected', async () => {
      await renderPage();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('shows a reconnecting notice when the live socket is down', async () => {
      mock.live.connected = false;
      await renderPage();
      expect(screen.getByRole('status')).toHaveTextContent('Live updates reconnecting…');
    });

    it('re-syncs from the server when the live socket connects, so nothing missed while it was down is lost', async () => {
      mock.live.connected = false;
      const { rerender } = await renderPage();
      const sessionCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/ev/sessions/active').length;
      const before = sessionCalls();
      // While the socket was down, a session started elsewhere and a charger began charging.
      mock.sessions = [session({ id: 'missed', plateNumber: 'GA9KHA0001' })];
      mock.chargers = CHARGERS().map((c) => (c.id === 'cp1' ? { ...c, connectorStatus: 'Occupied' } : c));

      mock.live.connected = true;
      rerender(<EVEntryPage />);

      await waitFor(() => expect(sessionCalls()).toBeGreaterThan(before));
      await waitFor(() => expect(tab('Active')).toHaveTextContent('1'));
      expect(await screen.findByRole('radio', { name: /Charger 1.*Charging/ })).toBeDisabled();
    });

    it('does not re-sync on every render while the socket stays connected', async () => {
      const { rerender } = await renderPage();
      const sessionCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/ev/sessions/active').length;
      await waitFor(() => expect(sessionCalls()).toBeGreaterThanOrEqual(2)); // initial load + first connect
      const settled = sessionCalls();
      rerender(<EVEntryPage />);
      rerender(<EVEntryPage />);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(sessionCalls()).toBe(settled);
    });

    describe('a slow fetch racing a live event', () => {
      const chargeCalls = () => api.get.mock.calls.filter(([url]) => url === '/api/charge-points').length;
      const holdNextFetch = () => {
        let release;
        mock.hold = { promise: new Promise((resolve) => { release = resolve; }) };
        return () => act(async () => { release(); });
      };
      const reconnect = (rerender) => {
        mock.live.connected = false;
        rerender(<EVEntryPage />);
        mock.live.connected = true;
        rerender(<EVEntryPage />);
      };

      it('does not let an older snapshot roll the screen back over a newer live event', async () => {
        const { rerender } = await renderPage();
        await chargerCards();
        const before = chargeCalls();

        // A re-sync starts and the server answers slowly with the OLD state (Charger 1 free)...
        const release = holdNextFetch();
        reconnect(rerender);
        await waitFor(() => expect(chargeCalls()).toBeGreaterThan(before));

        // ...meanwhile a live event says Charger 1 is now in use.
        const busy = { ...CHARGERS()[0], connectorStatus: 'Occupied' };
        fireLive({ type: 'CHARGE_POINT_UPDATED', payload: busy });
        expect(await screen.findByRole('radio', { name: /Charger 1.*Charging/ })).toBeDisabled();

        // The stale answer finally lands. It must not undo the newer state; the page fetches again.
        mock.hold = null;
        mock.chargers = CHARGERS().map((c) => (c.id === 'cp1' ? busy : c));
        const settled = chargeCalls();
        await release();
        await waitFor(() => expect(chargeCalls()).toBeGreaterThan(settled));
        expect(screen.getByRole('radio', { name: /Charger 1.*Charging/ })).toBeDisabled();
      });

      it('still applies a slow fetch normally when nothing newer arrived in the meantime', async () => {
        const { rerender } = await renderPage();
        await chargerCards();
        expect(screen.getByRole('radio', { name: /Charger 3.*Offline/ })).toBeDisabled();
        const before = chargeCalls();

        mock.chargers = CHARGERS().map((c) => (c.id === 'cp3' ? { ...c, connectionStatus: 'ONLINE', connectorStatus: 'Available' } : c));
        const release = holdNextFetch();
        reconnect(rerender);
        await waitFor(() => expect(chargeCalls()).toBeGreaterThan(before));
        await release();

        await waitFor(() => expect(screen.getByRole('radio', { name: /Charger 3.*Ready/ })).toBeEnabled());
      });
    });

    describe('polling fallback', () => {
      beforeEach(() => { vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); });
      afterEach(() => { vi.useRealTimers(); });

      it('re-fetches the sessions every 10 seconds while the socket is down', async () => {
        mock.live.connected = false;
        await renderPage();
        const before = api.get.mock.calls.filter(([url]) => url === '/api/ev/sessions/active').length;
        await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
        const after = api.get.mock.calls.filter(([url]) => url === '/api/ev/sessions/active').length;
        expect(after).toBeGreaterThan(before);
      });

      it('does not poll while the socket is connected', async () => {
        await renderPage();
        const before = api.get.mock.calls.filter(([url]) => url === '/api/ev/sessions/active').length;
        await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
        const after = api.get.mock.calls.filter(([url]) => url === '/api/ev/sessions/active').length;
        expect(after).toBe(before);
      });
    });
  });

  // ------------------------------------------------------------ Nepali

  describe('Nepali', () => {
    it('renders the tabs, charger section and pills in Nepali', async () => {
      await renderPage('ne');
      expect(screen.getByRole('tab', { name: /सेसन सुरु/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /सक्रिय/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /भुक्तानी/ })).toBeInTheDocument();
      expect(screen.getByText('चार्जर छान्नुहोस्')).toBeInTheDocument();
      expect(await screen.findAllByRole('radio', { name: /चार्जर [१२३]/ })).toHaveLength(3);
      expect(screen.getByRole('radio', { name: /चार्जर १.*तयार/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'चार्जिङ सुरु गर्नुहोस् →' })).toBeInTheDocument();
    });

    it('uses Devanagari numerals for the tab count badge', async () => {
      mock.sessions = [session(), session({ id: 's2', chargePointId: 'cp2' })];
      await renderPage('ne');
      await waitFor(() => expect(screen.getByRole('tab', { name: /सक्रिय/ })).toHaveTextContent('२'));
    });

    it('shows the vehicle price with Devanagari numerals', async () => {
      await renderPage('ne');
      await userEvent.click(screen.getByRole('button', { name: /^गाडी \(वैकल्पिक/ }));
      const option = await screen.findByRole('option', { name: /Higer/ });
      expect(option).toHaveTextContent('रु १६');
      expect(option.textContent).not.toContain('/%');
      expect(option).toHaveTextContent('१०० kW');
    });

    it('switches the currency symbol with the language toggle, in both directions', async () => {
      mock.sessions = [session({ status: 'AWAITING_PAYMENT', suggestedAmount: 600, energyDeliveredKwh: 7.5 })];
      await renderPage();
      await userEvent.click(tab('Payment'));
      expect(await screen.findByText('Rs 600')).toBeInTheDocument();

      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: /नेपालीमा/ }));
      expect(await screen.findByText('रु ६००')).toBeInTheDocument();
      expect(screen.queryByText('Rs 600')).toBeNull();

      await userEvent.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Switch to English' }));
      expect(await screen.findByText('Rs 600')).toBeInTheDocument();
      expect(screen.queryByText('रु ६००')).toBeNull();
    });

    it('shows Nepali validation messages', async () => {
      await renderPage('ne');
      await userEvent.click(screen.getByRole('button', { name: 'चार्जिङ सुरु गर्नुहोस् →' }));
      expect(await screen.findByText('पहिले चार्जर छान्नुहोस्')).toBeInTheDocument();
    });
  });
});
