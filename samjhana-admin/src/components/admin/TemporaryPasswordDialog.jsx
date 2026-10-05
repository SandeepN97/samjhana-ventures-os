import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check } from 'lucide-react';
import useEscape from '../../utils/useEscape';

/**
 * Shows the temporary password an admin just created, once, in the middle of the screen. It cannot be
 * looked up again, so the admin copies it or reads it out before closing.
 */
export default function TemporaryPasswordDialog({ name, password, onClose }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const doneRef = useRef(null);
  useEscape(onClose);
  useEffect(() => { doneRef.current?.focus(); }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);   // the password is on screen to read out or select by hand
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={t('settings.temporaryPasswordTitle', { name })}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <h2 className="mb-2 text-lg font-bold text-gray-800">{t('settings.temporaryPasswordTitle', { name })}</h2>
        <p className="mb-3 text-sm text-gray-600">{t('settings.temporaryPasswordNote', { name })}</p>
        <div className="mb-4 flex items-center gap-2">
          <code data-testid="temporary-password"
            className="min-h-[44px] flex-1 select-all break-all rounded-lg bg-gray-100 px-3 py-2 text-center font-mono text-lg tracking-wider text-gray-900">
            {password}
          </code>
          <button type="button" onClick={copy} aria-label={t('settings.copy')}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border-2 border-gray-300 px-3 font-medium text-gray-700 hover:bg-gray-50">
            {copied ? <Check className="h-5 w-5 text-green-600" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
            <span className="text-sm">{copied ? t('settings.copied') : t('settings.copy')}</span>
          </button>
        </div>
        <button type="button" ref={doneRef} onClick={onClose}
          className="min-h-[44px] w-full rounded-lg bg-gray-800 font-bold text-white hover:bg-gray-700">
          {t('settings.done')}
        </button>
      </div>
    </div>
  );
}
