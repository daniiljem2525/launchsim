// LaunchSim database layer.
//
// Two modes, identical synchronous API (prepare().run/.get/.all, exec):
// 1. Default: node:sqlite on a local file (./data or /tmp on serverless).
// 2. Persistent serverless mode (Vercel): better-sqlite3 + Vercel Blob.
//    When BLOB_READ_WRITE_TOKEN is set, the DB file is restored from Blob at
//    cold start and every write re-uploads it — so accounts/projects survive
//    serverless restarts. Best-effort for demo scale: concurrent instances
//    resolve last-write-wins.
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOB_KEY = 'launchsim-db.sqlite';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

let db;
let blobMode = false;

if (BLOB_TOKEN) {
  const { default: Database } = await import('better-sqlite3');
  blobMode = true;
  const DB_PATH = '/tmp/launchsim.db';
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  // restore latest snapshot from Blob (cold start: /tmp is empty)
  try {
    const { head } = await import('@vercel/blob');
    const meta = await head(BLOB_KEY);
    const res = await fetch(meta.url);
    if (res.ok) fs.writeFileSync(DB_PATH, Buffer.from(await res.arrayBuffer()));
  } catch { /* no snapshot yet — fresh seed below */ }
  db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  async function uploadSnapshot() {
    try {
      const { put } = await import('@vercel/blob');
      const buf = fs.readFileSync(DB_PATH);
      await put(BLOB_KEY, buf, { access: 'public', addRandomSuffix: false, allowOverwrite: true });
    } catch (err) {
      console.error('[blob-upload]', err.message);
    }
  }
  let uploading = false, pendingAgain = false;
  function scheduleUpload() {
    if (uploading) { pendingAgain = true; return; }
    uploading = true;
    uploadSnapshot().finally(() => {
      uploading = false;
      if (pendingAgain) { pendingAgain = false; scheduleUpload(); }
    });
  }
  const origPrepare = db.prepare.bind(db);
  db.prepare = (sqlText) => {
    const stmt = origPrepare(sqlText);
    const origRun = stmt.run.bind(stmt);
    stmt.run = (...args) => {
      const res = origRun(...args);
      scheduleUpload();
      return res;
    };
    return stmt;
  };
} else {
  const { DatabaseSync } = await import('node:sqlite');
  const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(path.join(DATA_DIR, 'launchsim.db'));
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
}

export function dbMode() { return blobMode ? 'sqlite+blob' : 'sqlite'; }

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL DEFAULT '',
  is_admin INTEGER NOT NULL DEFAULT 0,
  plan TEXT NOT NULL DEFAULT 'free',
  credits INTEGER NOT NULL DEFAULT 2,
  google_id TEXT,
  reset_token TEXT,
  reset_expires INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled project',
  inputs TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  score INTEGER,
  status_label TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  seed INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS iterations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  label TEXT NOT NULL DEFAULT 'Original idea',
  changes TEXT NOT NULL DEFAULT '[]',
  inputs TEXT NOT NULL DEFAULT '{}',
  score INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS hypotheses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  text TEXT NOT NULL,
  importance INTEGER NOT NULL,
  confidence TEXT NOT NULL,
  evidence TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNKNOWN'
);
CREATE TABLE IF NOT EXISTS research (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  source_label TEXT NOT NULL,
  depth TEXT NOT NULL DEFAULT 'basic',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS competitors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  price TEXT,
  audience TEXT,
  positioning TEXT,
  strength TEXT,
  weakness TEXT,
  features TEXT NOT NULL DEFAULT '[]',
  registrations TEXT,
  evidence TEXT
);
CREATE TABLE IF NOT EXISTS simulations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  iteration_id INTEGER NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'quick',
  seed INTEGER NOT NULL,
  results TEXT NOT NULL,
  profile_count INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  engine TEXT NOT NULL DEFAULT 'demo',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS experiments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hypothesis TEXT NOT NULL,
  control TEXT NOT NULL DEFAULT '{}',
  variant TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  results TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS real_tests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  budget INTEGER NOT NULL,
  country TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PLANNED',
  plan TEXT,
  metrics TEXT,
  accuracy TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS validation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  real_test_id INTEGER NOT NULL REFERENCES real_tests(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'real',
  duration_ms INTEGER NOT NULL,
  seed INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  launched_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  real_test_id INTEGER,
  job_id INTEGER,
  type TEXT NOT NULL DEFAULT 'validation',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL,
  reasons TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  project_id INTEGER,
  name TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  project_id INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  provider TEXT NOT NULL DEFAULT 'demo',
  provider_ref TEXT,
  current_period_end INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS research_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING',
  provider TEXT NOT NULL DEFAULT 'sample',
  depth TEXT NOT NULL DEFAULT 'basic',
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE TABLE IF NOT EXISTS error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  message TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  meta TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS analytics_daily (
  day TEXT PRIMARY KEY,
  signups INTEGER NOT NULL DEFAULT 0,
  projects_created INTEGER NOT NULL DEFAULT 0,
  simulations_completed INTEGER NOT NULL DEFAULT 0,
  subscriptions INTEGER NOT NULL DEFAULT 0
);
`);

export function now() { return Date.now(); }
export function logError(scope, message, meta = {}) {
  try { db.prepare('INSERT INTO error_log (scope, message, meta, created_at) VALUES (?,?,?,?)')
    .run(scope, String(message).slice(0, 2000), JSON.stringify(meta), now()); } catch { /* ignore */ }
}
export function audit(userId, action, meta = {}) {
  try { db.prepare('INSERT INTO audit_log (user_id, action, meta, created_at) VALUES (?,?,?,?)')
    .run(userId, action, JSON.stringify(meta), now()); } catch { /* ignore */ }
}
export function track(name, userId = null, projectId = null, meta = {}) {
  try { db.prepare('INSERT INTO events (user_id, project_id, name, meta, created_at) VALUES (?,?,?,?,?)')
    .run(userId, projectId, name, JSON.stringify(meta), now()); } catch { /* ignore */ }
  try {
    const day = new Date().toISOString().slice(0, 10);
    const col = { signup: 'signups', project_created: 'projects_created', simulation_completed: 'simulations_completed', subscription_created: 'subscriptions' }[name];
    if (col) {
      db.prepare(`INSERT INTO analytics_daily (day, ${col}) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET ${col} = ${col} + 1`).run(day);
    }
  } catch { /* ignore */ }
}

export default db;
