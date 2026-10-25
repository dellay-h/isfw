// Edited copies of the enemy and skill lists, saved to their files on every
// change through the ISFW server (server.py: POST /api/enemies, /api/skills).
// Until a save succeeds the edits are also kept in localStorage (data.js
// loads them), so nothing is lost if the server is unreachable.
import { ENEMIES, SKILLS, FILES, DRAFT_KEYS, FILE_HASH, dataHash } from '../data.js';
import { enemiesSource, skillsSource } from '../serialize.js';

const clone = (x) => structuredClone(x);
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export const store = { enemies: clone(ENEMIES), skills: clone(SKILLS) };
export const RUNNING = { enemies: ENEMIES, skills: SKILLS }; // what the game uses
const SOURCE = { enemies: enemiesSource, skills: skillsSource };
const SAVE_DELAY = 400; // ms after the last edit

// Per file: 'saved' | 'pending' | 'error'
export const status = {
  enemies: { state: 'saved', msg: '', at: null, timer: null },
  skills: { state: 'saved', msg: '', at: null, timer: null },
};
export const server = { ok: null, msg: '' }; // null = not checked yet

// What is on disk, as far as this page knows:
//   data: hash of the data (drafts record it, see data.js)
//   text: sha-256 of the file text (sent with saves; the server refuses a
//         save if the file changed since, e.g. edited elsewhere)
const disk = {
  enemies: { data: FILE_HASH.enemies, text: null },
  skills: { data: FILE_HASH.skills, text: null },
};
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ready = Promise.all(Object.keys(disk).map(async (name) => {
  try {
    const r = await fetch(`/js/${name}.js`, { cache: 'no-store' });
    const text = await r.text();
    // only trust it if it is the version this page loaded
    const m = await import(`../${name}.js?check=${Date.now()}`).catch(() => null);
    const data = m && (m.ENEMIES || m.SKILLS);
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

// Call after every edit of store[name].
export function persist(name) {
  keepLocal(name);
  const st = status[name];
  st.state = 'pending';
  clearTimeout(st.timer);
  st.timer = setTimeout(() => write(name), SAVE_DELAY);
}

export async function write(name) {
  const st = status[name];
  clearTimeout(st.timer);
  st.timer = null;
  const snapshot = clone(store[name]);
  try {
    await ready;
    if (disk[name].stale || !disk[name].text) throw new Error(`${name}.js changed on disk after this page loaded. Reload the page to get the new version (your edits here are kept aside)`);
    const body = SOURCE[name](snapshot);
    const r = await fetch(`/api/${name}?base=${disk[name].text}`, {
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
      try { localStorage.removeItem(DRAFT_KEYS[name]); } catch {}
    }
  } catch (err) {
    st.state = 'error';
    st.msg = err.message === 'Failed to fetch' ? 'server not reachable' : err.message;
  }
  notify();
}

export async function flush() {
  await Promise.all(Object.keys(status).filter((n) => status[n].state !== 'saved').map(write));
}

// Is the page served by server.py (which can save)?
export async function checkServer() {
  try {
    const r = await fetch('/api/ping', { cache: 'no-store' });
    const j = r.ok ? await r.json() : null;
    server.ok = !!(j && j.server === 'isfw' && j.version >= 3);
  } catch { server.ok = false; }
  server.msg = server.ok ? '' : 'This page is not served by the current ISFW server, so edits cannot be saved to the files (they are kept in this browser). Close every server window and anything else using port 8000, then run start.bat.';
  notify();
}

export function initStore() {
  // Flush pending saves when the page is closed or reloaded.
  window.addEventListener('pagehide', () => {
    for (const name of Object.keys(status)) {
      if (status[name].state === 'saved') continue;
      if (!disk[name].text || disk[name].stale) continue;
      navigator.sendBeacon(`/api/${name}?base=${disk[name].text}`, new Blob([SOURCE[name](store[name])], { type: 'text/javascript' }));
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
  const parts = [];
  if (st.state === 'saved') parts.push(st.at ? `saved to ${file} ${st.at.toTimeString().slice(0, 8)}` : `${file} up to date`);
  else if (st.state === 'pending') parts.push('saving…');
  else parts.push(`<span class="err">not saved to ${file}: ${st.msg}. Edits are kept in this browser and saved with the next change.</span>`);
  const inGame = same(store.enemies, RUNNING.enemies) && same(store.skills, RUNNING.skills);
  parts.push(inGame ? 'game is running this version' : '<span class="warn">not applied to the game yet</span>');
  return parts.join(' · ');
}

export const appliedToGame = () => same(store.enemies, RUNNING.enemies) && same(store.skills, RUNNING.skills);
