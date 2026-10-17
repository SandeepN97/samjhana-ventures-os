import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Banknote,
  Calendar,
  Droplet,
  FileText,
  Filter,
  Fuel,
  Hexagon,
  Home,
  Search,
  Sofa,
  X,
  Zap,
} from 'lucide-react';
import api from '../../utils/api';
import BottomNav from '../../components/BottomNav';
import LedgerPageHeader from '../../components/LedgerPageHeader';
import { ToastContainer } from '../../components/Toast';
import { useToast } from '../../hooks/useToast';
import { adToBs, BS_MONTHS_EN, BS_MONTHS_NE, toNepaliDigits } from '../../utils/nepaliDate';
import { nepalToday, nepalTodayDate, toDateStr } from '../../utils/businessDay';

const MONEY_IN_TYPES = new Set(['SALE', 'INCOME', 'PAYMENT']);
const MONEY_OUT_TYPES = new Set(['PURCHASE', 'EXPENSE', 'DISBURSEMENT']);

// Date shortcuts use Nepal time, the same boundary used when records are created.
const today = () => nepalToday();
const startOfWeek = () => {
  const date = nepalTodayDate();
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return toDateStr(date);
};
const startOfMonth = () => {
  const date = nepalTodayDate();
  date.setDate(1);
  return toDateStr(date);
};

const BUSINESS_ICONS = {
  petrol: { icon: Fuel, color: 'bg-petrol-500', dot: 'bg-petrol-500', label: 'Petrol', labelNe: 'पेट्रोल' },
  diesel: { icon: Droplet, color: 'bg-beekeeping-600', dot: 'bg-beekeeping-600', label: 'Diesel', labelNe: 'डिजेल' },
  ev: { icon: Zap, color: 'bg-ev-500', dot: 'bg-ev-500', label: 'EV', labelNe: 'EV' },
  furniture: { icon: Sofa, color: 'bg-furniture-500', dot: 'bg-furniture-500', label: 'Furniture', labelNe: 'फर्निचर' },
  beekeeping: { icon: Hexagon, color: 'bg-beekeeping-500', dot: 'bg-beekeeping-500', label: 'Beekeeping', labelNe: 'मौरीपालन' },
  rental: { icon: Home, color: 'bg-rental-500', dot: 'bg-rental-500', label: 'Rental', labelNe: 'भाडा' },
  loan: { icon: Banknote, color: 'bg-loans-500', dot: 'bg-loans-500', label: 'Loan', labelNe: 'ऋण' },
};

function parseCustomFields(value) {
  if (!value || typeof value !== 'string') return value || null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export default function RecordsPage() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isNepali = i18n.language === 'ne';
  const { toasts, showToast, removeToast } = useToast();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(location.state?.filter || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/transactions';
      if (filter === 'petrol' || filter === 'diesel') {
        url = '/api/transactions?businessCode=petrol';
      } else if (filter !== 'all') {
        url = `/api/transactions?businessCode=${filter}`;
      }
      const response = await api.get(url);
      setTransactions((response.data || []).map((transaction) => ({
        ...transaction,
        customFields: parseCustomFields(transaction.customFields),
      })));
    } catch {
      showToast(t('records.failedToLoad'), 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, showToast, t]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const formatDate = (dateString) => {
    const [year, month, day] = String(dateString).slice(0, 10).split('-').map(Number);
    const bsDate = adToBs(new Date(year, month - 1, day));
    const label = `${isNepali ? BS_MONTHS_NE[bsDate.month] : BS_MONTHS_EN[bsDate.month]} ${bsDate.day}, ${bsDate.year}`;
    return isNepali ? toNepaliDigits(label) : label;
  };

  const formatAmount = (amount) => {
    const digits = Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    return `रु ${isNepali ? toNepaliDigits(digits) : digits}`;
  };

  const formatDecimal = (value, fractionDigits = 2) => {
    const digits = Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    });
    return isNepali ? toNepaliDigits(digits) : digits;
  };

  const applyDatePreset = (preset) => {
    if (preset === 'today') { setDateFrom(today()); setDateTo(today()); }
    if (preset === 'week') { setDateFrom(startOfWeek()); setDateTo(today()); }
    if (preset === 'month') { setDateFrom(startOfMonth()); setDateTo(today()); }
    if (preset === 'all') { setDateFrom(''); setDateTo(''); }
  };

  const activeDatePreset = (() => {
    if (!dateFrom && !dateTo) return 'all';
    if (dateFrom === today() && dateTo === today()) return 'today';
    if (dateFrom === startOfWeek() && dateTo === today()) return 'week';
    if (dateFrom === startOfMonth() && dateTo === today()) return 'month';
    return 'custom';
  })();

  const filteredTransactions = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (filter === 'petrol' && (transaction.businessCode !== 'petrol' || transaction.customFields?.fuelType?.toLowerCase() !== 'petrol')) return false;
      if (filter === 'diesel' && (transaction.businessCode !== 'petrol' || transaction.customFields?.fuelType?.toLowerCase() !== 'diesel')) return false;

      const transactionDate = String(transaction.transactionDate || '').slice(0, 10);
      if (dateFrom && transactionDate < dateFrom) return false;
      if (dateTo && transactionDate > dateTo) return false;
      if (!search) return true;

      return [transaction.businessName, transaction.notes, transaction.enteredByName, transaction.transactionType]
        .some((value) => value?.toLowerCase().includes(search));
    });
  }, [dateFrom, dateTo, filter, searchTerm, transactions]);

  const groupedTransactions = useMemo(() => {
    const groups = new Map();
    [...filteredTransactions]
      .sort((a, b) => String(b.transactionDate || '').localeCompare(String(a.transactionDate || '')))
      .forEach((transaction) => {
        const date = String(transaction.transactionDate || '').slice(0, 10);
        if (!groups.has(date)) groups.set(date, []);
        groups.get(date).push(transaction);
      });
    return [...groups.entries()];
  }, [filteredTransactions]);

  const getStatusStyle = (status) => {
    if (status === 'APPROVED') return 'bg-ev-50 text-ev-700 ring-ev-200';
    if (status === 'REJECTED') return 'bg-loans-50 text-loans-700 ring-loans-200';
    return 'bg-amber-50 text-amber-800 ring-amber-200';
  };

  const getStatusLabel = (status) => {
    const labels = {
      PENDING_REVIEW: t('status.pendingReview'),
      APPROVED: t('status.approved'),
      REJECTED: t('status.rejected'),
    };
    return labels[status] || status;
  };

  const getTypeLabel = (type) => t(`transactionType.${String(type || '').toLowerCase()}`, {
    defaultValue: String(type || '').replaceAll('_', ' ').toLowerCase(),
  });

  return (
    <div className="min-h-screen bg-gray-100 pb-24 font-['Red_Hat_Text',sans-serif] text-core-900 selection:bg-core-200 xl:pb-8">
      <LedgerPageHeader title={t('records.title')} />

      <main className="mx-auto max-w-7xl px-4 py-5 md:px-5 lg:px-8 lg:py-8">
        <section className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] ring-1 ring-core-200/80">
          <div className="border-b border-core-200 p-4 sm:p-6">
            <label htmlFor="record-search" className="mb-2 block text-sm font-bold text-core-700">
              {t('records.searchLabel')}
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-core-400" aria-hidden="true" />
              <input
                id="record-search"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t('records.searchPlaceholder')}
                className="min-h-[52px] w-full rounded-xl border border-core-300 bg-core-50 pl-12 pr-4 text-base text-core-950 outline-none transition placeholder:text-core-400 hover:border-core-400 focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-core-700">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {t('records.dateRange')}
              </div>
              <div className="grid grid-cols-4 gap-2" role="group" aria-label={t('records.dateRange')}>
                {[
                  { key: 'all', label: t('records.dateAll') },
                  { key: 'today', label: t('common.today') },
                  { key: 'week', label: t('records.dateWeek') },
                  { key: 'month', label: t('records.dateMonth') },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyDatePreset(key)}
                    aria-pressed={activeDatePreset === key}
                    className={`min-h-[44px] rounded-xl px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 sm:text-sm ${
                      activeDatePreset === key
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-core-100 text-core-600 hover:bg-core-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_44px] items-end gap-2">
                <label className="min-w-0 text-xs font-semibold text-core-500">
                  <span className="mb-1 block">{t('records.fromDate')}</span>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || today()}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="min-h-[44px] w-full min-w-0 rounded-lg border border-core-300 bg-white px-2 text-sm text-core-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <span className="mb-3 text-sm text-core-400" aria-hidden="true">→</span>
                <label className="min-w-0 text-xs font-semibold text-core-500">
                  <span className="mb-1 block">{t('records.toDate')}</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    max={today()}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="min-h-[44px] w-full min-w-0 rounded-lg border border-core-300 bg-white px-2 text-sm text-core-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  aria-label={t('records.clearDates')}
                  aria-hidden={!dateFrom && !dateTo}
                  tabIndex={!dateFrom && !dateTo ? -1 : 0}
                  className={`flex h-11 w-11 items-center justify-center rounded-lg text-core-500 transition-colors hover:bg-core-100 hover:text-core-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 ${!dateFrom && !dateTo ? 'invisible' : ''}`}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-w-0">
              <p className="mb-2 text-sm font-bold text-core-700">{t('records.businessFilter')}</p>
              <div className="-mx-1 overflow-x-auto px-1 pb-1 lg:overflow-visible" role="group" aria-label={t('records.businessFilter')}>
                <div className="flex min-w-max gap-2 lg:min-w-0 lg:flex-wrap">
                  <FilterButton active={filter === 'all'} onClick={() => setFilter('all')} label={t('records.all')} />
                  {Object.entries(BUSINESS_ICONS).map(([code, business]) => (
                    <FilterButton
                      key={code}
                      active={filter === code}
                      onClick={() => setFilter(code)}
                      label={isNepali ? business.labelNe : business.label}
                      dot={business.dot}
                    />
                  ))}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-core-500">
                {isNepali
                  ? 'एउटा व्यवसाय छानेर त्यसका रेकर्ड मात्र हेर्नुहोस्।'
                  : 'Choose one business to focus the ledger.'}
              </p>
            </div>
          </div>
        </section>

        <div className="mb-3 mt-6 flex items-end justify-between gap-4 px-1">
          <div>
            <h2 className="text-xl font-bold tracking-[-0.025em] text-core-950 sm:text-2xl">{t('records.latestActivity')}</h2>
            <p className="mt-1 text-sm text-core-500" aria-live="polite">
              {t('records.showingCount', {
                shown: isNepali ? toNepaliDigits(filteredTransactions.length) : filteredTransactions.length,
                total: isNepali ? toNepaliDigits(transactions.length) : transactions.length,
              })}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-core-200/80" aria-label={t('common.loading')}>
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex animate-pulse gap-3 border-b border-core-100 p-4 last:border-b-0">
                <div className="h-11 w-11 rounded-xl bg-core-200" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 w-1/3 rounded bg-core-200" />
                  <div className="h-3 w-1/2 rounded bg-core-100" />
                </div>
                <div className="h-5 w-24 rounded bg-core-200" />
              </div>
            ))}
          </div>
        ) : groupedTransactions.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] ring-1 ring-core-200/80">
            <FileText className="mx-auto h-9 w-9 text-core-300" aria-hidden="true" />
            <p className="mt-3 text-lg font-bold text-core-700">{t('records.noRecords')}</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-core-500">
              {isNepali ? 'खोज, मिति वा व्यवसाय फिल्टर परिवर्तन गरेर फेरि हेर्नुहोस्।' : 'Try changing the search, date, or business filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_32px_-24px_rgba(15,23,42,0.45)] ring-1 ring-core-200/80">
            {groupedTransactions.map(([date, records]) => (
              <section key={date} aria-labelledby={`records-${date}`}>
                <h3 id={`records-${date}`} className="border-y border-core-200 bg-core-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-core-500 first:border-t-0 sm:px-6">
                  {date === today() ? t('common.today') : formatDate(date)}
                </h3>
                <ol className="divide-y divide-core-100">
                  {records.map((transaction) => {
                    let business = BUSINESS_ICONS[transaction.businessCode] || {};
                    const fuelType = transaction.customFields?.fuelType?.toLowerCase();
                    if (transaction.businessCode === 'petrol' && fuelType) business = BUSINESS_ICONS[fuelType] || business;

                    const Icon = business.icon || Filter;
                    const liters = transaction.customFields?.liters;
                    const ratePerLiter = transaction.customFields?.ratePerLiter;
                    const unitsCharged = transaction.customFields?.unitsCharged ?? transaction.customFields?.kWh;
                    const unitRate = transaction.customFields?.unitRate ?? transaction.customFields?.ratePerKwh;
                    const paymentMethod = transaction.customFields?.paymentMethod?.toUpperCase();
                    const moneyIn = MONEY_IN_TYPES.has(transaction.transactionType);
                    const moneyOut = MONEY_OUT_TYPES.has(transaction.transactionType);
                    const amountTone = moneyIn ? 'text-ev-700' : moneyOut ? 'text-loans-700' : 'text-core-900';
                    const amountPrefix = moneyIn ? '+' : moneyOut ? '−' : '';
                    const businessName = transaction.businessCode === 'petrol' && fuelType
                      ? (fuelType === 'petrol' ? t('petrol.petrol') : t('petrol.diesel'))
                      : (isNepali ? business.labelNe : transaction.businessName) || business.label || transaction.businessName || transaction.businessCode;

                    return (
                      <li key={transaction.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-2 p-4 [contain-intrinsic-size:144px] [content-visibility:auto] sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:px-6 sm:py-5">
                        <span className={`${business.color || 'bg-core-500'} flex h-11 w-11 items-center justify-center rounded-xl text-white`}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>

                        <div className="min-w-0">
                          <p className="font-bold leading-5 text-core-950">{businessName}</p>
                          <p className="mt-0.5 text-sm text-core-500">{formatDate(transaction.transactionDate)}</p>

                          {transaction.businessCode === 'petrol' && liters && ratePerLiter ? (
                            <p className="mt-2 text-sm text-core-600">
                              {formatDecimal(liters)} {t('records.litersShort')} × रु {formatDecimal(ratePerLiter)}
                              {paymentMethod ? <PaymentMethod method={paymentMethod} t={t} /> : null}
                            </p>
                          ) : null}

                          {transaction.businessCode === 'ev' && unitsCharged && unitRate ? (
                            <p className="mt-2 text-sm text-core-600">
                              {formatDecimal(unitsCharged)} kWh × रु {formatDecimal(unitRate)}
                              {paymentMethod ? <PaymentMethod method={paymentMethod} t={t} /> : null}
                            </p>
                          ) : null}

                          {transaction.notes ? <p className="mt-2 text-sm italic text-core-500">{transaction.notes}</p> : null}

                          {transaction.status === 'REJECTED' && transaction.reviewNotes ? (
                            <div className="mt-3 rounded-lg bg-loans-50 p-3 ring-1 ring-inset ring-loans-200">
                              <p className="text-xs font-bold text-loans-700">{t('records.rejectionReason')}</p>
                              <p className="mt-1 text-sm text-loans-800">{transaction.reviewNotes}</p>
                            </div>
                          ) : null}

                          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-core-100 pt-2 text-xs text-core-500">
                            <span>{t('records.enteredBy')} {transaction.enteredByName || '—'}</span>
                            <span>{getTypeLabel(transaction.transactionType)}</span>
                          </p>
                        </div>

                        <div className="col-start-2 flex items-center justify-between gap-3 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:justify-start">
                          <p className={`whitespace-nowrap text-lg font-bold tabular-nums ${amountTone}`}>
                            {amountPrefix}{formatAmount(transaction.amount)}
                          </p>
                          <span className={`rounded-lg px-2 py-1 text-xs font-bold ring-1 ring-inset ${getStatusStyle(transaction.status)}`}>
                            {getStatusLabel(transaction.status)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </main>

      <div className="xl:hidden">
        <BottomNav active="records" />
      </div>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

function PaymentMethod({ method, t }) {
  const isCash = method === 'CASH';
  return (
    <span className={`ml-2 inline-flex rounded-md px-2 py-0.5 text-xs font-bold ${isCash ? 'bg-ev-50 text-ev-700' : 'bg-blue-50 text-blue-700'}`}>
      {isCash ? t('common.cash') : t('common.bank')}
    </span>
  );
}

function FilterButton({ active, onClick, label, dot }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-core-500 focus-visible:ring-offset-2 ${
        active ? 'bg-core-800 text-white' : 'bg-core-100 text-core-700 hover:bg-core-200'
      }`}
    >
      {dot ? <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" /> : null}
      {label}
    </button>
  );
}
