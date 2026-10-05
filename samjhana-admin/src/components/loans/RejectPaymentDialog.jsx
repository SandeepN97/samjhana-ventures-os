import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useEscape from '../../utils/useEscape';

/** Asks the admin why a payment is being rejected; the manager sees this reason, so it is required. */
export default function RejectPaymentDialog({ onReject, onCancel }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const box = useRef(null);
  useEscape(onCancel);
  useEffect(() => { box.current?.focus(); }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!reason.trim()) return setError(t('loan.rejectReasonRequired'));
    onReject(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <form role="dialog" aria-modal="true" aria-label={t('loan.rejectPayment')} onSubmit={submit}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-gray-800">{t('loan.rejectPayment')}</h2>
        <label className="block text-sm font-medium text-gray-700">
          {t('loan.rejectReason')}
          <textarea ref={box} value={reason} rows={3} maxLength={500}
            onChange={(e) => { setReason(e.target.value); setError(''); }}
            className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-loans-500 focus:outline-none" />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" className="min-h-[44px] flex-1 rounded-lg bg-red-600 font-bold text-white hover:bg-red-700">
            {t('loan.rejectConfirm')}
          </button>
          <button type="button" onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border-2 border-gray-300 font-bold text-gray-700 hover:bg-gray-50">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </div>
  );
}
