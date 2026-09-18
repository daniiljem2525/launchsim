import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

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
  const nav = useNavigate();
  const links = [
    { to: '/app', label: 'Dashboard', end: true },
    { to: '/app/experiments', label: 'Experiments' },
    { to: '/app/market', label: 'Market Intelligence' },
    { to: '/app/account', label: 'Account' },
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
            {user.isAdmin && <NavLink to="/app/admin" className={({ isActive }) => 'navlink' + (isActive ? ' on' : '')}>Admin</NavLink>}
          </nav>
        )}
        <div className="nav-cta">
          {user ? (
            <>
              <span className="credits-pill" title="AI credits remaining">◈ {user.credits} credits</span>
              <Link to="/app/new" className="btn btn-primary btn-sm">+ New Project</Link>
              <button className="avatar" title={user.email + ' — sign out'} onClick={async () => { await logout(); nav('/'); }}>
                {(user.name || user.email || '?')[0].toUpperCase()}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/signup" className="btn btn-dark btn-sm">Start free</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
