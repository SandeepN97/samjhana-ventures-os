/* eslint-env node */
import WebSocket from 'ws';

const START_METER_WH = 1_000_000;

/**
 * A fake DC fast charger that speaks OCPP 2.0.1-J to the real CSMS over a real WebSocket, so
 * browser tests can drive the whole flow the way the hardware would.
 *
 *   const charger = new SimulatedCharger({ code, secret, baseUrl: 'ws://localhost:8181' });
 *   await charger.connect();                 // BootNotification + StatusNotification(Available)
 *   ...UI clicks "Start"... the simulator accepts RequestStartTransaction and reports Started
 *   charger.sendMeter({ soc: 40, deltaWh: 6000 });
 *
 * `behaviour` controls how it answers the CSMS so failure paths can be tested too.
 */
export class SimulatedCharger {
  constructor({ code, secret, baseUrl, initialSoc = 32 }) {
    this.code = code;
    this.secret = secret;
    this.baseUrl = baseUrl;
    this.initialSoc = initialSoc;
    this.calls = []; // every CALL the CSMS sent us, in order
    this.resetBehaviour();
    this.seq = 0;
    this.transactionId = null;
    this.soc = initialSoc;
    this.deltaWh = 0;
  }

  resetBehaviour() {
    this.behaviour = {
      start: 'Accepted', // RequestStartTransaction answer: 'Accepted' | 'Rejected'
      unlock: ['Unlocked'], // UnlockConnector answers, consumed in order (last one repeats)
    };
    this.unlockAttempts = 0; // per-behaviour, so each test starts from its first answer
  }

  /** Opens the socket as the charger would after power-on and announces itself. */
  async connect() {
    const authorization = Buffer.from(`${this.code}:${this.secret}`).toString('base64');
    this.socket = new WebSocket(`${this.baseUrl}/ocpp/${this.code}`, ['ocpp2.0.1'], {
      headers: { Authorization: `Basic ${authorization}` },
    });
    this.socket.on('message', (raw) => this.#onMessage(raw.toString()));
    await new Promise((resolve, reject) => {
      this.socket.once('open', resolve);
      this.socket.once('unexpected-response', (_req, res) => reject(new Error(`Handshake refused: HTTP ${res.statusCode}`)));
      this.socket.once('error', reject);
    });
    await this.#call('BootNotification', {
      reason: 'PowerUp',
      chargingStation: { model: 'SIM', vendorName: 'Playwright', serialNumber: `SIM-${this.code}` },
    });
    await this.#call('StatusNotification', this.#status('Available'));
    return this;
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  disconnect() {
    if (this.connected) this.socket.close();
  }

  /** What the connector shows: Available / Occupied / Faulted… */
  setConnectorStatus(status) {
    return this.#call('StatusNotification', this.#status(status));
  }

  /** A periodic meter report during charging. `deltaWh` is energy since the session started. */
  sendMeter({ soc, deltaWh }) {
    this.soc = soc ?? this.soc;
    this.deltaWh = deltaWh ?? this.deltaWh;
    return this.#transactionEvent('Updated');
  }

  callsOf(action) {
    return this.calls.filter((call) => call.action === action);
  }

  /** Resolves when the CSMS has sent (at least `count`) commands of this kind. */
  async waitForCall(action, { count = 1, timeout = 15_000 } = {}) {
    const deadline = Date.now() + timeout;
    while (this.callsOf(action).length < count) {
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for ${action}; got: ${this.calls.map((c) => c.action).join(', ') || 'nothing'}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return this.callsOf(action)[count - 1];
  }

  // ------------------------------------------------------------------ internals

  #status(connectorStatus) {
    return { timestamp: new Date().toISOString(), connectorStatus, evseId: 1, connectorId: 1 };
  }

  #send(frame) {
    if (this.connected) this.socket.send(JSON.stringify(frame));
  }

  #call(action, payload) {
    const id = `${this.code}-${Math.random().toString(36).slice(2)}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`No reply to ${action}`)), 10_000);
      this.pending = this.pending || new Map();
      this.pending.set(id, (frame) => { clearTimeout(timer); resolve(frame); });
      this.#send([2, id, action, payload]);
    });
  }

  #transactionEvent(eventType) {
    const payload = {
      eventType,
      timestamp: new Date().toISOString(),
      triggerReason: eventType === 'Started' ? 'RemoteStart' : eventType === 'Ended' ? 'RemoteStop' : 'MeterValuePeriodic',
      seqNo: this.seq++,
      transactionInfo: { transactionId: this.transactionId },
      meterValue: [{
        timestamp: new Date().toISOString(),
        sampledValue: [
          { measurand: 'SoC', value: this.soc },
          { measurand: 'Energy.Active.Import.Register', value: START_METER_WH + this.deltaWh },
        ],
      }],
    };
    return this.#call('TransactionEvent', payload);
  }

  #reply(id, payload) {
    this.#send([3, id, payload]);
  }

  #onMessage(raw) {
    const frame = JSON.parse(raw);
    const [type, id] = frame;
    if (type === 3 || type === 4) {
      this.pending?.get(id)?.(frame);
      this.pending?.delete(id);
      return;
    }
    if (type !== 2) return;

    const [, , action, payload] = frame;
    this.calls.push({ action, payload, at: Date.now() });

    if (action === 'RequestStartTransaction') {
      this.#reply(id, { status: this.behaviour.start });
      if (this.behaviour.start === 'Accepted') {
        this.transactionId = `SIM-TX-${Date.now()}`;
        this.seq = 0;
        this.soc = this.initialSoc;
        this.deltaWh = 0;
        setTimeout(() => this.#transactionEvent('Started'), 150);
      }
    } else if (action === 'RequestStopTransaction') {
      this.#reply(id, { status: 'Accepted' });
      setTimeout(() => this.#transactionEvent('Ended'), 150);
    } else if (action === 'UnlockConnector') {
      const answers = this.behaviour.unlock;
      const attempt = this.unlockAttempts++;
      this.#reply(id, { status: answers[Math.min(attempt, answers.length - 1)] });
    } else {
      this.#send([4, id, 'NotSupported', `Simulator does not handle ${action}`, {}]);
    }
  }
}
