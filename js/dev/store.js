// Edited copies of the enemy, skill, shop and power lists, shared by the dev pages.
//
// Dev version (SITE.mode 'dev'): read-only until signed in with a
// GitHub token. Signed in, edits are kept in this browser as drafts and go
// to the dev branch only when "commit" is pressed; "release to playable"
// moves the playable version (main) to the dev branch.
import { ENEMIES, SKILLS, SHOP, POWER, FILES, DRAFT_KEYS, FILE_HASH, REMOTE, dataHash } from '../data.js';
import { enemiesSource, skillsSource, shopSource, powerSource } from '../serialize.js';
import { SITE } from '../site.js';
import * as GH from '../github.js';

const clone = (x) => structuredClone(x);
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const store = { enemies: clone(ENEMIES), skills: clone(SKILLS), shop: clone(SHOP), power: clone(POWER) };
export const RUNNING = { enemies: ENEMIES, skills: SKILLS, shop: SHOP, power: POWER }; // what the game uses
const SOURCE = { enemies: enemiesSource, skills: skillsSource, shop: shopSource, power: powerSource };

export const SIGNED_IN = SITE.mode === 'dev' && !!GH.token.get();
// Without a token (or the playable version): nothing can be edited.
export const READONLY = !SIGNED_IN;

// Per file: 'saved' | 'uncommitted'
export const status = {
  enemies: { state: 'saved', at: null },
  skills: { state: 'saved', at: null },
  shop: { state: 'saved', at: null },
  power: { state: 'saved', at: null },
};

// Dev version, signed in.
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
//   blob: git blob id of the file on the dev branch
//   committed: the data in the file (what "uncommitted" compares to)
const disk = {
  enemies: { data: FILE_HASH.enemies, blob: REMOTE?.enemies?.sha ?? null, committed: FILES.enemies },
  skills: { data: FILE_HASH.skills, blob: REMOTE?.skills?.sha ?? null, committed: FILES.skills },
  shop: { data: FILE_HASH.shop, blob: REMOTE?.shop?.sha ?? null, committed: FILES.shop },
  power: { data: FILE_HASH.power, blob: REMOTE?.power?.sha ?? null, committed: FILES.power },
};
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
  const changed = !same(store[name], disk[name].committed);
  if (changed) keepLocal(name); else dropLocal(name);
  status[name].state = changed ? 'uncommitted' : 'saved';
}

// ---------- GitHub ----------
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
  for (const name of Object.keys(status)) status[name].state = same(store[name], disk[name].committed) ? 'saved' : 'uncommitted';
  window.addEventListener('beforeunload', (ev) => { if (uncommitted().length) ev.preventDefault(); });
  checkGitHub();
}

export function statusText(name) {
  const st = status[name];
  const file = `${name}.js`;
  if (READONLY) return `read-only copy of ${file} · sign in with GitHub above to edit`;
  const parts = [];
  parts.push(st.state === 'saved' ? `${file} matches the ${SITE.branch} branch` : `<span class="warn">${file} has uncommitted changes (kept in this browser)</span>`);
  parts.push(appliedToGame() ? 'game is running this version' : '<span class="warn">not applied to the game yet</span>');
  return parts.join(' · ');
}

export const appliedToGame = () => Object.keys(store).every((n) => same(store[n], RUNNING[n]));
