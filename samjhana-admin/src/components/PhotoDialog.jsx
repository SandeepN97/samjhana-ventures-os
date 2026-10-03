import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import ImageUploader from './ImageUploader';

/** A small window to add, remove and reorder one product's pictures without opening its whole form. */
export default function PhotoDialog({ item, onSave, onClose }) {
  const { t } = useTranslation();
  const [ids, setIds] = useState(item.imageIds || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(item, ids);
    } catch (err) {
      setError(err?.response?.data?.message || t('productGrid.photoFailed'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-4" role="dialog" aria-modal="true" aria-label={item.name}>
      <div className="mx-4 my-auto w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold text-gray-800">{t('productGrid.photosOf', { name: item.name })}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          <ImageUploader id="photo-dialog" label={t('productGrid.pictures')} value={ids} onChange={setIds} />
          {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="button" onClick={save} disabled={saving}
            className="min-h-[44px] w-full rounded-lg bg-gray-800 font-bold text-white hover:bg-gray-700 disabled:bg-gray-400">
            {saving ? t('productGrid.saving') : t('productGrid.savePhotos')}
          </button>
        </div>
      </div>
    </div>
  );
}
