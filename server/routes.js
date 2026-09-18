// All API routes for LaunchSim.
import { Router } from 'express';
import crypto from 'node:crypto';
import db, { now, logError, audit, track } from './db.js';
import {
  hashPassword, verifyPassword, createSession, destroySession, parseCookies,
  setSessionCookie, clearSessionCookie, getSessionUser, requireAuth, requireAdmin,
  EMAIL_RE, validPassword, COOKIE,
} from './auth.js';
import * as E from './engine/index.js';
import * as V from './engine/validation.js';
import {
  runSimulation, runResearch, persistHypotheses, persistCompetitors,
  storeDecision, CREDIT_COSTS, aiConfigured,
} from './engine/pipeline.js';
import { DEMO_EMAIL, DEMO_PASSWORD } from './seed.js';

const api = Router();
const EXPRESS_MS = Number(process.env.LAUNCHSIM_EXPRESS_MS) || 180000; // demo-speed validation (~3 min)
const fmtMoney = (n) => '$' + (Number(n) >= 100 ? Math.round(Number(n)) : Number(n).toFixed(2));

// ---------- helpers ----------
class HttpError extends Error {
  constructor(status, code, message, extra = {}) { super(message); this.status = status; this.code = code; this.extra = extra; }
}
const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const rateBuckets = new Map();
function rateLimit(scope, max, windowMs) {
  return (req, res, next) => {
    // hard cap: drop the oldest scope-key if the map grows unbounded (memory safety)
    if (rateBuckets.size > 5000) {
      const firstKey = rateBuckets.keys().next().value;
      if (firstKey !== undefined) rateBuckets.delete(firstKey);
    }
    const key = `${scope}:${req.ip}`;
    const t = now();
    const arr = (rateBuckets.get(key) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) return next(new HttpError(429, 'rate_limited', 'Too many requests. Please wait a moment and retry.'));
    arr.push(t); rateBuckets.set(key, arr); next();
  };
}

function getUser(req) { return getSessionUser(req); }
function publicUser(u) {
  if (!u) return null;
  return { id: u.id, email: u.email, name: u.name, isAdmin: !!u.is_admin, plan: u.plan, credits: u.credits, createdAt: u.created_at };
}
function chargeCredits(user, amount, reason, projectId = null) {
  const fresh = db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id);
  if (!fresh || fresh.credits < amount) {
    throw new HttpError(402, 'insufficient_credits', `Not enough credits. This action needs ${amount} credit${amount > 1 ? 's' : ''} — you have ${fresh ? fresh.credits : 0}.`, { needed: amount, have: fresh ? fresh.credits : 0 });
  }
  db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(amount, user.id);
  db.prepare('INSERT INTO credit_transactions (user_id, amount, reason, project_id, created_at) VALUES (?,?,?,?,?)')
    .run(user.id, -amount, reason, projectId, now());
}
function grantCredits(userId, amount, reason, projectId = null) {
  db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(amount, userId);
  db.prepare('INSERT INTO credit_transactions (user_id, amount, reason, project_id, created_at) VALUES (?,?,?,?,?)')
    .run(userId, amount, reason, projectId, now());
}

const MODELS = ['subscription', 'one-time', 'marketplace', 'commission', 'advertising', 'freemium', 'other'];
const VALIDATE_OPTS = ['demand', 'willingness to pay', 'pricing', 'positioning', 'target audience', 'acquisition', 'differentiation', 'business model'];
function validateInputs(b) {
  const errs = [];
  const req = (k, min) => { if (!b[k] || String(b[k]).trim().length < min) errs.push(`Field “${k}” is required (min ${min} chars).`); };
  req('what', 15); req('audience', 3); req('problem', 10);
  if (b.model && !MODELS.includes(b.model)) errs.push('Invalid business model.');
  if (b.price != null && (!Number.isFinite(Number(b.price)) || Number(b.price) < 0.5 || Number(b.price) > 100000)) errs.push('Price must be between 0.5 and 100000.');
  if (b.budget != null && (!Number.isFinite(Number(b.budget)) || Number(b.budget) < 5 || Number(b.budget) > 1000000)) errs.push('Test budget must be between 5 and 1000000.');
  if (b.validate && (!Array.isArray(b.validate) || b.validate.some((v) => !VALIDATE_OPTS.includes(v)))) errs.push('Invalid validation options.');
  if (errs.length) throw new HttpError(400, 'validation', errs.join(' '), { errors: errs });
  return {
    name: String(b.name || '').trim().slice(0, 60),
    what: String(b.what).trim().slice(0, 2000),
    audience: String(b.audience).trim().slice(0, 200),
    problem: String(b.problem).trim().slice(0, 500),
    model: b.model || 'subscription',
    price: Number(b.price) || 9,
    market: String(b.market || 'United States').trim().slice(0, 80),
    budget: Number(b.budget) || 50,
    validate: Array.isArray(b.validate) ? b.validate : [],
  };
}

function intId(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(404, 'not_found', 'Not found.');
  return n;
}

function ownProject(req) {
  const id = intId(req.params.id);
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!p) throw new HttpError(404, 'not_found', 'Project not found.');
  if (p.user_id !== req.user.id) throw new HttpError(403, 'forbidden', 'You can only access your own projects.');
  return p;
}

function getLatestIteration(projectId) {
  return db.prepare('SELECT * FROM iterations WHERE project_id = ? ORDER BY number DESC LIMIT 1').get(projectId);
}
function iterationBundle(it) {
  if (!it) return null;
  const sim = db.prepare('SELECT * FROM simulations WHERE iteration_id = ? ORDER BY id DESC LIMIT 1').get(it.id);
  const research = db.prepare('SELECT * FROM research WHERE iteration_id = ? ORDER BY id DESC LIMIT 1').get(it.id);
  const hypotheses = db.prepare('SELECT * FROM hypotheses WHERE iteration_id = ? ORDER BY code ASC').all(it.id);
  const competitors = db.prepare('SELECT * FROM competitors WHERE iteration_id = ?').all(it.id);
  return {
    id: it.id, number: it.number, label: it.label, changes: JSON.parse(it.changes || '[]'),
    inputs: JSON.parse(it.inputs || '{}'), score: it.score, createdAt: it.created_at,
    simulation: sim ? { id: sim.id, mode: sim.mode, engine: sim.engine, createdAt: sim.created_at, results: JSON.parse(sim.results) } : null,
    research: research ? { id: research.id, sourceLabel: research.source_label, depth: research.depth, data: JSON.parse(research.data) } : null,
    hypotheses, competitors,
  };
}
function projectBundle(p) {
  const iterations = db.prepare('SELECT * FROM iterations WHERE project_id = ? ORDER BY number ASC').all(p.id);
  const current = iterations.length ? iterationBundle(iterations[iterations.length - 1]) : null;
  const inputs = JSON.parse(p.inputs || '{}');
  const baseline = current?.simulation ? { ...current.simulation.results.funnel, price: Number(inputs.price) || 9, budget: Number(inputs.budget) || 50 } : null;
  const structured = current?.simulation?.results?.structured || null;
  const simScores = current?.simulation?.results?.scores || null;
  const compParsed = (current?.competitors || []).map((c) => ({ ...c, features: c.features ? JSON.parse(c.features) : [] }));
  const competitorIntel = current?.simulation && compParsed.length
    ? { reaction: E.competitorReaction(structured, compParsed, simScores, (p.seed ^ Math.imul(current.id, 2654435761)) >>> 0) }
    : null;
  const realTests = db.prepare('SELECT * FROM real_tests WHERE project_id = ? ORDER BY id DESC').all(p.id)
    .map((rt) => {
      const m = rt.metrics ? JSON.parse(rt.metrics) : null;
      const job = db.prepare('SELECT * FROM validation_jobs WHERE real_test_id = ? ORDER BY id DESC LIMIT 1').get(rt.id);
      let jobSnap = null;
      if (job) {
        const ctx = {
          seed: job.seed, budget: rt.budget, country: rt.country, channel: rt.channel,
          price: Number(inputs.price) || 9, baseline, structured, scores: simScores, competitors: compParsed,
        };
        if (job.status === 'RUNNING' && Date.now() - job.launched_at >= job.duration_ms) {
          finalizeJob(p, rt, job, ctx);
        }
        if (job.status === 'COMPLETED') {
          saveReport(p, rt, job, ctx); // backfill for pre-archive jobs (idempotent)
        }
        jobSnap = V.jobSnapshot(job, ctx);
      }
      return { id: rt.id, budget: rt.budget, country: rt.country, channel: rt.channel, status: rt.status, isDemo: !!rt.is_demo, plan: rt.plan ? JSON.parse(rt.plan) : null, metrics: m ? m.metrics : null, simulationVs: m ? m.simulationVs : null, accuracy: rt.accuracy ? JSON.parse(rt.accuracy) : null, createdAt: rt.created_at, completedAt: rt.completed_at, job: jobSnap };
    });
  const decisions = db.prepare('SELECT * FROM decisions WHERE project_id = ? ORDER BY id DESC LIMIT 1').all(p.id)
    .map((d) => ({ id: d.id, recommendation: d.recommendation, reasons: JSON.parse(d.reasons || '[]'), createdAt: d.created_at }));
  const experiments = db.prepare('SELECT * FROM experiments WHERE project_id = ? ORDER BY id DESC').all(p.id)
    .map((x) => ({ id: x.id, hypothesis: x.hypothesis, control: JSON.parse(x.control || '{}'), variant: JSON.parse(x.variant || '{}'), status: x.status, results: x.results ? JSON.parse(x.results) : null, createdAt: x.created_at, completedAt: x.completed_at }));
  const reports = db.prepare('SELECT id, type, title, created_at FROM reports WHERE project_id = ? ORDER BY id DESC').all(p.id)
    .map((r) => ({ id: r.id, type: r.type, title: r.title, createdAt: r.created_at }));
  const competitors = compParsed;
  // timeline
  const timeline = [];
  for (const it of iterations) {
    timeline.push({ ts: it.created_at, kind: 'iteration', label: `Iteration #${it.number} — ${it.label}`, score: it.score });
    const sims = db.prepare('SELECT id, created_at FROM simulations WHERE iteration_id = ?').all(it.id);
    sims.forEach((s, i) => timeline.push({ ts: s.created_at, kind: 'simulation', label: `Simulation run ${i + 1} (iteration #${it.number})` }));
  }
  const researchRows = db.prepare('SELECT created_at FROM research WHERE project_id = ? LIMIT 1').get(p.id);
  if (researchRows) timeline.push({ ts: researchRows.created_at, kind: 'research', label: 'Market research completed' });
  timeline.push({ ts: p.created_at, kind: 'created', label: 'Project created' });
  for (const rt of realTests) {
    timeline.push({ ts: rt.createdAt, kind: 'realtest', label: `Real test planned (${rt.channel}, ${rt.country})` });
    if (rt.status === 'COMPLETED') timeline.push({ ts: rt.completedAt, kind: 'realtest', label: 'Real test completed' });
  }
  for (const d of decisions) timeline.push({ ts: d.createdAt, kind: 'decision', label: `Decision: ${d.recommendation}` });
  timeline.sort((a, b) => a.ts - b.ts);
  // improvement proposal (cheap, no credits)
  let improvement = null;
  if (current && current.simulation) {
    const scores = current.simulation.results.scores;
    const structured = current.simulation.results.structured;
    improvement = E.proposeImprovements(current.inputs, structured, scores, p.seed ^ Math.imul(current.id, 2654435761));
  }
  const decision = decisions.length ? decisions[0] : null;
  return {
    id: p.id, name: p.name, status: p.status, score: p.score, statusLabel: p.status_label,
    isDemo: !!p.is_demo, createdAt: p.created_at, updatedAt: p.updated_at,
    inputs: JSON.parse(p.inputs || '{}'),
    current, iterationsCount: iterations.length,
    realTests, decision, experiments, reports, competitorIntel, competitors, timeline: timeline.reverse(), improvement,
  };
}

// ---------- AUTH ----------
api.post('/auth/signup', h(async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) throw new HttpError(400, 'validation', 'Please enter a valid email address.');
  if (!validPassword(password)) throw new HttpError(400, 'validation', 'Password must be at least 8 characters.');
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase());
  if (exists) throw new HttpError(409, 'exists', 'An account with this email already exists. Try signing in.');
  const id = db.prepare('INSERT INTO users (email, password_hash, name, plan, credits, created_at) VALUES (?,?,?,?,?,?)')
    .run(String(email).toLowerCase(), hashPassword(password), String(name || '').trim().slice(0, 80) || 'Founder', 'free', 2, now()).lastInsertRowid;
  const { token } = createSession(id);
  setSessionCookie(res, token);
  audit(id, 'signup'); track('signup', id);
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
}));

// Constant-work dummy hash: unknown emails still run one scrypt comparison,
// so response timing can't be used to enumerate accounts.
const DUMMY_HASH = hashPassword('timing-equalizer-dummy');
api.post('/auth/login', h(async (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  if (!u) { verifyPassword(password || '', DUMMY_HASH); throw new HttpError(401, 'bad_credentials', 'Email or password is incorrect.'); }
  if (!verifyPassword(password || '', u.password_hash)) {
    throw new HttpError(401, 'bad_credentials', 'Email or password is incorrect.');
  }
  const { token } = createSession(u.id);
  setSessionCookie(res, token);
  audit(u.id, 'login');
  res.json({ user: publicUser(u) });
}));

api.post('/auth/demo', h(async (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(DEMO_EMAIL);
  if (!u) throw new HttpError(500, 'seed_missing', 'Demo account missing. Restart the server to re-seed.');
  const { token } = createSession(u.id);
  setSessionCookie(res, token);
  audit(u.id, 'demo_login');
  const demoProject = db.prepare('SELECT id FROM projects WHERE user_id = ? AND is_demo = 1 ORDER BY id DESC LIMIT 1').get(u.id);
  res.json({ user: publicUser(u), demoProjectId: demoProject ? demoProject.id : null });
}));

api.post('/auth/logout', h(async (req, res) => {
  const token = parseCookies(req)[COOKIE];
  destroySession(token);
  clearSessionCookie(res);
  res.json({ ok: true });
}));

api.get('/auth/me', h(async (req, res) => {
  const u = getUser(req);
  res.json({
    user: publicUser(u),
    demoEmail: DEMO_EMAIL,
    aiConfigured: aiConfigured(),
    googleConfigured: Boolean(process.env.GOOGLE_CLIENT_ID),
  });
}));

api.patch('/auth/me', requireAuth, h(async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 80);
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.user.id);
  audit(req.user.id, 'profile_updated');
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
}));

api.post('/auth/forgot', rateLimit('forgot', 5, 60000), h(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase();
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  // always answer ok to avoid account enumeration
  const resp = { ok: true, message: 'If that account exists, a reset link has been created.' };
  if (u) {
    const token = crypto.randomBytes(24).toString('hex');
    db.prepare('UPDATE users SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, now() + 3600 * 1000, u.id);
    audit(u.id, 'password_reset_requested');
    if (!process.env.SMTP_URL) {
      // No email provider configured in this environment: expose the token for testing,
      // clearly labeled. In production this link is emailed instead.
      resp.devNote = 'Email delivery is not configured in this environment. Direct reset link (testing only):';
      resp.devToken = token;
    }
  }
  res.json(resp);
}));

api.post('/auth/reset', h(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !validPassword(password)) throw new HttpError(400, 'validation', 'Password must be at least 8 characters.');
  const u = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(String(token));
  if (!u || u.reset_expires < now()) throw new HttpError(400, 'invalid_token', 'This reset link is invalid or has expired.');
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hashPassword(password), u.id);
  audit(u.id, 'password_reset');
  res.json({ ok: true });
}));

api.get('/auth/google', h(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({ error: { code: 'google_not_configured', message: 'Google sign-in is not configured in this environment. Use email & password instead.' } });
  }
  const redirect = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  res.redirect(url.toString());
}));

api.get('/auth/google/callback', h(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) throw new HttpError(501, 'google_not_configured', 'Google sign-in is not configured.');
  const code = req.query.code;
  const redirect = `${req.protocol}://${req.get('host')}/api/auth/google/callback`;
  const body = new URLSearchParams({
    code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirect, grant_type: 'authorization_code',
  });
  const tok = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body }).then((r) => r.json());
  const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then((r) => r.json());
  if (!info.email) throw new HttpError(400, 'google_failed', 'Google sign-in failed.');
  let u = db.prepare('SELECT * FROM users WHERE google_id = ? OR email = ?').get(info.sub, info.email);
  if (!u) {
    const id = db.prepare('INSERT INTO users (email, name, google_id, plan, credits, created_at) VALUES (?,?,?,?,?,?)')
      .run(info.email, info.name || 'Founder', info.sub, 'free', 2, now()).lastInsertRowid;
    u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    track('signup', u.id, null, { via: 'google' });
  } else if (!u.google_id) {
    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(info.sub, u.id);
  }
  const { token } = createSession(u.id);
  setSessionCookie(res, token);
  res.redirect('/app');
}));

// ---------- PROJECTS ----------
api.get('/projects', requireAuth, h(async (req, res) => {
  const rows = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  const cards = rows.map((p) => {
    const sims = db.prepare('SELECT COUNT(*) as c FROM simulations WHERE project_id = ?').get(p.id).c;
    const iters = db.prepare('SELECT COUNT(*) as c FROM iterations WHERE project_id = ?').get(p.id).c;
    const rt = db.prepare('SELECT status, channel, created_at FROM real_tests WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(p.id);
    return { id: p.id, name: p.name, score: p.score, statusLabel: p.status_label, isDemo: !!p.is_demo, createdAt: p.created_at, updatedAt: p.updated_at, simulations: sims, iterations: iters, latestTest: rt ? { status: rt.status, channel: rt.channel, at: rt.created_at } : null };
  });
  res.json({ projects: cards });
}));

api.post('/projects', requireAuth, rateLimit('create_project', 10, 60000), h(async (req, res) => {
  const inputs = validateInputs(req.body || {});
  const t = now();
  const seed = (crypto.randomBytes(4).readUInt32BE(0)) >>> 0;
  const name = inputs.name || E.structureIdea(inputs, seed).product;
  const id = db.prepare('INSERT INTO projects (user_id, name, inputs, status, seed, created_at, updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, name, JSON.stringify(inputs), 'draft', seed, t, t).lastInsertRowid;
  audit(req.user.id, 'project_created', { projectId: id });
  track('project_created', req.user.id, id);
  res.json({ id });
}));

api.get('/projects/:id', requireAuth, h(async (req, res) => {
  const p = ownProject(req);
  res.json({ project: projectBundle(p) });
}));

api.patch('/projects/:id', requireAuth, h(async (req, res) => {
  const p = ownProject(req);
  const name = String(req.body?.name || '').trim().slice(0, 60);
  if (!name) throw new HttpError(400, 'validation', 'Name is required.');
  db.prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?').run(name, now(), p.id);
  res.json({ ok: true });
}));

api.delete('/projects/:id', requireAuth, h(async (req, res) => {
  const p = ownProject(req);
  db.prepare('DELETE FROM projects WHERE id = ?').run(p.id);
  audit(req.user.id, 'project_deleted', { projectId: p.id });
  res.json({ ok: true });
}));

// Full analysis: research + hypotheses + competitors + simulation (creates iteration 1 if none).
api.post('/projects/:id/analyze', requireAuth, rateLimit('analyze', 12, 60000), h(async (req, res) => {
  const p = ownProject(req);
  const mode = ['quick', 'standard', 'advanced'].includes(req.body?.mode) ? req.body.mode : 'quick';
  const cost = CREDIT_COSTS[mode];
  chargeCredits(req.user, cost, `simulation:${mode}`, p.id);
  track('simulation_started', req.user.id, p.id, { mode });
  const inputs = JSON.parse(p.inputs || '{}');
  let it = getLatestIteration(p.id);
  let created = false;
  if (!it) {
    const num = db.prepare('SELECT COUNT(*) as c FROM iterations WHERE project_id = ?').get(p.id).c + 1;
    const id = db.prepare('INSERT INTO iterations (project_id, number, label, changes, inputs, created_at) VALUES (?,?,?,?,?,?)')
      .run(p.id, num, num === 1 ? 'Original idea' : `Iteration #${num}`, '[]', JSON.stringify(inputs), now()).lastInsertRowid;
    it = db.prepare('SELECT * FROM iterations WHERE id = ?').get(id);
    created = true;
  }
  const salt = db.prepare('SELECT COUNT(*) as c FROM simulations WHERE iteration_id = ?').get(it.id).c;
  runResearch({ project: p, iterationId: it.id, inputs, depth: 'basic' });
  const seed = (p.seed ^ Math.imul(it.id, 2654435761)) >>> 0;
  const structured = E.structureIdea(inputs, seed);
  persistHypotheses(p.id, it.id, inputs, structured, seed);
  persistCompetitors(p.id, it.id, inputs);
  const { simId, results } = runSimulation({ project: p, iterationId: it.id, inputs, mode, salt });
  // auto-store decision
  const decision = E.decide({ scores: results.scores });
  storeDecision(p.id, decision);
  audit(req.user.id, 'analysis_completed', { projectId: p.id, mode, score: results.scores.score });
  res.json({ iterationId: it.id, created, simId, score: results.scores.score, statusLabel: results.scores.statusLabel });
}));

// Deeper research (3 credits)
api.post('/projects/:id/research', requireAuth, rateLimit('research', 12, 60000), h(async (req, res) => {
  const p = ownProject(req);
  const it = getLatestIteration(p.id);
  if (!it) throw new HttpError(400, 'no_iteration', 'Run the first analysis before deepening research.');
  chargeCredits(req.user, CREDIT_COSTS.research_deep, 'research:deep', p.id);
  const inputs = JSON.parse(it.inputs || '{}');
  const out = runResearch({ project: p, iterationId: it.id, inputs, depth: 'deep' });
  res.json({ ok: true, researchId: out.id });
}));

// Apply improvements: creates a new iteration with edited inputs, then simulates.
api.post('/projects/:id/iterate', requireAuth, rateLimit('iterate', 12, 60000), h(async (req, res) => {
  const p = ownProject(req);
  const mode = ['quick', 'standard', 'advanced'].includes(req.body?.mode) ? req.body.mode : 'quick';
  const cost = CREDIT_COSTS[mode];
  chargeCredits(req.user, cost, `simulation:${mode}`, p.id);
  track('iteration_created', req.user.id, p.id);
  track('simulation_started', req.user.id, p.id, { mode });
  const prev = getLatestIteration(p.id);
  if (!prev) throw new HttpError(400, 'no_iteration', 'Run the first analysis before iterating.');
  const merged = { ...JSON.parse(prev.inputs || '{}'), ...(req.body?.inputs || {}) };
  const inputs = validateInputs(merged);
  const changes = Array.isArray(req.body?.changes) ? req.body.changes.slice(0, 6).map((c) => ({
    area: String(c.area || 'Change').slice(0, 40), from: String(c.from || '').slice(0, 200), to: String(c.to || '').slice(0, 200), why: String(c.why || '').slice(0, 300),
  })) : [];
  if (req.body?.name) {
    db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(String(req.body.name).trim().slice(0, 60), p.id);
  }
  const num = db.prepare('SELECT COUNT(*) as c FROM iterations WHERE project_id = ?').get(p.id).c + 1;
  const label = changes.length ? changes.map((c) => c.area).join(' + ') + ' updated' : `Iteration #${num}`;
  const id = db.prepare('INSERT INTO iterations (project_id, number, label, changes, inputs, created_at) VALUES (?,?,?,?,?,?)')
    .run(p.id, num, label.slice(0, 100), JSON.stringify(changes), JSON.stringify(inputs), now()).lastInsertRowid;
  db.prepare('UPDATE projects SET inputs = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(inputs), now(), p.id);
  const p2 = db.prepare('SELECT * FROM projects WHERE id = ?').get(p.id);
  runResearch({ project: p2, iterationId: id, inputs, depth: 'basic' });
  const seed = (p2.seed ^ Math.imul(id, 2654435761)) >>> 0;
  const structured = E.structureIdea(inputs, seed);
  persistHypotheses(p.id, id, inputs, structured, seed);
  persistCompetitors(p.id, id, inputs);
  const { simId, results } = runSimulation({ project: p2, iterationId: id, inputs, mode, salt: 0 });
  const decision = E.decide({ scores: results.scores });
  storeDecision(p.id, decision);
  audit(req.user.id, 'iteration_created', { projectId: p.id, iteration: num, score: results.scores.score });
  res.json({ iterationId: id, simId, score: results.scores.score, statusLabel: results.scores.statusLabel });
}));

// Unit-economics what-if recompute (no credits — pure calculator).
api.post('/projects/:id/unitecon/whatif', requireAuth, h(async (req, res) => {
  const p = ownProject(req);
  const it = getLatestIteration(p.id);
  const sim = it ? db.prepare('SELECT results FROM simulations WHERE iteration_id = ? ORDER BY id DESC LIMIT 1').get(it.id) : null;
  if (!sim) throw new HttpError(400, 'no_simulation', 'Run a simulation before exploring unit economics.');
  const results = JSON.parse(sim.results);
  const base = results.unitEcon || E.unitEconomics(JSON.parse(it.inputs), results.structured, results.funnel, results.scores, p.seed);
  const overrides = {};
  if (req.body?.churn != null && Number.isFinite(Number(req.body.churn))) overrides.churn = Number(req.body.churn);
  if (req.body?.margin != null && Number.isFinite(Number(req.body.margin))) overrides.margin = Number(req.body.margin);
  res.json({ unitEcon: E.recomputeUnitEconomics(base, overrides) });
}));

// ---------- REAL TESTS ----------
api.post('/projects/:id/realtest', requireAuth, h(async (req, res) => {
  const p = ownProject(req);
  const it = getLatestIteration(p.id);
  if (!it || it.score == null) throw new HttpError(400, 'no_simulation', 'Run a simulation before setting up a real test.');
  const budget = Number(req.body?.budget);
  const country = String(req.body?.country || '').trim().slice(0, 60);
  const channel = String(req.body?.channel || '');
  if (!Number.isFinite(budget) || budget < 5 || budget > 100000) throw new HttpError(400, 'validation', 'Budget must be between $5 and $100000.');
  if (!country) throw new HttpError(400, 'validation', 'Country is required.');
  if (!['Meta Ads', 'Google Ads', 'TikTok Ads', 'Instagram Ads'].includes(channel)) throw new HttpError(400, 'validation', 'Choose a channel: Meta Ads, Google Ads, TikTok Ads or Instagram Ads.');
  const cur = iterationBundle(it);
  const landing = cur.simulation.results.landing;
  const ads = cur.simulation.results.ads;
  const plan = {
    disclaimer: 'Campaign plan generated in Demo Mode. No ad account is connected and no money is spent.',
    landing,
    creatives: ads.map((a) => ({ angle: a.angle, headline: a.headline, body: a.body })),
    campaignStructure: [
      `Campaign: ${p.name} — ${country}`,
      'Ad set 1: broad audience matching your customer profile (start broad, let the algorithm learn)',
      'Ad set 2: narrow lookalike of the highest-intent simulated profile',
      'Budget split: 70% / 30% for the first 3 days, then shift to the winner',
    ],
    trackingPlan: [
      'UTM template: utm_source={channel}&utm_campaign=' + p.name.toLowerCase().replace(/\s+/g, '-') + '&utm_content={angle}',
      'Events to track: landing_view, signup, pricing_view, purchase',
      'Daily check: CTR, CPC, signup rate, cost per signup',
    ],
    integrations: {
      meta: process.env.META_ADS_TOKEN ? 'connected' : 'not_connected',
      google: process.env.GOOGLE_ADS_TOKEN ? 'connected' : 'not_connected',
      tiktok: process.env.TIKTOK_ADS_TOKEN ? 'connected' : 'not_connected',
    },
  };
  const id = db.prepare('INSERT INTO real_tests (project_id, budget, country, channel, status, plan, is_demo, created_at) VALUES (?,?,?,?,?,?,1,?)')
    .run(p.id, budget, country, channel, 'PLANNED', JSON.stringify(plan), now()).lastInsertRowid;
  track('real_test_started', req.user.id, p.id);
  res.json({ id });
}));

// Launch the long-running validation job (4/12/24 real hours, or express demo mode).
api.post('/projects/:id/realtest/:tid/launch', requireAuth, rateLimit('realtest_run', 8, 60000), h(async (req, res) => {
  const p = ownProject(req);
  const rt = db.prepare('SELECT * FROM real_tests WHERE id = ? AND project_id = ?').get(intId(req.params.tid), p.id);
  if (!rt) throw new HttpError(404, 'not_found', 'Real test not found.');
  if (rt.status === 'COMPLETED') throw new HttpError(400, 'already_run', 'This test already ran.');
  const running = db.prepare("SELECT id FROM validation_jobs WHERE real_test_id = ? AND status = 'RUNNING'").get(rt.id);
  if (running) throw new HttpError(400, 'already_running', 'A validation is already running for this test.');
  const mode = req.body?.mode === 'express' ? 'express' : 'real';
  let durationMs;
  if (mode === 'express') {
    durationMs = EXPRESS_MS;
  } else {
    const hours = Number(req.body?.durationHours);
    if (![4, 12, 24].includes(hours)) throw new HttpError(400, 'validation', 'Choose a duration: 4, 12 or 24 hours.');
    durationMs = hours * 3600000;
  }
  chargeCredits(req.user, CREDIT_COSTS.real_test_analysis, 'real_test:validation', p.id);
  const seed = crypto.randomBytes(4).readUInt32BE(0);
  db.prepare("UPDATE real_tests SET status = 'RUNNING' WHERE id = ?").run(rt.id);
  const id = db.prepare('INSERT INTO validation_jobs (project_id, real_test_id, mode, duration_ms, seed, status, launched_at) VALUES (?,?,?,?,?,?,?)')
    .run(p.id, rt.id, mode, durationMs, seed, 'RUNNING', Date.now()).lastInsertRowid;
  track('real_test_started', req.user.id, p.id, { mode, hours: mode === 'express' ? 'express' : Number(req.body?.durationHours) });
  audit(req.user.id, 'validation_launched', { projectId: p.id, realTestId: rt.id, mode, durationMs });
  res.json({ ok: true, jobId: id, durationMs });
}));

// Lazy finalizer: writes results, refreshes the decision and archives the report when the clock runs out.
function finalizeJob(p, rt, job, ctx) {
  const metrics = V.finalMetrics(job.seed, { budget: rt.budget, channel: rt.channel, price: ctx.price, baseline: ctx.baseline });
  const est = ctx.baseline;
  const accuracy = est ? {
    ctr: Math.round(100 - Math.min(100, Math.abs(est.ctr - metrics.ctr) / Math.max(est.ctr, 0.01) * 100)),
    conversion: Math.round(100 - Math.min(100, Math.abs(est.signupRate - metrics.signupRate) / Math.max(est.signupRate, 0.01) * 100)),
  } : null;
  if (accuracy) accuracy.overall = Math.round((accuracy.ctr + accuracy.conversion) / 2);
  const budgetScale = est?.budget ? rt.budget / est.budget : 1;
  const simulationVs = est ? {
    impressions: { sim: Math.round((est.impressions ?? 0) * budgetScale), actual: metrics.impressions },
    ctr: { sim: est.ctr, actual: metrics.ctr },
    conversion: { sim: est.signupRate, actual: metrics.signupRate },
    pricingViews: { sim: Math.round((est.pricingViews ?? 0) * budgetScale), actual: metrics.pricingViews },
    purchases: { sim: Math.round((est.purchases?.[1] ?? 0) * budgetScale), actual: metrics.purchases },
    note: est.budget ? `Simulation estimates rescaled from ${fmtMoney(est.budget)} baseline budget to the actual ${fmtMoney(rt.budget)} test budget.` : null,
  } : null;
  db.prepare("UPDATE real_tests SET status = 'COMPLETED', metrics = ?, accuracy = ?, completed_at = ? WHERE id = ?")
    .run(JSON.stringify({ metrics, simulationVs }), JSON.stringify(accuracy), Date.now(), rt.id);
  db.prepare("UPDATE validation_jobs SET status = 'COMPLETED', completed_at = ? WHERE id = ?").run(Date.now(), job.id);
  saveReport(p, rt, job, ctx);
  try {
    const it = getLatestIteration(p.id);
    const cur = it ? iterationBundle(it) : null;
    if (cur?.simulation) {
      const decision = E.decide({ scores: cur.simulation.results.scores, realTest: { metrics, accuracy } });
      storeDecision(p.id, decision);
    }
  } catch (err) { logError('finalize', err.message, { jobId: job.id }); }
  track('real_test_completed', p.user_id, p.id);
  audit(p.user_id, 'real_test_completed', { projectId: p.id, realTestId: rt.id, mode: job.mode });
}

// Archive the full validation report (idempotent per job).
function saveReport(p, rt, job, ctx) {
  try {
    const existing = db.prepare('SELECT id FROM reports WHERE job_id = ?').get(job.id);
    if (existing) return existing.id;
    const snap = V.jobSnapshot(job, ctx);
    const title = `Validation report — ${p.name} — ${new Date(job.completed_at || Date.now()).toLocaleDateString()}`;
    const content = {
      projectName: p.name,
      mode: job.mode,
      durationHours: Math.round(job.duration_ms / 3600000),
      budget: rt.budget, country: rt.country, channel: rt.channel,
      baseline: ctx.baseline, snapshot: snap,
    };
    return db.prepare('INSERT INTO reports (project_id, real_test_id, job_id, type, title, content, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(p.id, rt.id, job.id, 'validation', title, JSON.stringify(content), job.completed_at || Date.now()).lastInsertRowid;
  } catch (err) { logError('report', err.message, { jobId: job.id }); return null; }
}
function clampPct(v) { return Math.max(0.001, Math.min(0.9, v)); }

// ---------- REPORTS (archive) ----------
api.get('/projects/:id/reports/:rid', requireAuth, h(async (req, res) => {
  const p = ownProject(req);
  const r = db.prepare('SELECT * FROM reports WHERE id = ? AND project_id = ?').get(intId(req.params.rid), p.id);
  if (!r) throw new HttpError(404, 'not_found', 'Report not found.');
  res.json({ report: { id: r.id, type: r.type, title: r.title, createdAt: r.created_at, content: JSON.parse(r.content) } });
}));

// ---------- EXPERIMENTS ----------
api.get('/experiments', requireAuth, h(async (req, res) => {
  const rows = db.prepare(
    `SELECT e.*, p.name as project_name FROM experiments e JOIN projects p ON p.id = e.project_id WHERE p.user_id = ? ORDER BY e.id DESC`
  ).all(req.user.id);
  res.json({ experiments: rows.map((x) => ({ id: x.id, projectId: x.project_id, projectName: x.project_name, hypothesis: x.hypothesis, control: JSON.parse(x.control || '{}'), variant: JSON.parse(x.variant || '{}'), status: x.status, results: x.results ? JSON.parse(x.results) : null, createdAt: x.created_at, completedAt: x.completed_at })) });
}));

api.post('/experiments', requireAuth, h(async (req, res) => {
  const { projectId, hypothesis, control, variant } = req.body || {};
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(projectId));
  if (!p || p.user_id !== req.user.id) throw new HttpError(404, 'not_found', 'Project not found.');
  if (!hypothesis || String(hypothesis).trim().length < 8) throw new HttpError(400, 'validation', 'Describe the hypothesis (min 8 chars).');
  const id = db.prepare('INSERT INTO experiments (project_id, hypothesis, control, variant, status, created_at) VALUES (?,?,?,?,?,?)')
    .run(p.id, String(hypothesis).trim().slice(0, 400), JSON.stringify(control || {}), JSON.stringify(variant || {}), 'DRAFT', now()).lastInsertRowid;
  res.json({ id });
}));

api.post('/experiments/:id/run', requireAuth, h(async (req, res) => {
  const x = db.prepare(
    `SELECT e.*, p.user_id, p.seed FROM experiments e JOIN projects p ON p.id = e.project_id WHERE e.id = ?`
  ).get(intId(req.params.id));
  if (!x || x.user_id !== req.user.id) throw new HttpError(404, 'not_found', 'Experiment not found.');
  if (x.status === 'COMPLETED') throw new HttpError(400, 'already_run', 'This experiment already completed.');
  const results = simulateExperiment(x, req.body || {});
  db.prepare('UPDATE experiments SET status = ?, results = ?, completed_at = ? WHERE id = ?')
    .run('COMPLETED', JSON.stringify(results), now(), x.id);
  audit(req.user.id, 'experiment_completed', { experimentId: x.id });
  res.json({ ok: true, results });
}));

api.patch('/experiments/:id', requireAuth, h(async (req, res) => {
  const x = db.prepare(`SELECT e.*, p.user_id FROM experiments e JOIN projects p ON p.id = e.project_id WHERE e.id = ?`).get(intId(req.params.id));
  if (!x || x.user_id !== req.user.id) throw new HttpError(404, 'not_found', 'Experiment not found.');
  const status = req.body?.status;
  if (!['DRAFT', 'RUNNING', 'CANCELLED'].includes(status)) throw new HttpError(400, 'validation', 'Invalid status.');
  db.prepare('UPDATE experiments SET status = ? WHERE id = ?').run(status, x.id);
  res.json({ ok: true });
}));

function simulateExperiment(x, body) {
  const control = { ...(typeof x.control === 'string' ? JSON.parse(x.control) : x.control), ...(body.control || {}) };
  const variant = { ...(typeof x.variant === 'string' ? JSON.parse(x.variant) : x.variant), ...(body.variant || {}) };
  const rng = (s) => { let a = s >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const r = rng(x.seed ^ Math.imul(x.id, 2654435761));
  const base = { ctr: 0.022, intent: 0.3, priceAcceptance: 0.32 };
  const side = (cfg, drift) => ({
    label: cfg.label || cfg.name || 'Variant',
    price: cfg.price ?? null,
    positioning: cfg.positioning || cfg.note || '',
    ctr: +((base.ctr + drift + (r() - 0.5) * 0.006) * 100).toFixed(2),
    intent: +((base.intent + drift * 3 + (r() - 0.5) * 0.05) * 100).toFixed(1),
    priceAcceptance: +((base.priceAcceptance + drift * 2 + (r() - 0.5) * 0.05) * 100).toFixed(1),
  });
  const c = side(control, 0);
  const v = side(variant, 0.004 + r() * 0.004);
  const winner = v.ctr + v.intent + v.priceAcceptance > c.ctr + c.intent + c.priceAcceptance ? 'variant' : 'control';
  return {
    disclaimer: 'Simulated experiment result (Demo Mode) — not a guarantee of real-world performance.',
    control: c, variant: v, winner,
    reading: winner === 'variant'
      ? `Variant (“${v.label}”) wins on combined CTR + intent + price acceptance. Validate with a small real split test before committing.`
      : `Control holds up — the proposed change is not clearly better in simulation. Consider a different lever.`,
  };
}

// ---------- BILLING / CREDITS ----------
const PLANS = [
  { id: 'free', name: 'Free', price: 0, priceLabel: '$0', period: '', credits: 2, note: '1 basic simulation', monthly: false },
  { id: 'test', name: 'Test', price: 19, priceLabel: '$19', period: 'one-time', credits: 10, note: 'One full validation cycle', monthly: false },
  { id: 'founder', name: 'Founder', price: 39, priceLabel: '$39/mo', period: 'month', credits: 30, note: 'For solo founders', monthly: true },
  { id: 'pro', name: 'Pro', price: 99, priceLabel: '$99/mo', period: 'month', credits: 100, note: 'Heavy iteration', monthly: true },
  { id: 'studio', name: 'Studio', price: 299, priceLabel: '$299/mo', period: 'month', credits: 400, note: 'Teams & accelerators', monthly: true },
];

function refillIfDue(user) {
  const sub = db.prepare(`SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).get(user.id);
  if (!sub || !sub.current_period_end) return;
  if (sub.current_period_end > now()) return;
  const plan = PLANS.find((p) => p.id === sub.plan);
  if (plan && plan.monthly) {
    db.prepare('UPDATE subscriptions SET current_period_end = ? WHERE id = ?').run(now() + 30 * 86400 * 1000, sub.id);
    grantCredits(user.id, plan.credits, `monthly_refill:${plan.id}`);
  }
}

api.get('/billing', requireAuth, h(async (req, res) => {
  refillIfDue(req.user);
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const tx = db.prepare('SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY id DESC LIMIT 30').all(u.id);
  const sub = db.prepare(`SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`).get(u.id);
  const monthAgo = now() - 30 * 86400 * 1000;
  const usage = db.prepare(`SELECT reason, SUM(amount) as spent FROM credit_transactions WHERE user_id = ? AND amount < 0 AND created_at > ? GROUP BY reason`).all(u.id, monthAgo);
  res.json({
    plan: u.plan, credits: u.credits, plans: PLANS,
    subscription: sub ? { plan: sub.plan, provider: sub.provider, currentPeriodEnd: sub.current_period_end } : null,
    transactions: tx.map((t) => ({ id: t.id, amount: t.amount, reason: t.reason, at: t.created_at })),
    usageLast30d: usage,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
  });
}));

api.post('/billing/checkout', requireAuth, rateLimit('checkout', 6, 60000), h(async (req, res) => {
  const planId = String(req.body?.plan || '');
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.id === 'free') throw new HttpError(400, 'validation', 'Choose a paid plan.');
  track('upgrade_started', req.user.id, null, { plan: planId });
  if (process.env.STRIPE_SECRET_KEY) {
    // Real Stripe Checkout (used only when STRIPE_SECRET_KEY is configured).
    try {
      const origin = `${req.protocol}://${req.get('host')}`;
      const body = new URLSearchParams({
        mode: plan.monthly ? 'subscription' : 'payment',
        success_url: `${origin}/app/account?checkout=success`,
        cancel_url: `${origin}/app/account?checkout=cancelled`,
        'line_items[0][price_data][currency]': 'usd',
        'line_items[0][price_data][unit_amount]': String(plan.price * 100),
        'line_items[0][price_data][product_data][name]': `LaunchSim ${plan.name}`,
        'line_items[0][quantity]': '1',
        'client_reference_id': String(req.user.id),
      });
      if (plan.monthly) body.set('line_items[0][price_data][recurring][interval]', 'month');
      const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      }).then((r) => r.json());
      if (resp.url) return res.json({ redirectUrl: resp.url, mode: 'stripe' });
    } catch (err) {
      logError('billing', err.message, { plan: planId });
    }
  }
  // Demo checkout: no payment processor configured. Activates plan immediately, clearly labeled.
  db.prepare('INSERT INTO subscriptions (user_id, plan, status, provider, provider_ref, current_period_end, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(req.user.id, plan.id, 'active', 'demo', 'demo_' + crypto.randomBytes(6).toString('hex'), plan.monthly ? now() + 30 * 86400 * 1000 : null, now());
  db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan.id, req.user.id);
  grantCredits(req.user.id, plan.credits, `plan_activation:${plan.id}`);
  track('subscription_created', req.user.id, null, { plan: planId, demo: true });
  audit(req.user.id, 'subscription_created', { plan: planId, demo: true });
  res.json({ ok: true, mode: 'demo', notice: `Demo checkout — no real payment was processed. Plan “${plan.name}” activated with ${plan.credits} credits.` });
}));

// ---------- MARKET INTELLIGENCE ----------
api.get('/market', requireAuth, h(async (req, res) => {
  const research = db.prepare(
    `SELECT r.*, p.name as project_name FROM research r JOIN projects p ON p.id = r.project_id WHERE p.user_id = ? ORDER BY r.id DESC LIMIT 20`
  ).all(req.user.id);
  const jobs = db.prepare(
    `SELECT j.*, p.name as project_name FROM research_jobs j JOIN projects p ON p.id = j.project_id WHERE p.user_id = ? ORDER BY j.id DESC LIMIT 20`
  ).all(req.user.id);
  res.json({
    research: research.map((r) => ({ id: r.id, projectId: r.project_id, projectName: r.project_name, sourceLabel: r.source_label, depth: r.depth, data: JSON.parse(r.data), createdAt: r.created_at })),
    jobs: jobs.map((j) => ({ id: j.id, projectId: j.project_id, projectName: j.project_name, status: j.status, provider: j.provider, depth: j.depth, createdAt: j.created_at })),
    aiConfigured: aiConfigured(),
    notice: aiConfigured() ? null : 'Demo Mode: research uses the built-in illustrative sample dataset. Connect a research API (Serper, Tavily, Crunchbase…) to get live market data. Where live data is missing, LaunchSim shows “Not enough evidence” instead of guessing.',
  });
}));

// ---------- EVENTS (product analytics) ----------
api.post('/events', rateLimit('events', 60, 60000), h(async (req, res) => {
  const u = getUser(req);
  const name = String(req.body?.name || '').slice(0, 60);
  if (!name) return res.json({ ok: false });
  track(name, u ? u.id : null, req.body?.projectId ? Number(req.body.projectId) : null, req.body?.meta || {});
  res.json({ ok: true });
}));

// ---------- ADMIN ----------
api.get('/admin/overview', requireAdmin, h(async (req, res) => {
  const q = (sql) => db.prepare(sql).get();
  const users = db.prepare('SELECT id, email, name, plan, credits, is_admin, created_at FROM users ORDER BY id DESC LIMIT 100').all();
  const projects = db.prepare(`SELECT p.id, p.name, p.score, p.status_label, p.is_demo, u.email as owner, p.created_at FROM projects p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 100`).all();
  const errors = db.prepare('SELECT * FROM error_log ORDER BY id DESC LIMIT 50').all();
  const jobs = db.prepare(`SELECT j.*, p.name as project_name FROM research_jobs j JOIN projects p ON p.id = j.project_id ORDER BY j.id DESC LIMIT 50`).all();
  const tests = db.prepare(`SELECT rt.*, p.name as project_name FROM real_tests rt JOIN projects p ON p.id = rt.project_id ORDER BY rt.id DESC LIMIT 50`).all();
  res.json({
    counts: {
      users: q('SELECT COUNT(*) as c FROM users').c,
      projects: q('SELECT COUNT(*) as c FROM projects').c,
      simulations: q('SELECT COUNT(*) as c FROM simulations').c,
      creditsSpent: Math.abs(q('SELECT COALESCE(SUM(amount),0) as c FROM credit_transactions WHERE amount < 0').c),
      subscriptions: q(`SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active'`).c,
      realTests: q('SELECT COUNT(*) as c FROM real_tests').c,
      errors: q('SELECT COUNT(*) as c FROM error_log').c,
    },
    aiUsage: q('SELECT COALESCE(SUM(credits_used),0) as c FROM simulations').c,
    analytics: db.prepare('SELECT * FROM analytics_daily ORDER BY day DESC LIMIT 14').all(),
    topEvents: db.prepare(`SELECT name, COUNT(*) as c FROM events GROUP BY name ORDER BY c DESC LIMIT 12`).all(),
    users, projects, errors: errors.map((e) => ({ id: e.id, scope: e.scope, message: e.message, at: e.created_at })),
    jobs: jobs.map((j) => ({ id: j.id, project: j.project_name, status: j.status, provider: j.provider, depth: j.depth, at: j.created_at })),
    tests: tests.map((t) => ({ id: t.id, project: t.project_name, budget: t.budget, channel: t.channel, status: t.status, isDemo: !!t.is_demo })),
  });
}));

// ---------- ERRORS ----------
api.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) logError('api', err.stack || err.message, { path: req.path });
  res.status(status).json({ error: { code: err.code || 'internal', message: status >= 500 ? 'Something went wrong on our side. Please retry.' : err.message, ...(err.extra || {}) } });
});

export default api;
