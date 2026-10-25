// GitHub access for the online dev version (SITE.mode 'dev'): reads the
// enemy/skill files from the dev branch, commits edits to it and releases it
// to the playable version (main). Uses a fine-grained token kept only in
// this browser (see README, "Online dev version").
import { SITE, key } from './site.js';

const API = 'https://api.github.com';
const TOKEN_KEY = key('isfw.github.token');

export const token = {
  get() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } },
  set(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} },
  clear() { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
};

export class GitHubError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// path: '/user' or a repo path such as '/git/ref/heads/dev'.
export async function api(path, { method = 'GET', body, raw = false, auth = token.get() } = {}) {
  const url = path.startsWith('/user') ? `${API}${path}` : `${API}/repos/${SITE.repo}${path}`;
  let r;
  try {
    r = await fetch(url, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${auth}`,
        Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new GitHubError(0, 'GitHub not reachable');
  }
  if (!r.ok) {
    let msg = '';
    try { msg = (await r.json()).message || ''; } catch {}
    throw new GitHubError(r.status, msg || `GitHub answered ${r.status}`);
  }
  if (r.status === 204) return null;
  return raw ? r.text() : r.json();
}

// Git blob id of a text, as GitHub reports it for a file (sha-1 of
// "blob <bytes>\0<bytes>").
export async function blobSha(text) {
  const bytes = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head);
  all.set(bytes, head.length);
  const buf = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const FILE_PATHS = { enemies: 'js/enemies.js', skills: 'js/skills.js' };

// Latest enemies.js / skills.js on the dev branch, so the dev version never
// waits for the site to redeploy after a commit.
export async function loadRemote() {
  const ref = await api(`/git/ref/heads/${SITE.branch}`);
  const head = ref.object.sha;
  const out = { head };
  for (const [name, path] of Object.entries(FILE_PATHS)) {
    const text = await api(`/contents/${path}?ref=${head}`, { raw: true });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
    try {
      const m = await import(url);
      out[name] = { text, data: m.ENEMIES || m.SKILLS, sha: await blobSha(text) };
    } finally {
      URL.revokeObjectURL(url);
    }
    if (!Array.isArray(out[name].data)) throw new GitHubError(0, `${path} on ${SITE.branch} has no data`);
  }
  return out;
}

// One commit on the dev branch with the given files ({ 'js/enemies.js': text }).
// expected: { path: blob sha the page loaded }; if any of them changed on the
// branch since, nothing is committed (GitHubError 409).
export async function commitFiles(files, expected, message) {
  const ref = await api(`/git/ref/heads/${SITE.branch}`);
  const head = ref.object.sha;
  const commit = await api(`/git/commits/${head}`);
  for (const path of Object.keys(files)) {
    let current = null;
    try { current = (await api(`/contents/${path}?ref=${head}`)).sha; } catch (err) { if (err.status !== 404) throw err; }
    if (current !== expected[path]) throw new GitHubError(409, `${path} changed on the ${SITE.branch} branch after this page loaded it`);
  }
  const tree = await api('/git/trees', {
    method: 'POST',
    body: { base_tree: commit.tree.sha, tree: Object.entries(files).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content })) },
  });
  const created = await api('/git/commits', { method: 'POST', body: { message, tree: tree.sha, parents: [head] } });
  try {
    await api(`/git/refs/heads/${SITE.branch}`, { method: 'PATCH', body: { sha: created.sha, force: false } });
  } catch (err) {
    if (err.status === 422) throw new GitHubError(409, `the ${SITE.branch} branch changed while committing`);
    throw err;
  }
  return created.sha;
}

// How far dev is ahead of the playable version (main).
export async function compare() {
  const c = await api(`/compare/${SITE.release}...${SITE.branch}`);
  return { ahead: c.ahead_by, behind: c.behind_by };
}

// Release: move main to the dev branch (fast-forward), or merge dev into main
// if main has commits of its own.
export async function release() {
  const ref = await api(`/git/ref/heads/${SITE.branch}`);
  const sha = ref.object.sha;
  try {
    await api(`/git/refs/heads/${SITE.release}`, { method: 'PATCH', body: { sha, force: false } });
    return { how: 'fast-forward', sha };
  } catch (err) {
    if (err.status !== 422) throw err;
  }
  const m = await api('/merges', { method: 'POST', body: { base: SITE.release, head: sha, commit_message: `Release ${SITE.branch} to playable` } });
  return { how: 'merge', sha: m ? m.sha : sha };
}
