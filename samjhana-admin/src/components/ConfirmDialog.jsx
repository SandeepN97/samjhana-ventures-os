import React, { useEffect, useRef } from 'react';
import useEscape from '../utils/useEscape';

/**
 * A question in a pop-up in the middle of the screen, wherever the page is scrolled to, so it is never
 * somewhere you cannot see. "Keep" is focused first so a stray tap on Enter never deletes anything.
 */
export default function ConfirmDialog({ message, confirmLabel, cancelLabel, onConfirm, onCancel, danger = true }) {
  const cancelRef = useRef(null);
  useEscape(onCancel);
  useEffect(() => { cancelRef.current?.focus(); }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-label={message} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <p className="mb-4 text-lg text-gray-800">{message}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onConfirm}
            className={`min-h-[44px] flex-1 rounded-lg font-bold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-800 hover:bg-gray-700'}`}>{confirmLabel}</button>
          <button type="button" ref={cancelRef} onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-lg border-2 border-gray-300 font-bold text-gray-700 hover:bg-gray-50">{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
