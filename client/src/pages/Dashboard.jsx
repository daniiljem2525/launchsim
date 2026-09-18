import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { useAuth } from '../auth.jsx';
import { api, dayAgo } from '../api.js';
import { StatusBadge, Spinner, EmptyState } from '../ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  const load = async () => {
    try { setData(await api.projects()); } catch (e) { setErr(e); }
  };
  useEffect(() => { load(); }, []);

  const projects = data?.projects || [];
  const tested = projects.filter((p) => p.statusLabel === 'TEST' || p.statusLabel === 'LAUNCH').length;

  return (
    <div>
      <TopNav />
      <main className="container-wide page">
        <div className="page-head">
          <div>
            <h1>Dashboard</h1>
            <p className="muted small">Test your assumptions. Find your biggest risk. {user?.name ? `Welcome back, ${user.name}.` : ''}</p>
          </div>
          <div className="row">
            <Link to="/app/new" className="btn btn-primary">+ New Project</Link>
          </div>
        </div>

        {err && <div className="banner banner-error">{err.message}</div>}

        <div className="grid grid-4 mb-24">
          {[
            ['Projects', projects.length],
            ['Simulations run', projects.reduce((s, p) => s + p.simulations, 0)],
            ['Ready to test', tested],
            ['Credits left', user?.credits ?? '—'],
          ].map(([k, v]) => (
            <div className="card-plain" key={k}>
              <div className="tiny" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
              <div className="stat-num">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="mb-16">Your projects</h2>
        {!data && !err && <Spinner label="Loading projects…" />}
        {data && projects.length === 0 && (
          <EmptyState
            title="No projects yet"
            text="Create your first project and run a simulation before writing a line of code."
            action={<Link to="/app/new" className="btn btn-primary">Test an idea</Link>}
          />
        )}
        <div className="grid grid-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/app/projects/${p.id}`} className="card card-hover" onClick={() => api.event('project_opened', p.id)}>
              <div className="spread">
                <div>
                  <div className="row" style={{ gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{p.name}</h3>
                  </div>
                  <div className="tiny mt-8">Created {dayAgo(p.createdAt)} · updated {dayAgo(p.updatedAt)}</div>
                </div>
                <div className="center">
                  <div className="stat-num" style={{ fontSize: 26 }}>{p.score ?? '—'}</div>
                  <div className="tiny">{p.score != null ? '/ 100' : 'no score'}</div>
                </div>
              </div>
              <div className="row-wrap mt-16">
                <StatusBadge label={p.statusLabel} />
                <span className="tiny">{p.iterations} iteration{p.iterations === 1 ? '' : 's'} · {p.simulations} simulation{p.simulations === 1 ? '' : 's'}</span>
              </div>
              <div className="tiny mt-8">
                {p.latestTest
                  ? p.latestTest.status === 'RUNNING'
                    ? <span className="badge badge-test pulse">VALIDATION RUNNING</span>
                    : `Latest real test: ${p.latestTest.status.toLowerCase()} · ${p.latestTest.channel}`
                  : 'No real test yet'}
              </div>
            </Link>
          ))}
        </div>

        {data && projects.length > 0 && (
          <div className="card mt-32" style={{ background: 'var(--bg-soft)' }}>
            <div className="spread row-wrap">
              <div>
                <h3 style={{ marginBottom: 4 }}>Ready for a real test?</h3>
                <p className="muted small" style={{ margin: 0 }}>Projects scoring 71+ are worth validating with a small ad budget before you build.</p>
              </div>
              {projects.some((p) => (p.score ?? 0) >= 71)
                ? <button className="btn btn-dark" onClick={() => nav(`/app/projects/${projects.find((p) => (p.score ?? 0) >= 71).id}?tab=realtest`)}>Open a test-ready project</button>
                : <Link to="/app/new" className="btn btn-secondary">Run another simulation</Link>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
