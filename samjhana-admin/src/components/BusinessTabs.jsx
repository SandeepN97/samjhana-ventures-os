import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../utils/api';
import useLocaleFormat from '../hooks/useLocaleFormat';

const TABS = {
  furniture: [
    { to: '/entry/furniture', key: 'overview' },
    { to: '/furniture/inventory', key: 'products' },
    { to: '/furniture/orders/new', key: 'newSale' },
    { to: '/furniture/orders', key: 'orders' },
    { to: '/furniture/customers', key: 'customers' },
    { to: '/online-orders', key: 'onlineOrders', badge: true },
    { to: '/furniture/website', key: 'websitePage', staff: true },
  ],
  beekeeping: [
    { to: '/entry/beekeeping', key: 'overview' },
    { to: '/beekeeping/inventory', key: 'products' },
    { to: '/beekeeping/orders/new', key: 'newSale' },
    { to: '/beekeeping/orders', key: 'orders' },
    { to: '/online-orders', key: 'onlineOrders', badge: true },
    { to: '/beekeeping/website', key: 'websitePage', staff: true },
  ],
};

/**
 * The tabs along the top of a business: Overview · Products · New sale · Orders · (Customers) · Online orders · Website page.
 * "Online orders" opens the inbox of orders placed on the public website, with the number still waiting for staff.
 * Meant to sit inside the coloured PageHeader. "Website page" is only for admins and managers, who edit it.
 */
export default function BusinessTabs({ business }) {
  const { t } = useTranslation();
  const { num } = useLocaleFormat();
  const [newOrders, setNewOrders] = useState(0);
  useEffect(() => {
    let cancelled = false;
    api.get('/api/shop-orders/summary')
      .then((res) => { if (!cancelled) setNewOrders(Number(res?.data?.NEW) || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  let user = {};
  try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { user = {}; }
  const staff = user.role === 'ADMIN' || user.role === 'MANAGER';
  const tabs = (TABS[business] || []).filter((x) => !x.staff || staff);

  return (
    <nav aria-label={t('bizTabs.label')} className="-mx-4 mt-3 overflow-x-auto px-4">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end
            className={({ isActive }) =>
              `flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                isActive ? 'bg-white text-gray-900' : 'bg-white/20 text-white hover:bg-white/30'}`}>
            {t(`bizTabs.${tab.key}`)}
            {tab.badge && newOrders > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-2 text-xs font-bold text-white"
                aria-label={t('siteEditor.newOrders', { count: num(newOrders) })}>{num(newOrders)}</span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
