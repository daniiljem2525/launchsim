import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { api, fmtMoney, fmtDate, fmtDateTime, dayAgo } from '../api.js';
import { useAuth } from '../auth.jsx';
import {
  Spinner, StatusBadge, ScoreRing, SubScores, FunnelChart,
  ErrorBanner, InfoBanner, EmptyState, KV,
} from '../ui.jsx';

const TABS = [
  ['overview', 'Overview'],
  ['research', 'Research'],
  ['hypotheses', 'Hypotheses'],
  ['simulation', 'Simulation'],
  ['economics', 'Economics'],
  ['product', 'Product'],
  ['iterations', 'Iterations'],
  ['realtest', 'Real Test'],
  ['reports', 'Reports'],
];

export default function Project() {
  const { id } = useParams();
  const { refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'overview';
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState('');
  const [improveOpen, setImproveOpen] = useState(false);
  const loadSeq = React.useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const fresh = await api.project(id);
      if (seq === loadSeq.current) { setData(fresh); setErr(null); }
    } catch (e) { if (seq === loadSeq.current) setErr(e); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const act = async (key, fn) => {
    setBusy(key); setErr(null);
    try { await fn(); await load(); await refresh(); }
    catch (e) { setErr(e); }
    finally { setBusy(''); }
  };
  act.busy = busy;

  const p = data?.project;
  const sim = p?.current?.simulation?.results;

  return (
    <div>
      <TopNav />
      <main className="container-wide page">
        {!data && !err && <Spinner label="Loading project…" />}
        <ErrorBanner error={err} onRetry={load} />
        {p && (
          <>
            <div className="page-head">
              <div>
                <div className="row" style={{ gap: 10 }}>
                  <h1 style={{ marginBottom: 0 }}>{p.name}</h1>
                  <StatusBadge label={p.statusLabel} />
                </div>
                <div className="tiny mt-8">
                  Created {fmtDate(p.createdAt)} · {p.iterationsCount} iteration{p.iterationsCount === 1 ? '' : 's'} · updated {dayAgo(p.updatedAt)}
                  {sim ? ` · ${sim.engine === 'demo' ? 'Demo engine' : 'AI-assisted engine'}` : ''}
                </div>
              </div>
              <div className="row-wrap">
                <button className="btn btn-secondary" disabled={!!busy} onClick={() => setImproveOpen(true)}>Improve Idea</button>
                <button className="btn btn-dark" disabled={!!busy} onClick={() => setParams({ tab: 'simulation' })}>Simulate Again</button>
                <button className="btn btn-primary" disabled={!!busy} onClick={() => setParams({ tab: 'realtest' })}>Run Real Test</button>
              </div>
            </div>

            {busy && <div className="loading-block"><span className="spinner" /> {busy}…</div>}

            <div className="tabs">
              {TABS.map(([key, label]) => (
                <button key={key} className={'tab' + (tab === key ? ' on' : '')} onClick={() => setParams({ tab: key })}>{label}</button>
              ))}
            </div>

            {tab === 'overview' && <Overview p={p} sim={sim} act={act} onImprove={() => setImproveOpen(true)} goTab={(t) => setParams({ tab: t })} />}
            {tab === 'research' && <Research p={p} act={act} />}
            {tab === 'hypotheses' && <Hypotheses p={p} />}
            {tab === 'simulation' && <Simulation p={p} sim={sim} act={act} />}
            {tab === 'economics' && <Economics p={p} sim={sim} />}
            {tab === 'product' && <Product sim={sim} />}
            {tab === 'iterations' && <Iterations p={p} />}
            {tab === 'realtest' && <RealTest p={p} act={act} reload={load} />}
            {tab === 'reports' && <Reports p={p} />}

            {p.isDemo && (
              <div className="tiny mt-32 center">This is the demo project. All results are produced by the same simulation engine but labeled DEMO / SIMULATED — they do not describe a real product or real market data.</div>
            )}
          </>
        )}
        {p && improveOpen && (
          <ImproveModal p={p} onClose={() => setImproveOpen(false)} act={act} />
        )}
      </main>
    </div>
  );
}

/* ---------------- OVERVIEW ---------------- */
function Overview({ p, sim, act, onImprove, goTab }) {
  const scores = sim?.scores;
  const risks = sim?.risks || [];
  const opp = sim?.opportunities;
  const decision = p.decision;
  return (
    <div className="fade-in">
      {!sim && (
        <EmptyState
          title="Not analyzed yet"
          text="Run the first analysis to generate research, hypotheses and a launch score for this idea."
          action={<button className="btn btn-primary" onClick={() => goTab('simulation')}>Run analysis</button>}
        />
      )}
      {sim && (
        <div className="grid grid-side">
          <div>
            <div className="card mb-16">
              <div className="grid" style={{ gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>
                <ScoreRing score={p.score} />
                <div>
                  <div className="row"><StatusBadge label={p.statusLabel} /></div>
                  <p className="mt-8" style={{ fontWeight: 560 }}>{scores.headline}</p>
                </div>
              </div>
              <hr className="divider" />
              <h3 className="mb-16">Score breakdown — every number has a reason</h3>
              <SubScores sub={scores.sub} reasons={scores.reasons} accent />
            </div>

            <div className="grid grid-2">
              <div className="card">
                <h3>Biggest Risks</h3>
                {risks.map((r, i) => (
                  <div key={r.risk} className={i ? 'mt-16' : ''} style={{ borderTop: i ? '1px solid var(--line)' : 0, paddingTop: i ? 12 : 0 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <b className="small">{i + 1}. {r.risk}</b>
                      <span className="badge badge-neutral">{r.subScore}/100</span>
                    </div>
                    <div className="tiny mt-8"><b>Evidence:</b> {r.evidence}</div>
                    <div className="tiny"><b>Impact:</b> {r.impact}</div>
                    <div className="small mt-8"><b>Recommendation:</b> {r.recommendation}</div>
                  </div>
                ))}
              </div>
              <div className="card">
                <h3>Biggest Opportunity</h3>
                <p className="small" style={{ fontWeight: 560 }}>{opp?.biggest}</p>
                <div className="small mt-8"><b>Current idea:</b> {opp?.current}</div>
                <div className="center" style={{ color: 'var(--ink-3)', margin: '4px 0' }}>↓</div>
                <div className="small"><b>Recommended version:</b> {opp?.segment}</div>
                <hr className="divider" />
                <KV k="Recommended price" v={fmtMoney(sim.priceSim.suggested.price)} />
                <KV k="Recommended positioning" v={opp?.positioning} />
                <div className="tiny mt-8">Based on price simulation trade-off (conversion × price × revenue).</div>
              </div>
            </div>
          </div>

          <div>
            {decision && (
              <div className="card-dark mb-16">
                <div className="tiny" style={{ color: '#a1a1aa', letterSpacing: '.1em' }}>RECOMMENDATION</div>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '4px 0 10px' }}>{decision.recommendation}</div>
                <ul style={{ margin: 0, paddingLeft: 18, color: '#d4d4d8', fontSize: 13.5 }}>
                  {decision.reasons.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r}</li>)}
                </ul>
              </div>
            )}
            <div className="card mb-16">
              <h3>Next steps</h3>
              <div className="grid" style={{ gap: 8 }}>
                <button className="btn btn-primary" onClick={onImprove}>Improve my idea</button>
                <button className="btn btn-secondary" onClick={() => goTab('simulation')}>Simulate again</button>
                <button className="btn btn-secondary" onClick={() => goTab('realtest')}>Ready for a real test?</button>
              </div>
              <div className="tiny mt-16">Improve idea shows what to change and why — then re-simulates the new version.</div>
            </div>
            <div className="card">
              <h3>Idea snapshot</h3>
              <KV k="Product" v={sim.structured.product} />
              <KV k="Audience" v={sim.structured.audience} />
              <KV k="Problem" v={sim.structured.problem} />
              <KV k="Business model" v={sim.structured.businessModel} />
              <KV k="Price" v={sim.structured.price} />
              <KV k="Market" v={sim.structured.targetMarket} />
              <KV k="Acquisition" v={sim.structured.acquisition} />
              <KV k="Primary KPI" v={sim.structured.primaryKpi} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- RESEARCH ---------------- */
function Research({ p, act }) {
  const r = p.current?.research;
  const competitors = p.current?.competitors || [];
  const [err, setErr] = useState(null);
  if (!r) return <EmptyState title="No research yet" text="Run the analysis to generate the market picture." />;
  const d = r.data;
  return (
    <div className="fade-in">
      <div className="spread row-wrap mb-16">
        <div>
          <h2 style={{ marginBottom: 4 }}>Market Intelligence</h2>
          <div className="tiny">{r.sourceLabel} · depth: {r.depth}</div>
        </div>
        <button className="btn btn-secondary" disabled={act.busy}
          onClick={() => act('Running deep research (3 credits)', async () => { await api.deepResearch(p.id); })}
          title="Deeper pass over the sample dataset (3 credits)">
          {act.busy === 'Running deep research (3 credits)' ? 'Researching…' : 'Deepen research · 3 cr'}
        </button>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>Market Overview</h3>
          {d.marketOverview.map((t, i) => <p key={i} className="small muted">{t}</p>)}
          <h3 className="mt-16">Pricing Landscape</h3>
          {d.pricingLandscape.map((t, i) => <p key={i} className="small muted">{t}</p>)}
          <h3 className="mt-16">Customer Language</h3>
          <div className="row-wrap">{(d.customerLanguage || []).map((c) => <span key={c} className="chip" style={{ cursor: 'default' }}>{c}</span>)}</div>
        </div>
        <div className="card">
          <h3>Customer Pain Points</h3>
          {(d.painPoints || []).map((pp) => (
            <div key={pp.id} className="row" style={{ alignItems: 'baseline', marginBottom: 8 }}>
              <span className="badge badge-neutral">{pp.id}</span><span className="small">{pp.text}</span>
            </div>
          ))}
          <h3 className="mt-16">Unmet Needs</h3>
          {(d.unmetNeeds || []).map((t, i) => <p key={i} className="small muted">{t}</p>)}
        </div>
        <div className="card">
          <h3>Market Risks</h3>
          {(d.marketRisks || []).map((t, i) => <p key={i} className="small muted">• {t}</p>)}
        </div>
        <div className="card">
          <h3>Opportunities</h3>
          {(d.opportunities || []).map((t, i) => <p key={i} className="small muted">• {t}</p>)}
          <h3 className="mt-16">Trends</h3>
          {(d.trends || []).map((t, i) => <p key={i} className="small muted">{t}</p>)}
        </div>
      </div>

      <div className="card mt-16">
        <h3>Competitor Map</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Competitor</th><th>Type</th><th>Price</th><th>Audience</th><th>Positioning</th><th>Strength</th><th>Weakness</th></tr></thead>
            <tbody>
              {competitors.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b></td>
                  <td><span className="badge badge-neutral">{c.kind}</span></td>
                  <td>{c.price}</td>
                  <td>{c.audience}</td>
                  <td>{c.positioning}</td>
                  <td>{c.strength}</td>
                  <td>{c.weakness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="banner banner-info mt-16" style={{ marginBottom: 0 }}>
          <div><b>White Space:</b> {d.unmetNeeds?.[0] || 'Not enough evidence.'}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UNIT ECONOMICS ---------------- */
function Economics({ p, sim }) {
  const base = sim?.unitEcon;
  const [churn, setChurn] = useState(null);
  const [margin, setMargin] = useState(null);
  const [wf, setWf] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setWf(null); }, [p.id, base]);
  if (!base) return <EmptyState title="No economics yet" text="Run a simulation to calculate CAC, LTV, churn and payback." />;
  const ue = wf || base;
  const verdictCls = ue.verdict === 'HEALTHY' ? 'badge-launch' : ue.verdict === 'BORDERLINE' ? 'badge-pivot' : 'badge-kill';
  const apply = async () => {
    setBusy(true);
    try { const d = await api.unitEconWhatIf(p.id, { churn, margin }); setWf(d.unitEcon); } catch { /* keep base */ }
    finally { setBusy(false); }
  };
  return (
    <div className="fade-in">
      <h2>Unit Economics</h2>
      <p className="muted small mb-16">CAC, LTV, churn, margin and payback — computed from the simulation. Drag the sliders to stress-test better or worse assumptions.</p>
      <div className="card mb-16">
        <div className="spread row-wrap">
          <div className="row">
            <h3 style={{ margin: 0 }}>{ue.verdict}</h3>
            <span className={'badge ' + verdictCls}>{ue.ltvCac}× LTV/CAC</span>
          </div>
          {wf && <button className="btn btn-ghost btn-sm" onClick={() => setWf(null)}>Reset to simulation</button>}
        </div>
        <p className="small muted mt-8">{ue.verdictWhy}</p>
        <div className="grid grid-4 mt-16">
          {[['CAC', fmtMoney(ue.cac)], ['LTV', fmtMoney(ue.ltv)], ['Churn / mo', Math.round(ue.churnMonthly * 100) + '%'], ['Gross margin', Math.round(ue.grossMargin * 100) + '%'],
            ['Lifetime', ue.lifetimeMonths + (ue.isSub ? ' mo' : ' purchase'), ], ['Payback', ue.paybackMonths != null ? ue.paybackMonths + ' mo' : 'immediate'], ['Margin / month', fmtMoney(ue.marginPerMonth)], ['12-mo contribution', fmtMoney(ue.contribution12)]].map(([k, v]) => (
            <div className="card-plain" key={k}><div className="tiny">{k}</div><div style={{ fontWeight: 660, fontSize: 18 }}>{v}</div></div>
          ))}
        </div>
        <div className="tiny mt-16"><b>Assumptions:</b> {ue.assumptions.join(' ')}</div>
      </div>

      <div className="card">
        <h3>What-if stress test</h3>
        <p className="small muted">Can the model survive a worse world? Or how good could it get?</p>
        <div className="grid grid-2 mt-16">
          <div>
            <label className="label">Monthly churn: <b>{Math.round((churn ?? base.churnMonthly) * 100)}%</b> {churn != null && churn !== base.churnMonthly ? <span className="tiny">(base {Math.round(base.churnMonthly * 100)}%)</span> : null}</label>
            <input type="range" min="4" max="50" step="1" value={Math.round((churn ?? base.churnMonthly) * 100)} onChange={(e) => setChurn(Number(e.target.value) / 100)} style={{ width: '100%' }} />
            <div className="spread tiny"><span>4% (sticky)</span><span>50% (leaky bucket)</span></div>
          </div>
          <div>
            <label className="label">Gross margin: <b>{Math.round((margin ?? base.grossMargin) * 100)}%</b> {margin != null && margin !== base.grossMargin ? <span className="tiny">(base {Math.round(base.grossMargin * 100)}%)</span> : null}</label>
            <input type="range" min="35" max="95" step="1" value={Math.round((margin ?? base.grossMargin) * 100)} onChange={(e) => setMargin(Number(e.target.value) / 100)} style={{ width: '100%' }} />
            <div className="spread tiny"><span>35% (heavy costs)</span><span>95% (pure software)</span></div>
          </div>
        </div>
        <button className="btn btn-primary mt-16" disabled={busy} onClick={apply}>{busy ? 'Recomputing…' : 'Recompute economics'}</button>
        {wf && <div className="banner banner-info mt-16" style={{ marginBottom: 0 }}>
          <div className="small"><b>What-if result:</b> LTV {fmtMoney(wf.ltv)} · LTV/CAC {wf.ltvCac}× · payback {wf.paybackMonths ?? '—'} mo · verdict <b>{wf.verdict}</b>. {wf.ltvCac >= 3 ? 'This configuration survives CAC inflation from competitor reaction.' : 'Still fragile — fix price, margin or churn before scaling spend.'}</div>
        </div>}
      </div>
    </div>
  );
}

/* ---------------- HYPOTHESES ---------------- */
function Hypotheses({ p }) {
  const hs = p.current?.hypotheses || [];
  if (!hs.length) return <EmptyState title="No hypotheses yet" text="Run the analysis to generate the assumption map." />;
  const badge = { CONFIRMED: 'badge-launch', UNKNOWN: 'badge-neutral', WEAK: 'badge-pivot', RISK: 'badge-kill' };
  return (
    <div className="fade-in">
      <h2>What we’re going to test</h2>
      <p className="muted small mb-16">The simulation only matters if these assumptions hold. RISK items are the first things to check with real users.</p>
      <div className="grid grid-2">
        {hs.map((h) => (
          <div className="card" key={h.id}>
            <div className="spread">
              <span className="badge badge-accent">{h.code}</span>
              <span className={badge[h.status] + ' badge'}>{h.status}</span>
            </div>
            <p style={{ fontWeight: 560, margin: '10px 0 8px' }}>{h.text}</p>
            <div className="bar"><i style={{ width: h.importance + '%' }} /></div>
            <div className="tiny mt-8">Importance {h.importance}/100 · Confidence: {h.confidence}</div>
            <div className="tiny mt-8"><b>Evidence:</b> {h.evidence}</div>
            <div className="tiny"><b>Why it matters:</b> {h.why}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- SIMULATION ---------------- */
function Simulation({ p, sim, act }) {
  const [mode, setMode] = useState('quick');
  if (!sim) {
    return (
      <div>
        <EmptyState title="No simulation yet" text="Run the first simulation to see the funnel, A/B variants and price test." />
        <RunControls mode={mode} setMode={setMode} onRun={(m) => act(`Running ${m} simulation`, async () => { await api.analyze(p.id, m); })} />
      </div>
    );
  }
  const ab = sim.ab;
  const ps = sim.priceSim;
  const f = sim.funnel;
  return (
    <div className="fade-in">
      <div className="card mb-16">
        <div className="spread row-wrap">
          <div>
            <h2 style={{ marginBottom: 4 }}>Simulation funnel</h2>
            <div className="tiny">{f.profileCount.toLocaleString()} customer profiles · {p.current.simulation.mode} mode</div>
          </div>
          <RunControls mode={mode} setMode={setMode} onRun={(m) => act(`Running ${m} simulation`, async () => { await api.analyze(p.id, m); })} />
        </div>
        <hr className="divider" />
        <FunnelChart funnel={f} />
        <div className="grid grid-4 mt-16">
          <div className="card-plain"><div className="tiny">EST. REVENUE</div><div className="stat-num" style={{ fontSize: 22 }}>{fmtMoney(f.estimatedRevenue[0])}–{fmtMoney(f.estimatedRevenue[2])}</div></div>
          <div className="card-plain"><div className="tiny">CAC (est.)</div><div className="stat-num" style={{ fontSize: 22 }}>{f.cac != null ? fmtMoney(f.cac) : '—'}</div></div>
          <div className="card-plain"><div className="tiny">SIGNUPS</div><div className="stat-num" style={{ fontSize: 22 }}>{f.signups}</div></div>
          <div className="card-plain"><div className="tiny">PURCHASES</div><div className="stat-num" style={{ fontSize: 22 }}>{f.purchases[0]}–{f.purchases[2]}</div></div>
        </div>
        <div className="tiny mt-16"><b>Assumptions:</b> {f.assumptions.join(' ')}</div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3>A/B headline simulation</h3>
          <table className="table">
            <thead><tr><th>Variant</th><th>CTR</th><th>Intent</th><th>Price acc.</th><th>Score</th></tr></thead>
            <tbody>
              {ab.rows.map((v) => (
                <tr key={v.label} className={v.label === ab.best.label ? 'hl' : ''}>
                  <td><b>{v.label}</b> <span className="tiny">{v.angle}</span><div className="small" style={{ maxWidth: 260 }}>“{v.headline}”</div></td>
                  <td>{v.ctr}%</td><td>{v.intent}%</td><td>{v.priceAcceptance}%</td><td><b>{v.overall}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="tiny mt-8">Winner: variant <b>{ab.best.label}</b> — used as the generated landing headline.</div>
        </div>
        <div className="card">
          <h3>Price simulation</h3>
          <div className="price-row" style={{ fontWeight: 650 }}>
            <span>Price</span><span>Conversion</span><span className="hide-sm">Rev / customer</span><span className="hide-sm">Resistance</span><span>Rev index</span>
          </div>
          {ps.rows.map((r) => (
            <div key={r.price} className={'price-row' + (r.price === ps.suggested.price ? '' : '')} style={r.price === ps.suggested.price ? { background: 'var(--accent-soft)', borderRadius: 8 } : undefined}>
              <b>{fmtMoney(r.price)}{r.price === ps.suggested.price ? ' ★' : ''}</b>
              <span>{r.conversion}%</span>
              <span className="hide-sm">{fmtMoney(r.revenuePerCustomer)}</span>
              <span className="hide-sm">{r.resistance}%</span>
              <span>{r.revenuePerCustomer}</span>
            </div>
          ))}
          <div className="banner banner-info mt-16" style={{ marginBottom: 0 }}>
            <div><b>Suggested price: {fmtMoney(ps.suggested.price)}</b><br /><span className="small">{ps.rationale}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RunControls({ mode, setMode, onRun }) {
  return (
    <div className="row-wrap">
      {[['quick', 'Basic · 1 cr'], ['standard', 'Standard · 2 cr'], ['advanced', 'Advanced · 5 cr']].map(([m, l]) => (
        <span key={m} className={'chip' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>{l}</span>
      ))}
      <button className="btn btn-primary" onClick={() => onRun(mode)}>Simulate</button>
    </div>
  );
}

/* ---------------- PRODUCT ---------------- */
function Product({ sim }) {
  if (!sim) return <EmptyState title="No product version yet" text="Run a simulation to generate the virtual product version." />;
  const l = sim.landing;
  return (
    <div className="fade-in">
      <div className="grid grid-side">
        <div>
          <h2>Generated landing</h2>
          <p className="muted small mb-16">The virtual version of your idea used in the simulation. Headline comes from the winning A/B variant.</p>
          <div className="mock-landing">
            <div className="mock-nav"><b>{sim.structured.product}</b><span className="tiny">{l.pricing.price} · {l.cta}</span></div>
            <div className="mock-hero">
              <h3>{l.headline}</h3>
              <p>{l.subheadline}</p>
              <button className="btn btn-light">{l.cta}</button>
            </div>
            <div className="mock-body">
              {l.benefits.map((b) => <div key={b} className="mock-benefit"><span className="dot-check">✓</span> {b}</div>)}
              <hr className="divider" style={{ margin: '6px 0' }} />
              {l.features.map((ft) => <div key={ft.name}><b className="small">{ft.name}.</b> <span className="small muted">{ft.text}</span></div>)}
              <hr className="divider" style={{ margin: '6px 0' }} />
              {l.faq.map((qa) => <div key={qa.q}><b className="small">{qa.q}</b><div className="tiny muted">{qa.a}</div></div>)}
            </div>
          </div>
        </div>
        <div>
          <div className="card mb-16">
            <h3>Product concept</h3>
            <p className="small muted">{sim.concept.valueProposition}</p>
            <div className="tiny" style={{ fontWeight: 700, marginTop: 10 }}>ONBOARDING</div>
            {sim.concept.onboarding.map((s) => <div key={s} className="small">{s}</div>)}
            <div className="tiny mt-8" style={{ fontWeight: 700 }}>CORE WORKFLOW</div>
            {sim.concept.coreWorkflow.map((s) => <div key={s} className="small">{s}</div>)}
            <div className="tiny mt-8" style={{ fontWeight: 700 }}>PRIMARY ACTION</div>
            <div className="small">{sim.concept.primaryAction}</div>
          </div>
          <div className="card">
            <h3>Ad concepts (5 angles)</h3>
            {sim.ads.map((a) => (
              <div key={a.angle} className="persona mb-8">
                <span className="badge badge-accent">{a.angle}</span>
                <div className="small" style={{ fontWeight: 600, marginTop: 6 }}>“{a.headline}”</div>
                <div className="tiny muted">{a.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ITERATIONS ---------------- */
function Iterations({ p }) {
  if (!p.current) return <EmptyState title="Nothing to show yet" text="Iterations appear after the first analysis." />;
  const sims = p.timeline.filter((t) => t.kind === 'simulation').length;
  return (
    <div className="fade-in grid grid-side">
      <div>
        <h2>Iteration history</h2>
        <p className="muted small">What changed, why, and what it did to the score. Scores are simulation estimates.</p>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 90, marginBottom: 14 }}>
            {[...p.timeline].filter((t) => t.kind === 'iteration').reverse().map((t) => {
              const h = Math.max(8, ((t.score || 0) / 100) * 90);
              return (
                <div key={t.ts + t.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  <b style={{ fontSize: 12 }}>{t.score ?? '—'}</b>
                  <div style={{ width: '70%', maxWidth: 46, height: h, background: 'var(--accent)', borderRadius: 6 }} />
                </div>
              );
            })}
          </div>
          <div className="timeline">
            {p.timeline.map((t, i) => (
              <div key={i} className={'tl-item' + (i === p.timeline.length - 1 ? ' tl-accent' : '')}>
                <div className="tl-when">{fmtDateTime(t.ts)}</div>
                <div className="tl-what">{t.label}{t.score != null ? <> · <b>{t.score}/100</b></> : null}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card" style={{ alignSelf: 'start' }}>
        <h3>Current version</h3>
        <KV k="Iteration" v={'#' + p.current.number} />
        <KV k="Label" v={p.current.label} />
        <KV k="Score" v={p.current.score != null ? p.current.score + ' / 100' : '—'} />
        <KV k="Simulation runs" v={String(sims)} />
        {p.current.changes.length > 0 && (
          <>
            <hr className="divider" />
            <h4>What changed</h4>
            {p.current.changes.map((c, i) => (
              <div key={i} className="small" style={{ marginBottom: 10 }}>
                <b>{c.area}:</b> {c.from ? <><span className="muted"> {c.from}</span> → </> : null}{c.to}
                {c.why ? <div className="tiny">Why: {c.why}</div> : null}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function CreativeBreakdown({ rows }) {
  if (!rows?.length) return null;
  const maxSignups = Math.max(...rows.map((r) => r.signups || 0), 1);
  return (
    <div className="mt-16">
      <h4>Which ad produced which registrations</h4>
      <table className="table">
        <thead><tr><th>Cell</th><th>Creative</th><th>Impressions</th><th>Clicks</th><th>CTR</th><th>Signups</th><th>Purchases</th><th>Spend</th><th>Cost / signup</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.cell} className={r.verdict === 'SCALE' || (r.kind === 'base' && r.signups === maxSignups) ? 'hl' : ''}>
              <td className="mono">{r.cell}</td>
              <td><b>{r.name}</b> {r.kind === 'idea' && <span className="badge badge-accent">idea {r.verdict}</span>}{r.note && <div className="tiny">{r.note}</div>}</td>
              <td>{r.impressions.toLocaleString()}</td>
              <td>{r.clicks.toLocaleString()}</td>
              <td>{r.ctr}%</td>
              <td>
                <div style={{ fontWeight: 660 }}>{r.signups}</div>
                <div className="bar" style={{ width: 90, marginTop: 3 }}><i style={{ width: Math.round(((r.signups || 0) / maxSignups) * 100) + '%' }} /></div>
              </td>
              <td>{r.purchases}</td>
              <td>{fmtMoney(r.spend)}</td>
              <td>{r.cpl != null ? fmtMoney(r.cpl) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tiny mt-8">Cells A–E are the base rotation; F–H are the simulator’s own ideas. Sums reconcile with the totals above.</div>
    </div>
  );
}

function HourlyCohorts({ buckets }) {
  if (!buckets?.length) return null;
  const max = Math.max(...buckets.map((b) => b.signups), 1);
  return (
    <div className="mt-16">
      <h4>Signup cohorts over time</h4>
      {buckets.map((b) => (
        <div className="funnel-row" key={b.label}>
          <div className="funnel-label">{b.label}</div>
          <div><div className="funnel-bar" style={{ width: Math.max(2, (b.signups / max) * 100) + '%', background: 'var(--accent)' }} /></div>
          <div className="funnel-val">{b.signups}<small>{b.clicks} clicks · {b.purchases} purch · cum. {b.cumulativeSignups}</small></div>
        </div>
      ))}
      <div className="tiny mt-8">New signups per time bucket. A healthy run shows early learning, mid-run peak from the optimizer, and no dead buckets.</div>
    </div>
  );
}

/* ---------------- REAL TEST FUNNEL & STATS ---------------- */
function RealFunnel({ rt }) {
  const m = rt.metrics;
  if (!m) return null;
  const sv = rt.simulationVs || {};
  const acc = (sim, act) => (sim != null && act != null) ? Math.round(100 - Math.min(100, (Math.abs(sim - act) / Math.max(sim, 0.01)) * 100)) + '%' : '—';
  const steps = [
    { stage: 'Impressions', count: m.impressions?.toLocaleString(), conv: '—', sim: sv.impressions?.sim != null ? sv.impressions.sim.toLocaleString() : null, acc: acc(sv.impressions?.sim, m.impressions) },
    { stage: 'Landing visits (clicks)', count: m.landingVisits?.toLocaleString(), conv: m.ctr + '% CTR', sim: null, acc: acc(sv.ctr?.sim, m.ctr), simNote: sv.ctr?.sim != null ? 'CTR ' + sv.ctr.sim + '%' : null },
    { stage: 'Signups', count: m.signups, conv: m.signupRate + '% of visits', sim: null, acc: acc(sv.conversion?.sim, m.signupRate), simNote: sv.conversion?.sim != null ? sv.conversion.sim + '%' : null },
    { stage: 'Pricing views', count: m.pricingViews, conv: m.signups ? Math.round((m.pricingViews / Math.max(1, m.signups)) * 100) + '% of signups' : '—', sim: sv.pricingViews?.sim, acc: acc(sv.pricingViews?.sim, m.pricingViews) },
    { stage: 'Purchases', count: m.purchases, conv: m.pricingViews ? Math.round((m.purchases / Math.max(1, m.pricingViews)) * 100) + '% of pricing views' : '—', sim: sv.purchases?.sim, acc: acc(sv.purchases?.sim, m.purchases) },
  ];
  return (
    <div>
      <h4>Funnel — who moved through</h4>
      <table className="table">
        <thead><tr><th>Stage</th><th>People</th><th>Step conversion</th><th>Sim est.</th><th>Accuracy</th></tr></thead>
        <tbody>
          {steps.map((s) => (
            <tr key={s.stage}>
              <td><b>{s.stage}</b></td>
              <td style={{ fontWeight: 660 }}>{s.count}</td>
              <td>{s.conv}</td>
              <td className="tiny">{s.sim != null ? s.sim : (s.simNote || '—')}</td>
              <td><span className="badge badge-neutral">{s.acc}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tiny mt-8"><b>Reading:</b> {m.impressions?.toLocaleString()} people saw the ad → <b>{m.landingVisits}</b> clicked → <b>{m.signups}</b> registered → <b>{m.pricingViews}</b> looked at the price → <b>{m.purchases}</b> bought.</div>
    </div>
  );
}

function DetailedStats({ rt, job }) {
  const m = rt.metrics;
  if (!m) return null;
  const cpm = m.impressions ? (m.spend / m.impressions) * 1000 : null;
  const perSignup = m.signups ? m.spend / m.signups : null;
  const perPurchase = m.purchases ? m.spend / m.purchases : null;
  const arpuRealized = m.purchases ? m.revenue / m.purchases : null;
  const rows = job?.series || job?.seriesTail || [];
  return (
    <div className="mt-16">
      <h4>Detailed statistics</h4>
      <div className="grid grid-4">
        {[['CPM', cpm != null ? fmtMoney(cpm) : '—'], ['CPC', m.cpc != null ? fmtMoney(m.cpc) : '—'],
          ['Cost / signup', perSignup != null ? fmtMoney(perSignup) : '—'], ['Cost / purchase', perPurchase != null ? fmtMoney(perPurchase) : '—'],
          ['Revenue', fmtMoney(m.revenue)], ['ROAS', String(m.roas)], ['Revenue / purchase', arpuRealized != null ? fmtMoney(arpuRealized) : '—'], ['Check-ins', job?.checkinsCount ?? '—']].map(([k, v]) => (
          <div className="card-plain" key={k}><div className="tiny">{k}</div><div style={{ fontWeight: 660, fontSize: 16 }}>{v}</div></div>
        ))}
      </div>
      {rows.length > 0 && (
        <details className="mt-16">
          <summary className="small" style={{ cursor: 'pointer', fontWeight: 600 }}>Check-in log ({rows.length} entries — spend, traffic, conversions over time)</summary>
          <div style={{ maxHeight: 320, overflowY: 'auto', marginTop: 8 }}>
            <table className="table">
              <thead><tr><th>#</th><th>Spend</th><th>Impr.</th><th>CTR</th><th>Signups</th><th>Purchases</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.i}><td className="tiny mono">{r.i + 1}</td><td>{fmtMoney(r.spend)}</td><td>{r.impressions.toLocaleString()}</td><td>{r.ctr}%</td><td>{r.signups}</td><td>{r.purchases}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

function InstagramBlock({ ig }) {
  if (!ig) return null;
  return (
    <div className="mt-16">
      <div className="row-wrap mb-16">
        <h4 style={{ margin: 0 }}>Instagram promotion</h4>
        <span className="badge badge-accent">{ig.handle}</span>
       
      </div>
      <div className="grid grid-4">
        {[['Reach', ig.reach.toLocaleString()], ['Profile visits', ig.profileVisits.toLocaleString()], ['Link clicks', ig.linkClicks.toLocaleString()], ['Signups from IG', String(ig.signups)],
          ['Follows', '+' + ig.follows.toLocaleString()], ['Reels', String(ig.reels)], ['Stories', String(ig.stories)], ['Saves', ig.saves.toLocaleString()]].map(([k, v]) => (
          <div className="card-plain" key={k}><div className="tiny">{k}</div><div style={{ fontWeight: 660, fontSize: 16 }}>{v}</div></div>
        ))}
      </div>
      <div className="tiny mt-8"><b>Best post:</b> {ig.topPost} · boost spend {fmtMoney(ig.boostedSpend)} (part of the paid budget). {ig.notes.join(' ')}</div>
      <div className="tiny muted">{ig.disclaimer}</div>
    </div>
  );
}

/* ---------------- REAL TEST ---------------- */
function RealTest({ p, act, reload }) {
  const [form, setForm] = useState({ budget: 50, country: p.inputs.market || 'United States', channel: 'Meta Ads' });
  const latest = p.realTests[0];
  const running = latest?.job?.status === 'RUNNING';

  useEffect(() => {
    if (!running) return;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [running, reload]);

  if (!p.current?.simulation) return <EmptyState title="Run a simulation first" text="A real test needs a simulated baseline to compare against." />;
  return (
    <div className="fade-in">
      <div className="grid grid-side">
        <div>
          <h2>Real Test</h2>
          <p className="muted small mb-16">One autonomous validation run compresses a month of founder work into hours: data collection, campaign simulators, TikTok video lab, final report.</p>
          <div className="card mb-16">
            <h3>Test setup</h3>
            <div className="grid grid-3">
              <div className="field"><label className="label">Budget, $</label>
                <input className="input" type="number" min="5" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
              <div className="field"><label className="label">Country</label>
                <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
              <div className="field"><label className="label">Channel</label>
                <select className="select" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                  <option>Meta Ads</option><option>Google Ads</option><option>TikTok Ads</option><option>Instagram Ads</option>
                </select></div>
            </div>
            <button className="btn btn-primary" disabled={!!act.busy}
              onClick={() => act('Creating test plan', async () => { await api.createRealTest(p.id, form); })}>
              Create campaign plan
            </button>
            <div className="tiny mt-8">Demo Mode: ad platforms are not connected. The validation runs on the built-in campaign simulator — clearly labeled. Integration points for Meta / Google / TikTok Ads are prepared.</div>
          </div>

          {latest && latest.status === 'PLANNED' && <LaunchPanel p={p} rt={latest} act={act} />}
          {latest && running && <ValidationLive job={latest.job} />}
          {latest && latest.status === 'COMPLETED' && <RealTestResult rt={latest} p={p} act={act} />}
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <h3>Baseline estimates</h3>
          <KV k="CTR (est.)" v={p.current.simulation.results.funnel.ctr + '%'} />
          <KV k="Signup rate (est.)" v={p.current.simulation.results.funnel.signupRate + '%'} />
          <KV k="Purchases (est.)" v={`${p.current.simulation.results.funnel.purchases[0]}–${p.current.simulation.results.funnel.purchases[2]}`} />
          <div className="tiny mt-8">The validation checks whether reality matches these estimates.</div>
        </div>
      </div>
    </div>
  );
}

function LaunchPanel({ p, rt, act }) {
  const [hours, setHours] = useState(24);
  const [express, setExpress] = useState(false);
  return (
    <div className="card mb-16">
      <div className="spread row-wrap">
        <h3 style={{ margin: 0 }}>Launch validation</h3>
        <span className="badge badge-accent">5 credits</span>
      </div>
      <p className="small muted mt-8" style={{ marginBottom: 12 }}>
        The simulator works autonomously for the whole duration — collecting data, running campaign check-ins, optimizing spend, producing and testing TikTok video concepts. It does in hours what a founder would do in a month.
      </p>
      <div className="option-grid mb-16">
        {[4, 12, 24].map((h) => (
          <div key={h} className={'option' + (!express && hours === h ? ' on' : '')} onClick={() => { setExpress(false); setHours(h); }}>
            <b>{h} hours</b><span>{h === 4 ? 'Sprint check' : h === 12 ? 'Overnight run' : 'Full month compressed'}</span>
          </div>
        ))}
      </div>
      <label className="row small" style={{ cursor: 'pointer', marginBottom: 14 }}>
        <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />
        <span>Express demo (~3 min instead of hours) — same pipeline, compressed for preview.</span>
      </label>
      <button className="btn btn-primary btn-lg" disabled={!!act.busy}
        onClick={() => act('Launching validation', async () => { await api.launchRealTest(p.id, rt.id, express ? { mode: 'express' } : { mode: 'real', durationHours: hours }); })}>
        {express ? 'Launch express validation · ~3 min' : `Launch validation · ${hours}h`}
      </button>
      <div className="tiny mt-8">No ad money is spent from here. When a real ad account is connected, the same pipeline runs against live traffic.</div>
    </div>
  );
}

function ValidationLive({ job }) {
  const pct = Math.round(job.progress * 100);
  const remaining = job.remainingMs;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const remainingLabel = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  return (
    <div className="card mb-16">
      <div className="spread row-wrap">
        <div className="row">
          <h3 style={{ margin: 0 }}>Validation running</h3>
          <span className="badge badge-test pulse">{job.mode === 'express' ? 'EXPRESS' : job.durationHours + 'H RUN'}</span>
        </div>
        <span className="tiny">{remainingLabel} remaining</span>
      </div>
      <div className="bar mt-16" style={{ height: 10 }}><i style={{ width: pct + '%', background: 'var(--accent)' }} /></div>
      <div className="spread small mt-8"><span className="muted">{pct}% complete · check-in {job.checkinsCount}</span><b>{job.totals ? `${fmtMoney(job.totals.spend)} of budget deployed` : ''}</b></div>

      <hr className="divider" />
      <div className="grid" style={{ gap: 6 }}>
        {job.stages.map((s) => (
          <div className="row" key={s.key} style={{ opacity: s.status === 'pending' ? 0.45 : 1 }}>
            <span>{s.status === 'done' ? '✅' : s.status === 'active' ? <span className="spinner" style={{ width: 13, height: 13 }} /> : '⬜'}</span>
            <span className="small" style={{ fontWeight: s.status === 'active' ? 650 : 480 }}>{s.label}</span>
            {s.status === 'active' && <span className="tiny">— {s.desc}</span>}
          </div>
        ))}
      </div>

      {job.totals && (
        <>
          <hr className="divider" />
          <h4>Live funnel</h4>
          <div className="funnel-row"><div className="funnel-label">Impressions</div><div><div className="funnel-bar" style={{ width: '100%' }} /></div><div className="funnel-val">{job.totals.impressions.toLocaleString()}</div></div>
          <div className="funnel-row"><div className="funnel-label">Clicks</div><div><div className="funnel-bar" style={{ width: Math.max(2, (job.totals.clicks / Math.max(1, job.totals.impressions)) * 100 * 20) + '%' }} /></div><div className="funnel-val">{job.totals.clicks.toLocaleString()}<small>{job.totals.ctr}% CTR</small></div></div>
          <div className="funnel-row"><div className="funnel-label">Signups</div><div><div className="funnel-bar" style={{ width: Math.max(2, (job.totals.signups / Math.max(1, job.totals.impressions)) * 100 * 400) + '%' }} /></div><div className="funnel-val">{job.totals.signups}<small>{job.totals.signupRate}% of clicks</small></div></div>
          <div className="funnel-row"><div className="funnel-label">Purchases</div><div><div className="funnel-bar" style={{ width: Math.max(2, (job.totals.purchases / Math.max(1, job.totals.impressions)) * 100 * 4000) + '%' }} /></div><div className="funnel-val">{job.totals.purchases}</div></div>
        </>
      )}

      {job.findings.length > 0 && (
        <>
          <hr className="divider" />
          <h4>Findings feed</h4>
          <div className="timeline">
            {[...job.findings].reverse().slice(0, 8).map((f, i) => (
              <div key={f.at + '' + i} className={'tl-item' + (i === 0 ? ' tl-accent' : '')}>
                <div className="tl-when">{f.atLabel} · <span className="mono tiny">{f.kind}</span></div>
                <div className="tl-what" style={{ fontWeight: 480 }}>{f.text}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {job.tiktok.length > 0 && (
        <>
          <hr className="divider" />
          <h4>TikTok video lab</h4>
          <div className="grid grid-3">
            {job.tiktok.map((v) => (
              <div className="persona" key={v.angle}>
                <span className="badge badge-accent">{v.angle}</span>
                <div className="small mt-8" style={{ fontWeight: 600 }}>“{v.hook}”</div>
                {v.script.map((s) => <div key={s.t} className="tiny"><b className="mono">{s.t}</b> — {s.text}</div>)}
                <div className="tiny mt-8">🎵 {v.sound}</div>
                <div className="tiny">{v.caption} <span className="muted">{v.hashtags.join(' ')}</span></div>
                <div className="row-wrap mt-8">
                  <span className="badge badge-neutral">{v.stats.views.toLocaleString()} views</span>
                  <span className="badge badge-neutral">{v.stats.watchThrough}% watch</span>
                  <span className="badge badge-neutral">{v.stats.likes.toLocaleString()} likes</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {job.instagram && job.progress > 0.75 && (
        <>
          <hr className="divider" />
          <h4>Instagram promotion</h4>
          <div className="grid grid-4">
            {[['Reach', job.instagram.reach.toLocaleString()], ['Profile visits', job.instagram.profileVisits.toLocaleString()], ['Link clicks', job.instagram.linkClicks.toLocaleString()], ['IG signups', String(job.instagram.signups)]].map(([k, v]) => (
              <div className="card-plain" key={k}><div className="tiny">{k}</div><div style={{ fontWeight: 660, fontSize: 16 }}>{v}</div></div>
            ))}
          </div>
          <div className="tiny mt-8">+{job.instagram.follows.toLocaleString()} followers · {job.instagram.reels} Reels · best post: {job.instagram.topPost}</div>
        </>
      )}

      {job.ideas?.length > 0 && (
        <>
          <hr className="divider" />
          <h4>Simulator’s marketing ideas — live in this run</h4>
          <div className="tiny mb-8">The engine’s own ideas were added to the campaign rotation as test cells. The optimizer acts on them mid-run.</div>
          <div className="grid grid-3">
            {job.ideas.map((x) => (
              <div className="persona" key={x.name}>
                <div className="spread">
                  <b className="small">{x.name}</b>
                  <span className={'badge ' + (x.status === 'promoted' ? 'badge-launch' : x.status === 'killed' ? 'badge-kill' : x.status === 'testing' ? 'badge-test' : 'badge-neutral')}>
                    {x.status === 'promoted' ? '★ promoted' : x.status}
                  </span>
                </div>
                <div className="tiny mt-8"><b>Cell {x.cell}</b> · {x.type}</div>
                <div className="tiny muted">{x.description}</div>
              </div>
            ))}
          </div>
          {job.vision && (
            <div className="banner banner-info mt-16" style={{ marginBottom: 0 }}>
              <div className="small"><b>Marketing vision (live):</b> big idea “{job.vision.bigIdea.name}” is leading the rotation. {job.vision.funnelLeak}</div>
            </div>
          )}
        </>
      )}

      <div className="tiny mt-16">{job.disclaimer}</div>
    </div>
  );
}

function RealTestResult({ rt, p, act }) {
  const m = rt.metrics;
  const report = rt.job?.report;
  return (
    <div>
      <div className="card mb-16">
        <div className="spread row-wrap">
          <div className="row">
            <h3 style={{ margin: 0 }}>Campaign plan</h3>
            <span className={'badge ' + (rt.status === 'COMPLETED' ? 'badge-launch' : 'badge-neutral')}>{rt.status}</span>
            {rt.job?.mode === 'express' && <span className="badge badge-neutral">express preview</span>}
          </div>
        </div>
        <KV k="Budget" v={fmtMoney(rt.budget)} />
        <KV k="Country" v={rt.country} />
        <KV k="Channel" v={rt.channel} />
        {rt.plan && (
          <>
            <hr className="divider" />
            <div className="tiny" style={{ fontWeight: 700 }}>CAMPAIGN STRUCTURE</div>
            {(rt.plan.campaignStructure || []).map((s, i) => <div key={i} className="small">{s}</div>)}
            <div className="tiny mt-8" style={{ fontWeight: 700 }}>TRACKING PLAN</div>
            {(rt.plan.trackingPlan || []).map((s, i) => <div key={i} className="small mono">{s}</div>)}
            <div className="tiny mt-8" style={{ fontWeight: 700 }}>AD INTEGRATIONS</div>
            <div className="row-wrap">
              {Object.entries(rt.plan.integrations || {}).map(([k, v]) => (
                <span key={k} className={'badge ' + (v === 'connected' ? 'badge-launch' : 'badge-neutral')}>{k}: {v === 'connected' ? 'connected' : 'not connected'}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {m && (
        <div className="card mb-16">
          <div className="row-wrap mb-16">
            <h3 style={{ margin: 0 }}>Results</h3>
          </div>
          <RealFunnel rt={rt} />
          <DetailedStats rt={rt} job={rt.job} />
          <InstagramBlock ig={rt.job?.instagram} />
          <CreativeBreakdown rows={rt.job?.creativeBreakdown} />
          <HourlyCohorts buckets={rt.job?.hourlyCohorts} />
          {rt.simulationVs && (
            <>
              <hr className="divider" />
              <h4>Simulation vs Reality</h4>
              <table className="table">
                <thead><tr><th>Metric</th><th>Simulation</th><th>Actual (demo)</th><th>Accuracy</th></tr></thead>
                <tbody>
                  <tr><td>CTR</td><td>{rt.simulationVs.ctr.sim}%</td><td>{rt.simulationVs.ctr.actual}%</td><td>{rt.accuracy?.ctr ?? '—'}%</td></tr>
                  <tr><td>Signup conversion</td><td>{rt.simulationVs.conversion.sim}%</td><td>{rt.simulationVs.conversion.actual}%</td><td>{rt.accuracy?.conversion ?? '—'}%</td></tr>
                </tbody>
              </table>
              <div className="tiny mt-8">Simulation accuracy: <b>{rt.accuracy?.overall ?? '—'}%</b> — how close the simulated funnel was to the validation run.</div>
            </>
          )}
        </div>
      )}

      {report && (
        <div className="card mb-16">
          <div className="row-wrap mb-16">
            <h3 style={{ margin: 0 }}>Validation report</h3>
            <span className="badge badge-demo">{rt.job?.durationHours ? `${rt.job.durationHours}h autonomous run` : 'autonomous run'}</span>
          </div>
          <p style={{ fontWeight: 600 }}>{report.headline}</p>
          <table className="table">
            <thead><tr><th>Check</th><th>Result</th><th>Verdict</th></tr></thead>
            <tbody>
              {report.checks.map((c) => (
                <tr key={c.check}>
                  <td><b>{c.check}</b></td>
                  <td className="small">{c.result}</td>
                  <td><span className={'badge ' + (c.verdict === 'POSITIVE' ? 'badge-launch' : c.verdict === 'NEGATIVE' ? 'badge-kill' : c.verdict === 'RISK' ? 'badge-kill' : c.verdict === 'WEAK' ? 'badge-pivot' : 'badge-neutral')}>{c.verdict.replace('_', ' ')}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {report.marketing && (
            <>
              <hr className="divider" />
              <h4>Marketing vision</h4>
              <p className="small muted" style={{ marginBottom: 8 }}>{report.marketing.vision.marketRead}</p>
              <div className="row-wrap mb-16">
                <span className="badge badge-accent">Big idea: {report.marketing.vision.bigIdea.name}</span>
                {report.marketing.ideas.map((x) => (
                  <span key={x.name} className={'badge ' + (x.verdict === 'SCALE' ? 'badge-launch' : x.verdict === 'PARK' ? 'badge-neutral' : 'badge-kill')}>
                    {x.name}: {x.verdict}
                  </span>
                ))}
              </div>
              <div className="small muted">{report.marketing.summary}</div>
            </>
          )}
          {report.bestVideo && (
            <>
              <hr className="divider" />
              <h4>Winning TikTok concept</h4>
              <div className="persona">
                <div className="row-wrap">
                  <span className="badge badge-accent">{report.bestVideo.angle}</span>
                  <span className="badge badge-neutral">{report.bestVideo.stats.views.toLocaleString()} views</span>
                  <span className="badge badge-neutral">{report.bestVideo.stats.watchThrough}% watch-through</span>
                </div>
                <div className="small mt-8" style={{ fontWeight: 600 }}>“{report.bestVideo.hook}”</div>
                <div className="tiny">{report.bestVideo.caption}</div>
              </div>
            </>
          )}
          <hr className="divider" />
          <h4>What the simulator did</h4>
          {report.optimizationLog.map((t, i) => <div key={i} className="small muted">• {t}</div>)}
          <div className="tiny mt-16">{report.disclaimer}</div>
          <Link className="btn btn-secondary btn-sm mt-16" to={`/app/projects/${p.id}?tab=reports`}>Open full report in Reports →</Link>
        </div>
      )}
    </div>
  );
}

function RealFunnelFlat({ m, sv }) {
  if (!m) return null;
  const acc = (sim, act) => (sim != null && act != null) ? Math.round(100 - Math.min(100, (Math.abs(sim - act) / Math.max(sim, 0.01)) * 100)) + '%' : '—';
  const steps = [
    { stage: 'Impressions', count: m.impressions?.toLocaleString(), conv: '—', sim: sv?.impressions?.sim != null ? sv.impressions.sim.toLocaleString() : null, acc: acc(sv?.impressions?.sim, m.impressions) },
    { stage: 'Landing visits (clicks)', count: m.clicks?.toLocaleString(), conv: m.ctr + '% CTR', sim: null, acc: acc(sv?.ctr?.sim, m.ctr), simNote: sv?.ctr?.sim != null ? 'CTR ' + sv.ctr.sim + '%' : null },
    { stage: 'Signups', count: m.signups, conv: m.signupRate + '% of visits', sim: null, acc: acc(sv?.conversion?.sim, m.signupRate), simNote: sv?.conversion?.sim != null ? sv.conversion.sim + '%' : null },
    { stage: 'Pricing views', count: m.pricingViews ?? Math.round((m.signups || 0) * 0.45), conv: m.signups ? Math.round((((m.pricingViews ?? Math.round((m.signups || 0) * 0.45)) / Math.max(1, m.signups)) * 100)) + '% of signups' : '—', sim: sv?.pricingViews?.sim, acc: acc(sv?.pricingViews?.sim, m.pricingViews) },
    { stage: 'Purchases', count: m.purchases, conv: (m.pricingViews ?? Math.round((m.signups || 0) * 0.45)) ? Math.round((m.purchases / Math.max(1, (m.pricingViews ?? Math.round((m.signups || 0) * 0.45)))) * 100) + '% of pricing views' : '—', sim: sv?.purchases?.sim, acc: acc(sv?.purchases?.sim, m.purchases) },
  ];
  return (
    <table className="table">
      <thead><tr><th>Stage</th><th>People</th><th>Step conversion</th><th>Sim est.</th><th>Accuracy</th></tr></thead>
      <tbody>
        {steps.map((s) => (
          <tr key={s.stage}>
            <td><b>{s.stage}</b></td>
            <td style={{ fontWeight: 660 }}>{s.count}</td>
            <td>{s.conv}</td>
            <td className="tiny">{s.sim != null ? s.sim : (s.simNote || '—')}</td>
            <td><span className="badge badge-neutral">{s.acc}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------- REPORTS ---------------- */
function Reports({ p }) {
  const reports = p.reports || [];
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [copied, setCopied] = useState(false);

  const open = async (id) => {
    setOpenId(id); setDetail(null);
    try { const d = await api.report(p.id, id); setDetail(d.report); } catch { setOpenId(null); }
  };

  const toMarkdown = (r) => {
    const c = r.content, s = c.snapshot;
    const L = [];
    L.push(`# ${r.title}`, '', `*${s.disclaimer}*`, '');
    L.push(`**Setup:** ${c.projectName} · ${c.channel} · ${c.country} · $${c.budget} · ${c.durationHours}h run (${c.mode})`, '');
    L.push(`## Headline`, '', s.report.headline, '');
    L.push(`## Checks`, '', ...s.report.checks.map((x) => `- **${x.check}:** ${x.result} — \`${x.verdict}\``), '');
    L.push(`## Totals`, '', `- Spend: $${s.totals.spend} · Impressions: ${s.totals.impressions} · CTR: ${s.totals.ctr}%`, `- Signups: ${s.totals.signups} (${s.totals.signupRate}%) · Purchases: ${s.totals.purchases}`, `- CAC: ${s.cac ? '$' + s.cac : '—'} · ROAS: ${s.report.roas}`, '');
    if (r.simulationVs) {
      const sv = r.simulationVs, t = s.totals;
      L.push(`## Funnel`, '', `| Stage | People | Step conv | Sim est. |`, `|---|---|---|---|`,
        `| Impressions | ${t.impressions.toLocaleString()} | — | ${sv.impressions?.sim?.toLocaleString() ?? '—'} |`,
        `| Landing visits | ${t.clicks.toLocaleString()} | ${t.ctr}% CTR | ${sv.ctr?.sim ?? '—'}% CTR |`,
        `| Signups | ${t.signups} | ${t.signupRate}% | ${sv.conversion?.sim ?? '—'}% |`,
        `| Pricing views | ${t.pricingViews ?? '—'} | — | ${sv.pricingViews?.sim ?? '—'} |`,
        `| Purchases | ${t.purchases} | — | ${sv.purchases?.sim ?? '—'} |`, '',
        `**Costs:** CPM $${((t.spend / t.impressions) * 1000).toFixed(2)} · CPC $${(t.spend / t.clicks).toFixed(2)} · cost/signup $${t.signups ? (t.spend / t.signups).toFixed(2) : '—'} · cost/purchase $${t.purchases ? (t.spend / t.purchases).toFixed(2) : '—'}`, '');
    }
    if (s.instagram) {
      const ig = s.instagram;
      L.push(`## Instagram promotion `, '', `- ${ig.handle}: reach ${ig.reach.toLocaleString()} · profile visits ${ig.profileVisits.toLocaleString()} · link clicks ${ig.linkClicks.toLocaleString()}`, `- Signups from IG: ${ig.signups} · follows +${ig.follows.toLocaleString()} · ${ig.reels} Reels · ${ig.stories} stories`, `- Best post: ${ig.topPost} · boost spend $${ig.boostedSpend}`, '');
    }
    if (s.creativeBreakdown?.length) {
      L.push(`## Which ad produced which registrations`, '', `| Cell | Creative | Impr. | Clicks | CTR | Signups | Purchases | Spend | Cost/signup |`, `|---|---|---|---|---|---|---|---|---|`);
      for (const r of s.creativeBreakdown) {
        L.push(`| ${r.cell} | ${r.name}${r.kind === 'idea' ? ' (idea ' + r.verdict + ')' : ''} | ${r.impressions.toLocaleString()} | ${r.clicks.toLocaleString()} | ${r.ctr}% | ${r.signups} | ${r.purchases} | $${r.spend} | ${r.cpl != null ? '$' + r.cpl : '—'} |`);
      }
      L.push('');
    }
    if (s.hourlyCohorts?.length) {
      L.push(`## Signup cohorts over time`, '', ...s.hourlyCohorts.map((b) => `- ${b.label}: ${b.signups} signups (${b.clicks} clicks, ${b.purchases} purchases) · cumulative ${b.cumulativeSignups}`), '');
    }
    if (s.accuracy?.overall != null) L.push(`## Simulation accuracy`, '', `CTR ${s.accuracy.ctr}% · Conversion ${s.accuracy.conversion}% · Overall ${s.accuracy.overall}%`, '');
    L.push(`## Marketing vision`, '', `*${s.vision.disclaimer}*`, '');
    L.push(`**Market read.** ${s.vision.marketRead}`, '');
    L.push(`**Positioning thesis.** ${s.vision.positioningThesis}`, '');
    L.push(`**Big idea: ${s.vision.bigIdea.name}** (${s.vision.bigIdea.type}). ${s.vision.bigIdea.rationale}`, '');
    L.push(`**Channel strategy.**`, '', ...s.vision.channelStrategy.map((x) => `- ${x.channel} — ${x.role} (${x.share}): ${x.why}`), '');
    L.push(`**Creative direction.** Tone: ${s.vision.creativeDirection.tone}`, `- Motifs: ${s.vision.creativeDirection.motifs.join('; ')}`, `- Avoid: ${s.vision.creativeDirection.avoid.join('; ')}`, '');
    L.push(`**Funnel leak.** ${s.vision.funnelLeak}`, '');
    L.push(`**Metrics philosophy.** ${s.vision.metricsPhilosophy}`, '');
    L.push(`## Marketing ideas tested in this run`, '', ...s.ideas.map((x) => `- **${x.name}** (cell ${x.cell}, ${x.type}) — \`${x.verdict}\` · CTR ${x.ctr}% · purchases ${x.purchases} · spend $${x.spend}. ${x.note || x.hypothesis}`), '');
    if (s.report.competitorReaction) {
      const cr = s.report.competitorReaction;
      L.push(`## Competitor reaction`, '', `*${cr.disclaimer}*`, '', `**Expected CAC inflation: +${cr.expectedCacUplift}%** — ${cr.summary}`, '');
      for (const x of cr.per) {
        L.push(`**${x.competitor}** (${x.threat})`);
        for (const sc of x.scenarios) L.push(`- ${sc.reaction} — ${sc.probability}% · ${sc.timing}. Impact: ${sc.impact}. Counter: ${sc.counter}`);
        L.push('');
      }
      if (cr.postTest?.length) {
        L.push(`**After this test:**`, '', ...cr.postTest.map((x) => `- ${x.name}: ${x.afterTest}`), '');
      }
    }
    L.push(`## TikTok video lab`, '', ...s.tiktok.map((v) => `- ${v.angle}: “${v.hook}” — ${v.stats.views.toLocaleString()} views, ${v.stats.watchThrough}% watch-through`), '');
    L.push(`## What the simulator did`, '', ...s.report.optimizationLog.map((t) => `- ${t}`), '');
    L.push(`---`, '', `Saved in LaunchSim Reports. ${s.report.disclaimer}`);
    return L.join('\n');
  };

  const copyMd = async (r) => {
    try {
      await navigator.clipboard.writeText(toMarkdown(r));
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="fade-in">
      <h2>Reports</h2>
      <p className="muted small mb-16">Every completed validation automatically saves its full report here — results, verdicts, the simulator’s marketing vision and the ideas it tested.</p>
      {reports.length === 0 && <EmptyState title="No reports yet" text="Reports appear here after the first real test completes." />}
      {reports.length > 0 && (
        <div className="card mb-16">
          {reports.map((r) => (
            <div key={r.id} className="spread row-wrap" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div>
                <b className="small">{r.title}</b>
                <div className="tiny mt-8">{r.type} · {fmtDateTime(r.createdAt)}</div>
              </div>
              <button className={'btn btn-sm ' + (openId === r.id ? 'btn-dark' : 'btn-secondary')} onClick={() => (openId === r.id ? setOpenId(null) : open(r.id))}>
                {openId === r.id ? 'Close' : 'Open'}
              </button>
            </div>
          ))}
        </div>
      )}

      {openId && !detail && <Spinner label="Loading report…" />}
      {detail && (
        <div className="card fade-in">
          <div className="spread row-wrap mb-16">
            <h3 style={{ margin: 0 }}>{detail.title}</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => copyMd(detail)}>{copied ? 'Copied ✓' : 'Copy as Markdown'}</button>
          </div>
          <ReportBody snapshot={detail.content.snapshot} setup={detail.content} />
        </div>
      )}
    </div>
  );
}

function ReportBody({ snapshot: s, setup }) {
  const r = s.report;
  return (
    <div>
      <p style={{ fontWeight: 620 }}>{r.headline}</p>
      <div className="tiny mb-16">{setup.channel} · {setup.country} · ${setup.budget} · {setup.durationHours}h ({setup.mode})</div>
      <table className="table">
        <thead><tr><th>Check</th><th>Result</th><th>Verdict</th></tr></thead>
        <tbody>
          {r.checks.map((c) => (
            <tr key={c.check}>
              <td><b>{c.check}</b></td>
              <td className="small">{c.result}</td>
              <td><span className={'badge ' + (c.verdict === 'POSITIVE' ? 'badge-launch' : c.verdict === 'NEGATIVE' || c.verdict === 'RISK' ? 'badge-kill' : c.verdict === 'WEAK' ? 'badge-pivot' : 'badge-neutral')}>{c.verdict.replace('_', ' ')}</span></td>
            </tr>
          ))}
        </tbody>
      </table>

      <hr className="divider" />
      <h3>How the simulator sees the marketing</h3>
      <div className="tiny mb-16">{s.vision.disclaimer}</div>
      <h4>Market read</h4>
      <p className="small muted">{s.vision.marketRead}</p>
      <h4>Positioning thesis</h4>
      <p className="small muted">{s.vision.positioningThesis}</p>
      <div className="card-plain mb-16" style={{ borderColor: 'var(--accent)' }}>
        <span className="badge badge-accent">Big idea</span>
        <div className="row mt-8"><b>{s.vision.bigIdea.name}</b><span className="tiny">({s.vision.bigIdea.type})</span></div>
        <p className="small muted" style={{ marginTop: 6, marginBottom: 0 }}>{s.vision.bigIdea.rationale}</p>
      </div>
      <h4>Channel strategy</h4>
      {s.vision.channelStrategy.map((x) => (
        <div className="small mb-8" key={x.channel}><b>{x.channel}</b> — {x.role} <span className="tiny">({x.share})</span><div className="tiny muted">{x.why}</div></div>
      ))}
      <h4 className="mt-16">Creative direction</h4>
      <p className="small muted">{s.vision.creativeDirection.tone}</p>
      <div className="small">Motifs: {s.vision.creativeDirection.motifs.join(' · ')}</div>
      <div className="small">Avoid: {s.vision.creativeDirection.avoid.join(' · ')}</div>
      <h4 className="mt-16">Funnel leak</h4>
      <p className="small muted">{s.vision.funnelLeak}</p>
      <h4>Metrics philosophy</h4>
      <p className="small muted">{s.vision.metricsPhilosophy}</p>

      <hr className="divider" />
      <h3>Marketing ideas tested in this run</h3>
      <div className="tiny mb-16">These ideas entered the rotation as extra test cells — the optimizer promoted, parked or killed them based on measured performance.</div>
      <table className="table">
        <thead><tr><th>Idea</th><th>Type</th><th>Cell</th><th>CTR</th><th>Purchases</th><th>Spend</th><th>Verdict</th></tr></thead>
        <tbody>
          {s.ideas.map((x) => (
            <tr key={x.name} className={x.verdict === 'SCALE' ? 'hl' : ''}>
              <td><b>{x.name}</b><div className="tiny">{x.note}</div></td>
              <td className="tiny">{x.type}</td>
              <td className="mono">{x.cell}</td>
              <td>{x.ctr}%</td>
              <td>{x.purchases}</td>
              <td>{fmtMoney(x.spend)}</td>
              <td><span className={'badge ' + (x.verdict === 'SCALE' ? 'badge-launch' : x.verdict === 'PARK' ? 'badge-neutral' : 'badge-kill')}>{x.verdict}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="banner banner-info mt-16" style={{ marginBottom: 0 }}>
        <div className="small">{r.marketing.summary}</div>
      </div>

      {r.competitorReaction && (
        <>
          <hr className="divider" />
          <h3>Competitor Reaction</h3>
          <div className="tiny mb-16">{r.competitorReaction.disclaimer}</div>
          <div className="card-plain mb-16">
            <span className="badge badge-test">Expected CAC inflation when you grow</span>
            <div className="stat-num" style={{ fontSize: 26, marginTop: 6 }}>+{r.competitorReaction.expectedCacUplift}%</div>
            <div className="small muted">{r.competitorReaction.summary}</div>
          </div>
          {r.competitorReaction.per.map((x) => (
            <div key={x.competitor} className="mb-16">
              <div className="row-wrap"><b className="small">{x.competitor}</b><span className="badge badge-neutral">{x.threat}</span></div>
              {x.scenarios.map((s, i) => (
                <div key={i} className="small mt-8" style={{ paddingLeft: 10, borderLeft: '2px solid var(--line-strong)' }}>
                  <b>{s.reaction}</b> <span className="tiny">({s.probability}% · {s.timing})</span>
                  <div className="tiny muted">{s.impact}</div>
                  <div className="tiny"><b>Counter:</b> {s.counter}</div>
                </div>
              ))}
            </div>
          ))}
          {r.competitorReaction.postTest?.length > 0 && (
            <>
              <h4>Where each competitor stands after this test</h4>
              {r.competitorReaction.postTest.map((x) => (
                <div key={x.name} className="small mb-8"><b>{x.name}</b> — {x.afterTest}</div>
              ))}
            </>
          )}
        </>
      )}

      {r.simulationVs && (
        <>
          <hr className="divider" />
          <h3>Funnel — who moved through</h3>
          <RealFunnelFlat m={s.totals} sv={r.simulationVs} />
          <h3 className="mt-16">Detailed statistics</h3>
          <div className="grid grid-4">
            {[['Spend', fmtMoney(s.totals.spend)], ['CPM', s.totals.impressions ? fmtMoney((s.totals.spend / s.totals.impressions) * 1000) : '—'],
              ['CPC', s.totals.clicks ? fmtMoney(s.totals.spend / s.totals.clicks) : '—'], ['Cost / signup', s.totals.signups ? fmtMoney(s.totals.spend / s.totals.signups) : '—'],
              ['Cost / purchase', s.totals.purchases ? fmtMoney(s.totals.spend / s.totals.purchases) : '—'], ['Revenue', fmtMoney(s.totals.revenue)],
              ['ROAS', String(r.roas)], ['Check-ins', String(s.checkinsCount)]].map(([k, v]) => (
              <div className="card-plain" key={k}><div className="tiny">{k}</div><div style={{ fontWeight: 660, fontSize: 16 }}>{v}</div></div>
            ))}
          </div>
          {s.instagram && (
            <>
              <h3 className="mt-16">Instagram promotion</h3>
              <div className="tiny mb-8">{s.instagram.disclaimer}</div>
              <div className="grid grid-4">
                {[['Reach', s.instagram.reach.toLocaleString()], ['Profile visits', s.instagram.profileVisits.toLocaleString()], ['Link clicks', s.instagram.linkClicks.toLocaleString()], ['IG signups', String(s.instagram.signups)],
                  ['Follows', '+' + s.instagram.follows.toLocaleString()], ['Reels', String(s.instagram.reels)], ['Stories', String(s.instagram.stories)], ['Best post', s.instagram.topPost]].map(([k, v]) => (
                  <div className="card-plain" key={k}><div className="tiny">{k}</div><div style={{ fontWeight: 660, fontSize: 16 }}>{v}</div></div>
                ))}
              </div>
            </>
          )}
          <CreativeBreakdown rows={s.creativeBreakdown} />
          <HourlyCohorts buckets={s.hourlyCohorts} />
          <div className="tiny mt-8">Overall simulation accuracy: <b>{r.accuracy.overall}%</b></div>
        </>
      )}

      <hr className="divider" />
      <h3>What the simulator did</h3>
      {r.optimizationLog.map((t, i) => <div key={i} className="small muted">• {t}</div>)}
      <div className="tiny mt-16">{r.disclaimer}</div>
    </div>
  );
}

/* ---------------- IMPROVE MODAL ---------------- */
function ImproveModal({ p, onClose, act }) {
  const imp = p.improvement;
  const cur = p.current.inputs;
  const [selected, setSelected] = useState(imp ? imp.changes.map((_, i) => i) : []);
  const [fields, setFields] = useState({ name: p.name, what: cur.what || '', audience: cur.audience || '', price: cur.price });
  const [mode, setMode] = useState('quick');
  if (!imp) return null;

  const toggle = (i) => setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  const applySuggestions = () => {
    const f = { ...fields };
    imp.changes.forEach((c, i) => {
      if (!selected.includes(i) || !c.patch) return;
      if (c.patch.audience) f.audience = c.patch.audience;
      if (c.patch.price) f.price = c.patch.price;
      if (c.patch.what) f.what = c.patch.what;
    });
    setFields(f);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,11,.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px', overflowY: 'auto' }} onClick={onClose}>
      <div className="card fade-in" style={{ maxWidth: 720, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 style={{ marginBottom: 0 }}>Improve my idea</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="row mt-8" style={{ gap: 14 }}>
          <span className="small muted">Current: <b style={{ color: 'var(--ink)' }}>{imp.currentScore}/100</b></span>
          <span style={{ color: 'var(--ink-3)' }}>→</span>
          <span className="small">Potential: <b style={{ color: 'var(--launch)' }}>{imp.potentialScore}/100</b></span>
          <span className="tiny">(simulation estimate — not a guarantee)</span>
        </div>

        <div className="mt-16">
          {imp.changes.map((c, i) => (
            <label key={i} className="card-plain mb-8" style={{ display: 'block', cursor: 'pointer', borderColor: selected.includes(i) ? 'var(--accent)' : undefined }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <input type="checkbox" checked={selected.includes(i)} onChange={() => toggle(i)} style={{ marginTop: 4 }} />
                <div>
                  <div className="row-wrap">
                    <span className="badge badge-accent">{c.area}</span>
                    <b className="small">+{c.expectedGain} est. points</b>
                  </div>
                  <div className="small mt-8"><b>{c.from}</b> → <b>{c.to}</b></div>
                  <div className="tiny">Why: {c.why}</div>
                </div>
              </div>
            </label>
          ))}
        </div>

        <hr className="divider" />
        <div className="spread row-wrap mb-16">
          <h3 style={{ margin: 0 }}>Adjusted inputs</h3>
          <button className="btn btn-secondary btn-sm" onClick={applySuggestions} disabled={!selected.length}>Apply selected suggestions</button>
        </div>
        <div className="grid grid-2">
          <div className="field"><label className="label">Project name</label>
            <input className="input" value={fields.name} onChange={(e) => setFields({ ...fields, name: e.target.value })} /></div>
          <div className="field"><label className="label">Price, $</label>
            <input className="input" type="number" min="0.5" step="0.5" value={fields.price} onChange={(e) => setFields({ ...fields, price: e.target.value })} /></div>
        </div>
        <div className="field"><label className="label">Audience</label>
          <input className="input" value={fields.audience} onChange={(e) => setFields({ ...fields, audience: e.target.value })} /></div>
        <div className="field"><label className="label">What are you building?</label>
          <textarea className="textarea" value={fields.what} onChange={(e) => setFields({ ...fields, what: e.target.value })} /></div>

        <div className="row-wrap mb-16">
          {[['quick', 'Basic · 1 cr'], ['standard', 'Standard · 2 cr'], ['advanced', 'Advanced · 5 cr']].map(([m, l]) => (
            <span key={m} className={'chip' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>{l}</span>
          ))}
        </div>
        <div className="spread">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={!!act.busy}
            onClick={() => act('Simulating improved version', async () => {
              await api.iterate(p.id, {
                name: fields.name, inputs: { what: fields.what, audience: fields.audience, price: Number(fields.price) },
                changes: imp.changes.filter((_, i) => selected.includes(i)).map(({ area, from, to, why }) => ({ area, from, to, why })),
                mode,
              });
              onClose();
            })}>
            Simulate Again
          </button>
        </div>
      </div>
    </div>
  );
}
