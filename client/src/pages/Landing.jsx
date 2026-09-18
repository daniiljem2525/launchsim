import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Brand } from '../components/TopNav.jsx';
import { useAuth } from '../auth.jsx';
import { api } from '../api.js';

const FLOW = ['IDEA', 'RESEARCH', 'SIMULATE', 'IMPROVE', 'REAL TEST', 'BUILD'];

export default function Landing() {
  const { user, enterDemo } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const testIdea = () => { nav(user ? '/app/new' : '/signup?next=/app/new'); };
  const exploreDemo = async () => {
    setBusy(true); setErr('');
    try {
      const demoProjectId = await enterDemo();
      nav(demoProjectId ? `/app/projects/${demoProjectId}` : '/app');
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ background: '#0a0a0b' }}>
        <div className="container-wide topnav-inner" style={{ borderBottom: '1px solid #26262b' }}>
          <Brand light />
          <div className="nav-cta">
            {user
              ? <Link to="/app" className="btn btn-light btn-sm">Open app</Link>
              : <>
                  <Link to="/login" className="btn btn-ghost-light btn-sm">Sign in</Link>
                  <Link to="/signup" className="btn btn-light btn-sm">Start free</Link>
                </>}
          </div>
        </div>
        <section className="hero">
          <div className="hero-inner">
            <span className="hero-eyebrow">Pre-Launch Testing Platform</span>
            <h1>Test your startup<br />before you build it.</h1>
            <p className="sub">Simulate demand, test your positioning, find your biggest risks and decide what to build — before spending weeks and money on an MVP.</p>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <button className="btn btn-light btn-lg" onClick={testIdea}>Test an idea</button>
              <a href="#how" className="btn btn-ghost-light btn-lg">See how it works</a>
            </div>
            <div className="flowstrip">
              {FLOW.map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <span className="flowarrow">→</span>}
                  <span className="flowstep">{s}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className="landing-section" id="how">
        <div className="container">
          <div className="kicker">How it works</div>
          <h2 className="section-title">One product. Six decisions.</h2>
          <p className="section-sub mb-24">LaunchSim is not a chatbot and not an idea generator. It is a structured testing system that takes your idea from assumption to evidence.</p>
          <div className="grid grid-3">
            {[
              ['1 · Describe the idea', 'What you build, for whom, the problem, the price and your test budget. Takes 3 minutes.', 'A $9/month dog sitting app for urban owners.'],
              ['2 · Get the market picture', 'LaunchSim structures your business model, maps competitors and pricing, and surfaces the assumptions to test first.', 'Hypothesis map with confidence and risk levels.'],
              ['3 · Simulate the launch', 'A virtual product version — landing page, 5 ad angles and a simulated market of customer profiles — runs through a conversion funnel.', 'CTR 2.8% · 235 signups · 3–5 purchases (estimates).'],
              ['4 · Find the weakest link', 'A 0–100 launch score with nine explained sub-scores, biggest risks and the biggest opportunity.', '74 / 100 — TEST.'],
              ['5 · Improve and re-simulate', 'Apply the recommended changes to audience, positioning, price or offer — then simulate again and compare.', 'Iteration #2: 74 → 82 (estimate).'],
              ['6 · Test with real money', 'When the signal is strong, generate the landing, creatives, campaign structure and tracking plan for a small real-budget test.', 'Simulation vs reality. Final decision.'],
            ].map(([t, d, e]) => (
              <div className="card card-hover" key={t}>
                <h3>{t}</h3>
                <p className="muted small">{d}</p>
                <div className="mono tiny" style={{ borderLeft: '2px solid var(--line-strong)', paddingLeft: 10 }}>{e}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section soft">
        <div className="container">
          <div className="grid grid-side" style={{ alignItems: 'center' }}>
            <div>
              <div className="kicker">Honest by design</div>
              <h2 className="section-title">Estimates, not promises.</h2>
              <p className="muted">Every number LaunchSim produces is a simulation estimate based on collected data, assumptions and models — clearly labeled, never presented as a prediction of real sales.</p>
              <p className="muted">If real evidence is missing, LaunchSim says <b>“Not enough evidence”</b> instead of inventing statistics. The goal is simple: help you decide whether the next few weeks of your life are worth spending on this idea.</p>
            </div>
            <div className="card-dark">
              <div className="tiny" style={{ color: '#a1a1aa', letterSpacing: '.1em', marginBottom: 10 }}>LAUNCH SCORE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 44, fontWeight: 700, letterSpacing: '-0.03em' }}>74</span>
                <span className="badge badge-test">TEST</span>
              </div>
              <hr style={{ border: 0, borderTop: '1px solid #26262b', margin: '14px 0' }} />
              {[['Market Demand', 81], ['Willingness to Pay', 58], ['Competition', 66], ['Differentiation', 63], ['Acquisition', 72], ['Retention', 46]].map(([k, v]) => (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div className="spread small"><span style={{ color: '#d4d4d8' }}>{k}</span><b>{v}</b></div>
                  <div className="bar" style={{ background: '#26262b' }}><i style={{ width: v + '%', background: '#fff' }} /></div>
                </div>
              ))}
              <div className="tiny mt-16" style={{ color: '#a1a1aa' }}>Simulation estimate — not a guarantee of real-world performance.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="container">
          <div className="kicker">Pricing</div>
          <h2 className="section-title">Start free. Upgrade when it saves you money.</h2>
          <p className="section-sub mb-24">One failed MVP costs more than a year of LaunchSim. All plans use credits for simulations and research.</p>
          <div className="grid grid-4">
            {[
              ['Free', '$0', 'forever', ['2 credits', '1 basic simulation', '1 project'], false],
              ['Test', '$19', 'one-time', ['10 credits', 'Full validation cycle', 'Price + A/B simulation', 'Real test planning'], true],
              ['Founder', '$39', 'per month', ['30 credits / month', 'Unlimited projects', 'Deep research', 'Experiments'], false],
              ['Studio', '$299', 'per month', ['400 credits / month', 'Team workspaces*', 'Priority research', 'Accuracy tracking'], false],
            ].map(([name, price, per, feats, hot]) => (
              <div key={name} className={'card' + (hot ? '' : ' card-plain')} style={hot ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' } : undefined}>
                {hot && <span className="badge badge-accent mb-8">Popular</span>}
                <h3>{name}</h3>
                <div className="row" style={{ alignItems: 'baseline', gap: 6 }}>
                  <span className="stat-num">{price}</span>
                  <span className="tiny">{per}</span>
                </div>
                <hr className="divider" />
                {feats.map((f) => <div key={f} className="small mb-8">✓ {f}</div>)}
              </div>
            ))}
          </div>
          <div className="tiny mt-16">* Studio team features are on the roadmap. Billing runs in demo mode in this environment — no real payment is processed.</div>
        </div>
      </section>

      <section className="landing-section soft">
        <div className="container center">
          <h2 className="section-title">Don’t build yet.</h2>
          <p className="section-sub" style={{ margin: '0 auto 26px' }}>Find your biggest risk first. It takes three minutes — not three weeks.</p>
          <div className="row-wrap" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary btn-lg" onClick={testIdea}>Test an idea</button>
            <button className="btn btn-secondary btn-lg" onClick={exploreDemo} disabled={busy}>{busy ? 'Preparing…' : 'Explore Demo'}</button>
          </div>
          {err && <div className="error-text mt-8">{err}</div>}
          <div className="tiny mt-16">Demo opens a fully simulated sample project (DogSit) — every number in it is labeled DEMO / SIMULATED.</div>
        </div>
      </section>

      <footer className="footer">
        <div className="container spread">
          <span>© 2026 LaunchSim — Test your startup before you build it.</span>
          <span>Simulate the market. Improve the idea. Test it for real.</span>
        </div>
      </footer>
    </div>
  );
}
