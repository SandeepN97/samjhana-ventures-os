import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BarChart3, FilePlus2, Gauge, Receipt, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import api from '../../utils/api';
import LanguageToggle from '../../components/LanguageToggle';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';

const EMPTY_BILL = { periodStart: '', periodEnd: '', billedKwh: '', amountPaid: '', referenceNumber: '', notes: '' };
const money = (value) => `रु ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function EvElectricityPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toasts, showToast, removeToast } = useToast();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';
  const [bills, setBills] = useState([]);
  const [form, setForm] = useState(EMPTY_BILL);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reconciliation, setReconciliation] = useState(null);
  const [reconcilingId, setReconcilingId] = useState('');

  const loadBills = useCallback(async () => {
    setLoading(true);
    try { const response = await api.get('/api/ev/electricity-bills'); setBills(response.data || []); }
    catch (error) { showToast(error.response?.data?.message || t('evBills.loadFailed'), 'error'); }
    finally { setLoading(false); }
  }, [showToast, t]);
  useEffect(() => { loadBills(); }, [loadBills]);

  const saveBill = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      await api.post('/api/ev/electricity-bills', { ...form, billedKwh: Number(form.billedKwh), amountPaid: Number(form.amountPaid) });
      setForm(EMPTY_BILL); await loadBills(); showToast(t('evBills.saved'), 'success');
    } catch (error) { showToast(error.response?.data?.message || t('evBills.saveFailed'), 'error'); }
    finally { setSaving(false); }
  };

  const reconcile = async (id) => {
    setReconcilingId(id);
    try { const response = await api.get(`/api/ev/electricity-bills/${id}/reconciliation`); setReconciliation(response.data); }
    catch (error) { showToast(error.response?.data?.message || t('evBills.reconcileFailed'), 'error'); }
    finally { setReconcilingId(''); }
  };

  return (
    <div className="min-h-screen bg-[#f1f0e8] text-[#162019]">
      <header className="border-b border-[#162019]/10 bg-[#f8f7ef]/95 px-4 py-4 backdrop-blur-xl lg:px-8"><div className="mx-auto flex max-w-7xl items-center justify-between"><div className="flex items-center gap-3"><button onClick={() => navigate('/entry/ev')} className="grid h-11 w-11 place-items-center rounded-xl border border-[#162019]/10 bg-white"><ArrowLeft className="h-5 w-5" /></button><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#52731f]">{t('evBills.energyDesk')}</p><h1 className="text-xl font-black sm:text-2xl">{t('evBills.title')}</h1></div></div><LanguageToggle /></div></header>
      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[380px_1fr] lg:px-8">
        <aside>
          {canManage ? <form onSubmit={saveBill} className="sticky top-5 rounded-[26px] bg-[#17251e] p-5 text-white shadow-xl"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#c7f36a] text-[#17251e]"><FilePlus2 className="h-5 w-5" /></div><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c7f36a]">{t('evBills.manualEntry')}</p><h2 className="text-lg font-black">{t('evBills.addBill')}</h2></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Field label={t('evBills.periodStart')}><input required type="date" value={form.periodStart} onChange={(e) => setForm((current) => ({ ...current, periodStart: e.target.value }))} className="bill-input" /></Field><Field label={t('evBills.periodEnd')}><input required type="date" value={form.periodEnd} onChange={(e) => setForm((current) => ({ ...current, periodEnd: e.target.value }))} className="bill-input" /></Field></div><div className="mt-3 grid grid-cols-2 gap-3"><Field label={t('evBills.billedKwh')}><input required type="number" min="0.001" step="0.001" value={form.billedKwh} onChange={(e) => setForm((current) => ({ ...current, billedKwh: e.target.value }))} className="bill-input" /></Field><Field label={t('evBills.amountPaid')}><input required type="number" min="0.01" step="0.01" value={form.amountPaid} onChange={(e) => setForm((current) => ({ ...current, amountPaid: e.target.value }))} className="bill-input" /></Field></div><div className="mt-3"><Field label={t('evBills.reference')}><input value={form.referenceNumber} onChange={(e) => setForm((current) => ({ ...current, referenceNumber: e.target.value }))} className="bill-input" /></Field></div><button disabled={saving} className="mt-5 min-h-[52px] w-full rounded-xl bg-[#c7f36a] font-black text-[#17251e] disabled:opacity-40">{saving ? t('evBills.saving') : t('evBills.saveBill')}</button></form> : <div className="rounded-2xl border border-[#162019]/10 bg-white p-5 text-sm text-[#162019]/60">{t('evBills.managerOnly')}</div>}
        </aside>
        <section>
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#52731f]">{t('evBills.ledger')}</p><h2 className="mt-1 text-2xl font-black">{t('evBills.billingPeriods')}</h2></div>
          {loading ? <div className="grid min-h-[300px] place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-[#52731f]" /></div> : bills.length === 0 ? <div className="mt-4 grid min-h-[260px] place-items-center rounded-3xl border border-dashed border-[#162019]/20 bg-white/50 text-center"><div><Receipt className="mx-auto h-10 w-10 text-[#162019]/25" /><p className="mt-3 font-black">{t('evBills.noBills')}</p></div></div> : <div className="mt-4 space-y-3">{bills.map((bill) => <button key={bill.id} onClick={() => reconcile(bill.id)} className="grid min-h-[96px] w-full grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-[#162019]/10 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#52731f]/50"><div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#52731f]">{bill.periodStart} → {bill.periodEnd}</p><p className="mt-1 text-lg font-black">{bill.referenceNumber || t('evBills.neaBill')}</p><p className="text-xs text-[#162019]/45">{bill.createdByName}</p></div><div className="text-right"><p className="font-black">{Number(bill.billedKwh).toFixed(1)} kWh</p><p className="text-sm text-[#162019]/55">{money(bill.amountPaid)}</p>{reconcilingId === bill.id ? <RefreshCw className="ml-auto mt-1 h-4 w-4 animate-spin" /> : null}</div></button>)}</div>}
        </section>
      </main>
      {reconciliation ? <ReconciliationSheet data={reconciliation} t={t} onClose={() => setReconciliation(null)} /> : null}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

function Field({ label, children }) { return <label className="block"><span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-white/45">{label}</span>{children}</label>; }

function ReconciliationSheet({ data, t, onClose }) {
  const profitable = Number(data.profit) >= 0;
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-[#07100b]/75 p-3 backdrop-blur-sm sm:p-6"><div className="mx-auto max-w-3xl rounded-[30px] bg-[#f8f7ef] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#52731f]">{t('evBills.reconciliation')}</p><h2 className="mt-1 text-2xl font-black">{data.periodStart} → {data.periodEnd}</h2></div><button onClick={onClose} className="min-h-[44px] rounded-xl border border-[#162019]/10 px-4 font-black">{t('common.close')}</button></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><ReconMetric icon={Gauge} label={t('evBills.soldKwh')} value={`${data.soldKwh} kWh`} /><ReconMetric icon={Zap} label={t('evBills.billedKwh')} value={`${data.billedKwh} kWh`} /><ReconMetric icon={profitable ? TrendingUp : TrendingDown} label={t('evBills.profit')} value={money(data.profit)} accent={profitable} /><ReconMetric icon={BarChart3} label={t('evBills.margin')} value={`${data.profitPercent}%`} accent={profitable} /></div><div className="mt-5 rounded-2xl border border-[#162019]/10 bg-white p-4"><div className="flex items-center justify-between"><span className="text-sm font-bold text-[#162019]/55">{t('evBills.energyGap')}</span><span className={`text-lg font-black ${Number(data.varianceKwh) < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>{data.varianceKwh} kWh · {data.variancePercent}%</span></div></div><div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-wider text-[#162019]/45">{t('evBills.byCharger')}</p>{data.byChargePoint?.map((item) => <div key={item.chargePointCode} className="flex items-center justify-between border-b border-[#162019]/10 py-3"><div><p className="font-black">{item.chargePointCode}</p><p className="text-xs text-[#162019]/45">{item.model} · {item.sessions} {t('evBills.sessions')}</p></div><div className="text-right"><p className="font-black">{item.soldKwh} kWh</p><p className="text-xs text-[#162019]/45">{money(item.revenue)}</p></div></div>)}</div></div></div>;
}

function ReconMetric({ icon: Icon, label, value, accent }) { return <div className="rounded-2xl border border-[#162019]/10 bg-white p-4"><Icon className={`h-5 w-5 ${accent === true ? 'text-emerald-600' : accent === false ? 'text-red-600' : 'text-[#52731f]'}`} /><p className="mt-3 text-[10px] font-black uppercase tracking-wider text-[#162019]/40">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
