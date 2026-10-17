import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CakeSlice,
  Check,
  ChevronDown,
  Coffee,
  Cookie,
  CupSoda,
  Edit2,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  Utensils,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import ChipSlider from '../../components/ChipSlider';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import ImageUploader from '../../components/ImageUploader';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import { resolveMediaUrl } from '../../utils/image';

const COURSES = [
  { value: 'ALL', tKey: 'restAdmin.courseAll', icon: Utensils },
  { value: 'BREAKFAST', tKey: 'restAdmin.courseBreakfast', icon: Coffee },
  { value: 'MAIN', tKey: 'restAdmin.courseMain', icon: UtensilsCrossed },
  { value: 'SNACK', tKey: 'restAdmin.courseSnack', icon: Cookie },
  { value: 'DRINK', tKey: 'restAdmin.courseDrink', icon: CupSoda },
  { value: 'DESSERT', tKey: 'restAdmin.courseDessert', icon: CakeSlice },
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
const FIELD = 'w-full min-h-[48px] rounded-xl border border-slate-500 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-600 focus:border-core-600 focus:ring-4 focus:ring-core-100';

export default function RestaurantMenuPage() {
  const { t } = useTranslation();
  const { money, num } = useLocaleFormat();
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const isAdmin = user.role === 'ADMIN';
  const canToggle = isAdmin || user.role === 'MANAGER';

  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [updatingAvailability, setUpdatingAvailability] = useState({});
  const [course, setCourse] = useState('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pageRef = useRef(null);
  const dialogRef = useRef(null);
  const nameInputRef = useRef(null);
  const previousFocusRef = useRef(null);

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

  useEffect(() => {
    if (!showForm) return undefined;
    const background = pageRef.current;
    const previousOverflow = document.body.style.overflow;
    background?.setAttribute('inert', '');
    background?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => {
      background?.removeAttribute('inert');
      background?.removeAttribute('aria-hidden');
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm]);

  const rememberFocus = () => { previousFocusRef.current = document.activeElement; };
  const closeForm = () => {
    const focusTarget = previousFocusRef.current;
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setSaved('');
    window.requestAnimationFrame(() => focusTarget?.focus());
  };
  const openAdd = () => { rememberFocus(); setForm(EMPTY); setEditing(null); setFormError(''); setSaved(''); setShowForm(true); };
  const openEdit = (dish) => {
    rememberFocus();
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
    setActionError(null);
    try {
      await api.delete(`/api/restaurant/dishes/${dish.id}`);
      load();
    } catch (err) {
      setActionError({ dishId: dish.id, message: err.response?.data?.message || t('restAdmin.failedToRemove') });
    }
  };

  const setAvailable = async (dish, available) => {
    if (updatingAvailability[dish.id]) return;
    setActionError(null);
    setUpdatingAvailability((items) => ({ ...items, [dish.id]: true }));
    try {
      await api.patch(`/api/restaurant/dishes/${dish.id}/available`, { available });
      setDishes((items) => items.map((item) => (item.id === dish.id ? { ...item, available } : item)));
    } catch (err) {
      setActionError({ dishId: dish.id, message: err.response?.data?.message || t('restAdmin.failedToSave') });
    } finally {
      setUpdatingAvailability((items) => {
        const next = { ...items };
        delete next[dish.id];
        return next;
      });
    }
  };

  const handleDialogKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeForm();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const visible = dishes.filter((d) => course === 'ALL' || d.course === course);
  const availableCount = dishes.filter((d) => d.available !== false).length;
  const websiteCount = dishes.filter((d) => d.showOnWebsite !== false).length;
  const mealLabel = (m) => t(MEALS.find((x) => x.value === m)?.tKey || m);
  const courseLabel = (value) => t(COURSES.find((x) => x.value === value)?.tKey || value);
  const selectedCourseCount = course === 'ALL' ? dishes.length : dishes.filter((dish) => dish.course === course).length;

  return (
    <div ref={pageRef} className="min-h-screen bg-slate-100 pb-24">
      <PageHeader unit="core" icon={Utensils} title={t('restAdmin.title')} backTo="/website" />

      <main className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6">
        <section className="overflow-hidden rounded-2xl bg-[#f7f3ed] ring-1 ring-[#e4daca]" aria-labelledby="menu-overview-title">
          <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e9efdf] text-[#6f591e] ring-1 ring-[#d7ddcb]">
                <Utensils className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="menu-overview-title" className="text-lg font-bold text-slate-900">{t('restAdmin.overviewTitle')}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[#5f5548]">{t('restAdmin.intro')}</p>
                {!loading && !loadError && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-slate-700" aria-label={t('restAdmin.overviewTitle')}>
                    <span>{t('restAdmin.dishCount', { count: dishes.length, formattedCount: num(dishes.length) })}</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />{t('restAdmin.availableSummary', { formattedCount: num(availableCount) })}</span>
                    <span className="flex items-center gap-1.5"><Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />{t('restAdmin.websiteSummary', { formattedCount: num(websiteCount) })}</span>
                  </div>
                )}
              </div>
            </div>

            {isAdmin && (
              <button type="button" onClick={openAdd}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-core-900 px-5 font-bold text-white transition hover:bg-core-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 lg:min-w-[150px]">
                <Plus className="h-5 w-5" aria-hidden="true" /> {t('restAdmin.addDish')}
              </button>
            )}
          </div>
        </section>

        <section className="mt-5 rounded-2xl bg-white p-3 ring-1 ring-slate-200 sm:p-4" aria-labelledby="current-menu-title">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <h2 id="current-menu-title" className="text-lg font-bold text-slate-900">{t('restAdmin.currentMenu')}</h2>
            {!loading && !loadError && <p className="text-sm text-slate-500">{t('restAdmin.showingCount', { shown: num(visible.length), total: num(dishes.length) })}</p>}
          </div>
          <ChipSlider
            className="md:hidden"
            label={t('restAdmin.filterLabel')}
            value={course}
            onChange={setCourse}
            items={COURSES.map((c) => ({
              value: c.value,
              label: t(c.tKey),
              icon: c.icon,
              count: num(c.value === 'ALL' ? dishes.length : dishes.filter((dish) => dish.course === c.value).length),
            }))}
          />
          <nav className="hidden md:block" aria-label={t('restAdmin.filterLabel')}>
            <div className="flex min-w-max gap-2">
              {COURSES.map((c) => {
                const count = c.value === 'ALL' ? dishes.length : dishes.filter((dish) => dish.course === c.value).length;
                const selected = course === c.value;
                return (
                  <button type="button" key={c.value} onClick={() => setCourse(c.value)} aria-pressed={selected}
                    className={`flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 ${selected ? 'bg-core-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}>
                    {t(c.tKey)}
                    <span aria-hidden="true" className={`rounded-full px-2 py-0.5 text-xs ${selected ? 'bg-white/15 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200'}`}>{num(count)}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </section>

      {showForm && createPortal(
        <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/60 sm:items-center sm:p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={editing ? t('restAdmin.editDish') : t('restAdmin.addDish')}
            onKeyDown={handleDialogKeyDown}
            className="w-full max-w-3xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#e4daca] bg-[#f7f3ed] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9efdf] text-[#6f591e]"><Utensils className="h-5 w-5" aria-hidden="true" /></span>
                <h2 className="text-xl font-bold text-slate-900">{editing ? t('restAdmin.editDish') : t('restAdmin.addDish')}</h2>
              </div>
              <button type="button" onClick={closeForm} aria-label={t('common.close')} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500"><X className="h-6 w-6" /></button>
            </div>
            <form onSubmit={submit} className="max-h-[calc(100vh-5.5rem)] overflow-y-auto sm:max-h-[calc(100vh-8rem)]">
              <div className="grid gap-x-5 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
              {formError && <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 ring-1 ring-red-200 sm:col-span-2"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />{formError}</div>}
              {saved && <div role="status" className="flex items-center rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 sm:col-span-2"><Check className="mr-2 h-5 w-5" aria-hidden="true" />{saved}</div>}

              <div>
                <label htmlFor="dish-name" className="mb-1.5 block text-sm font-semibold text-slate-700">{t('restAdmin.name')} *</label>
                <input ref={nameInputRef} id="dish-name" type="text" value={form.name} className={FIELD} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dish-name-ne" className="mb-1.5 block text-sm font-semibold text-slate-700">{t('restAdmin.nameNepali')}</label>
                <input id="dish-name-ne" type="text" value={form.nameNepali} className={FIELD} onChange={(e) => setForm({ ...form, nameNepali: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="dish-desc" className="mb-1.5 block text-sm font-semibold text-slate-700">{t('restAdmin.description')}</label>
                <textarea id="dish-desc" rows={3} value={form.description} className={`${FIELD} resize-y leading-relaxed`} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dish-price" className="mb-1.5 block text-sm font-semibold text-slate-700">{t('restAdmin.price')}</label>
                <input id="dish-price" type="number" min="0" step="0.01" value={form.price} className={FIELD} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label htmlFor="dish-course" className="mb-1.5 block text-sm font-semibold text-slate-700">{t('restAdmin.course')}</label>
                <select id="dish-course" value={form.course} className={FIELD} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                  {COURSES.filter((c) => c.value !== 'ALL').map((c) => <option key={c.value} value={c.value}>{t(c.tKey)}</option>)}
                </select>
              </div>

              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm font-semibold text-slate-700">{t('restAdmin.servedAt')}</legend>
                <div className="flex flex-wrap gap-2">
                  {MEALS.map((m) => (
                    <label key={m.value} className={`flex min-h-[46px] items-center gap-2 rounded-xl border px-3.5 font-medium transition ${form.mealPeriods.includes(m.value) ? 'border-core-700 bg-core-50 text-core-900' : 'border-slate-400 bg-white text-slate-700 hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={form.mealPeriods.includes(m.value)} onChange={() => toggleMeal(m.value)} className="h-5 w-5 accent-core-800" />
                      {t(m.tKey)}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="sm:col-span-2"><ImageUploader id="dish-picture" single label={t('restAdmin.picture')} value={form.imageIds} onChange={(imageIds) => setForm({ ...form, imageIds })} /></div>

              <div className="grid gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200 sm:col-span-2 sm:grid-cols-3">
                <label htmlFor="dish-veg" className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 font-medium text-slate-800 hover:bg-white">
                  <input id="dish-veg" type="checkbox" checked={form.veg} className="h-5 w-5 accent-core-800" onChange={(e) => setForm({ ...form, veg: e.target.checked })} />
                  {t('restAdmin.veg')}
                </label>
                <label htmlFor="dish-web" className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 font-medium text-slate-800 hover:bg-white">
                  <input id="dish-web" type="checkbox" checked={form.showOnWebsite} className="h-5 w-5 accent-core-800" onChange={(e) => setForm({ ...form, showOnWebsite: e.target.checked })} />
                  {t('restAdmin.showOnWebsite')}
                </label>
                <label htmlFor="dish-avail" className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 font-medium text-slate-800 hover:bg-white">
                  <input id="dish-avail" type="checkbox" checked={form.available} className="h-5 w-5 accent-core-800" onChange={(e) => setForm({ ...form, available: e.target.checked })} />
                  {t('restAdmin.availableToday')}
                </label>
              </div>
              </div>

              <div className="sticky bottom-0 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex sm:justify-end sm:px-6">
                <button type="submit" disabled={submitting}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-core-900 px-6 font-bold text-white transition hover:bg-core-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto sm:min-w-[170px]">
                  {submitting && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                  {submitting ? t('restAdmin.saving') : editing ? t('restAdmin.update') : t('restAdmin.addDish')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {loading ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label={t('common.loading')}>
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />)}
        </div>
      ) : loadError ? (
        <div role="alert" className="mt-5 rounded-2xl bg-red-50 px-5 py-8 text-center text-red-800 ring-1 ring-red-200">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
          <p className="mb-4 font-semibold">{t('restAdmin.failedToLoad')}</p>
          <button type="button" onClick={load} className="min-h-[44px] rounded-xl bg-red-700 px-5 font-bold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">{t('beeDash.retry')}</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="mt-5 rounded-2xl bg-white px-5 py-16 text-center text-slate-600 ring-1 ring-slate-200">
          <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-50 text-amber-900"><Utensils className="h-7 w-7" aria-hidden="true" /></span>
          <p className="text-lg font-semibold text-slate-800">{t('restAdmin.noDishes')}</p>
          {isAdmin && <button type="button" onClick={openAdd} className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-core-900 px-5 font-bold text-white hover:bg-core-800"><Plus className="h-5 w-5" aria-hidden="true" />{t('restAdmin.addDish')}</button>}
        </div>
      ) : (
        <ul className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((d) => (
            <li key={d.id} className="flex min-h-[230px] flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200" data-testid="dish-row">
              <div className="flex flex-1 gap-4 p-5">
                {d.imageUrl && <img src={resolveMediaUrl(d.imageUrl)} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-slate-900">{d.name}</h3>
                      {d.nameNepali && <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{d.nameNepali}</p>}
                    </div>
                    <span className={`shrink-0 font-bold tabular-nums ${d.price == null ? 'text-sm text-slate-500' : 'text-slate-900'}`}>
                      {d.price != null ? money(d.price) : t('restAdmin.priceNotSet')}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${d.veg ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                      <span className={`h-2 w-2 rounded-sm ${d.veg ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
                      {d.veg ? t('restAdmin.vegLabel') : t('restAdmin.nonVegLabel')}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-900">{courseLabel(d.course)}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${d.showOnWebsite === false ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-800'}`}>
                      {d.showOnWebsite === false ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                      {d.showOnWebsite === false ? t('restAdmin.hidden') : t('restAdmin.onWebsite')}
                    </span>
                  </div>

                  {d.description && <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">{d.description}</p>}
                  <p className="mt-3 text-sm font-medium text-slate-500">{(d.mealPeriods || []).map(mealLabel).join(' · ')}</p>
                </div>
              </div>

              {actionError?.dishId === d.id && (
                <div role="alert" className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-800 ring-1 ring-red-200">
                  <span className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />{actionError.message}</span>
                  <button type="button" onClick={() => setActionError(null)} aria-label={t('common.close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><X className="h-5 w-5" /></button>
                </div>
              )}

              {removing?.id === d.id && (
                <div role="alertdialog" aria-label={t('restAdmin.removeConfirm', { name: d.name })} className="border-t border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-red-900">{t('restAdmin.removeConfirm', { name: d.name })}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={confirmRemove} className="min-h-[44px] flex-1 rounded-xl bg-red-700 px-3 font-bold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2">{t('restAdmin.removeYes')}</button>
                    <button type="button" onClick={() => setRemoving(null)} className="min-h-[44px] flex-1 rounded-xl border border-slate-500 bg-white px-3 font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">{t('restAdmin.keep')}</button>
                  </div>
                </div>
              )}

              <div className="flex min-h-[64px] items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2">
                {canToggle ? (
                  <label className={`flex min-h-[44px] items-center gap-2.5 text-sm font-semibold text-slate-700 ${updatingAvailability[d.id] ? 'cursor-wait opacity-70' : 'cursor-pointer'}`}>
                    <input type="checkbox" className="peer sr-only" checked={d.available !== false} onChange={(e) => setAvailable(d, e.target.checked)}
                      disabled={Boolean(updatingAvailability[d.id])}
                      aria-label={t('restAdmin.availableToggle', { name: d.name })} />
                    <span aria-hidden="true" className="relative h-6 w-11 rounded-full bg-slate-400 transition peer-checked:bg-emerald-600 peer-disabled:opacity-70 peer-focus-visible:ring-2 peer-focus-visible:ring-core-500 peer-focus-visible:ring-offset-2 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:after:translate-x-5" />
                    {updatingAvailability[d.id] ? (
                      <span role="status" className="flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t('restAdmin.saving')}</span>
                    ) : (
                      <span>{d.available !== false ? t('restAdmin.availableToday') : t('restAdmin.soldOut')}</span>
                    )}
                  </label>
                ) : (
                  <p className={`flex min-h-[44px] items-center gap-2 text-sm font-semibold ${d.available === false ? 'text-red-700' : 'text-emerald-700'}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${d.available === false ? 'bg-red-500' : 'bg-emerald-500'}`} aria-hidden="true" />
                    {d.available === false ? t('restAdmin.soldOut') : t('restAdmin.availableToday')}
                  </p>
                )}
                {isAdmin && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => openEdit(d)} aria-label={t('restAdmin.editDish')} className="flex h-11 w-11 items-center justify-center rounded-xl text-core-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500"><Edit2 className="h-5 w-5" /></button>
                    <button type="button" onClick={() => setRemoving(d)} aria-label={t('common.delete')} className="flex h-11 w-11 items-center justify-center rounded-xl text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"><Trash2 className="h-5 w-5" /></button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      </main>
    </div>
  );
}
