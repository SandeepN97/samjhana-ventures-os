/* eslint-env node */
import { test, expect } from '@playwright/test';
import { SimulatedCharger } from './helpers/simulatedCharger.js';

// Charger 1 (see ChargePointSeeder). Its dev secret comes from application.yml unless overridden.
const CHARGER_CODE = 'HD-D180-CC-01';
const CHARGER_SECRET = process.env.OCPP_SECRET_HD_D180_CC_01 || 'dev-HD-D180-CC-01-change-me';
const BACKEND_WS = 'ws://localhost:8181';
const NEA_RATE = '12.5'; // what the station pays NEA per unit — set by the admin in the first test
// Seeded vehicle prices (rupees per 1% of battery charged): customers pay by car type × percentage.
const DFAC = { name: 'DFAC EV 32', rate: 14 };
const FOTON = { name: 'Foton', rate: 9 };
const START_SOC = 32; // SimulatedCharger's default starting battery

// Test users created by the backend's dev-profile DataSeeder (disposable in-memory database).
const ADMIN = { username: 'admin', password: 'admin' };
const STAFF = { username: 'staff', password: 'staff123' };

const charger = new SimulatedCharger({ code: CHARGER_CODE, secret: CHARGER_SECRET, baseUrl: BACKEND_WS });

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await charger.connect();
});

test.afterAll(() => {
  charger.disconnect();
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const watch = diagnostics.get(page);
  if (watch) await testInfo.attach('page-diagnostics', { body: watch.log.join('\n'), contentType: 'text/plain' });
  await testInfo.attach('simulator-calls', {
    body: charger.calls.map((c) => c.action).join(', ') + `\nconnected=${charger.connected}`, contentType: 'text/plain',
  });
});

test.beforeEach(async () => {
  charger.resetBehaviour();
  if (!charger.connected) await charger.connect();
});

// ---------------------------------------------------------------------------- helpers

/** Records the page's WebSocket lifecycle + console errors so a failure explains itself. */
function watchPage(page) {
  const log = [];
  const t0 = Date.now();
  const stamp = (text) => log.push(`+${String(Date.now() - t0).padStart(5)}ms ${text}`);
  page.on('websocket', (ws) => {
    stamp(`ws open   ${ws.url().replace(/token=[^&]+/, 'token=…')}`);
    ws.on('framereceived', (frame) => stamp(`ws frame  ${String(frame.payload).slice(0, 140)}`));
    ws.on('socketerror', (error) => stamp(`ws error  ${error}`));
    ws.on('close', () => stamp('ws close'));
  });
  page.on('console', (message) => { if (message.type() === 'error') stamp(`console.error ${message.text().slice(0, 140)}`); });
  page.on('pageerror', (error) => stamp(`pageerror ${error.message.slice(0, 140)}`));
  page.on('response', (response) => {
    if (/\/api\/(charge-points|ev\/sessions)/.test(response.url())) stamp(`http ${response.status()} ${response.url().split('5183')[1]}`);
  });
  return { log, stamp };
}

async function login(page, { username, password }) {
  // The app defaults to Nepali; these tests assert English labels (Nepali has its own test).
  await page.addInitScript(() => localStorage.setItem('preferredLanguage', 'en'));
  await page.goto('/login');
  await page.getByPlaceholder('Enter username').fill(username);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/$/);
}

const diagnostics = new WeakMap();

async function openEvPage(page, user = ADMIN) {
  diagnostics.set(page, watchPage(page));
  await login(page, user);
  await page.goto('/entry/ev');
  await expect(page.getByRole('tab', { name: /Start Session/ })).toHaveAttribute('aria-selected', 'true');
}

const chargerCard = (page, state = '.*') => page.getByRole('radio', { name: new RegExp(`Charger 1.*${state}`) });
const tab = (page, name) => page.getByRole('tab', { name: new RegExp(name) });

async function pickVehicle(page, name) {
  await page.getByRole('button', { name: /^Vehicle \(optional/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Choose vehicle' });
  await sheet.getByRole('searchbox').fill(name);
  await sheet.getByRole('option', { name: new RegExp(name.replace(/[()]/g, '\\$&')) }).click();
  await expect(sheet).toBeHidden();
}

async function startSession(page, plate) {
  await expect(chargerCard(page, 'Ready')).toBeEnabled();
  await chargerCard(page, 'Ready').click();
  await page.getByLabel(/^Plate number/).fill(plate);
  await page.getByRole('button', { name: 'Start Charging →' }).click();
  await expect(tab(page, 'Active')).toHaveAttribute('aria-selected', 'true');
}

/** Drive a started session up to the Payment screen (charging → stop → charger confirms stop). */
async function chargeAndStop(page, plate, { soc = 40, deltaWh = 6000, vehicle = DFAC } = {}) {
  if (vehicle) await pickVehicle(page, vehicle.name);
  await startSession(page, plate);
  await charger.waitForCall('RequestStartTransaction');
  await expect(page.getByRole('button', { name: 'Stop & Lock for Payment' })).toBeVisible();
  await charger.sendMeter({ soc, deltaWh });
  await expect(page.getByTestId('active-session')).toContainText(`${soc}%`);
  await page.getByRole('button', { name: 'Stop & Lock for Payment' }).click();
  await expect(page.getByText(`${plate} stopped — awaiting payment`)).toBeVisible();
  await expect(tab(page, 'Payment')).toHaveAttribute('aria-selected', 'true');
}

// ---------------------------------------------------------------------------- the main flow

test('runs a whole session: start → live progress → stop → payment → unlock', async ({ page }, testInfo) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const plate = 'BA1PA4521';
  const percentCharged = 40 - START_SOC; // 8%
  const amount = percentCharged * DFAC.rate; // 8% × Rs 14 = Rs 112

  await openEvPage(page);

  // The admin sees (and can set) what the station pays NEA.
  await page.getByRole('button', { name: /Update/ }).click();
  await page.getByRole('spinbutton', { name: /NEA Rate per Unit/ }).fill(NEA_RATE);
  await page.getByRole('button', { name: 'Save rate' }).click();
  await expect(page.getByText('Rate updated')).toBeVisible();
  await expect(page.getByText('12.50')).toBeVisible();
  await testInfo.attach('start-screen', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

  // Customers are charged by car type and percentage: pick the vehicle, then start.
  await pickVehicle(page, DFAC.name);
  await startSession(page, plate);
  const startCall = await charger.waitForCall('RequestStartTransaction');
  expect(startCall.payload.idToken.idToken).toBe(plate);

  // Charger reports "Started" → the card gains a Stop button, then live meter values arrive.
  await expect(page.getByRole('button', { name: 'Stop & Lock for Payment' })).toBeVisible();
  await charger.sendMeter({ soc: 40, deltaWh: 6000 });
  const card = page.getByTestId('active-session');
  await expect(card).toContainText('40%');
  await expect(card).toContainText(`Rs ${amount}`);
  await expect(card).toContainText('Target 80%');
  await expect(card).toContainText(DFAC.name);
  await testInfo.attach('active-screen', { body: await page.screenshot(), contentType: 'image/png' });

  // Stop: the charger stops power, and the connector must stay LOCKED until payment.
  await page.getByRole('button', { name: 'Stop & Lock for Payment' }).click();
  await charger.waitForCall('RequestStopTransaction');
  await expect(page.getByText(`${plate} stopped — awaiting payment`)).toBeVisible();
  await expect(tab(page, 'Payment')).toHaveAttribute('aria-selected', 'true');

  const due = page.getByTestId('payment-due');
  await expect(due).toContainText('Awaiting payment — connector locked');
  await expect(due).toContainText(`${percentCharged}% charged × Rs ${DFAC.rate} per 1%`);
  await expect(due).toContainText(`Rs ${amount}`);
  await expect(due).toContainText('Connector stays physically locked until payment is confirmed here.');
  expect(charger.callsOf('UnlockConnector')).toHaveLength(0);
  await testInfo.attach('payment-screen', { body: await page.screenshot(), contentType: 'image/png' });

  // Payment is the only thing that releases the connector.
  await due.getByRole('radio', { name: 'Cash' }).click();
  await due.getByRole('button', { name: 'Confirm Payment & Unlock' }).click();
  await charger.waitForCall('UnlockConnector');
  await expect(page.getByText(`Connector unlocked for ${plate}`)).toBeVisible();
  await expect(page.getByText('Nothing awaiting payment. Stop a session from the Active tab first.')).toBeVisible();

  // The charger is free again.
  await tab(page, 'Start Session').click();
  await expect(chargerCard(page, 'Ready')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

// ---------------------------------------------------------------------------- failure paths

test('asks for the missing charger and plate instead of sending an incomplete form', async ({ page }) => {
  await openEvPage(page);
  const startsBefore = charger.callsOf('RequestStartTransaction').length;

  await page.getByRole('button', { name: 'Start Charging →' }).click();
  await expect(page.getByText('Select a charger first')).toBeVisible();

  await chargerCard(page, 'Ready').click();
  await page.getByRole('button', { name: 'Start Charging →' }).click();
  await expect(page.getByText('Enter the plate number')).toBeVisible();
  await expect(page.getByLabel(/^Plate number/)).toHaveAttribute('aria-invalid', 'true');
  // Nothing reached the charger.
  expect(charger.callsOf('RequestStartTransaction')).toHaveLength(startsBefore);
});

test('shows a failure and frees the charger when the charger rejects the start command', async ({ page }) => {
  charger.behaviour.start = 'Rejected';
  await openEvPage(page);
  const before = charger.callsOf('RequestStartTransaction').length;

  await startSession(page, 'BA2PA7777');
  await charger.waitForCall('RequestStartTransaction', { count: before + 1 });

  await expect(page.getByText('Session failed: Charger rejected the start command')).toBeVisible();
  await expect(page.getByText('No active sessions. Start one from the Start Session tab.')).toBeVisible();
  await tab(page, 'Start Session').click();
  await expect(chargerCard(page, 'Ready')).toBeEnabled();
});

test('keeps the connector locked and offers Retry unlock when the first unlock fails', async ({ page }) => {
  charger.behaviour.unlock = ['UnlockFailed', 'Unlocked'];
  const plate = 'BA3PA8888';
  await openEvPage(page);
  const unlocksBefore = charger.callsOf('UnlockConnector').length;

  await chargeAndStop(page, plate, { soc: 55, deltaWh: 2500 });
  await page.getByTestId('payment-due').getByRole('button', { name: 'Confirm Payment & Unlock' }).click();

  await charger.waitForCall('UnlockConnector', { count: unlocksBefore + 1 });
  const stuck = page.getByTestId('payment-progress');
  await expect(stuck).toContainText('Connector unlock failed; retry required');

  await stuck.getByRole('button', { name: 'Retry unlock' }).click();
  await charger.waitForCall('UnlockConnector', { count: unlocksBefore + 2 });
  await expect(page.getByText(`Connector unlocked for ${plate}`)).toBeVisible();
});

test('asks staff to type the amount for a walk-in with no vehicle type', async ({ page }) => {
  const plate = 'BA6PA3434';
  await openEvPage(page);
  await chargeAndStop(page, plate, { soc: 50, deltaWh: 2000, vehicle: null });

  const due = page.getByTestId('payment-due');
  await expect(due).toContainText('No vehicle type was chosen for this session, so enter the amount to collect.');
  await expect(due).not.toContainText('per 1%');
  const confirm = due.getByRole('button', { name: 'Confirm Payment & Unlock' });
  await expect(confirm).toBeDisabled(); // nothing to collect until staff type an amount

  await due.getByLabel('Amount (Rs)').fill('400');
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(page.getByText(`Connector unlocked for ${plate}`)).toBeVisible();
});

test('lets staff change the amount and take the payment method they choose', async ({ page }) => {
  const plate = 'BA4PA9999';
  await openEvPage(page);
  await chargeAndStop(page, plate, { soc: 45, deltaWh: 1000, vehicle: FOTON });

  const due = page.getByTestId('payment-due');
  await expect(due).toContainText(`${45 - START_SOC}% charged × Rs ${FOTON.rate} per 1%`); // 13% × 9 = Rs 117
  await expect(due).toContainText(`Rs ${(45 - START_SOC) * FOTON.rate}`);
  await due.getByRole('button', { name: 'Change amount' }).click();
  await due.getByLabel('Amount (Rs)').fill('500');
  await due.getByRole('radio', { name: 'eSewa' }).click();
  await expect(due.getByRole('radio', { name: 'eSewa' })).toHaveAttribute('aria-checked', 'true');
  await due.getByRole('button', { name: 'Confirm Payment & Unlock' }).click();

  await expect(page.getByText(`Connector unlocked for ${plate}`)).toBeVisible();
});

// ---------------------------------------------------------------------------- live state

test('turns the charger card Offline when it disconnects and Ready again when it returns', async ({ page }) => {
  await openEvPage(page);
  await expect(chargerCard(page, 'Ready')).toBeEnabled();

  charger.disconnect();
  await expect(chargerCard(page, 'Offline')).toBeDisabled();

  await charger.connect();
  await expect(chargerCard(page, 'Ready')).toBeEnabled();
});

test('marks the charger Charging (and unselectable) while its connector is in use', async ({ page }) => {
  await openEvPage(page);
  await charger.setConnectorStatus('Occupied');
  await expect(chargerCard(page, 'Charging')).toBeDisabled();

  await charger.setConnectorStatus('Available');
  await expect(chargerCard(page, 'Ready')).toBeEnabled();
});

// ---------------------------------------------------------------------------- language, roles, layout

test('picks a vehicle from the searchable sheet, and it shows on the session', async ({ page }, testInfo) => {
  const plate = 'BA5PA1212';
  await openEvPage(page);
  const field = page.getByRole('button', { name: /^Vehicle \(optional/ });

  // The sheet lists the real seeded vehicles, each with kW, seats and the green price pill.
  await field.click();
  const sheet = page.getByRole('dialog', { name: 'Choose vehicle' });
  await expect(sheet.getByText('19 vehicles')).toBeVisible();
  await expect(sheet.getByRole('option', { name: /No vehicle \(walk-in\)/ })).toBeVisible();
  await testInfo.attach('vehicle-sheet', { body: await page.screenshot(), contentType: 'image/png' });

  await sheet.getByRole('searchbox').fill('fot');
  await expect(sheet.getByText('Showing 1 of 19 vehicles')).toBeVisible();
  await testInfo.attach('vehicle-sheet-search', { body: await page.screenshot(), contentType: 'image/png' });
  await sheet.getByRole('option', { name: /Foton/ }).click();

  await expect(sheet).toBeHidden();
  await expect(field).toContainText('Foton');
  await expect(field).toContainText(`Rs ${FOTON.rate}`);
  await expect(field).not.toContainText('/%');
  await expect(page.getByRole('button', { name: 'Clear vehicle' })).toBeVisible();

  // The chosen vehicle travels with the session.
  await chargeAndStop(page, plate, { soc: 50, deltaWh: 3000, vehicle: null }); // Foton already chosen above
  await expect(page.getByTestId('payment-due')).toContainText(`${50 - START_SOC}% charged × Rs ${FOTON.rate} per 1%`);
  await tab(page, 'Payment').click();
  await page.getByTestId('payment-due').getByRole('button', { name: 'Confirm Payment & Unlock' }).click();
  await expect(page.getByText(`Connector unlocked for ${plate}`)).toBeVisible();
});

test('switches every label to Nepali with Devanagari numerals and back', async ({ page }) => {
  await openEvPage(page);
  await page.getByRole('button', { name: 'नेपालीमा बदल्नुहोस्' }).click();

  await expect(page.getByRole('tab', { name: /सेसन सुरु/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /सक्रिय/ })).toBeVisible();
  await expect(page.getByRole('tab', { name: /भुक्तानी/ })).toBeVisible();
  await expect(page.getByText('चार्जर छान्नुहोस्')).toBeVisible();
  await expect(page.getByRole('radio', { name: /चार्जर १.*८० kW.*तयार/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'चार्जिङ सुरु गर्नुहोस् →' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('tab', { name: /Start Session/ })).toBeVisible();
});

test('hides the NEA rate and admin-only controls from staff, in the UI and at the API', async ({ page }) => {
  await openEvPage(page, STAFF);
  await expect(chargerCard(page, 'Ready')).toBeEnabled();

  // Nothing about what the station pays NEA is on screen (the admin set it to 12.50 earlier)...
  await expect(page.getByText(/NEA Rate per Unit/)).toHaveCount(0);
  await expect(page.getByText('12.50')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Update/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Vehicles$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /NEA bills/ })).toHaveCount(0);

  // ...and hiding it in the UI is not the only protection: the API itself refuses staff.
  const status = await page.evaluate(async () => {
    const response = await fetch('/api/settings/nea_rate', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    return response.status;
  });
  expect(status).toBe(403);
});

test('fits a phone screen on every tab and keeps touch targets at least 44px', async ({ page }) => {
  await openEvPage(page);

  for (const name of ['Start Session', 'Active', 'Payment']) {
    await tab(page, name).click();
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(noHorizontalScroll, `${name} tab scrolls horizontally`).toBe(true);

    const tooSmall = await page.evaluate(() => {
      const targets = document.querySelectorAll('[role="tabpanel"] button, [role="tab"], [role="radio"], nav button, header button:not([aria-label*="Switch"]):not([aria-label*="नेपाली"])');
      return [...targets]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, box: el.getBoundingClientRect() }))
        .filter(({ box }) => Math.min(box.width, box.height) < 43.5)
        .map(({ el, box }) => `${el.textContent.trim().slice(0, 30) || el.getAttribute('aria-label')} (${Math.round(box.width)}×${Math.round(box.height)})`);
    });
    expect(tooSmall, `${name} tab has undersized touch targets`).toEqual([]);
  }
});
