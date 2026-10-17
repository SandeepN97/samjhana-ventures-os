import React, { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  FileText,
  Globe,
  Home,
  Settings,
  ShoppingBag,
  User,
  Users,
} from 'lucide-react';
import { Wordmark } from './brand';
import LanguageToggle from './LanguageToggle';
import UserBar from './UserBar';
import { BUSINESS_BUTTONS } from './QuickActionButtons';
import { unitTheme } from '../brand/theme';
import useDesktop from '../hooks/useDesktop';

// Pages that belong to a business, so its sidebar entry stays highlighted inside them.
const BUSINESS_PATHS = {
  petrol: ['/entry/petrol', '/fuel-prices', '/fuel-orders'],
  ev: ['/entry/ev', '/ev-'],
  furniture: ['/entry/furniture', '/furniture'],
  beekeeping: ['/entry/beekeeping', '/beekeeping'],
  rental: ['/entry/rental', '/rental-'],
  loan: ['/entry/loan'],
};

const startsWithAny = (pathname, prefixes) => prefixes.some((prefix) => pathname.startsWith(prefix));

function currentUser() {
  try { return JSON.parse(localStorage.getItem('user') || '{}') || {}; } catch { return {}; }
}

/**
 * The desktop frame around every signed-in page: a left menu and a centred page area. It only
 * exists at 1024px and wider; on phones and tablets the page is returned exactly as it was, so
 * the bottom bar and every phone layout are untouched. It asks the server for nothing.
 */
export default function DesktopShell({ children }) {
  const desktop = useDesktop();
  if (!desktop) return children;
  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar />
      <div className="pl-64">
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </div>
    </div>
  );
}

function Sidebar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const user = currentUser();
  const canManage = user.role === 'ADMIN' || user.role === 'MANAGER';
  const isAdmin = user.role === 'ADMIN';
  const businesses = user.role === 'STAFF' ? BUSINESS_BUTTONS.filter((b) => b.code !== 'loan') : BUSINESS_BUTTONS;

  const work = [
    { key: 'records', icon: FileText, label: t('nav.records'), path: '/records', match: ['/records'] },
    { key: 'close', icon: FileText, label: t('home.dailyClose'), path: '/reports/close', match: ['/reports', '/pending'] },
    { key: 'orders', icon: ShoppingBag, label: t('home.onlineOrders'), path: '/online-orders', match: ['/online-orders'] },
    ...(canManage ? [{ key: 'analytics', icon: BarChart3, label: t('home.analytics'), path: '/analytics', match: ['/analytics'] }] : []),
    ...(canManage ? [{ key: 'website', icon: Globe, label: t('home.website'), path: '/website', match: ['/website', '/restaurant-menu'] }] : []),
    ...(isAdmin ? [{ key: 'staff', icon: Users, label: t('home.staffManagement'), path: '/staff', match: ['/staff'] }] : []),
    { key: 'settings', icon: Settings, label: t('nav.settings'), path: '/settings', match: ['/settings'] },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-core-800 text-white">
      <Link
        to="/"
        className="flex min-h-[64px] items-center px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        <Wordmark size="sm" />
      </Link>

      <nav aria-label={t('home.menuLabel')} className="flex-1 space-y-4 overflow-y-auto px-3 pb-3">
        <ul>
          <Item to="/" icon={Home} label={t('nav.home')} active={pathname === '/'} />
        </ul>

        <section aria-labelledby="shell-businesses">
          <h2 id="shell-businesses" className="px-3 pb-1 text-xs font-bold text-core-300">{t('home.businessesHeading')}</h2>
          <ul className="space-y-0.5">
            {businesses.map((b) => (
              <Item
                key={b.code}
                to={b.path}
                icon={b.icon}
                label={t(b.tKey)}
                tile={unitTheme(b.unit).tile.split(' ')[0]}
                active={startsWithAny(pathname, BUSINESS_PATHS[b.code] || [b.path])}
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="shell-work">
          <h2 id="shell-work" className="px-3 pb-1 text-xs font-bold text-core-300">{t('home.workHeading')}</h2>
          <ul className="space-y-0.5">
            {work.map((w) => (
              <Item key={w.key} to={w.path} icon={w.icon} label={w.label} active={startsWithAny(pathname, w.match)} />
            ))}
          </ul>
        </section>
      </nav>

      <div className="space-y-2 border-t border-white/10 p-3">
        <LanguageToggle className="w-full [&>button]:flex-1" />
        <p className="flex items-center gap-2 px-1 text-sm font-semibold text-white/85">
          <User className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{user.fullName || user.username}</span>
        </p>
        <UserBar showName={false} className="w-full [&>button]:flex-1 [&>button]:justify-center" />
      </div>
    </aside>
  );
}

function Item({ to, icon: Icon, label, active, tile }) {
  const ref = useRef(null);
  useEffect(() => {
    // A short window can hide the page you are on at the bottom of the menu; bring it into view.
    if (active) ref.current?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  return (
    <li>
      <Link
        ref={ref}
        to={to}
        aria-current={active ? 'page' : undefined}
        className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          active ? 'bg-white text-core-800' : 'text-white/85 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tile && !active ? `${tile} text-white` : active ? 'bg-core-100 text-core-800' : 'bg-white/10'}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}
