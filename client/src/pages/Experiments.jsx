import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { api, fmtMoney, fmtDateTime } from '../api.js';
import { Spinner, EmptyState, ErrorBanner, KV } from '../ui.jsx';

const STATUSES = { DRAFT: 'badge-neutral', RUNNING: 'badge-test', COMPLETED: 'badge-launch', CANCELLED: 'badge-kill' };

export default function Experiments() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ projectId: '', hypothesis: '', controlLabel: 'Control', controlPrice: 9, controlPositioning: 'generic positioning', variantLabel: 'Variant', variantPrice: 11, variantPositioning: 'verification guarantee' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [ex, pr] = await Promise.all([api.experiments(), api.projects()]);
      setData(ex); setProjects(pr.projects);
      if (!form.projectId && pr.projects.length) setForm((f) => ({ ...f, projectId: String(pr.projects[0].id) }));
    } catch (e) { setErr(e); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      await api.createExperiment({
        projectId: form.projectId,
        hypothesis: form.hypothesis,
        control: { label: form.controlLabel, price: Number(form.controlPrice), positioning: form.controlPositioning },
        variant: { label: form.variantLabel, price: Number(form.variantPrice), positioning: form.variantPositioning },
      });
      setForm((f) => ({ ...f, hypothesis: '' }));
      await load();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const run = async (id) => {
    setBusy(true); setErr(null);
    try { await api.runExperiment(id, {}); await load(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const experiments = data?.experiments || [];

  return (
    <div>
      <TopNav />
      <main className="container-wide page">
        <div className="page-head">
          <div>
            <h1>Experiments</h1>
            <p className="muted small">Test one assumption at a time: control vs variant, simulated first.</p>
          </div>
        </div>
        <ErrorBanner error={err} onRetry={load} />

        <div className="grid grid-side">
          <div>
            {!data && !err && <Spinner label="Loading experiments…" />}
            {data && experiments.length === 0 && (
              <EmptyState title="No experiments yet" text="Create your first experiment on the right — LaunchSim will simulate both sides and pick a winner." />
            )}
            {experiments.map((x) => (
              <div className="card mb-16" key={x.id}>
                <div className="spread row-wrap">
                  <div className="row">
                    <span className={STATUSES[x.status] + ' badge'}>{x.status}</span>
                    <Link to={`/app/projects/${x.projectId}`} className="tiny">{x.projectName}</Link>
                  </div>
                  <div className="row">
                    {x.status === 'DRAFT' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(x.id)}>Run simulation</button>}
                    {x.status === 'RUNNING' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(x.id)}>Complete</button>}
                  </div>
                </div>
                <p style={{ fontWeight: 560, margin: '10px 0' }}>“{x.hypothesis}”</p>
                <div className="grid grid-2">
                  <div className="persona">
                    <span className="badge badge-neutral">{x.control.label || 'Control'}</span>
                    <KV k="Price" v={x.control.price != null ? fmtMoney(x.control.price) : '—'} />
                    <KV k="Positioning" v={x.control.positioning || '—'} />
                  </div>
                  <div className="persona">
                    <span className="badge badge-accent">{x.variant.label || 'Variant'}</span>
                    <KV k="Price" v={x.variant.price != null ? fmtMoney(x.variant.price) : '—'} />
                    <KV k="Positioning" v={x.variant.positioning || '—'} />
                  </div>
                </div>
                {x.results && (
                  <>
                    <hr className="divider" />
                    <div className="grid grid-3">
                      {[['CTR', x.results.control.ctr + '% → ' + x.results.variant.ctr + '%'],
                        ['Intent', x.results.control.intent + '% → ' + x.results.variant.intent + '%'],
                        ['Price acc.', x.results.control.priceAcceptance + '% → ' + x.results.variant.priceAcceptance + '%']].map(([k, v]) => (
                        <div className="card-plain" key={k}><div className="tiny">{k}</div><b>{v}</b></div>
                      ))}
                    </div>
                    <div className="banner banner-info mt-16" style={{ marginBottom: 0 }}>
                      <div><b>Winner: {x.results.winner}.</b> {x.results.reading}</div>
                    </div>
                    <div className="tiny mt-8">{x.results.disclaimer} · completed {fmtDateTime(x.completedAt)}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="card" style={{ alignSelf: 'start' }}>
            <h3>New experiment</h3>
            {projects.length === 0 ? (
              <p className="small muted">Create a project first — experiments run on top of project simulations.</p>
            ) : (
              <>
                <div className="field">
                  <label className="label">Project</label>
                  <select className="select" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Hypothesis</label>
                  <textarea className="textarea" style={{ minHeight: 70 }} value={form.hypothesis} onChange={(e) => setForm({ ...form, hypothesis: e.target.value })} placeholder="Users care more about trust than price." />
                </div>
                <div className="grid grid-2">
                  <div className="field"><label className="label">Control price, $</label>
                    <input className="input" type="number" value={form.controlPrice} onChange={(e) => setForm({ ...form, controlPrice: e.target.value })} /></div>
                  <div className="field"><label className="label">Variant price, $</label>
                    <input className="input" type="number" value={form.variantPrice} onChange={(e) => setForm({ ...form, variantPrice: e.target.value })} /></div>
                </div>
                <div className="field"><label className="label">Control positioning</label>
                  <input className="input" value={form.controlPositioning} onChange={(e) => setForm({ ...form, controlPositioning: e.target.value })} /></div>
                <div className="field"><label className="label">Variant positioning</label>
                  <input className="input" value={form.variantPositioning} onChange={(e) => setForm({ ...form, variantPositioning: e.target.value })} /></div>
                <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy || !form.hypothesis.trim() || !form.projectId} onClick={create}>Create experiment</button>
                <div className="tiny mt-8">Status starts as DRAFT. Run the simulation when ready — results are simulated estimates.</div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
