import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingCart, Plus, Trash2, Check } from 'lucide-react';
import api from '../../utils/api';
import DatePicker from '../../components/DatePicker';
import SearchableSelect from '../../components/SearchableSelect';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { PageHeader } from '../../components/brand';
import { nepalToday } from '../../utils/businessDay';
import useLocaleFormat from '../../hooks/useLocaleFormat';

// Quantity and price are kept as typed (text) so clearing a field to retype it doesn't snap back to 1.
const qtyOf = (l) => parseInt(l.quantity, 10) || 0;
const priceOf = (l) => parseFloat(l.unitPrice) || 0;

const FIELD = 'w-full min-h-[44px] px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-beekeeping-500';

export default function BeekeepingSalePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { money, num } = useLocaleFormat();
  const { toasts, showToast, removeToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [lines, setLines] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [transactionDate, setTransactionDate] = useState(nepalToday());
  const [submitting, setSubmitting] = useState(false);

  const loadProducts = () => {
    setLoading(true);
    setLoadError(false);
    api.get('/api/beekeeping/items')
      .then((res) => setProducts(res.data))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProducts(); }, []);

  const productOf = (itemId) => products.find((p) => p.id === itemId);

  const addLine = () => setLines([...lines, { itemId: '', itemName: '', quantity: '1', unitPrice: '0' }]);
  const removeLine = (index) => setLines(lines.filter((_, i) => i !== index));

  const updateLine = (index, field, value) => {
    const next = lines.map((l, i) => (i === index ? { ...l } : l));
    next[index][field] = value;
    if (field === 'itemId') {
      const p = productOf(value);
      if (p) {
        next[index].itemName = p.name;
        next[index].unitPrice = String(parseFloat(p.sellingPrice) || 0);
      }
    }
    setLines(next);
  };

  // The same product on two lines still has one stock count.
  const wanted = (itemId) => lines.filter((l) => l.itemId === itemId).reduce((s, l) => s + qtyOf(l), 0);
  const overStock = (line) => {
    const p = productOf(line.itemId);
    return !!p && wanted(line.itemId) > p.stockQty;
  };
  const anyOverStock = lines.some(overStock);

  const total = lines.reduce((sum, l) => sum + qtyOf(l) * priceOf(l), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lines.length === 0) {
      showToast(t('beeOrd.addAtLeastOne'), 'error');
      return;
    }
    if (lines.some((l) => !l.itemId || qtyOf(l) < 1)) {
      showToast(t('beeOrd.fillAllItems'), 'error');
      return;
    }
    if (anyOverStock) return;

    setSubmitting(true);
    try {
      await api.post('/api/transactions', {
        businessCode: 'beekeeping',
        transactionType: 'SALE',
        transactionDate,
        amount: total,
        notes,
        customFields: {
          customerName: customerName.trim() || t('beeOrd.walkInCustomer'),
          customerPhone: customerPhone.trim() || null,
          items: lines.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            quantity: qtyOf(l),
            unitPrice: priceOf(l),
            total: qtyOf(l) * priceOf(l),
          })),
          paymentMethod,
        },
      });
      showToast(t('beeOrd.orderSaved'), 'success');
      navigate('/beekeeping/orders');
    } catch (err) {
      showToast(err.response?.data?.message || t('beeOrd.failedToSave'), 'error', 6000);
      // Stock may have changed under us (another sale): show the real counts again.
      loadProducts();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-beekeeping-600" role="status" aria-label={t('common.loading')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit="beekeeping" icon={ShoppingCart} title={t('beeOrd.newSaleTitle')} backTo="/entry/beekeeping" />

      {loadError && (
        <div role="alert" className="mx-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{t('beeOrd.failedToLoad')}</span>
          <button type="button" onClick={loadProducts} className="min-h-[44px] rounded-lg bg-red-600 px-4 font-bold text-white">{t('beeDash.retry')}</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4 space-y-5">
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">{t('beeOrd.dateLabel')} <span className="text-red-500">*</span></label>
          <DatePicker value={transactionDate} onChange={setTransactionDate} accentColor="beekeeping" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="bee-customer" className="block text-sm font-medium text-gray-700 mb-1">{t('beeOrd.customerNameOptional')}</label>
            <input id="bee-customer" type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label htmlFor="bee-phone" className="block text-sm font-medium text-gray-700 mb-1">{t('beeOrd.customerPhone')}</label>
            <input id="bee-phone" type="tel" inputMode="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={FIELD} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-medium text-gray-700">{t('beeOrd.items')} <span className="text-red-500">*</span></span>
            <button type="button" onClick={addLine} className="flex min-h-[44px] items-center gap-1 text-beekeeping-700 font-medium">
              <Plus className="w-5 h-5" aria-hidden="true" /> {t('beeOrd.add')}
            </button>
          </div>

          {lines.length === 0 && (
            <button type="button" onClick={addLine}
              className="w-full min-h-[44px] py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-beekeeping-400">
              <Plus className="w-8 h-8 mx-auto mb-2" aria-hidden="true" />
              <p>{t('beeOrd.addItems')}</p>
            </button>
          )}

          <div className="space-y-3">
            {lines.map((l, index) => {
              const p = productOf(l.itemId);
              const over = overStock(l);
              return (
                <div key={index} className={`bg-white rounded-xl shadow-sm p-4 border ${over ? 'border-red-400' : ''}`} data-testid="sale-line">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-bold text-gray-400">#{num(index + 1)}</span>
                    <button type="button" onClick={() => removeLine(index)} aria-label={t('common.delete')}
                      className="flex h-11 w-11 items-center justify-center text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <span className="block text-sm font-medium text-gray-700 mb-1">{t('beeOrd.itemLabel')}</span>
                    <SearchableSelect
                      value={l.itemId}
                      onChange={(val) => updateLine(index, 'itemId', val)}
                      options={products.map((item) => ({
                        value: item.id,
                        label: item.name,
                        subtitle: `${t('beeOrd.stock')}: ${num(item.stockQty)}`,
                      }))}
                      placeholder={t('beeOrd.selectItem')}
                      accentColor="beekeeping"
                      className="py-2 text-base"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor={`bee-qty-${index}`} className="block text-sm font-medium text-gray-700 mb-1">{t('beeOrd.qty')}</label>
                      <input id={`bee-qty-${index}`} type="number" min="1" step="1" value={l.quantity}
                        onChange={(e) => updateLine(index, 'quantity', e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-beekeeping-500 text-center font-bold" />
                    </div>
                    <div>
                      <label htmlFor={`bee-price-${index}`} className="block text-sm font-medium text-gray-700 mb-1">{t('common.unitPrice')}</label>
                      <input id={`bee-price-${index}`} type="number" step="0.01" min="0" value={l.unitPrice}
                        onChange={(e) => updateLine(index, 'unitPrice', e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-beekeeping-500 text-center font-bold" />
                    </div>
                  </div>

                  {over && (
                    <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                      {p.stockQty <= 0 ? t('beeOrd.outOfStock') : t('beeOrd.onlyLeft', { count: p.stockQty })}
                    </p>
                  )}
                  <div className="mt-2 text-right text-sm font-bold text-gray-600">
                    {t('beeOrd.subtotal')}: {money(qtyOf(l) * priceOf(l))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {lines.length > 0 && (
          <div className="bg-gradient-to-r from-beekeeping-500 to-beekeeping-600 rounded-xl p-4 text-white">
            <p className="text-sm opacity-90">{t('beeOrd.orderTotal')}</p>
            <p className="text-3xl font-bold">{money(total)}</p>
          </div>
        )}

        <div>
          <span className="block text-lg font-medium text-gray-700 mb-2">{t('beeOrd.payment')}</span>
          <div className="grid grid-cols-2 gap-3">
            {[{ value: 'CASH', tKey: 'common.cash' }, { value: 'BANK', tKey: 'common.bank' }].map((pm) => (
              <button key={pm.value} type="button" onClick={() => setPaymentMethod(pm.value)} aria-pressed={paymentMethod === pm.value}
                className={`min-h-[44px] py-3 text-lg font-bold rounded-xl border-2 transition-all ${
                  paymentMethod === pm.value ? 'bg-beekeeping-600 text-white border-beekeeping-600' : 'bg-white text-gray-700 border-gray-300'
                }`}>
                {t(pm.tKey)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="bee-notes" className="block text-lg font-medium text-gray-700 mb-2">
            {t('common.notes')} <span className="text-gray-400 text-sm">({t('common.optional')})</span>
          </label>
          <textarea id="bee-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${FIELD} resize-none`} />
        </div>

        <button type="submit" disabled={submitting || anyOverStock}
          className={`w-full min-h-[44px] py-5 text-xl font-bold rounded-xl text-white ${
            submitting || anyOverStock ? 'bg-gray-400 cursor-not-allowed' : 'bg-beekeeping-600 hover:bg-beekeeping-700 shadow-lg'
          }`}>
          <span className="flex items-center justify-center">
            <Check className="w-6 h-6 mr-2" aria-hidden="true" />
            {submitting ? t('beeOrd.saving') : t('beeOrd.saveOrder')}
          </span>
        </button>
      </form>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
