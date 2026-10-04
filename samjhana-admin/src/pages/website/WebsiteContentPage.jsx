import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Utensils, ShoppingBag, Plus, X, ChevronUp, ChevronDown, Check } from 'lucide-react';
import api from '../../utils/api';
import { PageHeader } from '../../components/brand';
import ImageUploader from '../../components/ImageUploader';
import { TABS } from './websiteSchema';

const INPUT = 'w-full min-h-[44px] rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-core-500 focus:outline-none';

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
      <fieldset className="rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-sm font-bold text-gray-700">{label}</legend>
        <div className="space-y-3">
          {field.fields.map((f) => (
            <Field key={f.name} field={f} id={`${id}-${f.name}`} value={group[f.name]} onChange={(v) => onChange({ ...group, [f.name]: v })} />
          ))}
        </div>
      </fieldset>
    );
  }

  if (field.type === 'strings') {
    const items = value || [];
    return (
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-gray-700">{label}</legend>
        <div className="space-y-2">
          {items.map((text, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={text} aria-label={`${label} ${i + 1}`} className={INPUT}
                onChange={(e) => onChange(items.map((s, j) => (j === i ? e.target.value : s)))} />
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('siteEditor.removeText', { n: i + 1 })}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"><X className="h-5 w-5" /></button>
            </div>
          ))}
        </div>
        {(!field.max || items.length < field.max) && (
          <button type="button" onClick={() => onChange([...items, ''])}
            className="mt-2 flex min-h-[44px] items-center gap-1 rounded-lg px-3 font-medium text-core-700 hover:bg-gray-100">
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
        <legend className="mb-1 text-sm font-bold text-gray-700">{label}</legend>
        <div className="space-y-3">
          {items.map((item, i) => {
            const name = item[field.itemName] || t('siteEditor.item', { n: i + 1 });
            return (
              <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-3" data-testid="list-item">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate font-medium text-gray-800">{name}</span>
                  {!field.fixed && (
                    <div className="flex shrink-0">
                      <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={t('siteEditor.moveUp', { name })}
                        className="flex h-11 w-11 items-center justify-center rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30"><ChevronUp className="h-5 w-5" /></button>
                      <button type="button" disabled={i === items.length - 1} onClick={() => move(i, i + 1)} aria-label={t('siteEditor.moveDown', { name })}
                        className="flex h-11 w-11 items-center justify-center rounded text-gray-600 hover:bg-gray-200 disabled:opacity-30"><ChevronDown className="h-5 w-5" /></button>
                      <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={t('siteEditor.removeItem', { name })}
                        className="flex h-11 w-11 items-center justify-center rounded text-red-600 hover:bg-red-50"><X className="h-5 w-5" /></button>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {field.fields.map((f) => (
                    <Field key={f.name} field={f} id={`${id}-${i}-${f.name}`} value={item[f.name]}
                      onChange={(v) => onChange(items.map((it, j) => (j === i ? { ...it, [f.name]: v } : it)))} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {!field.fixed && (!field.max || items.length < field.max) && (
          <button type="button" onClick={() => onChange([...items, Object.fromEntries(field.fields.map((f) => [f.name, blank(f)]))])}
            className="mt-2 flex min-h-[44px] items-center gap-1 rounded-lg px-3 font-medium text-core-700 hover:bg-gray-100">
            <Plus className="h-4 w-4" aria-hidden="true" /> {t('siteEditor.addItem')}
          </button>
        )}
      </fieldset>
    );
  }

  if (field.type === 'select') {
    return (
      <div>
        <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
        <select id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} className={INPUT}>
          {field.options.map((o) => <option key={o} value={o}>{t(`siteEditor.icons.${o}`)}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {field.type === 'textarea' ? (
        <textarea id={id} rows={3} value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={`${INPUT} resize-y`} />
      ) : (
        <input id={id} type={field.type === 'number' ? 'number' : 'text'} step={field.type === 'number' ? 'any' : undefined}
          inputMode={field.type === 'number' ? 'decimal' : field.type === 'url' ? 'url' : field.type === 'phone' ? 'tel' : undefined}
          value={value ?? ''} onChange={(e) => onChange(e.target.value)} className={INPUT} />
      )}
    </div>
  );
}

// These tabs belong to a business and are edited inside it (Furniture / Beekeeping → Website page).
export const BUSINESS_TAB_IDS = ['furniturePages', 'beekeepingPages'];

/**
 * The website editor. On its own it shows the shared tabs; `only` shows just those tabs (a business's own
 * "Website page" tab) and `embedded` leaves the header to the screen that hosts it.
 */
export default function WebsiteContentPage({ only = null, embedded = false }) {
  const { t } = useTranslation();
  const visibleTabs = TABS.filter((x) => (only ? only.includes(x.id) : !BUSINESS_TAB_IDS.includes(x.id)));
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const allowed = user.role === 'ADMIN' || user.role === 'MANAGER';

  const [content, setContent] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [tabId, setTabId] = useState(visibleTabs[0].id);
  const [status, setStatus] = useState({});      // key -> { state: 'dirty'|'saving'|'saved'|'error', message }
  const [newOrders, setNewOrders] = useState(0);

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
    api.get('/api/shop-orders/summary').then((res) => setNewOrders(res.data?.NEW || 0)).catch(() => {});
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

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-100 pb-20'}>
      {!embedded && <PageHeader unit="core" icon={Globe} title={t('siteEditor.title')} />}

      {!allowed ? (
        <p role="alert" className="m-4 rounded-xl bg-white p-4 text-gray-700">{t('siteEditor.noAccess')}</p>
      ) : (
        <>
          <p className="px-4 pt-4 text-gray-600">{embedded ? t('siteEditor.pageIntro') : t('siteEditor.intro')}</p>

          {!embedded && <div className="grid grid-cols-2 gap-3 px-4 py-3">
            <Link to="/restaurant-menu" className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 font-bold text-core-800 shadow-sm">
              <Utensils className="h-5 w-5" aria-hidden="true" /> {t('siteEditor.menu')}
            </Link>
            <Link to="/online-orders" className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-white px-3 py-3 font-bold text-core-800 shadow-sm">
              <ShoppingBag className="h-5 w-5" aria-hidden="true" /> {t('siteEditor.orders')}
              {newOrders > 0 && <span className="rounded-full bg-amber-500 px-2 text-xs font-bold text-white">{t('siteEditor.newOrders', { count: newOrders })}</span>}
            </Link>
          </div>}

          {visibleTabs.length > 1 && <div className="overflow-x-auto border-y bg-white px-4 py-2">
            <div className="flex min-w-max gap-2" role="tablist">
              {visibleTabs.map((x) => (
                <button type="button" role="tab" key={x.id} aria-selected={tabId === x.id} onClick={() => setTabId(x.id)}
                  className={`min-h-[44px] rounded-full px-4 text-sm font-medium ${tabId === x.id ? 'bg-core-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t(x.labelKey)}
                </button>
              ))}
            </div>
          </div>}

          {loadError ? (
            <div role="alert" className="mx-4 mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center text-red-700">
              <p className="mb-3">{t('siteEditor.failedToLoad')}</p>
              <button type="button" onClick={load} className="min-h-[44px] rounded-lg bg-red-600 px-5 font-bold text-white">{t('beeDash.retry')}</button>
            </div>
          ) : !content ? (
            <div className="flex justify-center py-20"><div className="h-10 w-10 animate-spin rounded-full border-b-2 border-core-700" role="status" aria-label={t('common.loading')} /></div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              {tab.sections.map((section) => {
                const st = status[section.key] || {};
                return (
                  <section key={section.key} aria-label={t(section.labelKey)} className="rounded-xl bg-white p-4 shadow-sm">
                    <h2 className="mb-3 text-lg font-bold text-gray-800">{t(section.labelKey)}</h2>
                    <div className="space-y-4">
                      {section.fields.map((field) => (
                        <Field key={field.name} field={field} id={`${section.key}-${field.name}`}
                          value={(content[section.key] || {})[field.name]}
                          onChange={(v) => edit(section.key, { ...(content[section.key] || {}), [field.name]: v })} />
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button type="button" disabled={st.state === 'saving'} onClick={() => save(section)}
                        className="min-h-[44px] rounded-lg bg-core-800 px-6 font-bold text-white hover:bg-core-700 disabled:bg-gray-400">
                        {st.state === 'saving' ? t('siteEditor.saving') : t('siteEditor.save')}
                      </button>
                      {st.state === 'dirty' && <span className="text-sm text-amber-700">{t('siteEditor.unsaved')}</span>}
                      {st.state === 'saved' && <span role="status" className="flex items-center gap-1 text-sm font-medium text-green-700"><Check className="h-4 w-4" aria-hidden="true" />{t('siteEditor.saved')}</span>}
                      {st.state === 'error' && <span role="alert" className="text-sm font-medium text-red-600">{st.message}</span>}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
