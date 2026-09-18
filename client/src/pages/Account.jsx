import React, { useEffect, useState } from 'react';
import TopNav from '../components/TopNav.jsx';
import { api, fmtMoney, fmtDateTime } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorBanner, KV } from '../ui.jsx';

const CREDIT_COSTS = [
  ['Basic simulation', '1 credit', '100 simulated profiles'],
  ['Standard simulation', '2 credits', '500 simulated profiles'],
  ['Advanced simulation', '5 credits', '1000 profiles + deeper funnel'],
  ['Deep research', '3 credits', 'Extended research pass'],
  ['Real test analysis', '5 credits', 'Demo run + accuracy report'],
];

export default function Account() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(user?.name || '');

  const load = async () => { try { setData(await api.billing()); } catch (e) { setErr(e); } };
  useEffect(() => { load(); }, []);

  const upgrade = async (planId) => {
    setBusy(true); setErr(null); setNotice('');
    try {
      const res = await api.checkout(planId);
      if (res.redirectUrl) { window.location.href = res.redirectUrl; return; }
      setNotice(res.notice);
      await refresh(); await load();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const saveProfile = async () => {
    setBusy(true); setErr(null);
    try { await api.updateMe({ name }); await refresh(); setNotice('Profile updated.'); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div>
      <TopNav />
      <main className="container page" style={{ maxWidth: 960 }}>
        <div className="page-head">
          <div>
            <h1>Account</h1>
            <p className="muted small">Profile, plan, credits and billing.</p>
          </div>
        </div>
        {notice && <div className="banner banner-success">{notice}</div>}
        <ErrorBanner error={err} onRetry={load} />

        <div className="grid grid-2">
          <div className="card">
            <h3>Profile</h3>
            <div className="field"><label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field"><label className="label">Email</label>
              <input className="input" value={user?.email || ''} disabled /></div>
            <button className="btn btn-secondary" onClick={saveProfile} disabled={busy}>Save</button>
            <hr className="divider" />
            <button className="btn btn-danger btn-sm" onClick={async () => { await api.logout(); window.location.href = '/'; }}>Sign out</button>
          </div>

          <div className="card">
            <h3>Usage</h3>
            <KV k="Plan" v={(data?.plan || user?.plan || 'free').toUpperCase()} />
            <KV k="Credits available" v={String(data?.credits ?? user?.credits ?? '—')} />
            {data?.subscription && <KV k="Subscription" v={`${data.subscription.plan} · renews ${fmtDateTime(data.subscription.currentPeriodEnd)}`} />}
            <hr className="divider" />
            <h4>Credit costs</h4>
            {CREDIT_COSTS.map(([k, v, d]) => (
              <div className="spread small" key={k} style={{ padding: '4px 0' }}>
                <span>{k} <span className="tiny">· {d}</span></span><b>{v}</b>
              </div>
            ))}
          </div>
        </div>

        <h2 className="mt-32 mb-16">Plans</h2>
        {!data && <Spinner />}
        {data && (
          <div className="grid grid-4">
            {data.plans.map((p) => (
              <div key={p.id} className={'card' + (p.id === data.plan ? '' : ' card-plain')} style={p.id === data.plan ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}>
                <div className="spread">
                  <h3 style={{ margin: 0 }}>{p.name}</h3>
                  {p.id === data.plan && <span className="badge badge-accent">Current</span>}
                </div>
                <div className="row" style={{ alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                  <span className="stat-num" style={{ fontSize: 24 }}>{p.priceLabel}</span>
                  <span className="tiny">{p.period}</span>
                </div>
                <div className="small muted mt-8">{p.credits} credits · {p.note}</div>
                {p.id !== 'free' && (
                  <button className="btn btn-dark mt-16" style={{ width: '100%' }} disabled={busy || p.id === data.plan} onClick={() => upgrade(p.id)}>
                    {p.id === data.plan ? 'Active' : 'Choose ' + p.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {data && !data.stripeConfigured && (
          <div className="tiny mt-16">Billing runs in demo mode: checkout activates plans instantly without real payment. The Stripe integration point is prepared — set STRIPE_SECRET_KEY to enable real checkout.</div>
        )}

        <h2 className="mt-32 mb-16">Credit history</h2>
        <div className="card">
          <table className="table">
            <thead><tr><th>When</th><th>Change</th><th>Reason</th></tr></thead>
            <tbody>
              {(data?.transactions || []).map((t) => (
                <tr key={t.id}>
                  <td className="tiny">{fmtDateTime(t.at)}</td>
                  <td style={{ color: t.amount > 0 ? 'var(--launch)' : 'var(--ink)' }}><b>{t.amount > 0 ? '+' : ''}{t.amount}</b></td>
                  <td className="small">{t.reason}</td>
                </tr>
              ))}
              {data && data.transactions.length === 0 && <tr><td colSpan="3" className="tiny">No credit transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
