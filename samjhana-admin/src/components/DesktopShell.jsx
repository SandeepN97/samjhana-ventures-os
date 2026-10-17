import React, { useEffect, useRef, useState } from 'react';
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
  const [sidebarWidth, setSidebarWidth] = useState(
    () => localStorage.getItem('desktopSidebarCollapsed') === 'true' ? 76 : 256,
  );
  const [resizing, setResizing] = useState(false);
  if (!desktop) return children;

  const collapsed = sidebarWidth <= 76;
  const saveWidth = (width) => {
    const nextWidth = width < 166 ? 76 : 256;
    setSidebarWidth(nextWidth);
    localStorage.setItem('desktopSidebarCollapsed', String(nextWidth === 76));
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar
        collapsed={collapsed}
        width={sidebarWidth}
        resizing={resizing}
        onResizeStart={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setResizing(true);
        }}
        onResize={(event) => setSidebarWidth(Math.max(76, Math.min(256, event.clientX)))}
        onResizeEnd={(event) => {
          setResizing(false);
          saveWidth(event.clientX);
        }}
        onResizeKey={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); saveWidth(76); }
          if (event.key === 'ArrowRight') { event.preventDefault(); saveWidth(256); }
        }}
      />
      <div
        data-testid="desktop-main-offset"
        className={`transition-[padding] duration-200 ease-out ${resizing ? '!transition-none' : ''}`}
        style={{ paddingLeft: `${sidebarWidth}px` }}
      >
        <div className="desktop-main-content mx-auto w-full max-w-[1400px]">{children}</div>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, width, resizing, onResizeStart, onResize, onResizeEnd, onResizeKey }) {
  const { t, i18n } = useTranslation();
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
    <aside
      data-testid="desktop-sidebar"
      data-collapsed={collapsed}
      className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-core-800 text-white ${resizing ? '' : 'transition-[width] duration-200 ease-out'}`}
      style={{ width: `${width}px` }}
    >
      <div className={`flex ${collapsed ? 'min-h-[64px] items-center justify-center px-2' : 'min-h-[88px] items-center px-5 pt-6'}`}>
        <Link
          to="/"
          aria-label={t('nav.home')}
          title={collapsed ? t('nav.home') : undefined}
          aria-current={pathname === '/' ? 'page' : undefined}
          className={`flex min-w-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${collapsed ? 'h-11 w-11 items-center justify-center' : ''} ${pathname === '/' ? 'text-white' : 'text-white/90 hover:text-white'}`}
        >
          {collapsed
            ? <Home className="h-6 w-6" aria-hidden="true" />
            : <Wordmark size="sm" />}
        </Link>
      </div>

      <nav
        aria-label={t('home.menuLabel')}
        className={`flex-1 space-y-4 overflow-y-auto pb-3 ${collapsed ? 'px-2' : 'px-3'}`}
      >
        <section aria-labelledby="shell-businesses">
          <h2 id="shell-businesses" className={`${collapsed ? 'sr-only' : 'px-3 pb-1 text-xs font-bold text-core-300'}`}>{t('home.businessesHeading')}</h2>
          <ul className="space-y-0.5">
            {businesses.map((b) => (
              <Item
                key={b.code}
                to={b.path}
                icon={b.icon}
                label={t(b.tKey)}
                tile={unitTheme(b.unit).tile.split(' ')[0]}
                active={startsWithAny(pathname, BUSINESS_PATHS[b.code] || [b.path])}
                collapsed={collapsed}
              />
            ))}
          </ul>
        </section>

        <section aria-labelledby="shell-work">
          <h2 id="shell-work" className={`${collapsed ? 'sr-only' : 'px-3 pb-1 text-xs font-bold text-core-300'}`}>{t('home.workHeading')}</h2>
          <ul className="space-y-0.5">
            {work.map((w) => (
              <Item key={w.key} to={w.path} icon={w.icon} label={w.label} active={startsWithAny(pathname, w.match)} collapsed={collapsed} />
            ))}
          </ul>
        </section>
      </nav>

      <div className={`border-t border-white/10 ${collapsed ? 'flex flex-col items-center gap-2 p-2' : 'space-y-2 p-3'}`}>
        {collapsed ? (
          <button
            type="button"
            onClick={() => {
              const nextLanguage = i18n.language === 'ne' ? 'en' : 'ne';
              i18n.changeLanguage(nextLanguage);
              localStorage.setItem('preferredLanguage', nextLanguage);
            }}
            aria-label={i18n.language === 'ne' ? t('nav.switchToEnglish') : t('nav.switchToNepali')}
            title={i18n.language === 'ne' ? t('nav.switchToEnglish') : t('nav.switchToNepali')}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <Globe className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : (
          <LanguageToggle className="w-full [&>button]:flex-1" />
        )}
        {!collapsed && (
          <p className="flex items-center gap-2 px-1 text-sm font-semibold text-white/85">
            <User className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{user.fullName || user.username}</span>
          </p>
        )}
        <UserBar
          showName={false}
          compact={collapsed}
          className={collapsed ? 'w-full justify-center' : 'w-full [&>button]:flex-1 [&>button]:justify-center'}
        />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('nav.resizeSidebar')}
        aria-valuemin={76}
        aria-valuemax={256}
        aria-valuenow={width}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onPointerMove={(event) => { if (event.buttons === 1) onResize(event); }}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        onKeyDown={onResizeKey}
        className="absolute right-[-6px] top-0 z-50 h-full w-3 touch-none cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-core-300"
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10 transition-colors hover:bg-white/40" aria-hidden="true" />
      </div>
    </aside>
  );
}

function Item({ to, icon: Icon, label, active, tile, collapsed }) {
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
        title={collapsed ? label : undefined}
        className={`flex min-h-[44px] items-center rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${collapsed ? 'min-h-[48px] justify-center px-0' : 'gap-3 px-3'} ${
          active ? 'bg-white text-core-800' : 'text-white/85 hover:bg-white/10 hover:text-white'
        }`}
      >
        <span className={`grid shrink-0 place-items-center rounded-lg ${collapsed ? 'h-10 w-10' : 'h-8 w-8'} ${tile && !active ? `${tile} text-white` : active ? 'bg-core-100 text-core-800' : 'bg-white/10'}`}>
          <Icon className={collapsed ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden="true" />
        </span>
        <span className={collapsed ? 'sr-only' : 'truncate'}>{label}</span>
      </Link>
    </li>
  );
}
