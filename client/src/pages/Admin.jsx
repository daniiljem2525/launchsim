import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { api, fmtDateTime, dayAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Spinner, ErrorBanner, EmptyState } from '../ui.jsx';

export default function Admin() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const load = () => { api.admin().then((d) => { setData(d); setErr(null); }).catch(setErr); };
  useEffect(() => { load(); }, [refreshKey]);

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
            <p className="muted small">Platform overview — users, credits, projects, validations, reports, errors.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setRefreshKey((k) => k + 1)}>Refresh</button>
        </div>
        <ErrorBanner error={err} onRetry={load} />
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
              <UsersCard users={data.users} onChanged={load} />
              <ProjectsCard projects={data.projects} />
              <AnalyticsCard analytics={data.analytics} topEvents={data.topEvents} />
              <JobsCard jobs={data.jobs} />
              <RealTestsCard tests={data.tests} />
              <ErrorsCard errors={data.errors} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function UsersCard({ users, onChanged }) {
  const [amounts, setAmounts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');

  const adjust = async (id, sign) => {
    const raw = Number(amounts[id]);
    if (!Number.isInteger(raw) || raw === 0) { setNotice('Enter a non-zero whole number.'); return; }
    setBusyId(id); setNotice('');
    try {
      const res = await api.adminAdjustCredits(id, sign * Math.abs(raw));
      setNotice(`User #${id}: ${sign > 0 ? '+' : '−'}${Math.abs(res.amount)} credits → ${res.credits} total.`);
      setAmounts((a) => ({ ...a, [id]: '' }));
      onChanged();
    } catch (e) { setNotice(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="card">
      <h3>Users — credits</h3>
      {notice && <div className="banner banner-info">{notice}</div>}
      <table className="table">
        <thead><tr><th>User</th><th>Plan</th><th>Credits</th><th>Adjust</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <b className="small">{u.email}</b>{u.is_admin ? <span className="badge badge-accent" style={{ marginLeft: 6 }}>admin</span> : null}
                <div className="tiny">{u.name} · joined {dayAgo(u.created_at)}</div>
              </td>
              <td>{u.plan}</td>
              <td><b>{u.credits}</b></td>
              <td>
                <div className="row" style={{ gap: 4 }}>
                  <input className="input" style={{ width: 58, padding: '4px 8px' }} type="number" placeholder="N"
                    value={amounts[u.id] ?? ''} onChange={(e) => setAmounts((a) => ({ ...a, [u.id]: e.target.value }))} />
                  <button className="btn btn-sm btn-primary" disabled={busyId === u.id} title={`Grant N credits`} onClick={() => adjust(u.id, +1)}>+</button>
                  <button className="btn btn-sm btn-danger" disabled={busyId === u.id} title={`Deduct N credits`} onClick={() => adjust(u.id, -1)}>−</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tiny mt-8">+ adds N credits, − deducts N credits (never below zero). Every adjustment lands in the user's credit history.</div>
    </div>
  );
}

function ProjectsCard({ projects }) {
  return (
    <div className="card">
      <h3>Projects</h3>
      <table className="table">
        <thead><tr><th>Name</th><th>Owner</th><th>Score</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b>{p.is_demo ? <span className="badge badge-neutral" style={{ marginLeft: 6 }}>demo</span> : null}</td>
              <td className="tiny">{p.owner}</td>
              <td>{p.score ?? '—'}</td>
              <td>{p.status_label || 'draft'}</td>
              <td><Link className="btn btn-sm btn-secondary" to={`/app/projects/${p.id}`}>Open</Link></td>
            </tr>
          ))}
          {!projects.length && <tr><td colSpan="5" className="tiny">No projects yet.</td></tr>}
        </tbody>
      </table>
      <div className="tiny mt-8">As an admin you can open any project — research, simulations, real tests and full reports included.</div>
    </div>
  );
}

function AnalyticsCard({ analytics, topEvents }) {
  return (
    <div className="card">
      <h3>Analytics (14 days)</h3>
      <table className="table">
        <thead><tr><th>Day</th><th>Signups</th><th>Projects</th><th>Simulations</th><th>Subs</th></tr></thead>
        <tbody>
          {(analytics || []).map((a) => (
            <tr key={a.day}><td className="mono">{a.day}</td><td>{a.signups}</td><td>{a.projects_created}</td><td>{a.simulations_completed}</td><td>{a.subscriptions}</td></tr>
          ))}
          {!(analytics || []).length && <tr><td colSpan="5" className="tiny">No data yet.</td></tr>}
        </tbody>
      </table>
      <hr className="divider" />
      <h4>Top events</h4>
      {(topEvents || []).map((e) => (
        <div className="spread small" key={e.name} style={{ padding: '4px 0' }}><span className="mono">{e.name}</span><b>{e.c}</b></div>
      ))}
    </div>
  );
}

function JobsCard({ jobs }) {
  return (
    <div className="card">
      <h3>Research jobs</h3>
      <table className="table">
        <thead><tr><th>Project</th><th>Status</th><th>Provider</th><th>Depth</th></tr></thead>
        <tbody>
          {(jobs || []).slice(0, 12).map((j) => (
            <tr key={j.id}><td>{j.project}</td><td><span className="badge badge-launch">{j.status}</span></td><td>{j.provider}</td><td>{j.depth}</td></tr>
          ))}
          {!(jobs || []).length && <tr><td colSpan="4" className="tiny">No research jobs yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function RealTestsCard({ tests }) {
  return (
    <div className="card">
      <h3>Real tests & reports</h3>
      <table className="table">
        <thead><tr><th>Project</th><th>Channel</th><th>Budget</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(tests || []).map((t) => (
            <tr key={t.id}>
              <td><b>{t.project}</b></td>
              <td>{t.channel}</td>
              <td>${t.budget}</td>
              <td><span className="badge badge-neutral">{t.status}</span></td>
              <td><Link className="btn btn-sm btn-secondary" to={`/app/projects/${t.projectId ?? t.id}?tab=reports`}>Report</Link></td>
            </tr>
          ))}
          {!(tests || []).length && <tr><td colSpan="5" className="tiny">No real tests yet.</td></tr>}
        </tbody>
      </table>
      <div className="tiny mt-8">Report opens the project's Reports tab — full validation report with the funnel, marketing vision and verdicts.</div>
    </div>
  );
}

function ErrorsCard({ errors }) {
  return (
    <div className="card">
      <h3>Errors</h3>
      {!(errors || []).length && <div className="small muted">No errors logged. 🎉</div>}
      {(errors || []).slice(0, 10).map((e) => (
        <div key={e.id} className="small mb-8" style={{ borderLeft: '2px solid var(--kill)', paddingLeft: 10 }}>
          <span className="mono tiny">{e.scope}</span> — <span className="tiny">{e.message.slice(0, 140)}</span>
        </div>
      ))}
    </div>
  );
}
