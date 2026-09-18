// Pipeline orchestrator: runs one full analysis pass for an iteration.
// Engine selection: AI provider if configured, otherwise deterministic demo engine.
// Every result is persisted as structured JSON and always carries its estimate disclaimer.
import * as E from './index.js';
import db, { now, logError, track } from '../db.js';

export const CREDIT_COSTS = {
  quick: 1,        // quick simulation (100 profiles)
  standard: 2,     // standard simulation (500 profiles)
  advanced: 5,     // advanced simulation (1000 profiles)
  research_deep: 3,
  real_test_analysis: 5,
};

export function aiConfigured() {
  return Boolean(process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY);
}

// Runs the full simulation for a project iteration and persists everything.
export function runSimulation({ project, iterationId, inputs, mode = 'quick', salt = 0 }) {
  const seed = (project.seed ^ Math.imul(iterationId, 2654435761) ^ Math.imul(salt, 9176)) >>> 0;
  try {
    const structured = E.structureIdea(inputs, seed);
    const scores = E.scoreProject(inputs, structured, seed);
    const ab = E.runAB(structured, seed);
    const wtp = scores.sub['Willingness to Pay'];
    const priceSim = E.runPriceSim(inputs, structured, seed, wtp);
    const priceAcceptance = priceSim.suggested.resistance <= 60 ? clamp(0.55 - priceSim.suggested.resistance / 200, 0.1, 0.5) : 0.18;
    const angleFit = 0.85 + (ab.best.overall / 100) * 0.35;
    const funnel = E.runFunnel(inputs, structured, seed, mode, angleFit, priceAcceptance, wtp);
    const personas = E.generatePersonas(inputs, structured, seed, mode === 'advanced' ? 12 : 8);
    const landing = E.generateLanding(structured, seed, { headline: ab.best.headline });
    const ads = E.generateAdConcepts(structured, seed);
    const concept = E.generateProductConcept(structured, seed);
    const risks = E.findRisks(inputs, structured, scores, seed);
    const opportunities = E.findOpportunities(inputs, structured, seed);
    const unitEcon = E.unitEconomics(inputs, structured, funnel, scores, seed ^ 0x777);
    const results = {
      structured, scores, ab, priceSim, funnel, personas, landing, ads, concept, risks, opportunities, unitEcon,
      engine: aiConfigured() ? 'ai-assisted' : 'demo',
      disclaimer: 'Simulation estimate — not a guarantee of real-world performance.',
      generatedAt: now(),
    };
    const credits = CREDIT_COSTS[mode] ?? 1;
    const simId = db.prepare(
      'INSERT INTO simulations (project_id, iteration_id, mode, seed, results, profile_count, credits_used, engine, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(project.id, iterationId, mode, seed, JSON.stringify(results), funnel.profileCount, credits, results.engine, now()).lastInsertRowid;
    db.prepare('UPDATE iterations SET score = ? WHERE id = ?').run(scores.score, iterationId);
    db.prepare("UPDATE projects SET score = ?, status_label = ?, status = 'active', updated_at = ? WHERE id = ?")
      .run(scores.score, scores.statusLabel, now(), project.id);
    track('simulation_completed', project.user_id, project.id, { mode, score: scores.score });
    return { simId, results };
  } catch (err) {
    logError('simulation', err.message, { projectId: project.id, iterationId });
    const e = new Error('Simulation temporarily unavailable. Retry.');
    e.status = 503; e.code = 'simulation_failed';
    throw e;
  }
}

export function runResearch({ project, iterationId, inputs, depth = 'basic' }) {
  const seed = project.seed ^ (iterationId * 2654435761) ^ 0x77;
  try {
    const structured = E.structureIdea(inputs, seed);
    const research = E.generateResearch(inputs, structured, seed, depth);
    const jobId = db.prepare('INSERT INTO research_jobs (project_id, status, provider, depth, created_at, completed_at) VALUES (?,?,?,?,?,?)')
      .run(project.id, 'COMPLETED', aiConfigured() ? 'ai' : 'sample', depth, now(), now()).lastInsertRowid;
    const id = db.prepare('INSERT INTO research (project_id, iteration_id, data, source_label, depth, created_at) VALUES (?,?,?,?,?,?)')
      .run(project.id, iterationId, JSON.stringify(research), research.disclaimer, depth, now()).lastInsertRowid;
    return { id, research };
  } catch (err) {
    logError('research', err.message, { projectId: project.id });
    const e = new Error('Research temporarily unavailable. Retry.');
    e.status = 503; e.code = 'research_failed';
    throw e;
  }
}

export function persistHypotheses(projectId, iterationId, inputs, structured, seed) {
  const hs = E.generateHypotheses(inputs, structured, seed);
  const del = db.prepare('DELETE FROM hypotheses WHERE iteration_id = ?').run(iterationId);
  const stmt = db.prepare('INSERT INTO hypotheses (project_id, iteration_id, code, text, importance, confidence, evidence, status) VALUES (?,?,?,?,?,?,?,?)');
  for (const h of hs) stmt.run(projectId, iterationId, h.code, h.text, h.importance, h.confidence, h.evidence, h.status);
  return hs;
}

export function persistCompetitors(projectId, iterationId, inputs) {
  const cat = E.detectCategory(`${inputs.what} ${inputs.problem} ${inputs.audience}`);
  const del = db.prepare('DELETE FROM competitors WHERE iteration_id = ?').run(iterationId);
  const stmt = db.prepare('INSERT INTO competitors (project_id, iteration_id, name, kind, price, audience, positioning, strength, weakness, features, registrations, evidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  for (const c of cat.competitors) stmt.run(projectId, iterationId, c.name, c.kind, c.price, c.audience, c.positioning, c.strength, c.weakness, JSON.stringify(c.features || []), c.registrations || 'Not enough evidence', c.evidence || 'no public data');
  return cat.competitors;
}

export function storeDecision(projectId, decision) {
  return db.prepare('INSERT INTO decisions (project_id, recommendation, reasons, created_at) VALUES (?,?,?,?)')
    .run(projectId, decision.recommendation, JSON.stringify(decision.reasons), now()).lastInsertRowid;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
