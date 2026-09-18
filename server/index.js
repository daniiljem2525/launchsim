import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db from './db.js';
import { seedIfEmpty } from './seed.js';
import api from './routes.js';
import { logError } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIR = path.join(__dirname, '..', 'client', 'dist');
const PORT = Number(process.env.PORT) || 3000;

seedIfEmpty();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

// API responses are dynamic and session-scoped — never cache them.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Security headers
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

// CSRF: mutations must originate from this site (browsers always send Origin on
// cross-site POSTs; same-origin fetches send it too or we allow empty for API clients)
app.use('/api', (req, res, next) => {
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return res.status(403).json({ error: { code: 'cross_origin', message: 'Cross-origin requests are not allowed.' } });
  }
  next();
});

// tiny structured request log
app.use((req, res, next) => {
  const t0 = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api') && (res.statusCode >= 400 || req.path.includes('analyze') || req.path.includes('iterate'))) {
      console.log(`[api] ${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - t0}ms)`);
    }
  });
  next();
});

app.use('/api', api);

// static client
app.use(express.static(CLIENT_DIR));
app.get(/^\/(?!api).*/, (req, res) => {
  const index = path.join(CLIENT_DIR, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(503).send('Client build missing. Run: npm run build');
});

// final error handler (unhandled)
app.use((err, req, res, next) => {
  logError('server', err.stack || err.message, { path: req.path });
  console.error('[server]', err);
  res.status(500).json({ error: { code: 'internal', message: 'Something went wrong on our side. Please retry.' } });
});

// In serverless environments (Vercel) the app is exported, not listened.
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    console.log(`LaunchSim running on http://localhost:${PORT} (users: ${users}, mode: ${process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY ? 'AI' : 'demo'})`);
  });
}
