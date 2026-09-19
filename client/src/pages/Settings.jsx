import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { useAuth } from '../auth.jsx';
import { useLang } from '../i18n.jsx';
import { api, fmtDate } from '../api.js';

export default function Settings() {
  const { user, refresh, logout } = useAuth();
  const { lang, setLang, t } = useLang();
  const nav = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [profileMsg, setProfileMsg] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [passMsg, setPassMsg] = useState(null); // { ok, text }
  const [passBusy, setPassBusy] = useState(false);

  if (!user) return null;

  const saveProfile = async () => {
    setProfileBusy(true); setProfileMsg('');
    try { await api.updateMe({ name }); await refresh(); setProfileMsg(t('set.saved')); }
    catch (e) { setProfileMsg(e.message); }
    finally { setProfileBusy(false); }
  };

  const changePass = async (e) => {
    e.preventDefault();
    setPassBusy(true); setPassMsg(null);
    try {
      await api.changePassword({ currentPassword: currentPass, newPassword: newPass });
      setPassMsg({ ok: true, text: t('set.passOk') });
      setCurrentPass(''); setNewPass('');
    } catch (e2) {
      setPassMsg({ ok: false, text: e2.code === 'bad_credentials' ? t('set.passWrong') : e2.message });
    } finally { setPassBusy(false); }
  };

  return (
    <div>
      <TopNav />
      <main className="container page" style={{ maxWidth: 720 }}>
        <div className="page-head">
          <div>
            <h1>{t('set.title')}</h1>
            <p className="muted small">{t('set.sub')}</p>
          </div>
          <div className="avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
            {(user.name || user.email || '?')[0].toUpperCase()}
          </div>
        </div>

        <div className="card mb-16">
          <h3>{t('set.profile')}</h3>
          <div className="field"><label className="label">{t('auth.name')}</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label className="label">{t('set.email')}</label>
            <input className="input" value={user.email} disabled /></div>
          <div className="spread row-wrap">
            <span className="tiny">{t('set.member')} {fmtDate(user.createdAt)} · {t('set.plan')}: <b>{(user.plan || 'free').toUpperCase()}</b> · ◈ {user.credits}</span>
            <button className="btn btn-secondary" onClick={saveProfile} disabled={profileBusy}>{profileBusy ? '…' : t('set.save')}</button>
          </div>
          {profileMsg && <div className="tiny mt-8" style={{ color: 'var(--launch)' }}>{profileMsg}</div>}
        </div>

        <div className="card mb-16">
          <h3>{t('set.language')}</h3>
          <div className="row-wrap">
            {[['ru', 'Русский'], ['en', 'English']].map(([code, label]) => (
              <span key={code} className={'chip' + (lang === code ? ' on' : '')} onClick={() => setLang(code)}>{label}</span>
            ))}
          </div>
          <div className="tiny mt-8">{t('set.languageHint')}</div>
        </div>

        <div className="card mb-16">
          <h3>{t('set.pass')}</h3>
          <form onSubmit={changePass}>
            <div className="field"><label className="label">{t('set.currentPass')}</label>
              <input className="input" type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} required /></div>
            <div className="field"><label className="label">{t('set.newPass')}</label>
              <input className="input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={8} placeholder={t('auth.min8')} /></div>
            {passMsg && <div className={'banner ' + (passMsg.ok ? 'banner-success' : 'banner-error')}>{passMsg.text}</div>}
            <button className="btn btn-primary" disabled={passBusy || !currentPass || newPass.length < 8}>{passBusy ? '…' : t('set.update')}</button>
          </form>
        </div>

        <div className="card">
          <div className="spread row-wrap">
            <div>
              <h3 style={{ margin: 0 }}>{t('set.plan')}</h3>
              <span className="tiny">{(user.plan || 'free').toUpperCase()} · ◈ {user.credits} {t('nav.credits')}</span>
            </div>
            <Link to="/app/account" className="btn btn-secondary btn-sm">{t('set.planLink')}</Link>
          </div>
          <hr className="divider" />
          <button className="btn btn-danger" onClick={async () => { await logout(); nav('/'); }}>{t('set.signOut')}</button>
        </div>
      </main>
    </div>
  );
}
