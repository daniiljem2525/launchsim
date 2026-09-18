import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav.jsx';
import { api } from '../api.js';
import { ErrorBanner } from '../ui.jsx';

const STEPS = ['Idea', 'Audience', 'Problem', 'Model', 'Price', 'Market', 'Budget', 'Validate'];
const MODELS = [
  ['subscription', 'Subscription', 'Recurring monthly payment'],
  ['one-time', 'One-time payment', 'Pay once, use forever'],
  ['marketplace', 'Marketplace', 'Connect supply & demand'],
  ['commission', 'Commission', 'Take % of transactions'],
  ['advertising', 'Advertising', 'Free product, paid ads'],
  ['freemium', 'Freemium', 'Free tier + paid upgrades'],
  ['other', 'Other', 'Something else'],
];
const VALIDATE = ['demand', 'willingness to pay', 'pricing', 'positioning', 'target audience', 'acquisition', 'differentiation', 'business model'];

export default function Wizard() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', what: '', audience: '', problem: '', model: 'subscription',
    price: 9, market: 'United States', budget: 50, validate: ['demand', 'willingness to pay'],
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const stepValid = () => {
    switch (step) {
      case 0: return form.what.trim().length >= 15;
      case 1: return form.audience.trim().length >= 3;
      case 2: return form.problem.trim().length >= 10;
      case 3: return Boolean(form.model);
      case 4: return Number(form.price) >= 0.5;
      case 5: return form.market.trim().length >= 2;
      case 6: return Number(form.budget) >= 5;
      case 7: return form.validate.length > 0;
      default: return false;
    }
  };

  const start = async () => {
    setErr(''); setBusy(true);
    try {
      const { id } = await api.createProject(form);
      await api.analyze(id, 'quick');
      nav(`/app/projects/${id}`);
    } catch (e) {
      setErr(e);
      setBusy(false);
    }
  };

  return (
    <div>
      <TopNav />
      <main className="container page" style={{ maxWidth: 760 }}>
        <div className="page-head">
          <div>
            <h1>New project</h1>
            <p className="muted small">8 short questions. LaunchSim does the rest.</p>
          </div>
        </div>

        <div className="wizard-steps">
          {STEPS.map((s, i) => (
            <span key={s} className={'wstep' + (i === step ? ' on' : i < step ? ' done' : '')}>
              {i < step ? '✓' : i + 1} {s}
            </span>
          ))}
        </div>

        <div className="card fade-in" key={step}>
          {step === 0 && (
            <>
              <h2>What are you building?</h2>
              <div className="field mt-16">
                <label className="label">Project name (optional — we’ll suggest one)</label>
                <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="DogSit" maxLength={60} />
              </div>
              <div className="field">
                <label className="label">Describe the product</label>
                <textarea className="textarea" value={form.what} onChange={(e) => set('what', e.target.value)} placeholder={'I want to build an app that helps…'} />
                <div className="tiny mt-8">One paragraph is enough. Mention what makes it different if you can.</div>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <h2>Who is it for?</h2>
              <p className="muted small">Be as specific as you can — “urban dog owners” beats “everyone”.</p>
              <div className="field mt-16">
                <input className="input" value={form.audience} onChange={(e) => set('audience', e.target.value)} placeholder="Urban dog owners" />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <h2>What problem does it solve?</h2>
              <p className="muted small">How painful is it today? How do people solve it now?</p>
              <div className="field mt-16">
                <textarea className="textarea" value={form.problem} onChange={(e) => set('problem', e.target.value)} placeholder="It's hard to find a trustworthy dog sitter quickly…" />
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2>How will you make money?</h2>
              <div className="option-grid mt-16">
                {MODELS.map(([id, t, d]) => (
                  <div key={id} className={'option' + (form.model === id ? ' on' : '')} onClick={() => set('model', id)}>
                    <b>{t}</b><span>{d}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {step === 4 && (
            <>
              <h2>Expected price</h2>
              <p className="muted small">{form.model === 'subscription' || form.model === 'freemium' ? 'Per month.' : form.model === 'one-time' ? 'One-time.' : 'Primary price point.'}</p>
              <div className="field mt-16" style={{ maxWidth: 220 }}>
                <label className="label">Price, $</label>
                <input className="input" type="number" min="0.5" step="0.5" value={form.price} onChange={(e) => set('price', e.target.value)} />
              </div>
            </>
          )}
          {step === 5 && (
            <>
              <h2>Target market</h2>
              <p className="muted small">Country or region where you’ll launch first.</p>
              <div className="field mt-16" style={{ maxWidth: 320 }}>
                <input className="input" value={form.market} onChange={(e) => set('market', e.target.value)} placeholder="United States" />
              </div>
            </>
          )}
          {step === 6 && (
            <>
              <h2>Test budget</h2>
              <p className="muted small">Money you could realistically spend on a first real ad test.</p>
              <div className="field mt-16" style={{ maxWidth: 220 }}>
                <label className="label">Budget, $</label>
                <input className="input" type="number" min="5" step="5" value={form.budget} onChange={(e) => set('budget', e.target.value)} />
              </div>
            </>
          )}
          {step === 7 && (
            <>
              <h2>What do you want to validate?</h2>
              <p className="muted small">Pick everything that matters. We’ll prioritise hypotheses accordingly.</p>
              <div className="row-wrap mt-16">
                {VALIDATE.map((v) => (
                  <span key={v} className={'chip' + (form.validate.includes(v) ? ' on' : '')}
                    onClick={() => set('validate', form.validate.includes(v) ? form.validate.filter((x) => x !== v) : [...form.validate, v])}>
                    {v}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        <ErrorBanner error={err.code ? err : err ? { message: String(err) } : null} onRetry={err && err.code ? start : undefined} />
        {busy && <div className="loading-block"><span className="spinner" /> Running research, hypotheses and first simulation… This takes a few seconds.</div>}

        <div className="spread mt-24">
          <button className="btn btn-ghost" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>← Back</button>
          {step < 7
            ? <button className="btn btn-dark" disabled={!stepValid()} onClick={() => setStep((s) => s + 1)}>Continue →</button>
            : <button className="btn btn-primary btn-lg" disabled={!stepValid() || busy} onClick={start}>Start analysis</button>}
        </div>
        <div className="tiny mt-16 center">Basic simulation uses 1 credit. You can run standard (2) or advanced (5) simulations later.</div>
      </main>
    </div>
  );
}
