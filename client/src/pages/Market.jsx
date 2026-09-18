import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { api, fmtDate } from '../api.js';
import { Spinner, EmptyState, ErrorBanner } from '../ui.jsx';

export default function Market() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { api.market().then(setData).catch(setErr); }, []);
  const research = data?.research || [];

  return (
    <div>
      <TopNav />
      <main className="container-wide page">
        <div className="page-head">
          <div>
            <h1>Market Intelligence</h1>
            <p className="muted small">Research collected across your projects.</p>
          </div>
        </div>
        {data?.notice && <div className="banner banner-warn">{data.notice}</div>}
        <ErrorBanner error={err} onRetry={() => api.market().then(setData).catch(setErr)} />
        {!data && !err && <Spinner label="Loading research…" />}
        {data && research.length === 0 && (
          <EmptyState
            title="No research yet"
            text="Research is generated when you run your first project analysis."
            action={<Link to="/app/new" className="btn btn-primary">Create a project</Link>}
          />
        )}
        {research.map((r) => (
          <div className="card mb-16" key={r.id}>
            <div className="spread row-wrap" style={{ cursor: 'pointer' }} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <h3 style={{ margin: 0 }}>{r.projectName}</h3>
                  <span className="badge badge-neutral">{r.depth}</span>
                </div>
                <div className="tiny mt-8">{r.sourceLabel} · {fmtDate(r.createdAt)}</div>
              </div>
              <span className="btn btn-ghost btn-sm">{openId === r.id ? 'Hide' : 'Show'}</span>
            </div>
            {openId === r.id && (
              <div className="fade-in mt-16">
                <div className="grid grid-2">
                  <div>
                    <h4>Market Overview</h4>
                    {r.data.marketOverview?.map((t, i) => <p key={i} className="small muted">{t}</p>)}
                    <h4 className="mt-16">Pricing Landscape</h4>
                    {r.data.pricingLandscape?.map((t, i) => <p key={i} className="small muted">{t}</p>)}
                    <h4 className="mt-16">Trends</h4>
                    {r.data.trends?.map((t, i) => <p key={i} className="small muted">{t}</p>)}
                  </div>
                  <div>
                    <h4>Pain Points</h4>
                    {r.data.painPoints?.map((p) => <p key={p.id} className="small muted">• {p.text}</p>)}
                    <h4 className="mt-16">Opportunities</h4>
                    {r.data.opportunities?.map((t, i) => <p key={i} className="small muted">• {t}</p>)}
                  </div>
                </div>
                <Link to={`/app/projects/${r.projectId}?tab=research`} className="btn btn-secondary btn-sm mt-8">Open in project</Link>
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
