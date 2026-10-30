// Edited copies of the enemy, skill and shop lists, shared by the dev pages.
//
// Locally (SITE.mode 'local', start.bat): saved to their files on every
// change through the ISFW server (server.py: POST /api/enemies, /api/skills, /api/shop).
// Until a save succeeds the edits are also kept in localStorage (data.js
// loads them), so nothing is lost if the server is unreachable.
//
// Online dev version (SITE.mode 'dev'): read-only until signed in with a
// GitHub token. Signed in, edits are kept in this browser as drafts and go
// to the dev branch only when "commit" is pressed; "release to playable"
// moves the playable version (main) to the dev branch.
import { ENEMIES, SKILLS, SHOP, FILES, DRAFT_KEYS, FILE_HASH, REMOTE, dataHash } from '../data.js';
import { enemiesSource, skillsSource, shopSource } from '../serialize.js';
import { SITE } from '../site.js';
import * as GH from '../github.js';

const clone = (x) => structuredClone(x);
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const store = { enemies: clone(ENEMIES), skills: clone(SKILLS), shop: clone(SHOP) };
export const RUNNING = { enemies: ENEMIES, skills: SKILLS, shop: SHOP }; // what the game uses
const SOURCE = { enemies: enemiesSource, skills: skillsSource, shop: shopSource };
const SAVE_DELAY = 400; // ms after the last edit

export const LOCAL = SITE.mode === 'local';
export const SIGNED_IN = SITE.mode === 'dev' && !!GH.token.get();
// Online without a token (or the playable version): nothing can be edited.
export const READONLY = !LOCAL && !SIGNED_IN;

// Per file: 'saved' | 'pending' | 'error' (local), 'saved' | 'uncommitted' (online)
export const status = {
  enemies: { state: 'saved', msg: '', at: null, timer: null },
  skills: { state: 'saved', msg: '', at: null, timer: null },
  shop: { state: 'saved', msg: '', at: null, timer: null },
};
export const server = { ok: null, msg: '' }; // null = not checked yet

// Online dev version, signed in.
export const gh = {
  user: '', // GitHub login once the token is checked
  error: REMOTE && REMOTE.error ? `could not load the dev branch: ${REMOTE.error.message}` : '',
  head: REMOTE && !REMOTE.error ? REMOTE.head : null, // dev commit the data came from
  busy: '', // 'commit' | 'release' while running
  msg: '', // result of the last commit / release
  ahead: null, // dev commits not released to playable yet
  behind: null,
};

// What is in the files, as far as this page knows:
//   data: hash of the data (drafts record it, see data.js)
//   text: sha-256 of the file text (local: sent with saves; the server
//         refuses a save if the file changed since, e.g. edited elsewhere)
//   blob: git blob id of the file on the dev branch (online)
//   committed: the data in the file (online: what "uncommitted" compares to)
const disk = {
  enemies: { data: FILE_HASH.enemies, text: null, blob: REMOTE?.enemies?.sha ?? null, committed: FILES.enemies },
  skills: { data: FILE_HASH.skills, text: null, blob: REMOTE?.skills?.sha ?? null, committed: FILES.skills },
  shop: { data: FILE_HASH.shop, text: null, blob: REMOTE?.shop?.sha ?? null, committed: FILES.shop },
};
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ready = !LOCAL ? Promise.resolve() : Promise.all(Object.keys(disk).map(async (name) => {
  try {
    const r = await fetch(`js/${name}.js`, { cache: 'no-store' });
    const text = await r.text();
    // only trust it if it is the version this page loaded
    const m = await import(`../${name}.js?check=${Date.now()}`).catch(() => null);
    const data = m && (m.ENEMIES || m.SKILLS || m.SHOP);
    if (data && dataHash(data) === FILE_HASH[name]) disk[name].text = await sha256(text);
    else disk[name].stale = true;
  } catch { /* unreachable: saves will report it */ }
}));

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const notify = () => listeners.forEach((fn) => fn());

function keepLocal(name) {
  try { localStorage.setItem(DRAFT_KEYS[name], JSON.stringify({ base: disk[name].data, data: store[name] })); } catch {}
}
function dropLocal(name) {
  try { localStorage.removeItem(DRAFT_KEYS[name]); } catch {}
}

// Call after every edit of store[name].
export function persist(name) {
  if (READONLY) return;
  if (!LOCAL) {
    const changed = !same(store[name], disk[name].committed);
    if (changed) keepLocal(name); else dropLocal(name);
    status[name].state = changed ? 'uncommitted' : 'saved';
    return;
  }
  keepLocal(name);
  const st = status[name];
  st.state = 'pending';
  clearTimeout(st.timer);
  st.timer = setTimeout(() => write(name), SAVE_DELAY);
}

export async function write(name) {
  if (!LOCAL) return;
  const st = status[name];
  clearTimeout(st.timer);
  st.timer = null;
  const snapshot = clone(store[name]);
  try {
    await ready;
    if (disk[name].stale || !disk[name].text) throw new Error(`${name}.js changed on disk after this page loaded. Reload the page to get the new version (your edits here are kept aside)`);
    const body = SOURCE[name](snapshot);
    const r = await fetch(`api/${name}?base=${disk[name].text}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
      body,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      if (r.status === 409) disk[name].stale = true;
      throw new Error(r.status === 409 ? `${name}.js changed on disk after this page loaded. Reload the page to get the new version (your edits here are kept aside)`
        : r.status === 501 || r.status === 405 || r.status === 404 ? 'this server cannot save (an old or different server is running)'
        : `server answered ${r.status} ${txt.slice(0, 120)}`);
    }
    disk[name].text = await sha256(body);
    disk[name].data = dataHash(snapshot);
    st.at = new Date();
    if (same(store[name], snapshot)) {
      st.state = 'saved';
      dropLocal(name);
    }
  } catch (err) {
    st.state = 'error';
    st.msg = err.message === 'Failed to fetch' ? 'server not reachable' : err.message;
  }
  notify();
}

export async function flush() {
  if (!LOCAL) return; // online, drafts are already kept in this browser
  await Promise.all(Object.keys(status).filter((n) => status[n].state !== 'saved').map(write));
}

// Is the page served by server.py (which can save)?
export async function checkServer() {
  try {
    const r = await fetch('api/ping', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    server.ok = !!(j && j.server === 'isfw' && j.version >= 3);
  } catch { server.ok = false; }
  server.msg = server.ok ? '' : 'This page is not served by the current ISFW server, so edits cannot be saved to the files (they are kept in this browser). Close every server window and anything else using port 8000, then run start.bat.';
  notify();
}

// ---------- online dev version: GitHub ----------
const short = (sha) => (sha ? sha.slice(0, 7) : '?');
export const uncommitted = () => Object.keys(status).filter((n) => !same(store[n], disk[n].committed));

async function refreshCompare() {
  try { Object.assign(gh, await GH.compare()); } catch { gh.ahead = gh.behind = null; }
}

async function checkGitHub() {
  try {
    const u = await GH.api('/user');
    gh.user = u.login;
    const repo = await GH.api('');
    if (!repo.permissions || !repo.permissions.push) gh.error = `${u.login} cannot push to ${SITE.repo}`;
  } catch (err) {
    gh.error = err.status === 401 ? 'GitHub rejected the token (expired or revoked?). Sign out and sign in with a new one.' : `GitHub check failed: ${err.message}`;
  }
  await refreshCompare();
  notify();
}

// Sign in: check the token, keep it in this browser, reload.
export async function signIn(t) {
  t = t.trim();
  if (!t) throw new Error('paste a token first');
  let repo;
  try {
    await GH.api('/user', { auth: t });
    repo = await GH.api('', { auth: t });
  } catch (err) {
    throw new Error(err.status === 401 ? 'GitHub rejected this token' : err.status === 404 ? `this token cannot access ${SITE.repo}` : err.message);
  }
  if (!repo.permissions || !repo.permissions.push) throw new Error(`this token cannot push to ${SITE.repo}`);
  GH.token.set(t);
  location.reload();
}

export function signOut() {
  GH.token.clear();
  location.reload();
}

export async function commit(message) {
  const names = uncommitted();
  if (!names.length || gh.busy || !SIGNED_IN || gh.error) return;
  gh.busy = 'commit';
  gh.msg = '';
  notify();
  const files = {};
  const expected = {};
  const snap = {};
  for (const n of names) {
    snap[n] = clone(store[n]);
    files[GH.FILE_PATHS[n]] = SOURCE[n](snap[n]);
    expected[GH.FILE_PATHS[n]] = disk[n].blob;
  }
  const msg = message.trim() || `dev: update ${names.map((n) => `${n}.js`).join(', ')}`;
  try {
    const sha = await GH.commitFiles(files, expected, msg);
    for (const n of names) {
      disk[n].committed = snap[n];
      disk[n].blob = await GH.blobSha(files[GH.FILE_PATHS[n]]);
      disk[n].data = dataHash(snap[n]);
      if (same(store[n], snap[n])) { status[n].state = 'saved'; dropLocal(n); } else keepLocal(n);
      status[n].at = new Date();
    }
    gh.head = sha;
    gh.msg = `committed ${short(sha)} to ${SITE.branch}`;
    await refreshCompare();
  } catch (err) {
    gh.msg = `<span class="err">not committed: ${err.message}${err.status === 409 ? '. Reload the page to get the newer version (your edits are kept aside)' : ''}</span>`;
  }
  gh.busy = '';
  notify();
}

export async function releaseToPlay() {
  if (gh.busy || !SIGNED_IN || gh.error) return;
  if (uncommitted().length) { gh.msg = '<span class="warn">commit or undo your changes before releasing</span>'; notify(); return; }
  gh.busy = 'release';
  gh.msg = '';
  notify();
  try {
    const r = await GH.release();
    gh.msg = `released ${short(r.sha)} to playable (${r.how}); the playable site updates in about a minute`;
    await refreshCompare();
  } catch (err) {
    gh.msg = `<span class="err">not released: ${err.message}</span>`;
  }
  gh.busy = '';
  notify();
}

export function initStore() {
  if (READONLY) return;
  if (!LOCAL) {
    for (const name of Object.keys(status)) status[name].state = same(store[name], disk[name].committed) ? 'saved' : 'uncommitted';
    window.addEventListener('beforeunload', (ev) => { if (uncommitted().length) ev.preventDefault(); });
    checkGitHub();
    return;
  }
  // Flush pending saves when the page is closed or reloaded.
  window.addEventListener('pagehide', () => {
    for (const name of Object.keys(status)) {
      if (status[name].state === 'saved') continue;
      if (!disk[name].text || disk[name].stale) continue;
      navigator.sendBeacon(`api/${name}?base=${disk[name].text}`, new Blob([SOURCE[name](store[name])], { type: 'text/javascript' }));
    }
  });
  checkServer();
  // Edits left from a failed save: try again now.
  for (const name of Object.keys(status)) {
    if (!same(store[name], FILES[name])) { status[name].state = 'pending'; write(name); }
  }
}

export function statusText(name) {
  const st = status[name];
  const file = `${name}.js`;
  if (READONLY) return `read-only copy of ${file} · sign in with GitHub above to edit`;
  const parts = [];
  if (!LOCAL) parts.push(st.state === 'saved' ? `${file} matches the ${SITE.branch} branch` : `<span class="warn">${file} has uncommitted changes (kept in this browser)</span>`);
  else if (st.state === 'saved') parts.push(st.at ? `saved to ${file} ${st.at.toTimeString().slice(0, 8)}` : `${file} up to date`);
  else if (st.state === 'pending') parts.push('saving…');
  else parts.push(`<span class="err">not saved to ${file}: ${st.msg}. Edits are kept in this browser and saved with the next change.</span>`);
  parts.push(appliedToGame() ? 'game is running this version' : '<span class="warn">not applied to the game yet</span>');
  return parts.join(' · ');
}

export const appliedToGame = () => Object.keys(store).every((n) => same(store[n], RUNNING[n]));
