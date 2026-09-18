import React from 'react';

export function Spinner({ label }) {
  return <div className="loading-block"><span className="spinner" />{label ? <span>{label}</span> : null}</div>;
}

export function Skeleton({ h = 60, style }) {
  return <div className="skeleton" style={{ height: h, ...style }} />;
}

export function StatusBadge({ label }) {
  if (!label) return <span className="badge badge-neutral">DRAFT</span>;
  const cls = { KILL: 'badge-kill', PIVOT: 'badge-pivot', ITERATE: 'badge-iterate', TEST: 'badge-test', LAUNCH: 'badge-launch' }[label] || 'badge-neutral';
  const suffix = label === 'LAUNCH' ? ' · STRONG SIGNAL' : '';
  return <span className={cls + ' badge'}>{label}{suffix}</span>;
}

export function ScoreRing({ score, size = 128 }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const color = s <= 30 ? 'var(--kill)' : s <= 50 ? 'var(--pivot)' : s <= 70 ? 'var(--iterate)' : s <= 85 ? 'var(--test)' : 'var(--launch)';
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--bg-sunken)" strokeWidth="10" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} style={{ transition: 'stroke-dashoffset .7s ease' }} />
      </svg>
      <div className="ring-num"><b>{s}</b><span>/ 100</span></div>
    </div>
  );
}

export function SubScores({ sub, reasons, accent }) {
  return (
    <div>
      {Object.entries(sub).map(([k, v]) => (
        <div className="subscore" key={k} title={reasons ? reasons[k] : ''}>
          <div className="subscore-top"><b>{k}</b><span>{v}</span></div>
          <div className={'bar' + (accent ? ' bar-accent' : '') + (v < 50 ? ' bar-warn' : '')}><i style={{ width: v + '%' }} /></div>
          {reasons && reasons[k] ? <div className="tiny mt-8">{reasons[k]}</div> : null}
        </div>
      ))}
    </div>
  );
}

const FUNNEL_STEPS = [
  ['impressions', 'Impressions', (f) => f.impressions?.toLocaleString(), null],
  ['ctr', 'Clicks', (f) => f.visits?.toLocaleString(), (f) => `CTR ${f.ctr}%`],
  ['visits', 'Landing visits', (f) => f.visits?.toLocaleString(), null],
  ['signupRate', 'Signups', (f) => f.signups?.toLocaleString(), (f) => `${f.signupRate}% of visits`],
  ['pricingIntent', 'Pricing views', (f) => f.pricingViews?.toLocaleString(), (f) => `${f.pricingIntent}% of signups`],
  ['purchases', 'Purchases (est.)', (f) => Array.isArray(f.purchases) ? `${f.purchases[0]}–${f.purchases[2]}` : '—', null],
];

export function FunnelChart({ funnel }) {
  const max = funnel.impressions || 1;
  const widths = {
    impressions: 100,
    visits: Math.max(2, (funnel.visits / max) * 100),
    signups: Math.max(2, (funnel.signups / max) * 100 * 20),
    pricingViews: Math.max(2, (funnel.pricingViews / max) * 100 * 100),
    purchases: Math.max(2, ((funnel.purchases?.[1] || 0) / max) * 100 * 400),
  };
  return (
    <div>
      {FUNNEL_STEPS.map(([key, label, val, note], i) => (
        <React.Fragment key={label}>
          <div className="funnel-row">
            <div className="funnel-label">{label}</div>
            <div><div className="funnel-bar" style={{ width: widths[key] + '%' }} /></div>
            <div className="funnel-val">{val(funnel)}{note ? <small>{note(funnel)}</small> : null}</div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

export function EstimateNote({ children }) {
  return <div className="tiny mt-8" style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
    <span aria-hidden>⚠</span><span><b>Simulation estimate — not a guarantee of real-world performance.</b>{children ? ' ' + children : ''}</span>
  </div>;
}

export function DemoTag() {
  return <span className="notice-demo">Demo · Simulated</span>;
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="banner banner-error" role="alert">
      <div className="grow">
        <b>{error.code === 'insufficient_credits' ? 'Out of credits. ' : 'Something went wrong. '}</b>
        {error.message}
      </div>
      {onRetry ? <button className="btn btn-sm btn-secondary" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

export function InfoBanner({ children, kind = 'banner-info' }) {
  return <div className={'banner ' + kind}>{children}</div>;
}

export function EmptyState({ title, text, action }) {
  return (
    <div className="card center" style={{ padding: '48px 24px' }}>
      <h3>{title}</h3>
      <p className="muted small" style={{ maxWidth: 420, margin: '0 auto 18px' }}>{text}</p>
      {action}
    </div>
  );
}

export function KV({ k, v }) {
  return <div className="kv"><span>{k}</span><b>{v}</b></div>;
}
