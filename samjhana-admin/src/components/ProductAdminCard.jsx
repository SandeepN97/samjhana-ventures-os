import React from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, Edit2, Trash2, Plus, Minus } from 'lucide-react';
import { resolveMediaUrl } from '../utils/image';

/** What a product's status is, in the words the shop uses. Several can apply at once. */
export function productStatus(item) {
  const stock = Number(item.stockQty) || 0;
  return {
    hasPicture: (item.imageUrls || []).length > 0,
    live: item.showOnWebsite !== false,
    out: stock <= 0,
    low: stock > 0 && stock <= (Number(item.reorderLevel) || 0),
  };
}

/**
 * One product in the picture grid: the photo first (tap it to add or change pictures), then name, price and
 * status chips, a Live/Hidden switch, and the stock buttons. Only admins edit; admins and managers adjust stock.
 */
export default function ProductAdminCard({
  item, price, cost = null, margin = null, categoryLabel, isAdmin, canManage, onPhoto, onEdit, onDelete, onStock, onToggleLive, accent = 'bg-gray-800',
  labels = {}, stockText = null, testId = 'product-row',
}) {
  const { t } = useTranslation();
  const s = productStatus(item);
  const cover = s.hasPicture ? resolveMediaUrl(item.imageUrls[0]) : '';

  const photo = (
    <>
      {cover ? (
        <img src={cover} alt={item.name} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-gray-100 text-gray-500">
          <Camera className="h-8 w-8" aria-hidden="true" />
          <span className="text-xs font-medium">{isAdmin ? t('productGrid.addPhoto') : t('productGrid.noPicture')}</span>
        </span>
      )}
      {isAdmin && cover && (
        <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow" aria-hidden="true">
          <Camera className="h-4 w-4" />
        </span>
      )}
    </>
  );

  return (
    <article className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm" data-testid={testId}>
      {isAdmin ? (
        <button type="button" onClick={() => onPhoto(item)} aria-label={t('productGrid.changePhotos', { name: item.name })}
          className="relative block aspect-square w-full overflow-hidden">{photo}</button>
      ) : (
        <div className="relative block aspect-square w-full overflow-hidden">{photo}</div>
      )}

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="font-bold leading-tight text-gray-800">{item.name}</h3>
          {item.nameNepali && <p className="text-sm text-gray-500">{item.nameNepali}</p>}
          <p className="mt-0.5 text-xs text-gray-400"><span>{categoryLabel}</span> · {item.sku}</p>
        </div>

        <div>
          <p className="text-lg font-bold text-gray-900">{price}</p>
          {cost && <p className="text-sm text-gray-500"><span>{cost}</span>{margin && <span className="ml-2 text-xs text-green-600">{margin}</span>}</p>}
        </div>

        <div className="flex flex-wrap gap-1.5" aria-label={t('productGrid.status')}>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${s.live ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
            {s.live ? t('productGrid.live') : t('productGrid.hidden')}
          </span>
          {s.out && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{labels.out || t('productGrid.outOfStock')}</span>}
          {s.low && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{labels.low || t('productGrid.lowStock')}</span>}
          {!s.hasPicture && <span className="rounded-full border border-amber-400 px-2 py-0.5 text-xs font-semibold text-amber-800">{t('productGrid.noPicture')}</span>}
        </div>

        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <div className="flex items-center">
            {canManage && (
              <button type="button" onClick={() => onStock(item, -1)} disabled={s.out} aria-label={labels.less || t('productGrid.lessStock', { name: item.name })}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            )}
            <span className={`min-w-[2.25rem] px-1 text-center text-lg font-bold ${s.out || s.low ? 'text-red-600' : 'text-gray-800'}`}
              aria-label={t('productGrid.inStock', { count: item.stockQty })}>{stockText ?? item.stockQty}</span>
            {canManage && (
              <button type="button" onClick={() => onStock(item, 1)} aria-label={labels.more || t('productGrid.moreStock', { name: item.name })}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200"><Plus className="h-4 w-4" /></button>
            )}
          </div>
          {isAdmin && (
            <div className="flex">
              <button type="button" onClick={() => onEdit(item)} aria-label={labels.edit || t('productGrid.edit', { name: item.name })}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"><Edit2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => onDelete(item)} aria-label={labels.remove || t('productGrid.remove', { name: item.name })}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {isAdmin && (
          <button type="button" role="switch" aria-checked={s.live} onClick={() => onToggleLive(item)}
            aria-label={t('productGrid.showOnWebsiteFor', { name: item.name })}
            className="flex min-h-[44px] items-center justify-between rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700">
            {t('productGrid.showOnWebsite')}
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full ${s.live ? accent : 'bg-gray-300'}`} aria-hidden="true">
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${s.live ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
