import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, X, ChevronLeft, ChevronRight, Star, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { prepareImage, mediaUrl } from '../utils/image';

/**
 * Picks, shrinks and uploads pictures, and lets staff order them. `value` is a list of picture ids; the first
 * one is the cover. With `single`, it holds at most one and a new pick replaces it. Removing a picture here
 * only takes it off this item; the uploaded file stays available.
 */
export default function ImageUploader({ id, value = [], onChange, max = 10, single = false, label }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const limit = single ? 1 : max;

  const upload = async (file) => {
    const ready = await prepareImage(file);
    const form = new FormData();
    form.append('file', ready, file.name);
    const res = await api.post('/api/media', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data.id;
  };

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (files.length === 0) return;
    setError('');
    const room = single ? files.length : limit - value.length;
    if (!single && room <= 0) {
      setError(t('media.tooMany', { max: limit }));
      return;
    }
    setBusy(true);
    const added = [];
    try {
      for (const file of files.slice(0, single ? 1 : room)) {
        try {
          added.push(await upload(file));
        } catch (err) {
          if (err.message === 'type') setError(t('media.wrongType'));
          else if (err.message === 'size') setError(t('media.tooBig'));
          else setError(err.response?.data?.message || t('media.failed'));
        }
      }
      if (!single && files.length > room) setError(t('media.tooMany', { max: limit }));
    } finally {
      setBusy(false);
    }
    if (added.length > 0) onChange(single ? [added[0]] : [...value, ...added]);
  };

  const move = (from, to) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const remove = (index) => onChange(value.filter((_, i) => i !== index));

  return (
    <div>
      {label && <span className="mb-1 block text-sm font-medium text-gray-700">{label}</span>}

      {value.length === 0 && !busy && (
        <p className="mb-2 text-sm text-gray-500">{t('media.noPictures')}</p>
      )}

      <ul className="mb-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {value.map((pictureId, index) => (
          <li key={pictureId} className="overflow-hidden rounded-lg border border-gray-200 bg-white" data-testid="picture">
            <div className="relative aspect-square bg-gray-100">
              <img src={mediaUrl(pictureId)} alt={t('media.pictureOf', { n: index + 1 })} className="h-full w-full object-cover" />
              {index === 0 && !single && (
                <span className="absolute left-1 top-1 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-xs font-bold text-white">
                  <Star className="h-3 w-3" aria-hidden="true" /> {t('media.cover')}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-1 p-1">
              {!single && (
                <div className="flex">
                  <button type="button" onClick={() => move(index, index - 1)} disabled={index === 0}
                    aria-label={t('media.moveEarlier', { n: index + 1 })}
                    className="flex h-11 w-11 items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => move(index, index + 1)} disabled={index === value.length - 1}
                    aria-label={t('media.moveLater', { n: index + 1 })}
                    className="flex h-11 w-11 items-center justify-center rounded text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
              <button type="button" onClick={() => remove(index)} aria-label={t('media.remove', { n: index + 1 })}
                className="ml-auto flex h-11 w-11 items-center justify-center rounded text-red-600 hover:bg-red-50">
                <X className="h-5 w-5" />
              </button>
            </div>
            {index > 0 && !single && (
              <button type="button" onClick={() => move(index, 0)}
                className="min-h-[44px] w-full border-t border-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {t('media.makeCover')}
              </button>
            )}
          </li>
        ))}
      </ul>

      <input id={id} ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={!single}
        onChange={handleFiles} className="sr-only" tabIndex={-1} aria-label={single ? t('media.choosePicture') : t('media.choosePictures')} />
      <button type="button" onClick={() => inputRef.current?.click()} disabled={busy || (!single && value.length >= limit)}
        className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 text-gray-700 hover:border-gray-400 disabled:opacity-50">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
        {busy ? t('media.uploading') : single && value.length > 0 ? t('media.replace') : t('media.add')}
      </button>
      <p className="mt-1 text-xs text-gray-500">{t('media.hint')}</p>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
