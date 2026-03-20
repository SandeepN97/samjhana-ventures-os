import React, { useEffect } from 'react';
import { X, Droplets, Battery, TrendingUp, TrendingDown } from 'lucide-react';
import { formatBsDate } from '../utils/nepaliDate';

const fmt = (n) => {
  if (n == null || isNaN(Number(n))) return '—';
  return `रु ${Math.abs(Number(n)).toLocaleString('en-IN')}`;
};

const SectionHeader = ({ children }) => (
  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">{children}</p>
);

const StatRow = ({ label, value, sub, accent }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
    <span className="text-sm text-gray-600">{label}</span>
    <div className="text-right">
      <span className={`text-sm font-bold ${accent || 'text-gray-900'}`}>{value}</span>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  </div>
);

// ── Per-business content ────────────────────────────────────────────────────

function PetrolContent({ txns, isNepali, canViewProfit }) {
  const sales = txns.filter(t => t.transactionType === 'SALE');
  const petrol = sales.filter(t => (t.customFields?.fuelType || '').toLowerCase() !== 'diesel');
  const diesel = sales.filter(t => (t.customFields?.fuelType || '').toLowerCase() === 'diesel');

  const sum = (arr, key) => arr.reduce((s, t) => s + parseFloat(t.customFields?.[key] || 0), 0);
  const sumAmt = (arr) => arr.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  const petrolL = sum(petrol, 'liters'), petrolRev = sumAmt(petrol);
  const dieselL = sum(diesel, 'liters'), dieselRev = sumAmt(diesel);
  const totalL = petrolL + dieselL;
  const totalRev = petrolRev + dieselRev;

  const cash = sales.filter(t => (t.customFields?.paymentMethod || '').toLowerCase() === 'cash');
  const cashRev = sumAmt(cash), bankRev = totalRev - cashRev;
  const cashPct = totalRev > 0 ? Math.round((cashRev / totalRev) * 100) : 0;

  const avgLiters = sales.length > 0 ? totalL / sales.length : 0;
  const avgAmount = sales.length > 0 ? totalRev / sales.length : 0;

  const purchaseCost = canViewProfit
    ? sales.reduce((s, t) => s + parseFloat(t.customFields?.purchaseRate || 0) * parseFloat(t.customFields?.liters || 0), 0)
    : null;

  return (
    <div className="space-y-4">
      {/* Fuel type split */}
      <div>
        <SectionHeader>{isNepali ? 'इन्धन प्रकार' : 'Fuel Type'}</SectionHeader>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: isNepali ? 'पेट्रोल' : 'Petrol', liters: petrolL, rev: petrolRev, color: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700' },
            { label: isNepali ? 'डिजेल' : 'Diesel', liters: dieselL, rev: dieselRev, color: 'bg-yellow-500', light: 'bg-yellow-50', text: 'text-yellow-700' },
          ].map(f => (
            <div key={f.label} className={`${f.light} rounded-xl p-3`}>
              <div className={`w-2 h-2 rounded-full ${f.color} mb-2`} />
              <p className={`text-xs font-bold ${f.text}`}>{f.label}</p>
              <p className="text-lg font-black text-gray-900">{f.liters.toFixed(1)}L</p>
              <p className="text-xs text-gray-500">{fmt(f.rev)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div>
        <SectionHeader>{isNepali ? 'सारांश' : 'Summary'}</SectionHeader>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <StatRow label={isNepali ? 'जम्मा लिटर' : 'Total Liters'} value={`${totalL.toFixed(1)}L`} />
          <StatRow label={isNepali ? 'औसत लिटर/कारोबार' : 'Avg Liters/Txn'} value={`${avgLiters.toFixed(1)}L`} />
          <StatRow label={isNepali ? 'औसत रकम/कारोबार' : 'Avg Amount/Txn'} value={fmt(avgAmount)} />
          {canViewProfit && purchaseCost != null && (
            <StatRow
              label={isNepali ? 'अनुमानित नाफा' : 'Est. Gross Profit'}
              value={fmt(totalRev - purchaseCost)}
              accent={totalRev - purchaseCost >= 0 ? 'text-green-600' : 'text-red-500'}
            />
          )}
        </div>
      </div>

      {/* Payment split */}
      <div>
        <SectionHeader>{isNepali ? 'भुक्तानी विधि' : 'Payment Split'}</SectionHeader>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <StatRow label={isNepali ? 'नगद' : 'Cash'} value={fmt(cashRev)} sub={`${cashPct}%`} />
          <StatRow label={isNepali ? 'डिजिटल/बैंक' : 'Digital/Bank'} value={fmt(bankRev)} sub={`${100 - cashPct}%`} />
        </div>
      </div>

      {/* Recent transactions */}
      <RecentTxns txns={sales} isNepali={isNepali}
        labelFn={t => `${(t.customFields?.fuelType || 'Petrol')} · ${parseFloat(t.customFields?.liters || 0).toFixed(1)}L`} />
    </div>
  );
}

function EvContent({ txns, isNepali }) {
  const sales = txns.filter(t => t.transactionType === 'SALE');
  const totalKwh = sales.reduce((s, t) => s + parseFloat(t.customFields?.kWh || 0), 0);
  const totalRev = sales.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const avgKwh = sales.length > 0 ? totalKwh / sales.length : 0;
  const avgRev = sales.length > 0 ? totalRev / sales.length : 0;

  // Vehicle type breakdown
  const byVehicle = {};
  sales.forEach(t => {
    const v = t.customFields?.vehicleType || (isNepali ? 'अन्य' : 'Other');
    if (!byVehicle[v]) byVehicle[v] = { count: 0, kwh: 0, rev: 0 };
    byVehicle[v].count++;
    byVehicle[v].kwh += parseFloat(t.customFields?.kWh || 0);
    byVehicle[v].rev += parseFloat(t.amount || 0);
  });
  const vehicleRows = Object.entries(byVehicle).sort((a, b) => b[1].rev - a[1].rev);

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{isNepali ? 'सारांश' : 'Summary'}</SectionHeader>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <StatRow label={isNepali ? 'जम्मा kWh' : 'Total kWh'} value={`${totalKwh.toFixed(1)} kWh`} />
          <StatRow label={isNepali ? 'औसत kWh/चार्ज' : 'Avg kWh/Charge'} value={`${avgKwh.toFixed(1)} kWh`} />
          <StatRow label={isNepali ? 'औसत रकम/चार्ज' : 'Avg Amount/Charge'} value={fmt(avgRev)} />
        </div>
      </div>

      {vehicleRows.length > 0 && (
        <div>
          <SectionHeader>{isNepali ? 'सवारी प्रकार' : 'By Vehicle Type'}</SectionHeader>
          <div className="bg-gray-50 rounded-xl px-3 py-1">
            {vehicleRows.map(([v, d]) => (
              <StatRow key={v} label={v} value={fmt(d.rev)} sub={`${d.count} charges · ${d.kwh.toFixed(1)} kWh`} />
            ))}
          </div>
        </div>
      )}

      <RecentTxns txns={sales} isNepali={isNepali}
        labelFn={t => `${t.customFields?.vehicleType || 'EV'} · ${parseFloat(t.customFields?.kWh || 0).toFixed(1)} kWh`} />
    </div>
  );
}

function FurnitureContent({ txns, isNepali, canViewProfit }) {
  const sales = txns.filter(t => t.transactionType === 'SALE');
  const totalRev = sales.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const avgOrder = sales.length > 0 ? totalRev / sales.length : 0;

  // Top items
  const byItem = {};
  sales.forEach(t => {
    const name = t.customFields?.itemName || (isNepali ? 'अज्ञात' : 'Unknown');
    const qty = parseFloat(t.customFields?.qtyOut || t.customFields?.quantity || 1);
    const rev = parseFloat(t.amount || 0);
    const profit = canViewProfit && t.customFields?.sellingPrice && t.customFields?.purchasePrice
      ? (parseFloat(t.customFields.sellingPrice) - parseFloat(t.customFields.purchasePrice)) * qty
      : null;
    if (!byItem[name]) byItem[name] = { qty: 0, rev: 0, profit: 0 };
    byItem[name].qty += qty;
    byItem[name].rev += rev;
    if (profit != null) byItem[name].profit += profit;
  });
  const itemRows = Object.entries(byItem).sort((a, b) => b[1].rev - a[1].rev).slice(0, 8);

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{isNepali ? 'सारांश' : 'Summary'}</SectionHeader>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <StatRow label={isNepali ? 'कुल अर्डर' : 'Total Orders'} value={sales.length} />
          <StatRow label={isNepali ? 'औसत अर्डर मूल्य' : 'Avg Order Value'} value={fmt(avgOrder)} />
        </div>
      </div>

      {itemRows.length > 0 && (
        <div>
          <SectionHeader>{isNepali ? 'शीर्ष वस्तुहरू' : 'Top Items'}</SectionHeader>
          <div className="bg-gray-50 rounded-xl px-3 py-1">
            {itemRows.map(([name, d]) => (
              <StatRow key={name} label={name}
                value={fmt(d.rev)}
                sub={`qty ${d.qty}${canViewProfit && d.profit ? ` · profit ${fmt(d.profit)}` : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      <RecentTxns txns={sales} isNepali={isNepali}
        labelFn={t => t.customFields?.itemName || (isNepali ? 'फर्निचर' : 'Furniture')} />
    </div>
  );
}

function RentalContent({ txns, isNepali }) {
  const payments = txns.filter(t =>
    t.transactionType === 'PAYMENT' || t.transactionType === 'SALE' || t.transactionType === 'INCOME'
  );
  const totalRev = payments.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Per-room breakdown
  const byRoom = {};
  payments.forEach(t => {
    const room = t.customFields?.roomNo || t.customFields?.propertyName || (isNepali ? 'अज्ञात' : 'Unknown');
    if (!byRoom[room]) byRoom[room] = { amount: 0, count: 0, months: [] };
    byRoom[room].amount += parseFloat(t.amount || 0);
    byRoom[room].count++;
    if (t.customFields?.paymentMonth) byRoom[room].months.push(t.customFields.paymentMonth);
  });
  const roomRows = Object.entries(byRoom).sort((a, b) => b[1].amount - a[1].amount);

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{isNepali ? 'सारांश' : 'Summary'}</SectionHeader>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <StatRow label={isNepali ? 'जम्मा भाडा संकलन' : 'Total Collected'} value={fmt(totalRev)} />
          <StatRow label={isNepali ? 'भुक्तानी गरेका कोठाहरू' : 'Rooms Paid'} value={roomRows.length} />
        </div>
      </div>

      {roomRows.length > 0 && (
        <div>
          <SectionHeader>{isNepali ? 'कोठा अनुसार' : 'By Room'}</SectionHeader>
          <div className="bg-gray-50 rounded-xl px-3 py-1">
            {roomRows.map(([room, d]) => (
              <StatRow key={room}
                label={`${isNepali ? 'कोठा' : 'Room'} ${room}`}
                value={fmt(d.amount)}
                sub={d.months.length > 0 ? d.months.join(', ') : `${d.count} payment${d.count > 1 ? 's' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

      <RecentTxns txns={payments} isNepali={isNepali}
        labelFn={t => `${isNepali ? 'कोठा' : 'Room'} ${t.customFields?.roomNo || t.customFields?.propertyName || '—'}`} />
    </div>
  );
}

function LoanContent({ txns, isNepali, canViewProfit }) {
  const disbursements = txns.filter(t => t.transactionType === 'DISBURSEMENT');
  const repayments    = txns.filter(t => t.transactionType === 'PAYMENT');

  const totalDisbursed = disbursements.reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalRepaid    = repayments.reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  // Per-borrower
  const byBorrower = {};
  const addToBorrower = (t, type) => {
    const name = t.customFields?.borrowerName || (isNepali ? 'अज्ञात' : 'Unknown');
    if (!byBorrower[name]) byBorrower[name] = { disbursed: 0, repaid: 0 };
    if (type === 'DISBURSEMENT') byBorrower[name].disbursed += parseFloat(t.amount || 0);
    if (type === 'PAYMENT')      byBorrower[name].repaid    += parseFloat(t.amount || 0);
  };
  disbursements.forEach(t => addToBorrower(t, 'DISBURSEMENT'));
  repayments.forEach(t => addToBorrower(t, 'PAYMENT'));
  const borrowerRows = Object.entries(byBorrower).sort((a, b) => b[1].disbursed - a[1].disbursed);

  return (
    <div className="space-y-4">
      <div>
        <SectionHeader>{isNepali ? 'यस अवधिमा' : 'This Period'}</SectionHeader>
        <div className="bg-gray-50 rounded-xl px-3 py-1">
          <StatRow label={isNepali ? 'वितरण गरिएको' : 'Disbursed'} value={fmt(totalDisbursed)} sub={`${disbursements.length} loan${disbursements.length !== 1 ? 's' : ''}`} accent="text-red-600" />
          <StatRow label={isNepali ? 'फिर्ता भएको' : 'Repaid'} value={fmt(totalRepaid)} sub={`${repayments.length} payment${repayments.length !== 1 ? 's' : ''}`} accent="text-green-600" />
        </div>
      </div>

      {borrowerRows.length > 0 && (
        <div>
          <SectionHeader>{isNepali ? 'ऋणी अनुसार' : 'By Borrower'}</SectionHeader>
          <div className="bg-gray-50 rounded-xl px-3 py-1">
            {borrowerRows.map(([name, d]) => (
              <div key={name} className="py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 font-medium">{name}</span>
                </div>
                <div className="flex gap-4 mt-0.5">
                  {d.disbursed > 0 && <span className="text-xs text-red-500">↑ {fmt(d.disbursed)}</span>}
                  {d.repaid > 0    && <span className="text-xs text-green-600">↓ {fmt(d.repaid)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared recent transactions list ────────────────────────────────────────

function RecentTxns({ txns, isNepali, labelFn }) {
  const recent = [...txns].sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || '')).slice(0, 8);
  if (recent.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
        {isNepali ? 'हालका कारोबारहरू' : 'Recent Transactions'}
      </p>
      <div className="bg-gray-50 rounded-xl px-3 py-1">
        {recent.map((t, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-xs font-medium text-gray-700">{labelFn(t)}</p>
              <p className="text-[10px] text-gray-400">{formatBsDate(t.transactionDate, isNepali)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-gray-900">{fmt(t.amount)}</p>
              <p className="text-[10px] text-gray-400">{(t.customFields?.paymentMethod || t.paymentMethod || '').toLowerCase()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main sheet component ────────────────────────────────────────────────────

export default function BusinessDrillSheet({ bizCode, bizConfig, txns, onClose, periodLabel, isNepali, canViewProfit }) {
  useEffect(() => {
    if (bizCode) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [bizCode]);

  if (!bizCode) return null;

  const cfg = bizConfig[bizCode];
  const Icon = cfg.icon;
  const bizTxns = txns.filter(t => t.businessCode === bizCode);
  const totalRev = bizTxns
    .filter(t => ['SALE','INCOME','PAYMENT'].includes(t.transactionType))
    .reduce((s, t) => s + parseFloat(t.amount || 0), 0);

  const contentMap = {
    petrol:    <PetrolContent    txns={bizTxns} isNepali={isNepali} canViewProfit={canViewProfit} />,
    ev:        <EvContent        txns={bizTxns} isNepali={isNepali} />,
    furniture: <FurnitureContent txns={bizTxns} isNepali={isNepali} canViewProfit={canViewProfit} />,
    rental:    <RentalContent    txns={bizTxns} isNepali={isNepali} />,
    loan:      <LoanContent      txns={bizTxns} isNepali={isNepali} canViewProfit={canViewProfit} />,
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-40 animate-fade-in" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '82vh', animation: 'slideUp 0.25s ease-out' }}>

        {/* Drag handle row — X on the right, plain and unobtrusive */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
          <div className="w-6" />
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
          <button onClick={onClose}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 active:text-gray-800 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Coloured hero card — left = identity, right = revenue */}
        <div className={`${cfg.color} mx-4 mb-1 rounded-2xl px-4 py-4 flex-shrink-0`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-base leading-tight truncate">{isNepali ? cfg.labelNe : cfg.labelEn}</p>
                <p className="text-white/70 text-xs">{periodLabel}</p>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-white/70 text-xs font-medium uppercase tracking-wide">{isNepali ? 'कुल आम्दानी' : 'Total Revenue'}</p>
              <p className="text-white font-black text-xl leading-tight">{fmt(totalRev)}</p>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {contentMap[bizCode] || <p className="text-center text-gray-400 py-8">No data</p>}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </>
  );
}
