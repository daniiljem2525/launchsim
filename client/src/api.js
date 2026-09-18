const BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const err = (data && data.error) || { code: 'http_' + res.status, message: 'Request failed (' + res.status + ').' };
    const e = new Error(err.message || 'Request failed.');
    e.code = err.code;
    e.status = res.status;
    e.extra = err;
    throw e;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  signup: (body) => request('/auth/signup', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  demo: () => request('/auth/demo', { method: 'POST' }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateMe: (body) => request('/auth/me', { method: 'PATCH', body }),
  forgot: (body) => request('/auth/forgot', { method: 'POST', body }),
  reset: (body) => request('/auth/reset', { method: 'POST', body }),

  projects: () => request('/projects'),
  project: (id) => request(`/projects/${id}`),
  createProject: (body) => request('/projects', { method: 'POST', body }),
  renameProject: (id, body) => request(`/projects/${id}`, { method: 'PATCH', body }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  analyze: (id, mode) => request(`/projects/${id}/analyze`, { method: 'POST', body: { mode } }),
  deepResearch: (id) => request(`/projects/${id}/research`, { method: 'POST' }),
  iterate: (id, body) => request(`/projects/${id}/iterate`, { method: 'POST', body }),
  createRealTest: (id, body) => request(`/projects/${id}/realtest`, { method: 'POST', body }),
  launchRealTest: (id, tid, body) => request(`/projects/${id}/realtest/${tid}/launch`, { method: 'POST', body }),
  report: (id, rid) => request(`/projects/${id}/reports/${rid}`),
  unitEconWhatIf: (id, body) => request(`/projects/${id}/unitecon/whatif`, { method: 'POST', body }),

  experiments: () => request('/experiments'),
  createExperiment: (body) => request('/experiments', { method: 'POST', body }),
  runExperiment: (id, body) => request(`/experiments/${id}/run`, { method: 'POST', body }),
  updateExperiment: (id, body) => request(`/experiments/${id}`, { method: 'PATCH', body }),

  billing: () => request('/billing'),
  checkout: (plan) => request('/billing/checkout', { method: 'POST', body: { plan } }),

  market: () => request('/market'),
  admin: () => request('/admin/overview'),
  event: (name, projectId, meta) => request('/events', { method: 'POST', body: { name, projectId, meta } }),
};

export const fmtMoney = (n) => '$' + (Number(n) >= 100 ? Math.round(Number(n)) : Number(n).toFixed(2));
export const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const fmtDateTime = (ts) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
export const dayAgo = (ts) => {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) { const h = Math.floor((Date.now() - ts) / 3600000); return h <= 0 ? 'just now' : `${h}h ago`; }
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
};

export const STATUS_COLORS = { KILL: 'kill', PIVOT: 'pivot', ITERATE: 'iterate', TEST: 'test', LAUNCH: 'launch' };
