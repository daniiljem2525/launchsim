import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useLang, LangToggle } from '../i18n.jsx';

export function Brand({ light }) {
  return (
    <Link to="/" className="brand" style={light ? { color: '#fff' } : undefined}>
      <span className="brand-mark" style={light ? { background: '#fff', color: '#0a0a0b' } : undefined}>L</span>
      LaunchSim
    </Link>
  );
}

export default function TopNav() {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const links = [
    { to: '/app', label: t('nav.dashboard'), end: true },
    { to: '/app/experiments', label: t('nav.experiments') },
    { to: '/app/market', label: t('nav.market') },
    { to: '/app/account', label: t('nav.account') },
  ];
  return (
    <header className="topnav">
      <div className="container-wide topnav-inner">
        <Brand />
        {user && (
          <nav className="navlinks">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'navlink' + (isActive ? ' on' : '')}>{l.label}</NavLink>
            ))}
            {user.isAdmin && <NavLink to="/app/admin" className={({ isActive }) => 'navlink' + (isActive ? ' on' : '')}>{t('nav.admin')}</NavLink>}
          </nav>
        )}
        <div className="nav-cta">
          <LangToggle />
          {user ? (
            <>
              <span className="credits-pill" title="AI credits remaining">◈ {user.credits} {t('nav.credits')}</span>
              <Link to="/app/new" className="btn btn-primary btn-sm">{t('nav.newProject')}</Link>
              <button className="avatar" title={user.email} onClick={async () => { await logout(); nav('/'); }}>
                {(user.name || user.email || '?')[0].toUpperCase()}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">{t('auth.login')}</Link>
              <Link to="/signup" className="btn btn-dark btn-sm">{t('auth.startFree')}</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
