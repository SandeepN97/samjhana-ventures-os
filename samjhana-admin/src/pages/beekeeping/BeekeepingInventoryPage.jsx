import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Package, Plus, X, Check, Search } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import ImageUploader from '../../components/ImageUploader';
import BusinessTabs from '../../components/BusinessTabs';
import ProductAdminCard, { productStatus } from '../../components/ProductAdminCard';
import PhotoDialog from '../../components/PhotoDialog';
import useEscape from '../../utils/useEscape';

const CATEGORIES = [
  { value: 'ALL', tKey: 'beeInv.catAll' },
  { value: 'HIVE', tKey: 'beeInv.catHive' },
  { value: 'GEAR', tKey: 'beeInv.catGear' },
  { value: 'TOOL', tKey: 'beeInv.catTool' },
  { value: 'HONEY', tKey: 'beeInv.catHoney' },
  { value: 'KIT', tKey: 'beeInv.catKit' },
  { value: 'OTHER', tKey: 'beeInv.catOther' },
];

const EMPTY_FORM = {
  name: '', nameNepali: '', sku: '', category: 'OTHER',
  purchasePrice: '', sellingPrice: '', stockQty: '0', reorderLevel: '2',
  description: '', badge: '', showOnWebsite: true, imageIds: [],
};

const FIELD = 'w-full min-h-[44px] px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-beekeeping-500';

export default function BeekeepingInventoryPage() {
  const { t } = useTranslation();
  const { money, num } = useLocaleFormat();
  // Mirrors the server's rules: only admins set prices (add/edit/remove products);
  // admins and managers adjust stock and see cost prices.
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const isAdmin = user.role === 'ADMIN';
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [photoItem, setPhotoItem] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // `silent` refreshes the list in place (after a stock, switch or picture change) without the spinner, so the
  // page does not jump back to the top.
  const fetchItems = async (silent = false) => {
    if (!silent) { setLoading(true); setLoadError(false); }
    try {
      const params = selectedCategory !== 'ALL' ? `?category=${selectedCategory}` : '';
      const res = await api.get(`/api/beekeeping/items${params}`);
      setItems(res.data);
    } catch {
      if (silent) setActionError(t('beeInv.failedToLoad'));
      else setLoadError(true);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, [selectedCategory]);

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setFormSuccess('');
  };
  useEscape(closeForm, showForm && !photoItem);

  const openAddForm = () => {
    setFormData(EMPTY_FORM);
    setEditingItem(null);
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const openEditForm = (item) => {
    setFormData({
      name: item.name || '',
      nameNepali: item.nameNepali || '',
      sku: item.sku || '',
      category: item.category || 'OTHER',
      purchasePrice: item.purchasePrice ?? '',
      sellingPrice: item.sellingPrice ?? '',
      stockQty: String(item.stockQty ?? 0),
      reorderLevel: String(item.reorderLevel ?? 2),
      description: item.description || '',
      badge: item.badge || '',
      showOnWebsite: item.showOnWebsite !== false,
      imageIds: item.imageIds || [],
    });
    setEditingItem(item);
    setFormError('');
    setFormSuccess('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    if (!formData.name.trim()) {
      setFormError(t('beeInv.itemNameRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        purchasePrice: formData.purchasePrice !== '' ? parseFloat(formData.purchasePrice) : null,
        sellingPrice: formData.sellingPrice !== '' ? parseFloat(formData.sellingPrice) : null,
        stockQty: parseInt(formData.stockQty, 10) || 0,
        reorderLevel: parseInt(formData.reorderLevel, 10) || 0,
      };
      // The SKU is fixed once a product exists.
      if (editingItem) delete payload.sku;
      if (editingItem) {
        await api.put(`/api/beekeeping/items/${editingItem.id}`, payload);
        setFormSuccess(t('beeInv.itemUpdated'));
      } else {
        await api.post('/api/beekeeping/items', payload);
        setFormSuccess(t('beeInv.itemAdded'));
      }
      fetchItems(true);
      setTimeout(closeForm, 1200);
    } catch (err) {
      setFormError(err.response?.data?.message || t('beeInv.failedToSave'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = async () => {
    const item = removing;
    setRemoving(null);
    try {
      await api.delete(`/api/beekeeping/items/${item.id}`);
      fetchItems(true);
    } catch (err) {
      setActionError(err.response?.data?.message || t('beeInv.failedToRemove'));
    }
  };

  // Quick actions straight from the grid: switch a product on or off the website, or change its pictures.
  const toggleLive = async (item) => {
    setActionError('');
    try {
      await api.put(`/api/beekeeping/items/${item.id}`, { showOnWebsite: item.showOnWebsite === false });
      fetchItems(true);
    } catch (err) {
      setActionError(err.response?.data?.message || t('productGrid.liveFailed'));
    }
  };

  const savePhotos = async (item, imageIds) => {
    await api.put(`/api/beekeeping/items/${item.id}`, { imageIds });
    setPhotoItem(null);
    fetchItems(true);
  };

  const adjustStock = async (item, adjustment) => {
    setActionError('');
    try {
      await api.patch(`/api/beekeeping/items/${item.id}/stock`, { adjustment });
      fetchItems(true);
    } catch (err) {
      setActionError(err.response?.data?.message || t('beeInv.failedStock'));
    }
  };

  const matchesStatus = (i, f) => {
    const st = productStatus(i);
    return f === 'ALL' || (f === 'LIVE' && st.live) || (f === 'HIDDEN' && !st.live) || (f === 'OUT' && st.out) || (f === 'NOPIC' && !st.hasPicture);
  };
  const statusCount = (f) => items.filter((i) => matchesStatus(i, f)).length;
  const visible = items.filter((i) => {
    if (!matchesStatus(i, statusFilter)) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return i.name?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s);
  });

  const categoryLabel = (value) => {
    const cat = CATEGORIES.find((c) => c.value === value);
    return cat ? t(cat.tKey) : value;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit="beekeeping" icon={Package} title={t('beeInv.title')} backTo="/entry/beekeeping">
        <BusinessTabs business="beekeeping" />
      </PageHeader>

      {isAdmin && (
        <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
          <button type="button" onClick={openAddForm}
            className="flex min-h-[44px] items-center gap-2 bg-beekeeping-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-beekeeping-700">
            <Plus className="w-5 h-5" aria-hidden="true" />
            {t('beeInv.addItem')}
          </button>
        </div>
      )}

      <div className="px-4 py-2 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((cat) => (
            <button type="button" key={cat.value} onClick={() => setSelectedCategory(cat.value)}
              aria-pressed={selectedCategory === cat.value}
              className={`min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.value ? 'bg-beekeeping-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t(cat.tKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max" role="group" aria-label={t('productGrid.status')}>
          {[['ALL', 'productGrid.all'], ['LIVE', 'productGrid.live'], ['HIDDEN', 'productGrid.hidden'], ['OUT', 'productGrid.soldOutFilter'], ['NOPIC', 'productGrid.needsPicture']].map(([f, key]) => (
            <button type="button" key={f} onClick={() => setStatusFilter(f)} aria-pressed={statusFilter === f}
              className={`min-h-[44px] px-4 rounded-full text-sm font-medium ${statusFilter === f ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t(key)} <span className="opacity-70">{statusCount(f)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            aria-label={t('beeInv.searchNameSku')} placeholder={t('beeInv.searchNameSku')}
            className="w-full min-h-[44px] pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-beekeeping-500" />
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label={t('common.close')}
            className="flex h-11 w-11 items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
      )}

      {removing && (
        <div role="alertdialog" aria-label={t('beeInv.removeConfirm', { name: removing.name })}
          className="mx-4 mt-3 rounded-xl border border-red-300 bg-white p-4 shadow">
          <p className="mb-3 text-gray-800">{t('beeInv.removeConfirm', { name: removing.name })}</p>
          <div className="flex gap-3">
            <button type="button" onClick={confirmRemove} className="min-h-[44px] flex-1 rounded-lg bg-red-600 font-bold text-white">{t('beeInv.removeYes')}</button>
            <button type="button" onClick={() => setRemoving(null)} className="min-h-[44px] flex-1 rounded-lg border-2 border-gray-300 font-bold text-gray-700">{t('beeInv.keep')}</button>
          </div>
        </div>
      )}

      {photoItem && <PhotoDialog item={photoItem} onSave={savePhotos} onClose={() => setPhotoItem(null)} />}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div role="dialog" aria-modal="true" aria-label={editingItem ? t('beeInv.editItem') : t('beeInv.addNewItem')}
            className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">{editingItem ? t('beeInv.editItem') : t('beeInv.addNewItem')}</h2>
              <button type="button" onClick={closeForm} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && <div role="alert" className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>}
              {formSuccess && <div role="status" className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center"><Check className="w-4 h-4 mr-1" />{formSuccess}</div>}

              <ImageUploader id="bee-pictures" label={t('beeInv.pictures')} value={formData.imageIds}
                onChange={(imageIds) => setFormData({ ...formData, imageIds })} />

              <div>
                <label htmlFor="bee-name" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.itemName')} *</label>
                <input id="bee-name" type="text" value={formData.name} className={FIELD}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder={t('beeInv.itemNamePlaceholder')} />
              </div>
              <div>
                <label htmlFor="bee-name-ne" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.nameNepali')}</label>
                <input id="bee-name-ne" type="text" value={formData.nameNepali} className={FIELD}
                  onChange={(e) => setFormData({ ...formData, nameNepali: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bee-sku" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.sku')}</label>
                  <input id="bee-sku" type="text" value={formData.sku} disabled={!!editingItem} className={`${FIELD} disabled:bg-gray-100`}
                    placeholder={t('beeInv.skuPlaceholder')} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="bee-category" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.category')}</label>
                  <select id="bee-category" value={formData.category} className={FIELD}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
                    {CATEGORIES.filter((c) => c.value !== 'ALL').map((cat) => (
                      <option key={cat.value} value={cat.value}>{t(cat.tKey)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bee-buy" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.purchasePrice')}</label>
                  <input id="bee-buy" type="number" step="0.01" min="0" value={formData.purchasePrice} className={FIELD}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="bee-sell" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.sellingPrice')}</label>
                  <input id="bee-sell" type="number" step="0.01" min="0" value={formData.sellingPrice} className={FIELD}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="bee-stock" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.stockQty')}</label>
                  <input id="bee-stock" type="number" min="0" value={formData.stockQty} className={FIELD}
                    onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="bee-reorder" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.reorderLevel')}</label>
                  <input id="bee-reorder" type="number" min="0" value={formData.reorderLevel} className={FIELD}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })} />
                </div>
              </div>

              <div>
                <label htmlFor="bee-badge" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.badge')}</label>
                <input id="bee-badge" type="text" value={formData.badge} className={FIELD}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })} />
              </div>
              <div>
                <label htmlFor="bee-desc" className="block text-sm font-medium text-gray-700 mb-1">{t('beeInv.description')}</label>
                <textarea id="bee-desc" value={formData.description} rows={2} className={`${FIELD} resize-none`}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>

              <label htmlFor="bee-web" className="flex min-h-[44px] items-center gap-3 text-gray-800">
                <input id="bee-web" type="checkbox" checked={formData.showOnWebsite} className="h-6 w-6"
                  onChange={(e) => setFormData({ ...formData, showOnWebsite: e.target.checked })} />
                {t('beeInv.showOnWebsite')}
              </label>

              <button type="submit" disabled={submitting}
                className={`w-full min-h-[44px] py-3 rounded-lg font-bold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-beekeeping-600 hover:bg-beekeeping-700'}`}>
                {submitting ? t('beeInv.saving') : editingItem ? t('beeInv.updateItem') : t('beeInv.addItem')}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-beekeeping-600" role="status" aria-label={t('common.loading')} />
        </div>
      ) : loadError ? (
        <div role="alert" className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-red-700">
          <p className="mb-3">{t('beeInv.failedToLoad')}</p>
          <button type="button" onClick={() => fetchItems()} className="min-h-[44px] rounded-lg bg-red-600 px-5 font-bold text-white">{t('beeDash.retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" aria-hidden="true" />
          <p className="text-lg">{t('beeInv.noItems')}</p>
          {isAdmin && (
            <button type="button" onClick={openAddForm} className="mt-4 min-h-[44px] bg-beekeeping-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-beekeeping-700">
              {t('beeInv.addFirstItem')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((item) => (
            <ProductAdminCard key={item.id} item={item} price={`${t('beeInv.sell')}: ${money(item.sellingPrice)}`} cost={item.purchasePrice != null ? `${t('beeInv.buy')}: ${money(item.purchasePrice)}` : null} categoryLabel={categoryLabel(item.category)}
              isAdmin={isAdmin} canManage={canManage} accent="bg-beekeeping-600"
              labels={{ less: t('beeInv.decreaseStock', { name: item.name }), more: t('beeInv.increaseStock', { name: item.name }), edit: t('beeInv.editItem'), remove: t('common.delete'), out: t('beeInv.outOfStockBadge'), low: t('beeInv.lowStockBadge') }}
              stockText={num(item.stockQty)}
              onPhoto={setPhotoItem} onEdit={openEditForm} onDelete={setRemoving} onStock={adjustStock} onToggleLive={toggleLive} />
          ))}
        </div>
      )}
    </div>
  );
}
