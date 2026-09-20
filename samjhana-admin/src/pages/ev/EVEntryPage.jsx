import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Camera, RefreshCw, Settings, Zap } from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../../components/LanguageToggle';
import BottomNav from '../../components/BottomNav';
import ChargerCard from '../../components/ev/ChargerCard';
import ChargeTargetCard from '../../components/ev/ChargeTargetCard';
import VehiclePicker from '../../components/ev/VehiclePicker';
import RateBanner from '../../components/ev/RateBanner';
import ActiveSessionCard from '../../components/ev/ActiveSessionCard';
import PaymentCard from '../../components/ev/PaymentCard';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import useBusinessDate from '../../hooks/useBusinessDate';
import useEvLiveUpdates from '../../hooks/useEvLiveUpdates';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import {
  ACTIVE_STATUSES, PAYMENT_STATUSES, OPEN_STATUSES, byRequestedAt, chargerState,
} from '../../utils/evSession';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const POLL_MS = 10000;
const EMPTY_FORM = { chargePointId: '', vehicleCatalogId: '', plateNumber: '', platePhotoDataUrl: '', targetPercent: '80' };

/**
 * EV Charging — live control flow for the staff kiosk: Start Session → Active → Payment.
 * Payment confirmation is the only thing that releases the connector after a stop.
 */
export default function EVEntryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { num } = useLocaleFormat();
  const { toasts, showToast, removeToast } = useToast();
  const { businessDate } = useBusinessDate();

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [tab, setTab] = useState('start');
  const [chargers, setChargers] = useState([]);
  const [chargersLoaded, setChargersLoaded] = useState(false);
  const [chargersFailed, setChargersFailed] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [date, setDate] = useState(businessDate);
  const [photoName, setPhotoName] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [now, setNow] = useState(Date.now());
  const knownStatus = useRef(new Map());
  // Bumped on every live event, so a REST fetch can tell whether it was overtaken (see refresh).
  const eventSeq = useRef(0);

  useEffect(() => { setDate(businessDate); }, [businessDate]);

  // ---- sessions: merge one update, and tell staff about transitions they care about ----
  const notifyTransition = useCallback((previous, next) => {
    if (previous === undefined || previous === next.status) return;
    if (next.status === 'FAILED') {
      showToast(t('evLive.sessionFailed', { message: next.statusMessage || '' }), 'error');
    } else if (next.status === 'AWAITING_PAYMENT') {
      showToast(t('evLive.stoppedAwaitingPayment', { plate: next.plateNumber }), 'info');
      setTab((current) => (current === 'active' ? 'pay' : current));
    } else if (next.status === 'CLOSED') {
      showToast(t('evLive.unlocked', { plate: next.plateNumber }), 'success');
    }
  }, [showToast, t]);

  const mergeSession = useCallback((next) => {
    const previous = knownStatus.current.get(next.id);
    knownStatus.current.set(next.id, next.status);
    setSessions((current) => {
      const rest = current.filter((item) => item.id !== next.id);
      return OPEN_STATUSES.has(next.status) ? [...rest, next].sort(byRequestedAt) : rest;
    });
    notifyTransition(previous, next);
  }, [notifyTransition]);

  const handleLiveEvent = useCallback((event) => {
    eventSeq.current += 1;
    if (event.type === 'CHARGE_SESSION_UPDATED' && event.payload) mergeSession(event.payload);
    if (event.type === 'CHARGE_POINT_UPDATED' && event.payload) {
      setChargers((current) => current.map((item) => (item.id === event.payload.id ? event.payload : item)));
    }
  }, [mergeSession]);
  const liveConnected = useEvLiveUpdates(handleLiveEvent);

  // ---- loading (and a slow poll while the live socket is down) ----
  const refresh = useCallback(async ({ initial = false } = {}) => {
    let results;
    let overtaken = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const seqAtStart = eventSeq.current;
      results = await Promise.allSettled([
        api.get('/api/charge-points'),
        initial ? api.get('/api/ev-vehicles') : Promise.resolve(null),
        api.get('/api/ev/sessions/active'),
      ]);
      overtaken = eventSeq.current !== seqAtStart;
      // A live event that landed mid-fetch is newer than this snapshot. Applying the snapshot
      // would roll the screen back (a charger stuck on "Charging"), so fetch again instead.
      if (!overtaken) break;
    }
    // Still being overtaken after retries: the live events already carry the truth, so keep
    // what's on screen. (The very first load has nothing on screen yet, so it always applies.)
    if (overtaken && !initial) return;
    const [chargerResult, vehicleResult, sessionResult] = results;
    if (chargerResult.status === 'fulfilled') {
      setChargers(Array.isArray(chargerResult.value.data) ? chargerResult.value.data : []);
      setChargersFailed(false);
    } else if (initial) {
      setChargersFailed(true);
    }
    if (initial) setChargersLoaded(true);
    if (vehicleResult.status === 'fulfilled' && vehicleResult.value && Array.isArray(vehicleResult.value.data)) {
      setVehicles(vehicleResult.value.data);
    }
    if (sessionResult.status === 'fulfilled' && Array.isArray(sessionResult.value.data)) {
      knownStatus.current = new Map(sessionResult.value.data.map((item) => [item.id, item.status]));
      setSessions([...sessionResult.value.data].sort(byRequestedAt));
    } else if (initial) {
      showToast(t('evLive.loadFailed'), 'error');
    }
  }, [showToast, t]);

  useEffect(() => { refresh({ initial: true }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (liveConnected) return undefined;
    const id = setInterval(() => refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [liveConnected, refresh]);

  // Live events are not replayed: anything that happened between the first load and the socket
  // connecting, or while it was down, is gone for good. Re-sync from REST on every (re)connect.
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { if (liveConnected) refreshRef.current(); }, [liveConnected]);

  const hasRunning = sessions.some((item) => item.status === 'ACTIVE');
  useEffect(() => {
    if (!hasRunning) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasRunning]);

  // ---- derived ----
  const activeSessions = useMemo(() => sessions.filter((item) => ACTIVE_STATUSES.includes(item.status)), [sessions]);
  const paymentSessions = useMemo(() => sessions.filter((item) => PAYMENT_STATUSES.includes(item.status)), [sessions]);
  const awaitingCount = paymentSessions.filter((item) => item.status === 'AWAITING_PAYMENT').length;
  const openChargerIds = useMemo(() => new Set(sessions.map((item) => item.chargePointId)), [sessions]);
  const anyOnline = chargers.some((item) => item.connectionStatus === 'ONLINE');
  const chargerName = (charger) => t('evConsole.charger', { number: num(charger.displayOrder) });

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: false }));
  };

  // ---- actions ----
  const readPhoto = (file) => {
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type)) { showToast(t('evLive.photoBadType'), 'error'); return; }
    if (file.size > MAX_PHOTO_BYTES) { showToast(t('evLive.photoTooLarge'), 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => { setField('platePhotoDataUrl', reader.result); setPhotoName(file.name); };
    reader.readAsDataURL(file);
  };

  const startSession = async () => {
    const plate = form.plateNumber.trim();
    const target = Number(form.targetPercent);
    if (!form.chargePointId) { setErrors({ chargePointId: true }); showToast(t('evLive.selectChargerFirst'), 'error'); return; }
    if (!plate) { setErrors({ plateNumber: true }); showToast(t('evLive.enterPlate'), 'error'); return; }
    if (!(target >= 1 && target <= 100)) { showToast(t('evLive.targetRange'), 'error'); return; }

    setSubmitting(true);
    try {
      const response = await api.post('/api/ev/sessions/start', {
        chargePointId: form.chargePointId,
        plateNumber: plate,
        vehicleCatalogId: form.vehicleCatalogId || null,
        platePhotoDataUrl: form.platePhotoDataUrl || null,
        targetPercent: target,
      });
      const charger = chargers.find((item) => item.id === form.chargePointId);
      mergeSession(response.data);
      showToast(t('evLive.started', { charger: charger ? chargerName(charger) : '' }), 'success');
      setForm(EMPTY_FORM);
      setPhotoName('');
      setErrors({});
      setTab('active');
    } catch (error) {
      showToast(error.response?.data?.message || t('evLive.startFailed'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const perform = async (id, action, payload, successKey, successValues) => {
    setBusyId(id);
    try {
      const response = await api.post(`/api/ev/sessions/${id}/${action}`, payload);
      mergeSession(response.data);
      showToast(t(successKey, successValues), 'success');
    } catch (error) {
      showToast(error.response?.data?.message || t('evLive.actionFailed'), 'error');
    } finally {
      setBusyId('');
    }
  };

  const tabs = [
    { key: 'start', label: t('evLive.startTab') },
    { key: 'active', label: t('evLive.activeTab'), count: activeSessions.length },
    { key: 'pay', label: t('evLive.paymentTab'), count: awaitingCount },
  ];
  const headerTitle = { start: t('evLive.title'), active: t('evLive.activeTitle'), pay: t('evLive.paymentTitle') }[tab];

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      <header className="bg-green-500 px-4 py-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label={t('common.goBack')}
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-green-600"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <Zap className="ml-2 h-8 w-8" />
            <h1 className="ml-3 text-xl font-bold">{headerTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/ev-vehicles')}
                className="flex min-h-[44px] flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors hover:bg-green-600"
              >
                <Settings className="h-5 w-5" />
                <span className="text-[10px] font-medium leading-none">{t('evLive.vehicles')}</span>
              </button>
            )}
            <LanguageToggle />
          </div>
        </div>
      </header>

      <div role="tablist" className="flex overflow-x-auto border-b border-gray-200 bg-white">
        {tabs.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`min-h-[44px] min-w-[92px] flex-1 border-b-2 px-2 py-2.5 text-xs font-bold ${
              tab === key ? 'border-green-600 text-green-600' : 'border-transparent text-gray-500'
            }`}
          >
            {label}
            {count > 0 && (
              <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">{num(count)}</span>
            )}
          </button>
        ))}
      </div>
      {!liveConnected && (
        <p role="status" className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-700">
          {t('evLive.liveReconnecting')}
        </p>
      )}

      {tab === 'start' && (
        <div role="tabpanel">
          {/* What the station pays NEA is business-sensitive: admins and managers only. */}
          {isAdmin && <RateBanner showToast={showToast} onOpenBills={() => navigate('/ev-electricity')} />}

          <div className="p-4 pb-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('evLive.selectCharger')}</p>
            {chargersFailed && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t('evLive.chargersLoadFailed')}</p>
            )}
            {!chargersLoaded && !chargersFailed && (
              <div className="flex justify-center py-8"><RefreshCw className="h-6 w-6 animate-spin text-green-500" aria-label={t('common.loading')} /></div>
            )}
            {chargersLoaded && !chargersFailed && chargers.length === 0 && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{t('evLive.noChargersSetup')}</p>
            )}
            {chargers.length > 0 && (
              <div role="radiogroup" aria-label={t('evLive.chargersLabel')} className="grid grid-cols-3 gap-2">
                {chargers.map((charger) => (
                  <ChargerCard
                    key={charger.id}
                    charger={charger}
                    state={chargerState(charger, openChargerIds.has(charger.id))}
                    selected={form.chargePointId === charger.id}
                    invalid={errors.chargePointId}
                    onSelect={(id) => setField('chargePointId', id)}
                  />
                ))}
              </div>
            )}
            {chargers.length > 0 && !anyOnline && (
              <p className="mt-2 text-sm font-medium text-amber-700">{t('evLive.noChargersOnline')}</p>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label htmlFor="ev-date" className="mb-2 block text-lg font-medium text-gray-700">
                {t('common.date')} <span className="text-red-500">*</span>
              </label>
              <input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div>
              <label id="ev-vehicle-label" htmlFor="ev-vehicle" className="mb-2 block text-lg font-medium text-gray-700">
                {t('evLive.vehicle')} <span className="text-sm text-gray-400">{t('evLive.vehicleHint')}</span>
              </label>
              <VehiclePicker
                id="ev-vehicle"
                labelledBy="ev-vehicle-label"
                vehicles={vehicles}
                value={form.vehicleCatalogId}
                onChange={(next) => setField('vehicleCatalogId', next)}
              />
            </div>

            <div className="rounded-xl bg-white p-4 shadow-md">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('evLive.plateSection')}</p>
              <input
                id="ev-plate-photo"
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { readPhoto(e.target.files?.[0]); e.target.value = ''; }}
              />
              <label
                htmlFor="ev-plate-photo"
                className="mb-3 flex min-h-[44px] w-full cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-green-300 py-5 text-center text-sm text-gray-500"
              >
                <Camera className="mx-auto mb-1 h-6 w-6 text-green-600" aria-hidden="true" />
                {photoName ? t('evLive.platePhotoDone', { name: photoName }) : t('evLive.platePhotoCta')}
              </label>
              <label htmlFor="ev-plate" className="mb-1 block text-sm font-medium text-gray-700">
                {t('evLive.plateNumber')} <span className="text-red-500">*</span>
              </label>
              <input
                id="ev-plate"
                type="text"
                value={form.plateNumber}
                onChange={(e) => setField('plateNumber', e.target.value.toUpperCase())}
                placeholder={t('evLive.platePlaceholder')}
                aria-invalid={errors.plateNumber ? 'true' : 'false'}
                autoCapitalize="characters"
                className={`w-full rounded-xl border-2 px-4 py-3 font-mono font-bold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  errors.plateNumber ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              <p className="mt-1 text-xs text-gray-400">{t('evLive.plateHelp')}</p>
            </div>

            <ChargeTargetCard value={form.targetPercent} onChange={(value) => setField('targetPercent', value)} />

            <button
              type="button"
              disabled={submitting}
              onClick={startSession}
              className="w-full rounded-xl bg-green-600 py-5 text-xl font-bold text-white shadow-lg hover:bg-green-700 disabled:opacity-60"
            >
              {submitting ? t('evLive.sending') : t('evLive.startCharging')}
            </button>
          </div>
        </div>
      )}

      {tab === 'active' && (
        <div role="tabpanel" className="space-y-3 p-4">
          {activeSessions.map((item) => (
            <ActiveSessionCard
              key={item.id}
              session={item}
              now={now}
              busy={busyId === item.id}
              onStop={(id) => perform(id, 'stop', undefined, 'evLive.stopSent')}
            />
          ))}
          {activeSessions.length === 0 && (
            <p className="mt-6 px-8 text-center text-sm text-gray-400">{t('evLive.noActive')}</p>
          )}
        </div>
      )}

      {tab === 'pay' && (
        <div role="tabpanel" className="p-4">
          {paymentSessions.map((item) => (
            <PaymentCard
              key={item.id}
              session={item}
              busy={busyId === item.id}
              onConfirm={(id, method, amount) =>
                perform(id, 'mark-paid', { method, amount }, 'evLive.paymentConfirmed', { plate: item.plateNumber })}
              onRetryUnlock={(id) => perform(id, 'unlock', undefined, 'evLive.unlocking')}
            />
          ))}
          {paymentSessions.length === 0 && (
            <p className="mt-10 px-8 text-center text-sm text-gray-400">{t('evLive.noPayment')}</p>
          )}
        </div>
      )}

      <BottomNav active="home" />
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
