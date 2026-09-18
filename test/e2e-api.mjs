// End-to-end API smoke test for LaunchSim (runs as a normal user would).
const BASE = 'http://localhost:4311/api';
let cookie = '';
let failures = 0;

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setc = res.headers.get('set-cookie');
  if (setc) cookie = setc.split(';')[0];
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
function check(name, cond, extra) {
  if (cond) console.log('  ✓', name);
  else { failures++; console.log('  ✗ FAIL:', name, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); }
}

(async () => {
  console.log('— signup');
  const email = `founder_${Date.now()}@test.io`;
  let r = await req('POST', '/auth/signup', { name: 'Test Founder', email, password: 'test-pass-123' });
  check('signup 200', r.status === 200, r);
  check('free plan 2 credits', r.data?.user?.credits === 2, r.data);

  console.log('— create project + analyze');
  r = await req('POST', '/projects', {
    name: 'FitBuddy', what: 'A mobile app that creates personalized workout plans and reminds users daily with streak tracking.',
    audience: 'Busy office workers', problem: 'Generic workout plans are frustrating and people quit after two weeks',
    model: 'subscription', price: 7.99, market: 'United States', budget: 80,
    validate: ['demand', 'willingness to pay', 'business model'],
  });
  check('create project', r.status === 200 && r.data?.id, r);
  const pid = r.data.id;
  r = await req('POST', `/projects/${pid}/analyze`, { mode: 'quick' });
  check('analyze ok', r.status === 200 && r.data?.score != null, r);
  check('quick cost 1 credit', r.status === 200);

  console.log('— bundle contents');
  r = await req('GET', `/projects/${pid}`);
  const p = r.data.project;
  check('has score + label', p.score != null && p.statusLabel, { s: p.score, l: p.statusLabel });
  check('research exists', !!p.current?.research, null);
  check('competitors >= 2 with real fields', (p.current?.competitors || []).length >= 2 && p.current.competitors.every((c) => c.name && c.price && c.registrations !== undefined), p.current?.competitors?.[0]);
  check('unit economics in simulation', p.current.simulation.results.unitEcon?.cac > 0 && p.current.simulation.results.unitEcon.ltv > 0, p.current.simulation.results.unitEcon);
  check('competitor intel (reaction)', p.competitorIntel?.reaction?.per?.length >= 2 && p.competitorIntel.reaction.expectedCacUplift > 0, p.competitorIntel);
  check('hypotheses >= 6', (p.current?.hypotheses || []).length >= 6);
  check('competitors >= 1', (p.current?.competitors || []).length >= 1);
  check('funnel numbers', p.current.simulation.results.funnel.impressions > 0);
  check('ab has 5 variants', p.current.simulation.results.ab.rows.length === 5);
  check('price ladder 5 rows', p.current.simulation.results.priceSim.rows.length === 5);
  check('personas >= 8', p.current.simulation.results.personas.length >= 8);
  check('landing generated', !!p.current.simulation.results.landing.headline);
  check('ads = 5 angles', p.current.simulation.results.ads.length === 5);
  check('improvement proposal', p.improvement?.potentialScore > p.score, p.improvement);
  check('decision stored', !!p.decision?.recommendation, p.decision);
  check('timeline >= 3', p.timeline.length >= 3);

  console.log('— second analyze (Simulate Again, same iteration, new seed salt)');
  r = await req('POST', `/projects/${pid}/analyze`, { mode: 'quick' });
  check('re-analyze ok', r.status === 200, r);

  console.log('— credits: free user should now be out (2 credits used)');
  r = await req('POST', `/projects/${pid}/analyze`, { mode: 'quick' });
  check('3rd analyze blocked 402', r.status === 402, r.status);

  console.log('— billing: upgrade to founder (demo checkout)');
  r = await req('POST', '/billing/checkout', { plan: 'founder' });
  check('demo checkout ok', r.status === 200 && r.data?.mode === 'demo', r);
  r = await req('GET', '/billing');
  check('credits granted 30', r.data?.credits === 30, r.data?.credits);
  check('plan = founder', r.data?.plan === 'founder');

  console.log('— improve + iterate');
  r = await req('POST', `/projects/${pid}/iterate`, {
    inputs: { audience: 'Busy office workers preparing for a marathon', price: 6.99 },
    changes: [{ area: 'Audience', from: 'Busy office workers', to: 'Marathon preppers', why: 'urgency' }],
    mode: 'standard',
  });
  check('iterate ok + credits deducted', r.status === 200, r);
  const score2 = r.data?.score;
  r = await req('GET', `/projects/${pid}`);
  check('iterationsCount = analyze(iter1) + iterate(iter2)', r.data.project.iterationsCount === 2, r.data.project.iterationsCount);
  check('iteration labeled', r.data.project.current.label.includes('Audience'), r.data.project.current.label);
  check('changes recorded', r.data.project.current.changes.length === 1);

  console.log('— deep research (3 credits)');
  r = await req('POST', `/projects/${pid}/research`);
  check('deep research ok', r.status === 200, r);

  console.log('— real test');
  r = await req('POST', `/projects/${pid}/realtest`, { budget: 120, country: 'United States', channel: 'Meta Ads' });
  check('realtest created', r.status === 200 && r.data?.id, r);
  const tid = r.data.id;
  r = await req('GET', `/projects/${pid}`);
  check('plan has tracking', !!r.data.project.realTests[0]?.plan?.trackingPlan?.length);
  r = await req('POST', `/projects/${pid}/realtest/${tid}/launch`, { mode: 'express' });
  check('validation launched (express)', r.status === 200 && r.data?.jobId, r);
  await new Promise((res) => setTimeout(res, 1500)); // let the run reach the first findings
  r = await req('GET', `/projects/${pid}`);
  check('job running with progress', r.data.project.realTests[0]?.job?.status === 'RUNNING' && r.data.project.realTests[0].job.progress > 0, r.data.project.realTests[0]?.job?.status);
  check('stages planned', r.data.project.realTests[0]?.job?.stages?.length === 6);
  check('findings feed alive', r.data.project.realTests[0]?.job?.findings?.length > 0);
  // wait for the express run to finish, polling like the UI does
  let done = false;
  for (let i = 0; i < 75; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    r = await req('GET', `/projects/${pid}`);
    if (r.data.project.realTests[0]?.status === 'COMPLETED') { done = true; break; }
  }
  check('validation completed', done);
  const rt = r.data.project.realTests[0];
  check('metrics written', rt.metrics?.purchases != null, rt.metrics);
  check('accuracy computed', rt.accuracy?.overall > 0, rt.accuracy);
  check('extended simulationVs (5 stages)', rt.simulationVs && ['impressions', 'ctr', 'conversion', 'pricingViews', 'purchases'].every((k) => rt.simulationVs[k]), Object.keys(rt.simulationVs || {}));
  check('instagram layer in job', rt.job?.instagram?.reach > 0 && rt.job.instagram.signups >= 0 && rt.job.instagram.linkClicks > 0, rt.job?.instagram?.reach);
  check('check-in series archived', Array.isArray(rt.job?.series) && rt.job.series.length > 50, rt.job?.series?.length);
  check('realistic signups (no 0 with 30+ clicks)', !(rt.metrics.landingVisits >= 30 && rt.metrics.signups === 0) && rt.metrics.signups > 0, { clicks: rt.metrics.landingVisits, signups: rt.metrics.signups });
  check('creative breakdown sums to totals', (() => {
    const cb = rt.job?.creativeBreakdown;
    if (!cb?.length) return false;
    const sign = cb.reduce((a, x) => a + x.signups, 0);
    const purch = cb.reduce((a, x) => a + x.purchases, 0);
    return sign === rt.metrics.signups && purch === rt.metrics.purchases && cb.length === 8;
  })(), { n: rt.job?.creativeBreakdown?.length, signups: rt.job?.creativeBreakdown?.reduce((a, x) => a + x.signups, 0) });
  check('hourly cohorts present', (rt.job?.hourlyCohorts?.length || 0) >= 4 && rt.job.hourlyCohorts.every((b) => b.signups >= 0), rt.job?.hourlyCohorts?.length);
  check('report with checks', rt.job?.report?.checks?.length >= 5, rt.job?.report?.checks?.length);
  check('tiktok videos produced', rt.job?.tiktok?.length === 3);
  check('marketing vision in report', !!rt.job?.report?.marketing?.vision?.bigIdea?.name, rt.job?.report?.marketing?.vision?.bigIdea);
  check('ideas tested in run', (rt.job?.ideas || []).length === 3 && rt.job.ideas.every((x) => ['SCALE', 'PARK', 'KILL'].includes(x.verdict)), rt.job?.ideas?.map((x) => x.verdict));
  check('competitor reaction in job', rt.job?.reaction?.per?.length >= 1 && rt.job.reaction.expectedCacUplift >= 5, rt.job?.reaction?.expectedCacUplift);
  check('post-test competitor insights', (rt.job?.competitorsInsights || []).length >= 1 && rt.job.competitorsInsights.every((x) => x.afterTest && x.threat), rt.job?.competitorsInsights?.length);
  check('decision refreshed', !!r.data.project.decision?.recommendation);

  console.log('— reports archive');
  check('report archived in bundle', (r.data.project.reports || []).length >= 1, r.data.project.reports);
  const rid = r.data.project.reports?.[0]?.id;
  r = await req('GET', `/projects/${pid}/reports/${rid}`);
  check('report detail loads', r.status === 200 && r.data?.report?.content?.snapshot?.report, r.status);
  check('report has vision + ideas', !!r.data.report.content.snapshot.vision.bigIdea.name && r.data.report.content.snapshot.ideas.length === 3);

  console.log('— unit economics what-if');
  r = await req('POST', `/projects/${pid}/unitecon/whatif`, { churn: 0.08, margin: 0.85 });
  check('what-if recomputes', r.status === 200 && r.data?.unitEcon?.whatIf === true && r.data.unitEcon.ltv >= p.current.simulation.results.unitEcon.ltv, r.data?.unitEcon?.ltv);

  console.log('— experiments');
  r = await req('POST', '/experiments', { projectId: pid, hypothesis: 'Users care more about trust than price.', control: { label: 'Control', price: 7.99 }, variant: { label: 'Trust+11', price: 11 } });
  check('experiment created', r.status === 200 && r.data?.id, r);
  const xid = r.data.id;
  r = await req('POST', `/experiments/${xid}/run`, {});
  check('experiment run ok', r.status === 200 && r.data?.results?.winner, r);
  r = await req('GET', '/experiments');
  check('experiments listed', r.data?.experiments?.length === 1);

  console.log('— ownership guard');
  cookie = '';
  r = await req('POST', '/auth/signup', { name: 'Other', email: `other_${Date.now()}@test.io`, password: 'test-pass-123' });
  r = await req('GET', `/projects/${pid}`);
  check('other user blocked 403', r.status === 403, r.status);
  r = await req('GET', '/projects');
  check('other user list empty', r.data?.projects?.length === 0);

  console.log('— admin');
  cookie = '';
  r = await req('POST', '/auth/login', { email: 'admin@launchsim.test', password: 'admin-1234' });
  check('admin login', r.status === 200 && r.data?.user?.isAdmin, r.data);
  r = await req('GET', '/admin/overview');
  check('admin overview', r.status === 200 && r.data?.counts?.users >= 4, r.data?.counts);
  cookie = '';
  r = await req('POST', '/auth/login', { email, password: 'test-pass-123' });
  r = await req('GET', '/admin/overview');
  check('non-admin blocked', r.status === 403, r.status);

  console.log('— validation & errors');
  cookie = '';
  r = await req('POST', '/auth/signup', { name: 'X', email: 'bad', password: 'short' });
  check('bad signup rejected', r.status === 400);
  r = await req('GET', '/projects/999999');
  check('404 project', r.status === 401 || r.status === 404);

  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECKS FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
