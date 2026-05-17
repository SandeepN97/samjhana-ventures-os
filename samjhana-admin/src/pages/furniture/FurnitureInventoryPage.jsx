import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Package, Plus, Edit2, Trash2, X, Check, Search, Minus } from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../components/LanguageToggle';

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

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '', nameNepali: '', sku: '', category: 'OTHER',
    purchasePrice: '', sellingPrice: '', stockQty: '0', reorderLevel: '2', description: '',
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

  const handleStockAdjust = async (item, adjustment) => {
    try {
      await api.patch(`/api/furniture/items/${item.id}/stock`, { adjustment });
      fetchItems();
    } catch (err) {
      alert('Failed to update stock');
    }
  };

  const filteredItems = items.filter(i => {
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
      <header className="bg-blue-600 text-white px-4 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button onClick={() => navigate('/entry/furniture')} className="p-2 -ml-2 rounded-full hover:bg-blue-700 transition-colors">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <Package className="w-8 h-8 ml-2" />
            <h1 className="text-xl font-bold ml-3">{t('furnitureInv.title')}</h1>
          </div>
          <LanguageToggle />
        </div>
      </header>

      {/* Actions */}
      <div className="px-4 py-3 bg-white border-b flex items-center justify-between">
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          {t('furnitureInv.addItem')}
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="px-4 py-2 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === cat.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t(cat.tKey)}
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
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.itemName')} *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder={t('furnitureInv.itemNamePlaceholder')} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.nameNepali')}</label>
                <input type="text" value={formData.nameNepali} onChange={(e) => setFormData({ ...formData, nameNepali: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder={t('furnitureInv.skuPlaceholder')}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.category')}</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500">
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
                    placeholder="0.00" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.sellingPrice')}</label>
                  <input type="number" step="0.01" min="0" value={formData.sellingPrice} onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    placeholder="0.00" className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.stockQty')}</label>
                  <input type="number" min="0" value={formData.stockQty} onChange={(e) => setFormData({ ...formData, stockQty: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.reorderLevel')}</label>
                  <input type="number" min="0" value={formData.reorderLevel} onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('furnitureInv.description')}</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2} className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none" />
              </div>

              <button type="submit" disabled={submitting}
                className={`w-full py-3 rounded-lg font-bold text-white transition-colors ${submitting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">{t('furnitureInv.noItems')}</p>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">
            {t('furnitureInv.addFirstItem')}
          </button>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {filteredItems.map((item) => {
            const isLowStock = item.stockQty <= item.reorderLevel;
            const profitMargin = item.purchasePrice && item.sellingPrice
              ? (((item.sellingPrice - item.purchasePrice) / item.purchasePrice) * 100).toFixed(0)
              : null;

            return (
              <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-800">{item.name}</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{getCategoryLabel(item.category)}</span>
                    </div>
                    {item.nameNepali && <p className="text-sm text-gray-500 mb-1">{item.nameNepali}</p>}
                    <p className="text-xs text-gray-400 mb-2">SKU: {item.sku}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{t('furnitureInv.buy')}: {formatCurrency(item.purchasePrice)}</span>
                      <span className="text-gray-800 font-medium">{t('furnitureInv.sell')}: {formatCurrency(item.sellingPrice)}</span>
                      {profitMargin && <span className="text-green-600 text-xs">+{profitMargin}%</span>}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEditForm(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Stock with +/- buttons */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleStockAdjust(item, -1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className={`text-lg font-bold px-2 min-w-[2rem] text-center ${isLowStock ? 'text-red-600' : 'text-gray-800'}`}>
                        {item.stockQty}
                      </span>
                      <button onClick={() => handleStockAdjust(item, 1)}
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-green-100 text-green-600 hover:bg-green-200">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {isLowStock && <span className="text-xs text-red-500 font-medium">{t('furnitureInv.lowStockBadge')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
