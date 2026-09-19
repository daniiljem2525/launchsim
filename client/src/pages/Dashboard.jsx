import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { useAuth } from '../auth.jsx';
import { useLang } from '../i18n.jsx';
import { api, dayAgo } from '../api.js';
import { StatusBadge, Spinner, EmptyState } from '../ui.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLang();
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
            <h1>{t('dash.title')}</h1>
            <p className="muted small">{t('dash.sub1')} {t('dash.sub2')} {user?.name ? `${t('dash.welcome')} ${user.name}.` : ''}</p>
          </div>
          <div className="row">
            <Link to="/app/new" className="btn btn-primary">+ New Project</Link>
          </div>
        </div>

        {err && <div className="banner banner-error">{err.message}</div>}

        <div className="grid grid-4 mb-24">
          {[
            [t('dash.projects'), projects.length],
            [t('dash.simulations'), projects.reduce((s, p) => s + p.simulations, 0)],
            [t('dash.readyToTest'), tested],
            [t('dash.creditsLeft'), user?.credits ?? '—'],
          ].map(([k, v]) => (
            <div className="card-plain" key={k}>
              <div className="tiny" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>{k}</div>
              <div className="stat-num">{v}</div>
            </div>
          ))}
        </div>

        <h2 className="mb-16">{t('dash.yourProjects')}</h2>
        {!data && !err && <Spinner label="Loading projects…" />}
        {data && projects.length === 0 && (
          <EmptyState
            title={t("dash.noProjects")}
            text={t("dash.noProjectsText")}
            action={<Link to="/app/new" className="btn btn-primary">{t("dash.testIdea")}</Link>}
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
                <span className="tiny">{p.iterations} {p.iterations === 1 ? t('dash.iteration') : t('dash.iterations')} · {p.simulations} {p.simulations === 1 ? t('dash.simulation') : t('dash.simulationsMany')}</span>
              </div>
              <div className="tiny mt-8">
                {p.latestTest
                  ? p.latestTest.status === 'RUNNING'
                    ? <span className="badge badge-test pulse">VALIDATION RUNNING</span>
                    : `${t('dash.latestRealTest')} ${p.latestTest.status.toLowerCase()} · ${p.latestTest.channel}`
                  : t('dash.noRealTest')}
              </div>
            </Link>
          ))}
        </div>

        {data && projects.length > 0 && (
          <div className="card mt-32" style={{ background: 'var(--bg-soft)' }}>
            <div className="spread row-wrap">
              <div>
                <h3 style={{ marginBottom: 4 }}>{t('dash.readyForReal')}</h3>
                <p className="muted small" style={{ margin: 0 }}>{t('dash.readySub')}</p>
              </div>
              {projects.some((p) => (p.score ?? 0) >= 71)
                ? <button className="btn btn-dark" onClick={() => nav(`/app/projects/${projects.find((p) => (p.score ?? 0) >= 71).id}?tab=realtest`)}>{t('dash.openTestReady')}</button>
                : <Link to="/app/new" className="btn btn-secondary">{t("dash.runAnother")}</Link>}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
