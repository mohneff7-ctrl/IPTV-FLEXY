import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useT, type I18nKey } from '../lib/i18n';
import { cx } from '../lib/format';
import { Logo } from './Logo';
import {
  IconBack,
  IconGear,
  IconBall,
  IconHeart,
  IconHome,
  IconMask,
  IconMenu,
  IconMovie,
  IconPuzzle,
  IconSearch,
  IconSeries,
  IconShare,
  IconTv,
} from './Icons';
import { toast } from './ui';

export const NAV: { to: string; key: I18nKey; icon: (p: { size?: number }) => ReactNode }[] = [
  { to: '/', key: 'home', icon: IconHome },
  { to: '/browse/series', key: 'series', icon: IconSeries },
  { to: '/browse/movie', key: 'movies', icon: IconMovie },
  { to: '/channels', key: 'channels', icon: IconTv },
  { to: '/matches', key: 'matches', icon: IconBall },
  { to: '/browse/anime', key: 'anime', icon: IconMask },
  { to: '/addons', key: 'addons', icon: IconPuzzle },
];

/** The phone tab bar mirrors the reference: Addons lives in the menu instead. */
const BOTTOM_NAV = NAV.filter((n) => n.to !== '/addons');

export function BottomNav() {
  const t = useT();
  return (
    <nav className="bottom-nav" aria-label="main">
      {BOTTOM_NAV.map(({ to, key, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('bn-item', isActive && 'active')}>
          <Icon size={24} />
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export async function shareApp(title = 'FLEXY', url = location.href.split('#')[0]) {
  try {
    if (navigator.share) await navigator.share({ title, url });
    else {
      await navigator.clipboard.writeText(url);
      toast('✓ ' + url);
    }
  } catch {
    /* user cancelled */
  }
}

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const loc = useLocation();
  useEffect(onClose, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const extra: { to: string; key: I18nKey; icon: (p: { size?: number }) => ReactNode }[] = [
    { to: '/search', key: 'search', icon: IconSearch },
    { to: '/favorites', key: 'favorites', icon: IconHeart },
    { to: '/settings', key: 'settings', icon: IconGear },
  ];
  return (
    <div className={cx('drawer-root', open && 'open')} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-logo">
          <Logo size={52} />
        </div>
        <div className="drawer-group">
          {NAV.map(({ to, key, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('drawer-item', isActive && 'active')}>
              <Icon size={24} />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </div>
        <div className="drawer-group">
          {extra.map(({ to, key, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('drawer-item', isActive && 'active')}>
              <Icon size={24} />
              <span>{t(key)}</span>
            </NavLink>
          ))}
        </div>
        <div className="drawer-group">
          <button className="drawer-item" onClick={() => shareApp()}>
            <IconShare size={24} />
            <span>{t('shareApp')}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}

/** The floating header used on main tabs (menu + quick actions). */
export function TopBar({ onMenu, solid }: { onMenu: () => void; solid?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const t = useT();
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <header className={cx('topbar', (scrolled || solid) && 'scrolled')}>
      <button className="icon-btn" onClick={onMenu} aria-label="menu">
        <IconMenu size={28} />
      </button>
      <Link to="/" className="topbar-logo">
        <Logo size={30} />
      </Link>
      <nav className="topbar-links">
        {NAV.map(({ to, key }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cx('topbar-link', isActive && 'active')}>
            {t(key)}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-actions">
        <Link to="/search" className="icon-btn" aria-label={t('search')}>
          <IconSearch size={25} />
        </Link>
        <Link to="/favorites" className="icon-btn" aria-label={t('favorites')}>
          <IconHeart size={25} />
        </Link>
        <Link to="/settings" className="icon-btn" aria-label={t('settings')}>
          <IconGear size={26} />
        </Link>
      </div>
    </header>
  );
}

/** Simple page header with a back arrow and a title (settings, search…). */
export function PageHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="page-header">
      <button className="icon-btn flip-rtl" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="back">
        <IconBack size={26} />
      </button>
      <h1>{title}</h1>
      <div className="page-header-right">{right}</div>
    </header>
  );
}
