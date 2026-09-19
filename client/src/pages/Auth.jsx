import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Brand } from '../components/TopNav.jsx';
import { useAuth } from '../auth.jsx';
import { useLang } from '../i18n.jsx';
import { api } from '../api.js';

function Shell({ title, sub, children }) {
  return (
    <div>
      <div className="container-wide" style={{ paddingTop: 22, paddingBottom: 12 }}>
        <Brand />
      </div>
      <div className="auth-wrap">
        <h2 style={{ textAlign: 'center' }}>{title}</h2>
        <p className="muted small center mb-16">{sub}</p>
        <div className="auth-card">{children}</div>
      </div>
    </div>
  );
}

const GoogleBtn = () => {
  const { t } = useLang();
  const [msg, setMsg] = useState('');
  const tryGoogle = async () => {
    try {
      const res = await fetch('/api/auth/google');
      if (res.status === 501) {
        const d = await res.json();
        setMsg(d.error?.message || t('auth.googleNotConfigured'));
      } else if (res.redirected) {
        window.location.href = res.url;
      }
    } catch { setMsg(t('auth.googleNotConfigured')); }
  };
  return (
    <div>
      <button className="oauth-btn" onClick={tryGoogle}>
        <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/><path fill="#FBBC05" d="M10.4 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.8l7.8-6.1z"/><path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.4-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.9 2.3-6.3 0-11.7-3.7-13.6-9.3l-7.8 6.1C6.5 42.6 14.6 48 24 48z"/></svg>
        {t('auth.google')}
      </button>
      {msg && <div className="tiny mt-8" style={{ color: 'var(--pivot)' }}>{msg}</div>}
    </div>
  );
};

export function Login() {
  const { setUser } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const d = await api.login({ email, password });
      setUser(d.user);
      nav('/app');
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <Shell title={t("auth.welcomeBack")} sub={t("auth.signInSub")}>
      <form onSubmit={submit}>
        {err && <div className="banner banner-error">{err}</div>}
        <div className="field"><label className="label">{t("auth.email")}</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        <div className="field"><label className="label">{t("auth.password")}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required /></div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? t('auth.signingIn') : t('auth.signInBtn')}</button>
      </form>
      <div className="center small muted mt-16 mb-16">{t('auth.or')}</div>
      <GoogleBtn />
      <div className="spread mt-16 small">
        <Link to="/forgot" className="muted">{t("auth.forgot")}</Link>
        <Link to="/signup">{t("auth.createAccount")}</Link>
      </div>
    </Shell>
  );
}

export function Signup() {
  const { setUser } = useAuth();
  const { t } = useLang();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/app';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const d = await api.signup({ name, email, password });
      setUser(d.user);
      nav(next);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <Shell title={t("auth.createTitle")} sub={t("auth.createSub")}>
      <form onSubmit={submit}>
        {err && <div className="banner banner-error">{err}</div>}
        <div className="field"><label className="label">{t("auth.name")}</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Founder" /></div>
        <div className="field"><label className="label">{t("auth.email")}</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
        <div className="field"><label className="label">{t("auth.password")}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.min8")} required minLength={8} /></div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? t('auth.creating') : t('auth.createBtn')}</button>
      </form>
      <div className="center small muted mt-16 mb-16">{t('auth.or')}</div>
      <GoogleBtn />
      <div className="center small mt-16">{t('auth.hasAccount')} <Link to="/login">{t('auth.login')}</Link></div>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { setRes(await api.forgot({ email })); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Forgot password" sub="We’ll create a reset link for your account.">
      {res ? (
        <div>
          <div className="banner banner-success">{res.message}</div>
          {res.devToken && (
            <div className="banner banner-warn">
              <div>
                {res.devNote}<br />
                <Link className="mono" to={`/reset?token=${res.devToken}`}>/reset?token={res.devToken.slice(0, 10)}…</Link>
              </div>
            </div>
          )}
          <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }}>Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit}>
          {err && <div className="banner banner-error">{err}</div>}
          <div className="field"><label className="label">{t("auth.email")}</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Working…' : 'Create reset link'}</button>
          <div className="center small mt-16"><Link to="/login" className="muted">Back to sign in</Link></div>
        </form>
      )}
    </Shell>
  );
}

export function Reset() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try { await api.reset({ token, password }); setOk(true); } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <Shell title="Set a new password" sub="Choose a new password for your account.">
      {ok ? (
        <div>
          <div className="banner banner-success">Password updated. You can sign in now.</div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => nav('/login')}>Go to sign in</button>
        </div>
      ) : (
        <form onSubmit={submit}>
          {err && <div className="banner banner-error">{err}</div>}
          <div className="field"><label className="label">Reset token</label>
            <input className="input mono" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the token from the reset link" required /></div>
          <div className="field"><label className="label">New password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.min8")} required minLength={8} /></div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
        </form>
      )}
    </Shell>
  );
}
