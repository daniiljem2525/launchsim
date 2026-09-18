// Seed: demo user + fully-simulated DogSit demo project + admin user.
// Demo data is produced by the same production engine (no hardcoded results),
// and every demo surface is labeled DEMO / SIMULATED.
import db, { now, track } from './db.js';
import { hashPassword } from './auth.js';
import * as E from './engine/index.js';
import * as V from './engine/validation.js';
import { runSimulation, runResearch, persistHypotheses, persistCompetitors, CREDIT_COSTS } from './engine/pipeline.js';

export const DEMO_EMAIL = 'demo@launchsim.test';
export const DEMO_PASSWORD = 'demo-1234';
export const ADMIN_EMAIL = 'admin@launchsim.test';
export const ADMIN_PASSWORD = 'admin-1234';

const DOGSIT_INPUTS = {
  name: 'DogSit',
  what: 'A mobile app that matches dog owners with verified local sitters in minutes, with in-app chat, live photo updates and secure payment.',
  audience: 'Urban dog owners',
  problem: 'Hard to find a trustworthy dog sitter quickly, especially for last-minute trips',
  model: 'subscription',
  price: 9,
  market: 'United States',
  budget: 50,
  validate: ['demand', 'willingness to pay', 'acquisition'],
};

export function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;

  const adminId = db.prepare('INSERT INTO users (email, password_hash, name, is_admin, plan, credits, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD), 'LaunchSim Admin', 1, 'studio', 999, now()).lastInsertRowid;

  const demoId = db.prepare('INSERT INTO users (email, password_hash, name, is_admin, plan, credits, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(DEMO_EMAIL, hashPassword(DEMO_PASSWORD), 'Demo Founder', 0, 'founder', 30, now()).lastInsertRowid;

  createDemoProject(demoId);
  track('signup', demoId, null, { seeded: true });
  console.log('[seed] created admin + demo accounts and DogSit demo project');
}

// Build the demo project by executing the real pipeline over 3 seeded iterations.
export function createDemoProject(userId) {
  const t = now();
  const projectId = db.prepare('INSERT INTO projects (user_id, name, inputs, status, is_demo, seed, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(userId, 'DogSit', JSON.stringify(DOGSIT_INPUTS), 'active', 1, 424242, t, t).lastInsertRowid;
  const project = { id: projectId, user_id: userId, seed: 424242, is_demo: 1 };

  // Iteration 1: original idea, rough version
  const v1 = db.prepare('INSERT INTO iterations (project_id, number, label, changes, inputs, created_at) VALUES (?,?,?,?,?,?)')
    .run(projectId, 1, 'Original idea', JSON.stringify([]), JSON.stringify(DOGSIT_INPUTS), t).lastInsertRowid;
  seedIteration(project, v1, DOGSIT_INPUTS);
  // Iteration 2: narrower audience + stronger positioning
  const v2Inputs = { ...DOGSIT_INPUTS, audience: 'Urban dog owners who travel', what: 'A mobile app that matches dog owners with verified local sitters in minutes, with trust scores, live photo updates and secure payment.' };
  const v2 = db.prepare('INSERT INTO iterations (project_id, number, label, changes, inputs, created_at) VALUES (?,?,?,?,?,?)')
    .run(projectId, 2, 'Narrowed audience + trust positioning', JSON.stringify([
      { area: 'Audience', from: 'Urban dog owners', to: 'Urban dog owners who travel', why: 'Travel creates urgent, recurring need' },
    ]), JSON.stringify(v2Inputs), t + 1000).lastInsertRowid;
  seedIteration(project, v2, v2Inputs);
  // Iteration 3: current version (price + trust-first landing)
  const v3Inputs = { ...v2Inputs, price: 9 };
  const v3 = db.prepare('INSERT INTO iterations (project_id, number, label, changes, inputs, created_at) VALUES (?,?,?,?,?,?)')
    .run(projectId, 3, 'Trust-first positioning', JSON.stringify([
      { area: 'Positioning', from: 'Generic sitter matching', to: 'Verified trust as the core promise', why: 'Differentiation was the weakest sub-score' },
    ]), JSON.stringify(v3Inputs), t + 2000).lastInsertRowid;
  seedIteration(project, v3, v3Inputs);

  // Completed DEMO real test on the current iteration: a 24h validation job (clearly labeled DEMO).
  const sim = db.prepare('SELECT results FROM simulations WHERE iteration_id = ? ORDER BY id DESC LIMIT 1').get(v3);
  const est = sim ? JSON.parse(sim.results).funnel : null;
  const spend = 150;
  const jobSeed = 777001;
  const metrics = V.finalMetrics(jobSeed, { budget: spend, channel: 'Meta Ads', price: 9, baseline: est ? { ...est, budget: 50 } : null });
  const accuracy = est ? {
    ctr: Math.round(100 - Math.min(100, Math.abs(est.ctr - metrics.ctr) / Math.max(est.ctr, 0.01) * 100)),
    conversion: Math.round(100 - Math.min(100, Math.abs(est.signupRate - metrics.signupRate) / Math.max(est.signupRate, 0.01) * 100)),
    overall: 0,
  } : null;
  if (accuracy) accuracy.overall = Math.round((accuracy.ctr + accuracy.conversion) / 2);
  const it3 = db.prepare('SELECT * FROM iterations WHERE id = ?').get(v3);
  const curInputs = JSON.parse(it3.inputs);
  const structured3 = E.structureIdea(curInputs, (project.seed ^ Math.imul(v3, 2654435761)) >>> 0);
  const scores3 = E.scoreProject(curInputs, structured3, (project.seed ^ Math.imul(v3, 2654435761)) >>> 0);
  db.prepare('INSERT INTO real_tests (project_id, budget, country, channel, status, plan, metrics, accuracy, is_demo, credits_used, created_at, completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(projectId, spend, 'United States', 'Meta Ads', 'COMPLETED', JSON.stringify({
      disclaimer: 'Demo campaign plan (DEMO). No ad account connected.',
      campaignStructure: [
        'Campaign: DogSit — United States',
        'Ad set 1: broad audience matching your customer profile',
        'Ad set 2: narrow lookalike of the highest-intent simulated profile',
        'Budget split: 70% / 30% for the first 3 days, then shift to the winner',
      ],
      trackingPlan: [
        'UTM template: utm_source=meta&utm_campaign=dogsit&utm_content={angle}',
        'Events to track: landing_view, signup, pricing_view, purchase',
        'Daily check: CTR, CPC, signup rate, cost per signup',
      ],
      integrations: { meta: 'not_connected', google: 'not_connected', tiktok: 'not_connected' },
    }), JSON.stringify({
      metrics,
      simulationVs: est ? (() => {
        const scale = spend / 50;
        return {
          impressions: { sim: Math.round(((50 / 11) * 1000) * scale), actual: metrics.impressions },
          ctr: { sim: est.ctr, actual: metrics.ctr },
          conversion: { sim: est.signupRate, actual: metrics.signupRate },
          pricingViews: { sim: Math.round(((est.signups || 10) * 0.45) * scale), actual: metrics.pricingViews },
          purchases: { sim: Math.round(est.purchases[1] * scale), actual: metrics.purchases },
          note: 'Simulation estimates rescaled from $50 baseline budget to the actual $150 test budget.',
        };
      })() : null,
    }), JSON.stringify(accuracy), 1, 5, t + 3000, t + 3100);
  // the 24h validation job behind that completed test
  const jobId = db.prepare('INSERT INTO validation_jobs (project_id, real_test_id, mode, duration_ms, seed, status, launched_at, completed_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(projectId, db.prepare('SELECT id FROM real_tests WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId).id,
      'real', 24 * 3600000, jobSeed, 'COMPLETED', t + 3000, t + 3000 + 24 * 3600000).lastInsertRowid;

  // archive the validation report
  const comps3 = db.prepare('SELECT * FROM competitors WHERE iteration_id = ?').all(v3)
    .map((c) => ({ ...c, features: JSON.parse(c.features || '[]') }));
  const jobForSnap = { status: 'COMPLETED', launched_at: t + 3000, duration_ms: 24 * 3600000, mode: 'real', seed: jobSeed, completed_at: t + 3000 + 24 * 3600000 };
  const snapCtx = { seed: jobSeed, budget: spend, country: 'United States', channel: 'Meta Ads', price: 9, baseline: est ? { ...est, budget: 50 } : null, structured: structured3, scores: scores3, competitors: comps3 };
  const snap = V.jobSnapshot(jobForSnap, snapCtx);
  db.prepare('INSERT INTO reports (project_id, real_test_id, job_id, type, title, content, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(projectId, db.prepare('SELECT id FROM real_tests WHERE project_id = ? ORDER BY id DESC LIMIT 1').get(projectId).id, jobId, 'validation',
      `Validation report — DogSit — ${new Date(t + 3000 + 24 * 3600000).toLocaleDateString()}`,
      JSON.stringify({ projectName: 'DogSit', mode: 'real', durationHours: 24, budget: spend, country: 'United States', channel: 'Meta Ads', baseline: est ? { ...est, budget: 50 } : null, snapshot: snap }),
      t + 3000 + 24 * 3600000);
  const decision = E.decide({ scores: scores3, realTest: { metrics, accuracy } });
  db.prepare('INSERT INTO decisions (project_id, recommendation, reasons, created_at) VALUES (?,?,?,?)')
    .run(projectId, decision.recommendation, JSON.stringify(decision.reasons), t + 3200);

  return projectId;
}

function seedIteration(project, iterationId, inputs) {
  runResearch({ project, iterationId, inputs, depth: 'basic' });
  const structured = E.structureIdea(inputs, project.seed ^ (iterationId * 2654435761));
  persistHypotheses(project.id, iterationId, inputs, structured, project.seed ^ (iterationId * 2654435761));
  persistCompetitors(project.id, iterationId, inputs);
  runSimulation({ project, iterationId, inputs, mode: 'standard' });
}
