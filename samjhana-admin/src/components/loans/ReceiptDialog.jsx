import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../utils/api';
import useEscape from '../../utils/useEscape';

/**
 * Shows a bank receipt photo in the middle of the screen. The photo is private, so it is fetched with the
 * signed-in token (not an open web address) and shown from memory; nothing is saved on the device.
 */
export default function ReceiptDialog({ receiptId, onClose }) {
  const { t } = useTranslation();
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  useEscape(onClose);

  useEffect(() => {
    let url = null;
    let cancelled = false;
    api.get(`/api/loans/receipts/${receiptId}`, { responseType: 'blob', skipAuthRedirect: true })
      .then((res) => {
        if (cancelled) return;
        url = URL.createObjectURL(res.data);
        setSrc(url);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [receiptId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true"
      aria-label={t('loan.receiptPhoto')} onClick={onClose}>
      <div className="max-h-full w-full max-w-lg overflow-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-2">
          <h2 className="text-lg font-bold text-gray-800">{t('loan.receiptPhoto')}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')}
            className="flex h-11 w-11 items-center justify-center rounded hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="p-4">
          {failed ? (
            <p role="alert" className="text-center text-red-600">{t('loan.receiptLoadFailed')}</p>
          ) : src ? (
            <img src={src} alt={t('loan.receiptPhoto')} className="mx-auto max-h-[70vh] w-auto max-w-full" />
          ) : (
            <p className="py-8 text-center text-gray-500">{t('common.loading', 'Loading...')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
