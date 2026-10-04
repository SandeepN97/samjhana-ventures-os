import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TABS = {
  furniture: [
    { to: '/entry/furniture', key: 'overview' },
    { to: '/furniture/inventory', key: 'products' },
    { to: '/furniture/orders/new', key: 'newSale' },
    { to: '/furniture/orders', key: 'orders' },
    { to: '/furniture/customers', key: 'customers' },
    { to: '/furniture/website', key: 'websitePage', staff: true },
  ],
  beekeeping: [
    { to: '/entry/beekeeping', key: 'overview' },
    { to: '/beekeeping/inventory', key: 'products' },
    { to: '/beekeeping/orders/new', key: 'newSale' },
    { to: '/beekeeping/orders', key: 'orders' },
    { to: '/beekeeping/website', key: 'websitePage', staff: true },
  ],
};

/**
 * The tabs along the top of a business: Overview · Products · New sale · Orders · (Customers) · Website page.
 * Meant to sit inside the coloured PageHeader. "Website page" is only for admins and managers, who edit it.
 */
export default function BusinessTabs({ business }) {
  const { t } = useTranslation();
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
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
