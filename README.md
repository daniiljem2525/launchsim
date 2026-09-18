# LaunchSim

**Test your startup before you build it.**

LaunchSim is a pre-launch testing platform for founders. Describe an idea, and the system structures the business model, researches the market, generates testable hypotheses, builds a virtual product version (landing + 5 ad angles), runs a simulated market through a conversion funnel, scores the idea 0–100 with explained sub-scores, proposes improvements, and lets you re-simulate — before you spend weeks and money on an MVP.

**IDEA → RESEARCH → SIMULATION → ITERATION → REAL TEST → DECISION**

> Every number LaunchSim produces is a **simulation estimate**, clearly labeled — never a promise of real-world performance. Where real evidence is missing, it shows "Not enough evidence" instead of inventing statistics.

## Quick start

```bash
npm install
npm run build   # builds the React client (client/dist)
npm start       # starts the server on http://localhost:4311
```

On first boot the server creates `data/launchsim.db` (SQLite) and seeds:
- **Demo project (DogSit)** — a fully simulated sample project, accessible from the landing page via **Explore Demo** (logs into the shared demo account).
- **Admin account**: `admin@launchsim.test` / `admin-1234`
- **Demo account**: `demo@launchsim.test` / `demo-1234`

Port: `PORT=... npm start` to change (default 4311). Dev-only: `LAUNCHSIM_EXPRESS_MS` overrides the express-validation duration (default ~3 min).

## What's implemented

| Area | Status |
|---|---|
| Auth | Email/password (scrypt), sessions, profile, password reset (dev-token fallback when no SMTP), Google OAuth (activates when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set; otherwise shows an honest "not configured" message) |
| Projects | 8-step intake wizard, full pipeline (structure → research → hypotheses → competitors → landing → ads → personas → funnel → A/B → price sim → score → risks → opportunities → decision) |
| Simulation | Modes: quick (100 profiles, 1 cr), standard (500, 2 cr), advanced (1000, 5 cr). Deterministic engine with model variance per run |
| Iterations | Improve-idea proposals with patches, editable inputs, re-simulation, full timeline & history |
| Real test | **Autonomous validation runs (4 / 12 / 24 real hours)** — a long-running job that compresses a month of founder work: data sweep, campaign simulator with check-ins and budget reallocation, TikTok video lab (scripts, hooks, captions, simulated performance), **Instagram promotion layer** (Reels/stories, reach, profile visits, link clicks, follows, IG-attributed signups), live findings feed, progress & ETA, final report with checks/verdicts, **readable funnel table (who moved through each stage + step conversions + sim estimates with budget rescaling)**, **detailed statistics (CPM, CPC, cost/signup, cost/purchase, revenue/purchase, 72-entry check-in log)**, Simulation vs Reality + accuracy, refreshed decision. Survives server restarts (progress is derived from wall-clock time, results finalize lazily). A clearly-labeled express preview (~3 min) runs the same pipeline for demos. Channels: Meta / Google / TikTok / **Instagram Ads** |
| Competitors 1:1 | Real products per category (Rover, Wag!, Notion, Duolingo, MyFitnessPal, HelloFresh, ChatGPT, Etsy…) with prices, audience, feature lists, positioning, weak spots and scale figures — every row carries an evidence label ("public reference, not verified live" / "no public data → Not enough evidence"). A 1:1 compare view vs your product; **post-test weak spots** update after each validation ("the run exploited their known weakness X"). |
| Unit Economics | CAC, LTV, monthly churn, gross margin, lifetime, payback months, margin/month, 12-month contribution and LTV/CAC verdict (HEALTHY / BORDERLINE / DANGEROUS with reasons) — computed from the simulation and stored per iteration. **What-if stress test**: churn & margin sliders recompute the model via a dedicated endpoint. |
| Competitor Reaction | Scenario simulation of how competitors respond to your growth (price cut, feature copy, marketing push, clone attempt, do-nothing) with probabilities, timing, CAC-inflation impact and a counter-move per scenario; expected CAC inflation is folded into the validation run findings and the archived report, alongside post-test threat levels. |
| Marketing engine | Before each run the simulator forms its own **marketing vision** (market read, positioning thesis, big idea, channel strategy, creative direction, funnel leak, metrics philosophy) and generates **3 concrete marketing ideas** that enter the campaign rotation as extra test cells — the optimizer promotes/parks/kills them mid-run, and the report scores each idea (SCALE / PARK / KILL with CTR, purchases, spend) |
| Reports archive | Every completed validation automatically saves a full report to the project's **Reports** tab (persisted in DB, self-healing backfill for older runs) — checks & verdicts, marketing vision, ideas results, TikTok lab, optimization log, totals, accuracy; one-click **Copy as Markdown** |
| Experiments | Control vs variant (price/positioning), simulated results with a winner and reading |
| Billing | Plans (Free/Test $19/Founder $39/Pro $99/Studio $299), credit ledger, demo checkout; real Stripe Checkout activates automatically when `STRIPE_SECRET_KEY` is set |
| Admin | Users, projects, simulations, credit usage, subscriptions, research jobs, real tests, error log, 14-day analytics |
| Analytics | Server-side event tracking (signup, project_created, simulation_started/completed, iteration_created, upgrade/subscription, real_test, decision) |

## Architecture

```
server/            Express API + static hosting (single process)
  db.js            SQLite schema (node:sqlite) — users, sessions, projects, iterations,
                   hypotheses, research, competitors, simulations, experiments, real_tests,
                   decisions, events, credit_transactions, subscriptions, research_jobs, logs
  auth.js          scrypt hashing, cookie sessions, auth/admin guards
  routes.js        All API routes + credit charging + rate limiting + ownership guards
  seed.js          Demo/admin seeding; DogSit is produced by the real engine, not hardcoded
  engine/
    index.js       Deterministic simulation engine: category detection, business model
                   structuring, research sample datasets, hypotheses, landing/ads generation,
                   personas, funnel, A/B, price simulation, scoring rubric, risks,
                   opportunities, improvement proposals, decision rules
    pipeline.js    Orchestration + persistence + credit costs + AI-provider detection
    validation.js  Long-running validation engine: 6-stage plan, deterministic check-in
                   series, findings feed, TikTok video lab, marketing vision + idea cells,
                   final report — a pure function of (seed, elapsed time) so jobs survive
                   restarts
client/            React 18 + Vite SPA (custom minimal design system, no UI framework)
  src/pages/       Landing, Auth, Dashboard, Wizard, Project (8 tabs), Experiments,
                   Market Intelligence, Account/Billing, Admin
test/e2e-api.mjs   End-to-end API test (signup → project → analyze → improve → iterate →
                   real test → experiments → billing → guards → admin)
```

### AI / integrations (honest by default)

The app runs fully offline in **Demo Mode**: research uses clearly-labeled illustrative sample datasets, simulation uses the local deterministic engine, billing and ad platforms are mocked with visible "demo" labels. Integration points that activate automatically when env vars are present:

- `ZAI_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `ANTHROPIC_API_KEY` — AI-assisted engine labeling (`aiConfigured()` pipeline hook)
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Google sign-in (real OAuth code flow)
- `STRIPE_SECRET_KEY` — real Stripe Checkout sessions
- `META_ADS_TOKEN` / `GOOGLE_ADS_TOKEN` / `TIKTOK_ADS_TOKEN` — flip integration status to "connected" in real-test plans (live metrics fetching is the next step)
- `SMTP_URL` — email delivery for password reset (otherwise a testing-only dev link is shown, clearly labeled)

No integration is ever presented as working when it is not: the UI always shows the real connection state.

## Testing

```bash
node test/e2e-api.mjs   # full user-journey API test against a running server
```

Walked through manually in the browser as well: signup → 8-step wizard → analysis → results → improve idea → simulate again → iteration history → real test plan → demo run → simulation-vs-reality → decision; plus demo project, experiments, billing upgrade, password reset, admin panel, and mobile layout.

## Deploy

### Local / VPS (persistent DB — recommended for real usage)
```bash
npm install && npm run build && npm start   # serves app + API on :4311
```

### Vercel (serverless)
The repo is Vercel-ready (`api/index.js` entry + `vercel.json`). Note: the serverless filesystem is ephemeral — the SQLite DB lives in `/tmp` and re-seeds on cold start, so data does not persist between invocations. Fine for demos; use the local/VPS mode (or swap `node:sqlite` for a hosted DB) for production.

1. Push this repo to GitHub.
2. vercel.com → Add New Project → Import the repo → Deploy (framework auto-detected; build + rewrites come from `vercel.json`).

Or via CLI: `npx vercel login` → `npx vercel --prod`.
