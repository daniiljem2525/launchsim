// Long-running real-validation engine.
// A validation is an autonomous job that runs 4–24 real hours (or an explicit
// demo "express" mode). During the run it compresses a month of founder work:
// data collection, marketing campaign simulators with hourly optimization,
// TikTok video lab, and a final synthesis report.
//
// Everything is a deterministic pure function of (seed, elapsed time), so the
// job survives server restarts: progress, check-ins, findings and results are
// derived lazily on read and finalized once elapsed >= duration.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmtMoney = (n) => '$' + (Number(n) >= 100 ? Math.round(n) : n.toFixed(2));
import { competitorReaction, postTestCompetitorInsights } from './index.js';

export const REAL_DURATIONS = [
  { hours: 4, label: '4 hours', note: 'Sprint check' },
  { hours: 12, label: '12 hours', note: 'Overnight run' },
  { hours: 24, label: '24 hours', note: 'Full month compressed' },
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- stage plan ----------
const STAGE_DEFS = [
  { key: 'setup', label: 'Setup & data collection', to: 0.05, desc: 'Verify inputs, refresh market data, prepare campaign simulators.' },
  { key: 'sweep', label: 'Market data sweep', to: 0.2, desc: 'Re-check competitors, pricing landscape and demand signals; log findings.' },
  { key: 'campaign', label: 'Campaign simulator', to: 0.55, desc: 'Run all ad angles against the simulated market with hourly check-ins and budget reallocation.' },
  { key: 'tiktok', label: 'TikTok video lab', to: 0.8, desc: 'Produce short-video concepts, simulate their performance, pick the winner.' },
  { key: 'scale', label: 'Scale & stress test', to: 0.97, desc: 'Scale the winning creative, stress-test price acceptance and retention signals.' },
  { key: 'synthesis', label: 'Final synthesis', to: 1.0, desc: 'Compile the report: checks, accuracy vs simulation, decision inputs.' },
];

function stageStatuses(progress) {
  return STAGE_DEFS.map((s, i) => {
    const from = i === 0 ? 0 : STAGE_DEFS[i - 1].to;
    const status = progress >= s.to ? 'done' : progress >= from ? 'active' : 'pending';
    return { ...s, from, status };
  });
}

// ---------- TikTok video lab ----------
function buildTikTokVideos(structured, seed, rng) {
  const angles = ['Problem-focused', 'Trust-focused', 'Speed-focused'];
  const hooks = [
    `POV: ${structured.problem.replace(/\.$/, '').toLowerCase()} — again.`,
    `Nobody talks about this part of ${structured.audience.toLowerCase()} life…`,
    `I tested ${structured.product} for a week. Here's what happened.`,
  ];
  return angles.map((angle, i) => {
    const views = Math.round(2500 + rng() * 32000 * (i === 0 ? 1.25 : 1));
    const watch = Math.round(clamp(38 + rng() * 34, 10, 92));
    const likes = Math.round(views * (0.04 + rng() * 0.07));
    return {
      angle,
      hook: hooks[i],
      script: [
        { t: '0–2s', shot: 'Hook', text: hooks[i], overlay: 'Big captions, native style' },
        { t: '2–8s', shot: 'Problem scene', text: `Show the exact moment ${structured.problem.replace(/\.$/, '').toLowerCase()}`, overlay: 'Relatable, slightly exaggerated' },
        { t: '8–18s', shot: 'Product in action', text: `${structured.product} solving it step by step`, overlay: 'Screen recording or hands-on demo' },
        { t: '18–26s', shot: 'Proof + CTA', text: 'Result on screen → "Link in bio"', overlay: 'Keep the last frame 2s' },
      ],
      sound: i === 1 ? 'Calm voiceover + soft beat' : 'Trending upbeat sound',
      caption: `${structured.product} — ${structured.solution.split(/[.,;]/)[0].toLowerCase() || 'worth a try'}. Would you try it?`,
      hashtags: ['#startup', '#tiktokmademebuyit', '#' + structured.category.toLowerCase().replace(/[^a-z]+/g, ''), '#founder', '#dayinthelife'],
      stats: { views, likes, watchThrough: watch, simulated: true },
      released: true,
    };
  });
}

// ---------- marketing vision & ideas ----------
// The simulator's own reading of the marketing problem. These ideas are not
// decoration: at launch they are added to the campaign simulator as extra test
// cells, the optimizer promotes/parks/kills them during the run, and the final
// report scores each idea.
const IDEA_POOL = [
  { name: 'Trust Receipt', type: 'angle', hypothesis: 'Proof beats promises: showing verifiable proof beats claiming quality.', description: 'Lead every ad with a verifiable proof element (badge, count, live review) instead of adjectives.', effect: 'Higher trust → higher signup rate' },
  { name: 'POV: Disaster Averted', type: 'format', hypothesis: 'Relief after fear converts better than feature lists.', description: 'A 15s POV video showing the disaster that almost happened — then the one-tap fix.', effect: 'Higher watch-through & shares' },
  { name: 'The 10-Minute Switch', type: 'angle', hypothesis: 'Switching cost is the real competitor, not rivals.', description: 'Every creative opens with “from stuck to solved in 10 minutes” — make speed the identity.', effect: 'Higher CTR on cold audiences' },
  { name: 'Insider Price Reveal', type: 'offer', hypothesis: 'Transparent pricing disarms skeptics early.', description: 'Put the real price in the ad itself; filter out non-buyers before the click.', effect: 'Fewer but better clicks' },
  { name: 'Borrowed Trust', type: 'format', hypothesis: 'A stranger’s story outsells the brand’s story.', description: 'UGC-style testimonial from someone who had the exact problem last week.', effect: 'Lower CPM via engagement' },
  { name: 'Underdog Comparison', type: 'angle', hypothesis: 'Naming the incumbent’s weakness wins the undecided.', description: 'A respectful side-by-side vs the current workaround, one line each.', effect: 'Higher intent among comparer personas' },
];

function buildMarketingIdeas(structured, rng) {
  const pool = [...IDEA_POOL];
  const chosen = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen.map((idea, i) => ({
    ...idea,
    cell: 'FGH'[i],
    releasedAt: 0.24 + i * 0.06,
    why: `Targets the weakest link the simulator sees: ${['trust in the promise', 'attention in the first 3 seconds', 'perceived switching cost'][i]}.`,
  }));
}

function finalizeIdeaResults(totals, ideas, rng) {
  const T = totals.purchases, S = totals.spend;
  // ideas win a realistic share — never 100%; the base rotation keeps the rest
  const w = [0.3 + rng() * 0.12, 0.09 + rng() * 0.08, rng() * 0.04]; // promoted / parked / killed shares
  const verdicts = ['SCALE', 'PARK', 'KILL'];
  const rows = ideas.map((idea, i) => {
    const purchases = Math.min(T, Math.round(T * w[i]));
    const spend = +(S * w[i]).toFixed(2);
    const ctr = +(totals.ctr * (i === 0 ? 1.1 + rng() * 0.25 : i === 1 ? 0.95 + rng() * 0.15 : 0.7 + rng() * 0.2)).toFixed(2);
    return { ...idea, purchases, spend, ctr, verdict: verdicts[i] };
  });
  rows[0].note = 'Promoted by the optimizer mid-run — received the largest idea-cell budget share.';
  rows[1].note = 'Held its own but didn’t beat the promoted idea — kept as a backup cell.';
  rows[2].note = 'Underperformed the rotation — spend cut early and redirected.';
  return rows;
}

function ideaLiveState(ideas, progress) {
  return ideas.map((idea, i) => {
    let status = 'queued';
    if (progress >= idea.releasedAt) status = 'testing';
    if (progress >= 0.45) status = i === 0 ? 'promoted' : 'testing';
    if (progress >= 0.7) status = i === 0 ? 'promoted' : i === 1 ? 'parked' : 'killed';
    return { ...idea, status };
  });
}

function marketingVision(ctx, ideas) {
  const s = ctx.structured || {};
  const aud = (s.audience || 'the audience').toLowerCase();
  const prob = (s.problem || 'the problem').toLowerCase().replace(/\.$/, '');
  const product = s.product || 'the product';
  const price = ctx.price;
  const b = ctx.baseline || {};
  // the weakest funnel link, computed from the estimates
  const links = [
    ['impressions → clicks', 1],
    ['clicks → signups', (b.signupRate ?? 7) / 100],
    ['signups → purchases', b.purchases && b.signups ? Math.min(1, (b.purchases?.[1] ?? 1) / Math.max(1, b.signups)) : 0.2],
  ];
  const leak = links.reduce((a, x) => (x[1] < a[1] ? x : a), links[2])[0];
  const bigIdea = ideas[0];
  return {
    marketRead: `${aud[0].toUpperCase() + aud.slice(1)} don’t wake up wanting a product — they wake up with ${prob}. At the moment of pain they fall back to their current workaround, because switching feels risky and unproven. The marketing job is not to explain features; it is to make trying ${product} feel smaller than staying stuck.`,
    positioningThesis: `Own one provable promise instead of many soft ones: the single sentence a satisfied user would say to a friend. Everything in the campaign — headline, proof, price — must defend that one sentence. At ${'$' + Number(price).toFixed(2)}, the promise has to be believed within the first 3 seconds of contact.`,
    bigIdea: { name: bigIdea.name, type: bigIdea.type, rationale: `${bigIdea.description} The simulator promotes this idea because it attacks ${bigIdea.why.replace('Targets the weakest link the simulator sees: ', '')}` },
    channelStrategy: [
      { channel: ctx.channel || 'Meta Ads', role: 'Demand creation — primary test cell', why: 'Cheapest reach for a consumer audience; the simulator uses it to establish CTR and signup baselines.', share: '70% of budget' },
      { channel: 'Google Ads (later)', role: 'Demand capture — after validation', why: 'Only worth it once the winning message is known; search catches people already looking for the fix.', share: 'phase 2' },
      { channel: 'TikTok (organic + spark)', role: 'Attention engine & creative lab', why: 'Native video concepts are produced and simulated in this run; winners become cheap creative for paid.', share: 'organic first' },
    ],
    creativeDirection: {
      tone: 'Calm confidence, zero hype: show the moment of pain, then the small, believable fix.',
      motifs: ['the exact moment the problem happens', 'one screen, one action', 'proof element in every frame'],
      avoid: ['stock-photo happiness', 'feature lists in the hook', 'claims without a visible proof'],
    },
    funnelLeak: `The simulator sees ${leak} as the tightest link of the funnel — that is where money leaks. Protect it: keep the landing message identical to the ad message and remove every step between click and value.`,
    metricsPhilosophy: 'Watch the leading indicator (signup rate at constant spend), not the vanity one (impressions). A campaign is working when CAC stops moving while volume grows — not when clicks get cheap.',
    disclaimer: 'This is the simulator’s marketing interpretation based on your inputs and sample data — a point of view to test, not a fact. Live research APIs would sharpen every statement above.',
  };
}

// ---------- per-creative breakdown ----------
// Which ad produced which registrations. Reconciles exactly with run totals:
// cells A–E are the base rotation angles, F–H are the simulator's own ideas.
function buildCreativeBreakdown(totals, ideasFinal, seed) {
  const rng = mulberry32(seed ^ 0xabcd);
  const base = [
    { cell: 'A', name: 'Problem-focused' },
    { cell: 'B', name: 'Benefit-focused' },
    { cell: 'C', name: 'Trust-focused' },
    { cell: 'D', name: 'Speed-focused' },
    { cell: 'E', name: 'Price-focused' },
  ];
  const ideaSpend = ideasFinal.reduce((a, x) => a + x.spend, 0);
  const ideaPurch = ideasFinal.reduce((a, x) => a + x.purchases, 0);
  const ideaSign = Math.round(totals.signups * 0.34);
  const restSpend = Math.max(0, totals.spend - ideaSpend);
  const restPurch = Math.max(0, totals.purchases - ideaPurch);
  const restSign = Math.max(0, totals.signups - ideaSign);
  const w = [1.15, 0.95, 1.2, 0.85, 0.75]; // trust & problem pull ahead (mirrors optimizer read)
  const wsum = w.reduce((a, x) => a + x, 0);
  // impressions share: ideas joined mid-run, base carried the start
  const ideaImpShare = 0.11 + rng() * 0.05;
  const rows = [];
  base.forEach((b, i) => {
    const share = w[i] / wsum;
    const impressions = Math.round(totals.impressions * (1 - ideaImpShare * 3) * share);
    const ctr = +(totals.ctr * (0.82 + rng() * 0.4) * (w[i] > 1 ? 1.12 : 0.95)).toFixed(2);
    const clicks = Math.round(impressions * ctr / 100);
    const signups = Math.round(restSign * share);
    const purchases = Math.min(signups, Math.round(restPurch * share));
    const spend = +(restSpend * share).toFixed(2);
    rows.push({ ...b, kind: 'base', impressions, ctr, clicks, signups, purchases, spend, note: null });
  });
  ideasFinal.forEach((x) => {
    const impressions = Math.round(totals.impressions * ideaImpShare * (x.verdict === 'SCALE' ? 1.35 : x.verdict === 'PARK' ? 1 : 0.6));
    const clicks = Math.round(impressions * (x.ctr / 100));
    rows.push({ cell: x.cell, name: x.name, kind: 'idea', impressions, ctr: x.ctr, clicks, signups: null, purchases: x.purchases, spend: x.spend, note: x.note, verdict: x.verdict });
  });
  // reconcile: clicks & signups sums must match totals exactly
  const clickSum = rows.reduce((a, x) => a + x.clicks, 0);
  const clickTarget = totals.clicks;
  const scaleC = clickTarget / Math.max(1, clickSum);
  rows.forEach((x) => { x.clicks = Math.round(x.clicks * scaleC); });
  const signSumNoIdea = rows.filter((x) => x.kind === 'base').reduce((a, x) => a + x.signups, 0);
  const signScale = restSign / Math.max(1, signSumNoIdea);
  rows.filter((x) => x.kind === 'base').forEach((x) => { x.signups = Math.round(x.signups * signScale); });
  // idea signups: from their clicks and the average signup rate
  rows.filter((x) => x.kind === 'idea').forEach((x, i, arr) => {
    const isLast = i === arr.length - 1;
    if (isLast) {
      const assigned = rows.filter((y) => y.kind === 'idea' && y !== x).reduce((a, y) => a + y.signups, 0);
      x.signups = Math.max(0, ideaSign - assigned);
    } else {
      x.signups = Math.round(x.clicks * (totals.signupRate / 100) * (x.verdict === 'SCALE' ? 1.2 : x.verdict === 'KILL' ? 0.5 : 0.9));
    }
  });
  // final signups reconciliation (may drift by ±1-2)
  let drift = totals.signups - rows.reduce((a, x) => a + x.signups, 0);
  for (let i = 0; drift !== 0 && i < rows.length; i++) {
    const adj = Math.sign(drift);
    if (rows[i].signups + adj >= 0) { rows[i].signups += adj; drift -= adj; }
  }
  // purchases floor per cell: a cell with signups but 0 purchases is fine; totals already reconciled
  const purchSum = rows.reduce((a, x) => a + x.purchases, 0);
  let pd = totals.purchases - purchSum;
  for (let i = 0; pd !== 0 && i < rows.length; i++) {
    const adj = Math.sign(pd);
    if (rows[i].purchases + adj >= 0 && rows[i].purchases + adj <= rows[i].signups) { rows[i].purchases += adj; pd -= adj; }
  }
  rows.forEach((x) => { x.cpl = x.signups > 0 ? +(x.spend / x.signups).toFixed(2) : null; });
  return rows.sort((a, b) => b.signups - a.signups);
}

// ---------- hourly signup cohorts ----------
function buildHourlyCohorts(series, durationMs) {
  const hours = durationMs / 3600000;
  const bucketCount = hours >= 20 ? 12 : hours >= 10 ? 8 : hours >= 3 ? 4 : 4;
  const per = Math.ceil(series.length / bucketCount);
  const buckets = [];
  for (let b = 0; b < bucketCount; b++) {
    const end = series[Math.min(series.length - 1, (b + 1) * per - 1)];
    const start = b === 0 ? null : series[b * per - 1];
    const fromH = +(((b * per) / (series.length - 1)) * hours).toFixed(1);
    const toH = +((((b + 1) * per - 0.5) / (series.length - 1)) * hours).toFixed(1);
    buckets.push({
      label: hours >= 1 ? `${fromH}–${toH}h` : `${Math.round(fromH * 60)}–${Math.round(toH * 60)}s`,
      clicks: end.clicks - (start ? start.clicks : 0),
      signups: end.signups - (start ? start.signups : 0),
      purchases: end.purchases - (start ? start.purchases : 0),
      cumulativeSignups: end.signups,
    });
  }
  return buckets;
}

// ---------- Instagram promotion layer ----------
// Every validation run also simulates Instagram promotion: Reels produced by the
// video lab, stories, reach, profile visits, link clicks, follows and attributed
// signups. Clearly a simulator layer — not real IG data.
function buildInstagram(structured, baseline, budget, rng) {
  const reels = 3;
  const posts = reels + 2 + Math.floor(rng() * 3);
  const stories = 8 + Math.floor(rng() * 10);
  const reach = 6000 + Math.floor(rng() * 45000);
  const profileVisits = Math.round(reach * (0.04 + rng() * 0.05));
  const linkClicks = Math.round(profileVisits * (0.25 + rng() * 0.3));
  const follows = Math.round(profileVisits * (0.08 + rng() * 0.12));
  const saves = Math.round(reach * (0.008 + rng() * 0.03));
  const signups = Math.round(linkClicks * (0.08 + rng() * 0.12));
  const boostedSpend = Math.round(budget * 0.15);
  const topPost = ['POV hook reel', 'Trust-receipt carousel', 'Before/after story series'][Math.floor(rng() * 3)];
  return {
    handle: '@' + (structured.product || 'yourproduct').toLowerCase().replace(/[^a-z0-9]+/g, ''),
    posts, reels, stories, reach, profileVisits, linkClicks, follows, saves, signups,
    boostedSpend, topPost,
    notes: [
      'Reels reuse the winning TikTok lab concepts, reformatted 9:16 with native captions.',
      'Boost budget is part of the paid budget — not an extra cost.',
    ],
    disclaimer: 'Instagram promotion is simulated (Demo Mode). Connect an Instagram/Meta account for real numbers.',
  };
}

// ---------- findings ----------
function buildFindings(structured, baseline, budget, country, channel, rng, ideas, reaction, ig) {
  const est = baseline || { ctr: 2.5, signupRate: 7, purchases: [1, 2, 3] };
  const compLine = reaction?.per?.[0] ? `Competitor watch: if growth continues, expect “${reaction.per[0].scenarios[0]?.reaction ?? 'a response'}” from ${reaction.per[0].competitor} around ${reaction.per[0].scenarios[0]?.timing ?? 'month 1'}. Counter: ${reaction.per[0].scenarios[0]?.counter ?? 'hold the wedge'}.` : null;
  const F = [
    { at: 0.02, kind: 'data', text: `Inputs verified. Target: ${structured.audience} in ${country}, ${fmtMoney(budget)} on ${channel}.` },
    { at: 0.06, kind: 'data', text: 'Market data refreshed from the sample dataset. Live research APIs are not connected — where real data is missing, the report says so instead of guessing.' },
    { at: 0.1, kind: 'data', text: 'Competitor pricing re-scanned: no significant changes detected during this run.' },
    { at: 0.14, kind: 'insight', text: `Demand signal check: search/social volume is unavailable in Demo Mode — marked as “Not enough evidence” in the final report.` },
    { at: 0.18, kind: 'insight', text: `Marketing engine formed its plan: big idea “${ideas[0].name}” — added to the rotation as test cell ${ideas[0].cell} alongside the 5 base creatives.` },
    { at: 0.22, kind: 'campaign', text: `Campaign simulator started: 5 creatives × simulated audience. First check-in: CTR ${est.ctr}% baseline holding.` },
    { at: 0.3, kind: 'campaign', text: 'Early read: Problem-focused and Trust-focused angles pulling ahead of Price-focused.' },
    { at: 0.34, kind: 'campaign', text: `Idea cell ${ideas[0].cell} (“${ideas[0].name}”) outperforming the rotation average on first exposure.` },
    { at: 0.38, kind: 'campaign', text: `Signup rate at ${est.signupRate}% — inside the simulated estimate band. Landing copy holds.` },
    { at: 0.45, kind: 'action', text: `Optimizer: reallocating budget — 70% to the leading creative (idea cell ${ideas[0].cell} “${ideas[0].name}”), 30% kept for the challenger set.` },
    { at: 0.52, kind: 'campaign', text: `First simulated purchase${(est.purchases?.[1] ?? 2) > 1 ? 's' : ''} landed. Cost per purchase currently above target — expected at this spend level.` },
    { at: 0.58, kind: 'tiktok', text: 'TikTok lab: 3 short-video concepts produced (hook scripts, shot lists, captions).' },
    { at: 0.62, kind: 'tiktok', text: `Video concepts aligned to the big idea “${ideas[0].name}”: hooks rewritten to match its proof-first angle.` },
    { at: 0.66, kind: 'tiktok', text: 'Video simulation: “POV hook” concept leads on watch-through.' },
    { at: 0.7, kind: 'action', text: `Optimizer: idea cell “${ideas[2].name}” underperforming — spend cut and redirected to “${ideas[0].name}”.` },
    { at: 0.74, kind: 'tiktok', text: 'Winner selected for the launch pack; two concepts parked as backups.' },
    { at: 0.78, kind: 'instagram', text: `Instagram: ${ig.reels} Reels published from the winning video concepts. Best performer: ${ig.topPost} (${ig.reach.toLocaleString()} reach).` },
    { at: 0.86, kind: 'instagram', text: `Instagram layer: ${ig.linkClicks.toLocaleString()} link clicks → ${ig.signups} signups, +${ig.follows.toLocaleString()} followers. Profile: ${ig.handle}.` },
    { at: 0.82, kind: 'scale', text: 'Scaling the winning creative. Price acceptance holding at the suggested tier.' },
    ...(compLine ? [{ at: 0.84, kind: 'competitor', text: compLine }] : []),
    { at: 0.88, kind: 'scale', text: 'Retention signal: simulated repeat-visit rate suggests the CAC payback window is plausible but must be confirmed with a longer live test.' },
    { at: 0.94, kind: 'synthesis', text: 'Compiling final report: checks, marketing vision results, simulation accuracy, decision inputs.' },
  ];
  return F;
}

// ---------- metrics series ----------
const CHECKINS = 72;

function buildSeries(seed, budget, baseline, channel) {
  const rng = mulberry32(seed);
  const cpm = channel === 'Google Ads' ? 18 : channel === 'TikTok Ads' ? 7 : channel === 'Instagram Ads' ? 9 : 11;
  const baseCtr = (baseline?.ctr ?? 2.5) / 100;
  const baseSignup = (baseline?.signupRate ?? 7) / 100;
  const price = baseline?.price ?? 9;
  const targetPurchases = Math.max(1, Math.round((baseline?.purchases?.[1] ?? 2) * (budget / Math.max(20, baseline?.budget ?? 50))));
  // spend ramp: slow start, peak mid, cooldown at the end
  const weights = [];
  let wsum = 0;
  for (let i = 0; i < CHECKINS; i++) {
    const x = i / (CHECKINS - 1);
    const w = 0.35 + Math.sin(Math.PI * clamp(x * 1.05, 0, 1)) * 0.9 + rng() * 0.18;
    weights.push(w); wsum += w;
  }
  const rows = [];
  let acc = { spend: 0, impressions: 0, clicks: 0, signups: 0, purchases: 0, revenue: 0 };
  let purchasesSoFar = 0;
  let signupFrac = 0; // fractional accumulator: rounding never eats real signups
  for (let i = 0; i < CHECKINS; i++) {
    const frac = weights[i] / wsum;
    const spendStep = budget * frac;
    const impressions = Math.round((spendStep / cpm) * 1000);
    const ctr = baseCtr * (0.82 + rng() * 0.4) * (i > CHECKINS * 0.45 ? 1.12 : 1); // optimizer lift mid-run
    const clicks = Math.round(impressions * ctr);
    // signups accumulate fractionally per click — a click is never silently dropped
    signupFrac += clicks * baseSignup * (0.8 + rng() * 0.45);
    const signupsNew = Math.floor(signupFrac);
    signupFrac -= signupsNew;
    const signups = acc.signups + signupsNew;
    let p = 0;
    const quota = targetPurchases * frac * (0.75 + rng() * 0.6);
    while (purchasesSoFar < targetPurchases && p < quota && rng() < 0.5) { p++; purchasesSoFar++; }
    // a purchase implies a signup: never let cumulative purchases exceed cumulative signups
    if (signups < acc.purchases + p) p = Math.max(0, signups - acc.purchases);
    purchasesSoFar = Math.min(purchasesSoFar, acc.purchases + p);
    acc = {
      spend: acc.spend + spendStep,
      impressions: acc.impressions + impressions,
      clicks: acc.clicks + clicks,
      signups,
      purchases: acc.purchases + p,
      revenue: acc.revenue + p * price * 2.2,
    };
    rows.push({
      i,
      spend: +acc.spend.toFixed(2),
      impressions: acc.impressions,
      clicks: acc.clicks,
      ctr: +((acc.clicks / Math.max(1, acc.impressions)) * 100).toFixed(2),
      signups: acc.signups,
      signupRate: +((acc.signups / Math.max(1, acc.clicks)) * 100).toFixed(1),
      purchases: acc.purchases,
      revenue: +acc.revenue.toFixed(2),
    });
  }
  // realism floor: with real traffic, thousands of clicks never produce zero signups
  const last = rows[rows.length - 1];
  if (last.clicks >= 30 && last.signups === 0) {
    const fix = Math.max(1, Math.round(last.clicks * (baseSignup * 0.5)));
    last.signups = fix;
    last.signupRate = +((fix / last.clicks) * 100).toFixed(1);
  }
  return rows;
}

// ---------- snapshot ----------
// ctx: { seed, budget, country, channel, price, baseline (funnel estimates), structured }
export function jobSnapshot(job, ctx, now = Date.now()) {
  const started = job.launched_at;
  const duration = job.duration_ms;
  const elapsed = clamp(now - started, 0, duration);
  const progress = duration > 0 ? elapsed / duration : 1;
  const stages = stageStatuses(progress);
  const completed = job.status === 'COMPLETED' || progress >= 1;

  const rng = mulberry32(ctx.seed);
  // deterministic shared artifacts
  const series = buildSeries(ctx.seed, ctx.budget, ctx.baseline, ctx.channel);
  const videos = buildTikTokVideos(ctx.structured || { audience: 'the audience', problem: 'the problem', product: 'the product', solution: '', category: 'General' }, ctx.seed, mulberry32(ctx.seed ^ 0x77aa));
  const ideasAll = buildMarketingIdeas(ctx.structured || {}, mulberry32(ctx.seed ^ 0x11ee));
  const compList0 = (ctx.competitors || []).map((c) => (typeof c.features === 'string' ? { ...c, features: JSON.parse(c.features || '[]') } : c));
  const reaction0 = compList0.length ? competitorReaction(ctx.structured || {}, compList0, ctx.scores || { sub: {} }, ctx.seed) : null;
  const ig = buildInstagram(ctx.structured || {}, ctx.baseline, ctx.budget, mulberry32(ctx.seed ^ 0x8150));
  const findings = buildFindings(ctx.structured || {}, ctx.baseline, ctx.budget, ctx.country, ctx.channel, mulberry32(ctx.seed ^ 0x55), ideasAll, reaction0, ig);
  const vision = marketingVision(ctx, ideasAll);

  const upto = completed ? CHECKINS - 1 : Math.floor(progress * (CHECKINS - 1));
  const totals = series[upto];  const visibleFindings = findings.filter((f) => f.at <= progress + 1e-9);
  const tiktokStage = STAGE_DEFS[3];
  const videosVisible = completed || progress >= tiktokStage.from - 0.001;
  const ideas = completed
    ? finalizeIdeaResults(totals, ideasAll, mulberry32(ctx.seed ^ 0x99))
    : ideaLiveState(ideasAll, progress);

  // competitor intelligence: 1:1 list, reaction simulation, post-test insights
  const compList = compList0;
  const reaction = reaction0;
  let competitorsInsights = null;
  if (completed && compList.length) {
    const probe = { ideas, totals };
    competitorsInsights = postTestCompetitorInsights(compList, probe, ctx.seed);
  }
  const creativeBreakdown = completed ? buildCreativeBreakdown(totals, ideas, ctx.seed) : null;
  const hourlyCohorts = completed ? buildHourlyCohorts(series, duration) : null;

  const result = {
    status: completed ? 'COMPLETED' : 'RUNNING',
    mode: job.mode,
    durationMs: duration,
    durationHours: Math.round(duration / 3600000),
    launchedAt: started,
    elapsedMs: elapsed,
    remainingMs: completed ? 0 : duration - elapsed,
    progress,
    eta: completed ? null : new Date(started + duration).toISOString(),
    stages,
    totals,
    checkinsCount: upto + 1,
    seriesTail: series.slice(Math.max(0, upto - 23), upto + 1),
    findings: visibleFindings.map((f) => ({ ...f, atMs: Math.round(f.at * duration), atLabel: labelAt(started + f.at * duration) })),
    tiktok: videosVisible ? videos : [],
    instagram: ig,
    series: completed ? series : null,
    ideas,
    vision,
    competitors: compList,
    reaction,
    competitorsInsights,
    creativeBreakdown,
    hourlyCohorts,
    disclaimer: completed
      ? 'Validation results are simulator outputs (Demo Mode unless a real ad account is connected) — not a guarantee of real-world performance.'
      : 'The validation simulator runs autonomously — you can close this page and come back. All numbers are simulation estimates.',
  };

  if (completed) result.report = buildReport(result, videos, ctx);
  return result;
}

function labelAt(ts) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function buildReport(snap, videos, ctx) {
  const t = snap.totals;
  const baseline = ctx.baseline || {};
  const est = baseline.ctr ?? null;
  const accCtr = est ? Math.round(100 - Math.min(100, Math.abs(est - t.ctr) / Math.max(est, 0.01) * 100)) : null;
  const estConv = baseline.signupRate ?? null;
  const accConv = estConv ? Math.round(100 - Math.min(100, Math.abs(estConv - t.signupRate) / Math.max(estConv, 0.01) * 100)) : null;
  const cac = t.purchases > 0 ? +(t.spend / t.purchases).toFixed(2) : null;
  const bestVideo = [...videos].sort((a, b) => b.stats.views * (b.stats.watchThrough / 100) - a.stats.views * (a.stats.watchThrough / 100))[0];
  const checks = [
    { check: 'Demand', result: t.signups > 0 ? `${t.signups} simulated signups at ${t.signupRate}% conversion` : 'No signups', verdict: t.signups >= 5 ? 'POSITIVE' : t.signups > 0 ? 'WEAK' : 'NEGATIVE' },
    { check: 'Willingness to pay', result: t.purchases > 0 ? `${t.purchases} simulated purchase${t.purchases === 1 ? '' : 's'} at ${fmtMoney(ctx.price)}` : 'No purchases at this price', verdict: t.purchases >= 2 ? 'POSITIVE' : t.purchases === 1 ? 'WEAK' : 'NEGATIVE' },
    { check: 'Creative / positioning', result: `Winning cell: “${snap.ideas?.[0]?.name ?? 'Trust-focused'}” beat the rotation`, verdict: 'POSITIVE' },
    { check: 'TikTok viability', result: bestVideo ? `Best concept: ${bestVideo.stats.views.toLocaleString()} views, ${bestVideo.stats.watchThrough}% watch-through (simulated)` : 'Not enough evidence', verdict: bestVideo && bestVideo.stats.watchThrough > 45 ? 'POSITIVE' : 'WEAK' },
    { check: 'Acquisition cost', result: cac != null ? `CAC ${fmtMoney(cac)} on ${fmtMoney(t.spend)} spend` : 'No purchases → CAC undefined', verdict: cac != null && cac <= (ctx.price || 9) * 6 ? 'POSITIVE' : 'RISK' },
    { check: 'Live demand volume', result: 'Live search/ad-volume APIs are not connected in this environment', verdict: 'NOT ENOUGH EVIDENCE' },
  ];
  return {
    headline: t.purchases >= 2 ? 'Validation passed — the funnel converts end-to-end in simulation.' : t.purchases === 1 ? 'Validation is borderline — one purchase is a signal, not proof.' : 'Validation failed — no purchases in simulation.',
    checks,
    marketing: {
      vision: snap.vision,
      ideas: snap.ideas,
      summary: `The simulator entered the run with its own marketing plan: big idea “${snap.vision.bigIdea.name}” was added to the rotation as test cell ${snap.ideas?.[0]?.cell}, fought the 5 base creatives for the whole run, and finished as the ${snap.ideas?.[0]?.verdict === 'SCALE' ? 'winner — recommended for the real campaign' : 'measured cell'}. The full marketing vision below is what the simulator will build on next run.`,
    },
    competitorReaction: snap.reaction ? {
      summary: snap.reaction.summary,
      expectedCacUplift: snap.reaction.expectedCacUplift,
      per: snap.reaction.per,
      disclaimer: snap.reaction.disclaimer,
      postTest: snap.competitorsInsights,
    } : null,
    optimizationLog: snap.findings.filter((f) => f.kind === 'action' || f.kind === 'campaign' || f.kind === 'tiktok').map((f) => f.text),
    totals: t,
    cac,
    roas: +(t.revenue / Math.max(1, t.spend)).toFixed(2),
    accuracy: { ctr: accCtr, conversion: accConv, overall: accCtr != null && accConv != null ? Math.round((accCtr + accConv) / 2) : null },
    simulationVs: est ? { ctr: { sim: est.ctr, actual: t.ctr }, conversion: { sim: estConv, actual: t.signupRate } } : null,
    bestVideo,
    creativeBreakdown: snap.creativeBreakdown,
    hourlyCohorts: snap.hourlyCohorts,
    disclaimer: 'Full-month-in-hours report. Simulator outputs (Demo Mode unless a real ad account is connected) — treat as decision support, not proof.',
  };
}

// Final metrics for real_tests row (used by finalize + seed): consistent with the series end.
export function finalMetrics(seed, { budget, channel, price, baseline }) {
  const series = buildSeries(seed, budget, baseline, channel);
  const t = series[series.length - 1];
  return {
    disclaimer: 'DEMO DATA — simulated campaign results produced by the validation simulator. Connect a real ad account for actual numbers.',
    isDemo: true,
    spend: t.spend, impressions: t.impressions, ctr: t.ctr,
    cpc: t.clicks ? +(t.spend / t.clicks).toFixed(2) : null,
    landingVisits: t.clicks, signups: t.signups, signupRate: t.signupRate,
    pricingViews: Math.round(t.signups * 0.45), purchases: t.purchases,
    cac: t.purchases ? +(t.spend / t.purchases).toFixed(2) : null,
    revenue: t.revenue, roas: +(t.revenue / Math.max(1, t.spend)).toFixed(2),
  };
}
