import React, { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import useLocaleFormat from '../../hooks/useLocaleFormat';

// Must match ChargeSession.PaymentMethod on the server.
const METHODS = [
  { value: 'CASH', labelKey: 'evConsole.payment.cash' },
  { value: 'ESEWA', labelKey: 'evConsole.payment.esewa' },
  { value: 'KHALTI', labelKey: 'evConsole.payment.khalti' },
];

/**
 * Payment Due card. While AWAITING_PAYMENT it collects the payment (this is the only way to
 * unlock the connector); once paid it just shows unlock progress with a retry if it failed.
 */
export default function PaymentCard({ session, busy, onConfirm, onRetryUnlock }) {
  const { t } = useTranslation();
  const { num, money } = useLocaleFormat();
  const suggested = session.suggestedAmount == null ? '' : String(session.suggestedAmount);
  const [method, setMethod] = useState('CASH');
  const [amount, setAmount] = useState(suggested);
  const [editing, setEditing] = useState(suggested === '');
  const touched = useRef(false);

  // The final kWh can still settle after the card first appears; follow it until staff edit.
  useEffect(() => {
    if (!touched.current) {
      setAmount(suggested);
      if (suggested === '') setEditing(true);
    }
  }, [suggested]);

  const kwh = num(Number(session.energyDeliveredKwh || 0).toFixed(1));
  const summary = t('evLive.deliveredSummary', { plate: session.plateNumber, charger: session.chargerModel, kwh });
  // "18% charged × Rs 14 per 1%": customers pay by car type and percentage, so show the working.
  const breakdown = session.ratePerPercent != null && session.percentCharged != null
    ? t('evLive.percentBreakdown', { percent: num(session.percentCharged), rate: money(session.ratePerPercent) })
    : null;
  const valid = Number(amount) > 0;

  if (session.status !== 'AWAITING_PAYMENT') {
    return (
      <div className="mb-3 rounded-xl bg-white p-4 shadow-md" data-testid="payment-progress">
        <p className="mb-1 text-sm text-gray-500">{summary}</p>
        <p className="text-sm font-semibold text-gray-800">{session.statusMessage || t('evLive.unlocking')}</p>
        {session.status === 'PAID' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRetryUnlock(session.id)}
            className="mt-3 min-h-[44px] w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {t('evLive.retryUnlock')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow-md" data-testid="payment-due">
      <p className="mb-1 text-xs font-semibold uppercase text-amber-600">{t('evLive.awaitingPayment')}</p>
      <p className="mb-1 text-sm text-gray-500">{summary}</p>
      {breakdown && <p className="mb-3 text-sm font-medium text-green-700">{breakdown}</p>}
      {!breakdown && <div className="mb-2" />}

      {editing ? (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor={`amount-${session.id}`}>
            {t('evLive.amountLabel')}
          </label>
          <input
            id={`amount-${session.id}`}
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => { touched.current = true; setAmount(e.target.value); }}
            className="w-full rounded-xl border-2 border-gray-300 px-4 py-3 text-2xl font-bold focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          {suggested === '' && <p className="mt-1 text-xs text-amber-600">{t('evLive.noRateHint')}</p>}
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-4xl font-black text-gray-900">{money(amount)}</p>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-[44px] text-sm font-medium text-green-600 underline-offset-2 hover:underline"
          >
            {t('evLive.changeAmount')}
          </button>
        </div>
      )}

      <div role="radiogroup" aria-label={t('common.paymentMethod')} className="mb-4 grid grid-cols-3 gap-3">
        {METHODS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={method === item.value}
            onClick={() => setMethod(item.value)}
            className={`min-h-[52px] rounded-xl border-2 py-4 text-base font-bold ${
              method === item.value
                ? 'border-green-500 bg-green-500 text-white'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={busy || !valid}
        onClick={() => onConfirm(session.id, method, Number(amount))}
        className="mb-3 w-full rounded-xl bg-green-600 py-5 text-xl font-bold text-white shadow-lg hover:bg-green-700 disabled:opacity-50"
      >
        {t('evLive.confirmUnlock')}
      </button>

      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
        <Lock className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
        {t('evLive.lockNotice')}
      </div>
    </div>
  );
}
