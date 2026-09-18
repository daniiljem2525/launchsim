import React, { useEffect, useState } from 'react';
import TopNav from '../components/TopNav.jsx';
import { api, fmtDateTime, dayAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorBanner, EmptyState } from '../ui.jsx';

export default function Admin() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { api.admin().then(setData).catch(setErr); }, []);

  if (user && !user.isAdmin) {
    return (
      <div>
        <TopNav />
        <main className="container-wide page">
          <EmptyState title="Admin access required" text="This area is only for LaunchSim administrators." />
        </main>
      </div>
    );
  }

  return (
    <div>
      <TopNav />
      <main className="container-wide page">
        <div className="page-head">
          <div>
            <h1>Admin</h1>
            <p className="muted small">Platform overview — users, projects, simulations, credits, errors.</p>
          </div>
        </div>
        <ErrorBanner error={err} onRetry={() => api.admin().then(setData).catch(setErr)} />
        {!data && !err && <Spinner label="Loading admin data…" />}
        {data && (
          <>
            <div className="grid grid-4 mb-24">
              {[
                ['Users', data.counts.users], ['Projects', data.counts.projects], ['Simulations', data.counts.simulations],
                ['AI credits used', data.counts.creditsSpent], ['Active subscriptions', data.counts.subscriptions],
                ['Real tests', data.counts.realTests], ['Errors logged', data.counts.errors], ['Sim credits', data.aiUsage],
              ].map(([k, v]) => (
                <div className="card-plain" key={k}><div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>{k}</div><div className="stat-num" style={{ fontSize: 24 }}>{v}</div></div>
              ))}
            </div>

            <div className="grid grid-2">
              <div className="card">
                <h3>Users</h3>
                <table className="table">
                  <thead><tr><th>Email</th><th>Plan</th><th>Credits</th><th>Joined</th></tr></thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id}><td>{u.email}{u.is_admin ? <span className="badge badge-accent" style={{ marginLeft: 6 }}>admin</span> : null}</td><td>{u.plan}</td><td>{u.credits}</td><td className="tiny">{dayAgo(u.created_at)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Projects</h3>
                <table className="table">
                  <thead><tr><th>Name</th><th>Owner</th><th>Score</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.projects.map((p) => (
                      <tr key={p.id}><td>{p.name}{p.is_demo ? ' 🔒demo' : ''}</td><td className="tiny">{p.owner}</td><td>{p.score ?? '—'}</td><td>{p.status_label || 'draft'}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Analytics (14 days)</h3>
                <table className="table">
                  <thead><tr><th>Day</th><th>Signups</th><th>Projects</th><th>Simulations</th><th>Subs</th></tr></thead>
                  <tbody>
                    {data.analytics.map((a) => (
                      <tr key={a.day}><td className="mono">{a.day}</td><td>{a.signups}</td><td>{a.projects_created}</td><td>{a.simulations_completed}</td><td>{a.subscriptions}</td></tr>
                    ))}
                    {!data.analytics.length && <tr><td colSpan="5" className="tiny">No data yet.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Top events</h3>
                {data.topEvents.map((e) => (
                  <div className="spread small" key={e.name} style={{ padding: '4px 0' }}><span className="mono">{e.name}</span><b>{e.c}</b></div>
                ))}
                {!data.topEvents.length && <div className="tiny">No events yet.</div>}
              </div>
              <div className="card">
                <h3>Research jobs</h3>
                <table className="table">
                  <thead><tr><th>Project</th><th>Status</th><th>Provider</th><th>Depth</th></tr></thead>
                  <tbody>
                    {data.jobs.slice(0, 12).map((j) => (
                      <tr key={j.id}><td>{j.project}</td><td><span className="badge badge-launch">{j.status}</span></td><td>{j.provider}</td><td>{j.depth}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <h3>Errors</h3>
                {data.errors.length === 0 && <div className="small muted">No errors logged. 🎉</div>}
                {data.errors.slice(0, 10).map((e) => (
                  <div key={e.id} className="small mb-8" style={{ borderLeft: '2px solid var(--kill)', paddingLeft: 10 }}>
                    <span className="mono tiny">{e.scope}</span> — <span className="tiny">{e.message.slice(0, 140)}</span>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3>Real tests</h3>
                <table className="table">
                  <thead><tr><th>Project</th><th>Channel</th><th>Budget</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.tests.map((t) => (
                      <tr key={t.id}><td>{t.project}</td><td>{t.channel}</td><td>${t.budget}</td><td><span className="badge badge-neutral">{t.status}</span></td></tr>
                    ))}
                    {!data.tests.length && <tr><td colSpan="4" className="tiny">No real tests yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
