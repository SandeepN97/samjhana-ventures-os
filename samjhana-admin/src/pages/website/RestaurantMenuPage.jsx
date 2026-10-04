import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import ImageUploader from '../../components/ImageUploader';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import { resolveMediaUrl } from '../../utils/image';

const COURSES = [
  { value: 'ALL', tKey: 'restAdmin.courseAll' },
  { value: 'BREAKFAST', tKey: 'restAdmin.courseBreakfast' },
  { value: 'MAIN', tKey: 'restAdmin.courseMain' },
  { value: 'SNACK', tKey: 'restAdmin.courseSnack' },
  { value: 'DRINK', tKey: 'restAdmin.courseDrink' },
  { value: 'DESSERT', tKey: 'restAdmin.courseDessert' },
];
const MEALS = [
  { value: 'BREAKFAST', tKey: 'restAdmin.mealBreakfast' },
  { value: 'LUNCH', tKey: 'restAdmin.mealLunch' },
  { value: 'DINNER', tKey: 'restAdmin.mealDinner' },
];
const EMPTY = {
  name: '', nameNepali: '', description: '', price: '', veg: true, course: 'MAIN',
  mealPeriods: ['LUNCH', 'DINNER'], imageIds: [], showOnWebsite: true, available: true,
};
const FIELD = 'w-full min-h-[44px] px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-core-500';

export default function RestaurantMenuPage() {
  const { t } = useTranslation();
  const { money } = useLocaleFormat();
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const isAdmin = user.role === 'ADMIN';
  const canToggle = isAdmin || user.role === 'MANAGER';

  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState('');
  const [course, setCourse] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get('/api/restaurant/dishes');
      setDishes(res.data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(EMPTY); setFormError(''); setSaved(''); };
  const openAdd = () => { setForm(EMPTY); setEditing(null); setFormError(''); setSaved(''); setShowForm(true); };
  const openEdit = (dish) => {
    setForm({
      name: dish.name || '', nameNepali: dish.nameNepali || '', description: dish.description || '',
      price: dish.price ?? '', veg: dish.veg !== false, course: dish.course, mealPeriods: dish.mealPeriods || [],
      imageIds: dish.imageId ? [dish.imageId] : [], showOnWebsite: dish.showOnWebsite !== false, available: dish.available !== false,
    });
    setEditing(dish);
    setFormError('');
    setSaved('');
    setShowForm(true);
  };

  const toggleMeal = (meal) => {
    const has = form.mealPeriods.includes(meal);
    setForm({ ...form, mealPeriods: has ? form.mealPeriods.filter((m) => m !== meal) : [...form.mealPeriods, meal] });
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError(t('restAdmin.nameRequired')); return; }
    if (form.mealPeriods.length === 0) { setFormError(t('restAdmin.mealRequired')); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name, nameNepali: form.nameNepali, description: form.description,
        price: form.price === '' ? null : parseFloat(form.price), veg: form.veg, course: form.course,
        mealPeriods: form.mealPeriods, imageId: form.imageIds[0] || null,
        showOnWebsite: form.showOnWebsite, available: form.available,
      };
      if (editing) await api.put(`/api/restaurant/dishes/${editing.id}`, payload);
      else await api.post('/api/restaurant/dishes', payload);
      setSaved(editing ? t('restAdmin.updated') : t('restAdmin.added'));
      load();
      setTimeout(closeForm, 1000);
    } catch (err) {
      setFormError(err.response?.data?.message || t('restAdmin.failedToSave'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRemove = async () => {
    const dish = removing;
    setRemoving(null);
    try {
      await api.delete(`/api/restaurant/dishes/${dish.id}`);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || t('restAdmin.failedToRemove'));
    }
  };

  const setAvailable = async (dish, available) => {
    setActionError('');
    try {
      await api.patch(`/api/restaurant/dishes/${dish.id}/available`, { available });
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || t('restAdmin.failedToSave'));
    }
  };

  const visible = dishes.filter((d) => course === 'ALL' || d.course === course);
  const mealLabel = (m) => t(MEALS.find((x) => x.value === m)?.tKey || m);

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <PageHeader unit="core" icon={Utensils} title={t('restAdmin.title')} backTo="/website" />

      {isAdmin && (
        <div className="px-4 py-3 bg-white border-b">
          <button type="button" onClick={openAdd}
            className="flex min-h-[44px] items-center gap-2 rounded-lg bg-core-800 px-4 font-bold text-white hover:bg-core-700">
            <Plus className="h-5 w-5" aria-hidden="true" /> {t('restAdmin.addDish')}
          </button>
        </div>
      )}

      <div className="px-4 py-2 bg-white border-b overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {COURSES.map((c) => (
            <button type="button" key={c.value} onClick={() => setCourse(c.value)} aria-pressed={course === c.value}
              className={`min-h-[44px] px-4 rounded-full text-sm font-medium ${course === c.value ? 'bg-core-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {t(c.tKey)}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError('')} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
      )}

      {removing && (
        <div role="alertdialog" aria-label={t('restAdmin.removeConfirm', { name: removing.name })} className="mx-4 mt-3 rounded-xl border border-red-300 bg-white p-4 shadow">
          <p className="mb-3 text-gray-800">{t('restAdmin.removeConfirm', { name: removing.name })}</p>
          <div className="flex gap-3">
            <button type="button" onClick={confirmRemove} className="min-h-[44px] flex-1 rounded-lg bg-red-600 font-bold text-white">{t('restAdmin.removeYes')}</button>
            <button type="button" onClick={() => setRemoving(null)} className="min-h-[44px] flex-1 rounded-lg border-2 border-gray-300 font-bold text-gray-700">{t('restAdmin.keep')}</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-4">
          <div role="dialog" aria-modal="true" aria-label={editing ? t('restAdmin.editDish') : t('restAdmin.addDish')}
            className="mx-4 my-auto w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-bold text-gray-800">{editing ? t('restAdmin.editDish') : t('restAdmin.addDish')}</h2>
              <button type="button" onClick={closeForm} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded hover:bg-gray-100"><X className="h-6 w-6 text-gray-500" /></button>
            </div>
            <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto p-4">
              {formError && <div role="alert" className="rounded-lg border border-red-400 bg-red-100 px-3 py-2 text-sm text-red-700">{formError}</div>}
              {saved && <div role="status" className="flex items-center rounded-lg border border-green-400 bg-green-100 px-3 py-2 text-sm text-green-700"><Check className="mr-1 h-4 w-4" />{saved}</div>}

              <div>
                <label htmlFor="dish-name" className="mb-1 block text-sm font-medium text-gray-700">{t('restAdmin.name')} *</label>
                <input id="dish-name" type="text" value={form.name} className={FIELD} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dish-name-ne" className="mb-1 block text-sm font-medium text-gray-700">{t('restAdmin.nameNepali')}</label>
                <input id="dish-name-ne" type="text" value={form.nameNepali} className={FIELD} onChange={(e) => setForm({ ...form, nameNepali: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dish-desc" className="mb-1 block text-sm font-medium text-gray-700">{t('restAdmin.description')}</label>
                <textarea id="dish-desc" rows={2} value={form.description} className={`${FIELD} resize-none`} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="dish-price" className="mb-1 block text-sm font-medium text-gray-700">{t('restAdmin.price')}</label>
                  <input id="dish-price" type="number" min="0" step="0.01" value={form.price} className={FIELD} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="dish-course" className="mb-1 block text-sm font-medium text-gray-700">{t('restAdmin.course')}</label>
                  <select id="dish-course" value={form.course} className={FIELD} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                    {COURSES.filter((c) => c.value !== 'ALL').map((c) => <option key={c.value} value={c.value}>{t(c.tKey)}</option>)}
                  </select>
                </div>
              </div>

              <fieldset>
                <legend className="mb-1 text-sm font-medium text-gray-700">{t('restAdmin.servedAt')}</legend>
                <div className="flex flex-wrap gap-2">
                  {MEALS.map((m) => (
                    <label key={m.value} className="flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-gray-200 px-3">
                      <input type="checkbox" checked={form.mealPeriods.includes(m.value)} onChange={() => toggleMeal(m.value)} className="h-5 w-5" />
                      {t(m.tKey)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <ImageUploader id="dish-picture" single label={t('restAdmin.picture')} value={form.imageIds} onChange={(imageIds) => setForm({ ...form, imageIds })} />

              <label htmlFor="dish-veg" className="flex min-h-[44px] items-center gap-3">
                <input id="dish-veg" type="checkbox" checked={form.veg} className="h-6 w-6" onChange={(e) => setForm({ ...form, veg: e.target.checked })} />
                {t('restAdmin.veg')}
              </label>
              <label htmlFor="dish-web" className="flex min-h-[44px] items-center gap-3">
                <input id="dish-web" type="checkbox" checked={form.showOnWebsite} className="h-6 w-6" onChange={(e) => setForm({ ...form, showOnWebsite: e.target.checked })} />
                {t('restAdmin.showOnWebsite')}
              </label>
              <label htmlFor="dish-avail" className="flex min-h-[44px] items-center gap-3">
                <input id="dish-avail" type="checkbox" checked={form.available} className="h-6 w-6" onChange={(e) => setForm({ ...form, available: e.target.checked })} />
                {t('restAdmin.availableToday')}
              </label>

              <button type="submit" disabled={submitting}
                className={`min-h-[44px] w-full rounded-lg py-3 font-bold text-white ${submitting ? 'bg-gray-400' : 'bg-core-800 hover:bg-core-700'}`}>
                {submitting ? t('restAdmin.saving') : editing ? t('restAdmin.update') : t('restAdmin.addDish')}
              </button>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-core-700" role="status" aria-label={t('common.loading')} /></div>
      ) : loadError ? (
        <div role="alert" className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-red-700">
          <p className="mb-3">{t('restAdmin.failedToLoad')}</p>
          <button type="button" onClick={load} className="min-h-[44px] rounded-lg bg-red-600 px-5 font-bold text-white">{t('beeDash.retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="py-20 text-center text-gray-500">
          <Utensils className="mx-auto mb-4 h-16 w-16 opacity-50" aria-hidden="true" />
          <p className="text-lg">{t('restAdmin.noDishes')}</p>
        </div>
      ) : (
        <ul className="space-y-3 px-4 py-4">
          {visible.map((d) => (
            <li key={d.id} className="rounded-xl bg-white p-4 shadow-sm" data-testid="dish-row">
              <div className="flex items-start gap-3">
                {d.imageUrl && <img src={resolveMediaUrl(d.imageUrl)} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-sm ${d.veg ? 'bg-green-500' : 'bg-red-500'}`} role="img" aria-label={d.veg ? t('restAdmin.vegLabel') : t('restAdmin.nonVegLabel')} />
                    <h3 className="font-bold text-gray-800">{d.name}</h3>
                    {d.showOnWebsite === false && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t('restAdmin.hidden')}</span>}
                  </div>
                  {d.nameNepali && <p className="text-sm text-gray-500">{d.nameNepali}</p>}
                  <p className="mt-1 text-xs text-gray-500">{(d.mealPeriods || []).map(mealLabel).join(' · ')}{d.price != null ? ` · ${money(d.price)}` : ''}</p>
                </div>
                {isAdmin && (
                  <div className="flex">
                    <button type="button" onClick={() => openEdit(d)} aria-label={t('restAdmin.editDish')} className="flex h-11 w-11 items-center justify-center rounded-lg text-core-700 hover:bg-gray-100"><Edit2 className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setRemoving(d)} aria-label={t('common.delete')} className="flex h-11 w-11 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              {canToggle && (
                <label className="mt-2 flex min-h-[44px] items-center gap-3 text-sm text-gray-700">
                  <input type="checkbox" className="h-6 w-6" checked={d.available !== false} onChange={(e) => setAvailable(d, e.target.checked)}
                    aria-label={t('restAdmin.availableToggle', { name: d.name })} />
                  {t('restAdmin.availableToday')}
                </label>
              )}
              {!canToggle && d.available === false && <p className="mt-2 text-sm font-medium text-red-600">{t('restAdmin.soldOut')}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
