import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Fuel,
  Globe,
  Home,
  Image,
  LayoutGrid,
  Loader2,
  MapPin,
  Plus,
  Save,
  ShoppingBag,
  Store,
  Tags,
  Type,
  Utensils,
  Wrench,
  X,
} from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import ImageUploader from '../../components/ImageUploader';
import useLocaleFormat from '../../hooks/useLocaleFormat';
import { TABS } from './websiteSchema';

const INPUT = 'w-full min-h-[48px] rounded-xl border border-slate-500 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-600 focus:border-core-600 focus:ring-4 focus:ring-core-100';

const TAB_ICONS = {
  contact: MapPin,
  home: Home,
  services: Fuel,
  restaurant: Utensils,
  shop: Store,
  brand: Type,
  shopPage: ShoppingBag,
  furniturePages: LayoutGrid,
  beekeepingPages: Tags,
};

const SECTION_ICONS = {
  contact: MapPin,
  hours: Clock3,
  hub: LayoutGrid,
  trust: Check,
  featured: Image,
  fuelEv: Fuel,
  bike: Wrench,
  restaurant: Utensils,
  shop: Store,
  identity: Type,
  shopHub: ShoppingBag,
  furniture: LayoutGrid,
  beekeeping: Tags,
};

const fieldWidth = (field) => (
  ['textarea', 'image', 'group', 'list', 'strings'].includes(field.type) ? 'lg:col-span-2' : ''
);

/** A blank value for a field, so a new list item starts empty rather than undefined. */
function blank(field) {
  switch (field.type) {
    case 'group': return Object.fromEntries(field.fields.map((f) => [f.name, blank(f)]));
    case 'list':
    case 'strings': return [];
    default: return '';
  }
}

/** What the server stores: number fields become numbers (or nothing when empty); everything else stays as typed. */
export function normalize(value, fields) {
  const out = { ...value };
  for (const f of fields) {
    const v = out[f.name];
    if (f.type === 'number') {
      out[f.name] = v === '' || v === null || v === undefined ? null : Number(v);
    } else if (f.type === 'group') {
      out[f.name] = normalize(v || {}, f.fields);
    } else if (f.type === 'list') {
      out[f.name] = (v || []).map((item) => normalize(item, f.fields));
    } else if (f.type === 'strings') {
      out[f.name] = (v || []).map((s) => String(s).trim()).filter(Boolean);
    }
  }
  return out;
}

function Field({ field, value, onChange, id }) {
  const { t } = useTranslation();
  const label = t(field.labelKey);

  if (field.type === 'image') {
    return <ImageUploader id={id} single label={label} value={value ? [value] : []} onChange={(ids) => onChange(ids[0] || '')} />;
  }

  if (field.type === 'group') {
    const group = value || {};
    return (
      <fieldset className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200 sm:p-5">
        <legend className="px-2 text-sm font-bold text-slate-800">{label}</legend>
        <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
          {field.fields.map((f) => (
            <div key={f.name} className={fieldWidth(f)}>
              <Field field={f} id={`${id}-${f.name}`} value={group[f.name]} onChange={(v) => onChange({ ...group, [f.name]: v })} />
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === 'strings') {
    const items = value || [];
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-700">{label}</legend>
        {items.length === 0 && <p className="mb-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{t('siteEditor.emptyList')}</p>}
        <div className="space-y-2">
          {items.map((text, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={text} aria-label={`${label} ${i + 1}`} className={INPUT}
                onChange={(e) => onChange(items.map((s, j) => (j === i ? e.target.value : s)))} />
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('siteEditor.removeText', { n: i + 1 })}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><X className="h-5 w-5" /></button>
            </div>
          ))}
        </div>
        {(!field.max || items.length < field.max) && (
          <button type="button" onClick={() => onChange([...items, ''])}
            className="mt-2 flex min-h-[44px] items-center gap-2 rounded-xl px-3 font-semibold text-core-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('siteEditor.addText')}
          </button>
        )}
      </fieldset>
    );
  }

  if (field.type === 'list') {
    const items = value || [];
    const move = (from, to) => {
      const next = [...items];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      onChange(next);
    };
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-slate-800">{label}</legend>
        {items.length === 0 && <p className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{t('siteEditor.emptyList')}</p>}
        <div className="space-y-3">
          {items.map((item, i) => {
            const name = item[field.itemName] || t('siteEditor.item', { n: i + 1 });
            return (
              <div key={i} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200" data-testid="list-item">
                <div className="mb-4 flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
                  <span className="flex min-w-0 items-center gap-2.5 font-semibold text-slate-800">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-bold text-slate-500 ring-1 ring-slate-200">{i + 1}</span>
                    <span className="truncate">{name}</span>
                  </span>
                  {!field.fixed && (
                    <div className="flex shrink-0 gap-1">
                      <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t('siteEditor.moveUp', { name })}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 disabled:opacity-30"><ChevronUp className="h-5 w-5" /></button>
                      <button type="button" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={t('siteEditor.moveDown', { name })}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 disabled:opacity-30"><ChevronDown className="h-5 w-5" /></button>
                      <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('siteEditor.removeItem', { name })}
                        className="flex h-11 w-11 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"><X className="h-5 w-5" /></button>
                    </div>
                  )}
                </div>
                <div className="grid gap-x-5 gap-y-4 lg:grid-cols-2">
                  {field.fields.map((f) => (
                    <div key={f.name} className={fieldWidth(f)}>
                      <Field field={f} id={`${id}-${i}-${f.name}`} value={item[f.name]}
                        onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, [f.name]: v } : it)))} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!field.fixed && (!field.max || items.length < field.max) && (
          <button type="button" onClick={() => onChange([...items, Object.fromEntries(field.fields.map((f) => [f.name, blank(f)]))])}
            className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl px-3 font-semibold text-core-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('siteEditor.addItem')}
          </button>
        )}
      </fieldset>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
        <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className={INPUT}>
          {field.options.map((o) => <option key={o} value={o}>{t(`siteEditor.icons.${o}`)}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      {field.type === 'textarea' ? (
        <textarea id={id} rows={4} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${INPUT} resize-y leading-relaxed`} />
      ) : (
        <input id={id} type={field.type === 'number' ? 'number' : 'text'} step={field.type === 'number' ? 'any' : undefined}
          inputMode={field.type === 'number' ? 'decimal' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : undefined}
          value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      )}
    </div>
  );
}

// These tabs belong to a business and are edited inside it (Furniture / Beekeeping → Website page).
const BUSINESS_TAB_IDS = ['furniturePages', 'beekeepingPages'];

/**
 * The website editor. On its own it shows the shared tabs; `only` shows just those tabs (a business's own
 * "Website page" tab) and `embedded` leaves the header to the screen that hosts it.
 */
export default function WebsiteContentPage({ only = null, embedded = false }) {
  const { t } = useTranslation();
  const { num } = useLocaleFormat();
  const visibleTabs = TABS.filter((x) => (only ? only.includes(x.id) : !BUSINESS_TAB_IDS.includes(x.id)));
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const allowed = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [tabId, setTabId] = useState(visibleTabs[0].id);
  const [status, setStatus] = useState({});      // key -> { state: 'dirty'|'saving'|'saved'|'error', message }

  const load = async () => {
    setLoadError(false);
    try {
      const res = await api.get('/api/site-content');
      setContent(res.data);
    } catch {
      setLoadError(true);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed]);

  const edit = (key, value) => {
    setContent((c) => ({ ...c, [key]: value }));
    setStatus((s) => ({ ...s, [key]: { state: 'dirty' } }));
  };

  const save = async (section) => {
    setStatus((s) => ({ ...s, [section.key]: { state: 'saving' } }));
    try {
      const res = await api.put(`/api/site-content/${section.key}`, normalize(content[section.key] || {}, section.fields));
      setContent((c) => ({ ...c, [section.key]: res.data.value }));
      setStatus((s) => ({ ...s, [section.key]: { state: 'saved' } }));
    } catch (err) {
      setStatus((s) => ({ ...s, [section.key]: { state: 'error', message: err.response?.data?.message || t('siteEditor.failedToSave') } }));
    }
  };

  const tab = visibleTabs.find((x) => x.id === tabId) || visibleTabs[0];
  const ActiveTabIcon = TAB_ICONS[tab.id] || Globe;

  return (
    <div className={embedded ? '' : 'min-h-screen bg-slate-100 pb-24'}>
      {!embedded && <PageHeader unit="core" icon={Globe} title={t('siteEditor.title')} />}

      {!allowed ? (
        <p role="alert" className="mx-auto mt-6 max-w-3xl rounded-2xl bg-white p-5 text-slate-700 shadow-sm ring-1 ring-slate-200">{t('siteEditor.noAccess')}</p>
      ) : (
        <main className={`mx-auto w-full ${embedded ? '' : 'max-w-7xl px-4 pt-5 sm:px-6'}`}>
          <div className={`${embedded ? 'px-4 pt-4 sm:px-6' : ''}`}>
            <div className="overflow-hidden rounded-2xl bg-[#f7f3ed] shadow-sm ring-1 ring-[#e4daca]">
              <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e9efdf] text-[#6f591e] ring-1 ring-[#d7ddcb]">
                    <Globe className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <p className="max-w-3xl pt-1 text-sm leading-6 text-[#5f5548] sm:text-base">
                    {embedded ? t('siteEditor.pageIntro') : t('siteEditor.intro')}
                  </p>
                </div>

                {!embedded && (
                  <Link to="/restaurant-menu" className="group flex min-h-[64px] items-center gap-3 rounded-xl bg-white px-4 py-2.5 font-bold text-core-800 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-800"><Utensils className="h-5 w-5" aria-hidden="true" /></span>
                    <span><span className="block text-sm">{t('siteEditor.menu')}</span><span className="mt-0.5 block text-xs font-medium text-slate-500">{t('siteEditor.menuHint')}</span></span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className={`${embedded ? 'px-4 sm:px-6' : ''} mt-5 lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start lg:gap-6`}>
            {visibleTabs.length > 1 && <aside className="mb-4 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4 lg:mb-0 lg:p-3">
              <p className="hidden px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400 lg:block">{t('siteEditor.editArea')}</p>
              <nav className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label={t('siteEditor.editArea')}>
                {visibleTabs.map((x) => {
                  const TabIcon = TAB_ICONS[x.id] || Globe;
                  const selected = tabId === x.id;
                  return (
                    <button type="button" key={x.id} aria-pressed={selected} onClick={() => setTabId(x.id)}
                      className={`flex min-h-[48px] min-w-max items-center gap-3 rounded-xl px-3.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 lg:w-full ${selected ? 'bg-core-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
                      <TabIcon className={`h-5 w-5 shrink-0 ${selected ? 'text-amber-300' : 'text-slate-400'}`} aria-hidden="true" />
                      <span>{t(x.labelKey)}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>}

            <div className="min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3 px-1">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-900"><ActiveTabIcon className="h-5 w-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-slate-900">{t(tab.labelKey)}</h2>
                    <p className="text-sm text-slate-500">{t('siteEditor.sectionCount', { count: tab.sections.length, formattedCount: num(tab.sections.length) })}</p>
                  </div>
                </div>
              </div>

              {loadError ? (
                <div role="alert" className="rounded-2xl bg-red-50 px-5 py-8 text-center text-red-800 ring-1 ring-red-200">
                  <AlertTriangle className="mx-auto mb-3 h-8 w-8" aria-hidden="true" />
                  <p className="mb-4 font-semibold">{t('siteEditor.failedToLoad')}</p>
                  <button type="button" onClick={load} className="min-h-[44px] rounded-xl bg-red-700 px-5 font-bold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2">{t('beeDash.retry')}</button>
                </div>
              ) : !content ? (
                <div className="space-y-4" role="status" aria-label={t('common.loading')}>
                  {[0, 1].map((item) => (
                    <div key={item} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                      <div className="h-16 animate-pulse bg-slate-100" />
                      <div className="grid gap-4 p-5 sm:grid-cols-2"><div className="h-12 animate-pulse rounded-xl bg-slate-100" /><div className="h-12 animate-pulse rounded-xl bg-slate-100" /><div className="h-24 animate-pulse rounded-xl bg-slate-100 sm:col-span-2" /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {tab.sections.map((section) => {
                    const st = status[section.key] || {};
                    const SectionIcon = SECTION_ICONS[section.key] || LayoutGrid;
                    return (
                      <section key={section.key} aria-label={t(section.labelKey)} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-5 py-4 sm:px-6">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-200"><SectionIcon className="h-5 w-5" aria-hidden="true" /></span>
                            <h3 className="truncate text-lg font-bold text-slate-900">{t(section.labelKey)}</h3>
                          </div>
                          {st.state === 'dirty' && <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{t('siteEditor.unsaved')}</span>}
                          {st.state === 'saved' && <span role="status" className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800"><Check className="h-3.5 w-3.5" aria-hidden="true" />{t('siteEditor.saved')}</span>}
                        </div>
                        <div className="grid gap-x-5 gap-y-5 p-5 sm:p-6 lg:grid-cols-2">
                          {section.fields.map((field) => (
                            <div key={field.name} className={fieldWidth(field)}>
                              <Field field={field} id={`${section.key}-${field.name}`}
                                value={(content[section.key] || {})[field.name]}
                                onChange={(v) => edit(section.key, { ...(content[section.key] || {}), [field.name]: v })} />
                            </div>
                          ))}
                        </div>
                        <div className="flex min-h-[72px] flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
                          <button type="button" disabled={st.state === 'saving'} onClick={() => save(section)}
                            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-core-900 px-6 font-bold text-white transition hover:bg-core-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400">
                            {st.state === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                            {st.state === 'saving' ? t('siteEditor.saving') : t('siteEditor.save')}
                          </button>
                          {st.state === 'error' && <span role="alert" className="text-sm font-semibold text-red-700">{st.message}</span>}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
