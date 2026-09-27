import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, FilePlus2, Gauge, Receipt, RefreshCw, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import api from '../../utils/api';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { Button, Card, PageHeader } from '../../components/brand';

const EMPTY_BILL = { periodStart: '', periodEnd: '', billedKwh: '', amountPaid: '', referenceNumber: '', notes: '' };
const money = (value) => `रु ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function EvElectricityPage() {
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
    <div className="min-h-screen bg-gray-100 pb-8">
      <PageHeader unit="ev" icon={Zap} title={t('evBills.title')} subtitle={t('evBills.energyDesk')} backTo="/entry/ev" />
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[380px_1fr] lg:px-8">
        <aside>
          {canManage ? (
            <Card as="form" onSubmit={saveBill} className="lg:sticky lg:top-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-ev-100 text-ev-700"><FilePlus2 className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-semibold text-ev-700">{t('evBills.manualEntry')}</p>
                  <h2 className="text-lg font-bold text-gray-800">{t('evBills.addBill')}</h2>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Field label={t('evBills.periodStart')}><input required type="date" value={form.periodStart} onChange={(e) => setForm((current) => ({ ...current, periodStart: e.target.value }))} className="bill-input" /></Field>
                <Field label={t('evBills.periodEnd')}><input required type="date" value={form.periodEnd} onChange={(e) => setForm((current) => ({ ...current, periodEnd: e.target.value }))} className="bill-input" /></Field>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label={t('evBills.billedKwh')}><input required type="number" min="0.001" step="0.001" value={form.billedKwh} onChange={(e) => setForm((current) => ({ ...current, billedKwh: e.target.value }))} className="bill-input" /></Field>
                <Field label={t('evBills.amountPaid')}><input required type="number" min="0.01" step="0.01" value={form.amountPaid} onChange={(e) => setForm((current) => ({ ...current, amountPaid: e.target.value }))} className="bill-input" /></Field>
              </div>
              <div className="mt-3">
                <Field label={t('evBills.reference')}><input value={form.referenceNumber} onChange={(e) => setForm((current) => ({ ...current, referenceNumber: e.target.value }))} className="bill-input" /></Field>
              </div>
              <Button type="submit" unit="ev" fullWidth disabled={saving} className="mt-5">{saving ? t('evBills.saving') : t('evBills.saveBill')}</Button>
            </Card>
          ) : (
            <Card className="text-sm text-gray-500">{t('evBills.managerOnly')}</Card>
          )}
        </aside>
        <section>
          <p className="text-xs font-semibold text-ev-700">{t('evBills.ledger')}</p>
          <h2 className="mt-0.5 text-xl font-bold text-gray-800">{t('evBills.billingPeriods')}</h2>
          {loading ? (
            <div className="grid min-h-[300px] place-items-center"><RefreshCw className="h-7 w-7 animate-spin text-ev-600" /></div>
          ) : bills.length === 0 ? (
            <div className="mt-3 grid min-h-[220px] place-items-center rounded-xl border-2 border-dashed border-gray-300 bg-white text-center">
              <div><Receipt className="mx-auto h-10 w-10 text-gray-300" /><p className="mt-3 font-bold text-gray-500">{t('evBills.noBills')}</p></div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {bills.map((bill) => (
                <button key={bill.id} type="button" onClick={() => reconcile(bill.id)} className="grid min-h-[88px] w-full grid-cols-[1fr_auto] items-center gap-4 rounded-xl bg-white p-4 text-left shadow-sm transition-colors hover:bg-ev-50">
                  <div>
                    <p className="text-xs font-semibold text-ev-700">{bill.periodStart} → {bill.periodEnd}</p>
                    <p className="mt-1 text-lg font-bold text-gray-800">{bill.referenceNumber || t('evBills.neaBill')}</p>
                    <p className="text-xs text-gray-500">{bill.createdByName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">{Number(bill.billedKwh).toFixed(1)} kWh</p>
                    <p className="text-sm text-gray-500">{money(bill.amountPaid)}</p>
                    {reconcilingId === bill.id ? <RefreshCw className="ml-auto mt-1 h-4 w-4 animate-spin text-ev-600" /> : null}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
      {reconciliation ? <ReconciliationSheet data={reconciliation} t={t} onClose={() => setReconciliation(null)} /> : null}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function ReconciliationSheet({ data, t, onClose }) {
  const profitable = Number(data.profit) >= 0;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-3 sm:p-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ev-700">{t('evBills.reconciliation')}</p>
            <h2 className="mt-0.5 text-xl font-bold text-gray-800">{data.periodStart} → {data.periodEnd}</h2>
          </div>
          <Button variant="secondary" onClick={onClose} className="px-4 py-2">{t('common.close')}</Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ReconMetric icon={Gauge} label={t('evBills.soldKwh')} value={`${data.soldKwh} kWh`} />
          <ReconMetric icon={Zap} label={t('evBills.billedKwh')} value={`${data.billedKwh} kWh`} />
          <ReconMetric icon={profitable ? TrendingUp : TrendingDown} label={t('evBills.profit')} value={money(data.profit)} accent={profitable} />
          <ReconMetric icon={BarChart3} label={t('evBills.margin')} value={`${data.profitPercent}%`} accent={profitable} />
        </div>
        <div className="mt-4 rounded-xl bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">{t('evBills.energyGap')}</span>
            <span className={`text-lg font-bold ${Number(data.varianceKwh) < 0 ? 'text-amber-700' : 'text-green-700'}`}>{data.varianceKwh} kWh · {data.variancePercent}%</span>
          </div>
        </div>
        <div className="mt-5">
          <p className="mb-2 text-sm font-semibold text-gray-600">{t('evBills.byCharger')}</p>
          {data.byChargePoint?.map((item) => (
            <div key={item.chargePointCode} className="flex items-center justify-between border-b border-gray-100 py-3">
              <div>
                <p className="font-bold text-gray-800">{item.chargePointCode}</p>
                <p className="text-xs text-gray-500">{item.model} · {item.sessions} {t('evBills.sessions')}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">{item.soldKwh} kWh</p>
                <p className="text-xs text-gray-500">{money(item.revenue)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReconMetric({ icon: Icon, label, value, accent }) {
  const tone = accent === true ? 'text-green-600' : accent === false ? 'text-red-600' : 'text-ev-600';
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <Icon className={`h-5 w-5 ${tone}`} />
      <p className="mt-2 text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-gray-800">{value}</p>
    </div>
  );
}
