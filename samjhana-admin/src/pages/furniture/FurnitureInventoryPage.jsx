import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, Plus, X, Check, Search } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import ImageUploader from '../../components/ImageUploader';
import BusinessTabs from '../../components/BusinessTabs';
import ProductAdminCard, { productStatus } from '../../components/ProductAdminCard';
import PhotoDialog from '../../components/PhotoDialog';

const CATEGORIES = [
  { value: 'ALL', tKey: 'furnitureInv.catAll' },
  { value: 'SOFA', tKey: 'furnitureInv.catSofa' },
  { value: 'TABLE', tKey: 'furnitureInv.catTable' },
  { value: 'CHAIR', tKey: 'furnitureInv.catChair' },
  { value: 'BED', tKey: 'furnitureInv.catBed' },
  { value: 'CABINET', tKey: 'furnitureInv.catCabinet' },
  { value: 'WARDROBE', tKey: 'furnitureInv.catWardrobe' },
  { value: 'SHELF', tKey: 'furnitureInv.catShelf' },
  { value: 'OTHER', tKey: 'furnitureInv.catOther' },
];

export default function FurnitureInventoryPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Mirrors the server's rules: only admins set prices (add/edit/remove items);
  // admins and managers adjust stock and see cost prices.
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [photoItem, setPhotoItem] = useState(null);

  const [formData, setFormData] = useState({
    name: '', nameNepali: '', sku: '', category: 'OTHER',
    purchasePrice: '', sellingPrice: '', stockQty: '0', reorderLevel: '2', description: '',
    badge: '', showOnWebsite: true, imageIds: [],
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [selectedCategory]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'ALL') params.append('category', selectedCategory);
      const res = await api.get(`/api/furniture/items?${params}`);
      setItems(res.data);
    } catch (err) {
      console.error('Failed to fetch items', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', nameNepali: '', sku: '', category: 'OTHER',
      purchasePrice: '', sellingPrice: '', stockQty: '0', reorderLevel: '2', description: '',
    badge: '', showOnWebsite: true, imageIds: [],
    });
    setEditingItem(null);
    setFormError('');
    setFormSuccess('');
  };

  const openEditForm = (item) => {
    setFormData({
      name: item.name || '',
      nameNepali: item.nameNepali || '',
      sku: item.sku || '',
      category: item.category || 'OTHER',
      purchasePrice: item.purchasePrice || '',
      sellingPrice: item.sellingPrice || '',
      stockQty: item.stockQty?.toString() || '0',
      reorderLevel: item.reorderLevel?.toString() || '2',
      description: item.description || '',
      badge: item.badge || '',
      showOnWebsite: item.showOnWebsite !== false,
      imageIds: item.imageIds || [],
    });
    setEditingItem(item);
    setShowForm(true);
    setFormError('');
    setFormSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!formData.name.trim()) {
      setFormError(t('furnitureInv.itemNameRequired'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
        sellingPrice: formData.sellingPrice ? parseFloat(formData.sellingPrice) : null,
        stockQty: parseInt(formData.stockQty) || 0,
        reorderLevel: parseInt(formData.reorderLevel) || 2,
      };

      if (editingItem) {
        await api.put(`/api/furniture/items/${editingItem.id}`, payload);
        setFormSuccess(t('furnitureInv.itemUpdated'));
      } else {
        await api.post('/api/furniture/items', payload);
        setFormSuccess(t('furnitureInv.itemAdded'));
      }

      fetchItems();
      setTimeout(() => { setShowForm(false); resetForm(); }, 1500);
    } catch (err) {
      setFormError(err.response?.data?.message || t('furnitureInv.failedToSave'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Remove ${item.name}?`)) return;
    try {
      await api.delete(`/api/furniture/items/${item.id}`);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || t('furnitureInv.failedToRemove'));
    }
  };

  // Quick actions straight from the grid: switch a piece on or off the website, or change its pictures.
  const toggleLive = async (item) => {
    try {
      await api.put(`/api/furniture/items/${item.id}`, { showOnWebsite: item.showOnWebsite === false });
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || t('productGrid.liveFailed'));
    }
  };

  const savePhotos = async (item, imageIds) => {
    await api.put(`/api/furniture/items/${item.id}`, { imageIds });
    setPhotoItem(null);
    fetchItems();
  };

  const handleStockAdjust = async (item, adjustment) => {
    try {
      await api.patch(`/api/furniture/items/${item.id}/stock`, { adjustment });
      fetchItems();
    } catch (err) {
      alert('Failed to update stock');
    }
  };

  const matchesStatus = (i, f) => {
    const st = productStatus(i);
    return f === 'ALL' || (f === 'LIVE' && st.live) || (f === 'HIDDEN' && !st.live) || (f === 'OUT' && st.out) || (f === 'NOPIC' && !st.hasPicture);
  };
  const statusCount = (f) => items.filter((i) => matchesStatus(i, f)).length;
  const filteredItems = items.filter(i => {
    if (!matchesStatus(i, statusFilter)) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return i.name?.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s);
  });

  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return `रु ${num.toLocaleString('en-IN')}`;
  };

  const getCategoryLabel = (value) => {
    const cat = CATEGORIES.find(c => c.value === value);
    return cat ? t(cat.tKey) : value;
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <PageHeader unit="furniture" icon={Package} title={t('furnitureInv.title')} backTo="/entry/furniture">
        <BusinessTabs business="furniture" />
      </PageHeader>

      {/* Actions */}
      {isAdmin && (
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-furniture-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-furniture-700"
        >
          <Plus className="w-5 h-5" />
          {t('furnitureInv.addItem')}
        </button>
      </div>
      )}

      {/* Category Filter Tabs */}
      <div className="px-4 py-2 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-furniture-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t(cat.tKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Status filter */}
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

      {/* Search */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('furnitureInv.searchNameSku')}
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-furniture-500"
          />
        </div>
      </div>

      {photoItem && <PhotoDialog item={photoItem} onSave={savePhotos} onClose={() => setPhotoItem(null)} />}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h2 className="text-lg font-bold text-gray-800">
                {editingItem ? t('furnitureInv.editItem') : t('furnitureInv.addNewItem')}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded-lg text-sm">{formError}</div>}
              {formSuccess && <div className="bg-green-100 border border-green-400 text-green-700 px-3 py-2 rounded-lg text-sm flex items-center"><Check className="w-4 h-4 mr-1" />{formSuccess}</div>}

              <ImageUploader id="furn-pictures" label={t('furnitureInv.pictures')} value={formData.imageIds}
                onChange={(imageIds) => setFormData({ ...formData, imageIds })} />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.itemName')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500"
                  placeholder={t('furnitureInv.itemNamePlaceholder')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.nameNepali')}</label>
                <input type="text" value={formData.nameNepali} onChange={(e) => setFormData({ ...formData, nameNepali: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder={t('furnitureInv.skuPlaceholder')}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.category')}</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500">
                    {CATEGORIES.filter(c => c.value !== 'ALL').map(cat => (
                      <option key={cat.value} value={cat.value}>{t(cat.tKey)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.purchasePrice')}</label>
                  <input type="number" step="0.01" min="0" value={formData.purchasePrice} onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="0.00" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.sellingPrice')}</label>
                  <input type="number" step="0.01" min="0" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="0.00" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.stockQty')}</label>
                  <input type="number" min="0" value={formData.stockQty} onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.reorderLevel')}</label>
                  <input type="number" min="0" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.description')}</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500 resize-none" />
              </div>

              <div>
                <label htmlFor="furn-badge" className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.badge')}</label>
                <input id="furn-badge" type="text" value={formData.badge} onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  className="w-full min-h-[44px] px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-furniture-500" />
              </div>

              <label htmlFor="furn-web" className="flex min-h-[44px] items-center gap-3 text-gray-800">
                <input id="furn-web" type="checkbox" checked={formData.showOnWebsite} className="h-6 w-6"
                  onChange={(e) => setFormData({ ...formData, showOnWebsite: e.target.checked })} />
                {t('furnitureInv.showOnWebsite')}
              </label>

              <button type="submit" disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-furniture-600 hover:bg-furniture-700'}`}>
                {submitting ? t('furnitureInv.saving') :
                  editingItem ? t('furnitureInv.updateItem') : t('furnitureInv.addItem')}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Item List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-furniture-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t('furnitureInv.noItems')}</p>
          {isAdmin && (
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="mt-4 bg-furniture-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-furniture-700">
              {t('furnitureInv.addFirstItem')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-3 lg:grid-cols-4">
          {filteredItems.map((item) => {
            const margin = item.purchasePrice != null && item.sellingPrice
              ? (((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(0)
              : null;
            return (
              <ProductAdminCard key={item.id} item={item} price={`${t('furnitureInv.sell')}: ${formatCurrency(item.sellingPrice)}`}
                cost={item.purchasePrice != null ? `${t('furnitureInv.buy')}: ${formatCurrency(item.purchasePrice)}` : null}
                margin={margin ? `+${margin}%` : null} categoryLabel={getCategoryLabel(item.category)}
                isAdmin={isAdmin} canManage={canManage} accent="bg-furniture-600"
                labels={{ edit: t('furnitureInv.editItem'), remove: t('common.delete'), low: t('furnitureInv.lowStockBadge') }}
                onPhoto={setPhotoItem} onEdit={openEditForm} onDelete={handleDelete} onStock={handleStockAdjust} onToggleLive={toggleLive} />
            );
          })}
        </div>
      )}
    </div>
  );
}
