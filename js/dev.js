// Dev screens (dev/enemies, dev/skills). Both edit the same in-memory copies
// of the enemy and skill lists (dev/store.js): saved to their files on every
// change locally, committed to GitHub from the online dev version.
import { STALE_DRAFTS } from './data.js';
import { SITE } from './site.js';
import {
  initStore, onChange, flush, server, READONLY, SIGNED_IN, gh, uncommitted, commit, releaseToPlay, signIn, signOut,
} from './dev/store.js';
import { initEnemies, renderEnemies } from './dev/enemies.js';
import { initSkills, renderSkills } from './dev/skills.js';
import { confirmed } from './dev/ui.js';

const $ = (sel) => document.querySelector(sel);
let current = null;

function renderBanner() {
  const b = $('#dev-banner');
  const msgs = [];
  if (server.ok === false) msgs.push(server.msg);
  if (gh.error) msgs.push(gh.error);
  if (STALE_DRAFTS.length) msgs.push(`Unsaved dev edits to ${[...new Set(STALE_DRAFTS)].join(' and ')} were made on an older version of the file, so the file was used instead. They are kept aside in this browser (localStorage isfw${SITE.mode === 'dev' ? '.devsite' : ''}.dev.stale.*).`);
  b.hidden = !current || !msgs.length;
  b.innerHTML = msgs.map((m) => `<div>${m}</div>`).join('');
}

// ---------- GitHub bar (online dev version) ----------
// Built once; renderBar only updates texts and buttons, so the inputs keep
// their focus and contents.
function buildBar() {
  const bar = $('#gh-bar');
  if (SITE.mode !== 'dev') return;
  bar.innerHTML = SIGNED_IN
    ? `<b>dev version</b> <span id="gh-who" class="muted"></span>
       <input type="text" id="gh-message" placeholder="commit message (optional)">
       <button id="gh-commit"></button>
       <span id="gh-rel" class="muted"></span>
       <button id="gh-release">release to playable</button>
       <button id="gh-signout" class="quiet">sign out</button>
       <div id="gh-msg"></div>`
    : `<b>dev version</b> <span class="muted">· read-only · to edit, sign in with a GitHub token (see README)</span>
       <input type="password" id="gh-token" placeholder="GitHub token" autocomplete="off">
       <button id="gh-signin">sign in</button>
       <div id="gh-msg"></div>`;
  if (!SIGNED_IN) {
    const go = async () => {
      $('#gh-msg').textContent = 'checking…';
      try { await signIn($('#gh-token').value); } catch (err) { $('#gh-msg').innerHTML = `<span class="err">${err.message}</span>`; }
    };
    $('#gh-signin').addEventListener('click', go);
    $('#gh-token').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
    return;
  }
  $('#gh-commit').addEventListener('click', async () => {
    await commit($('#gh-message').value);
    if (!uncommitted().length) $('#gh-message').value = '';
  });
  $('#gh-release').addEventListener('click', (ev) => {
    if (confirmed(ev.currentTarget, 'click again to release')) releaseToPlay();
  });
  $('#gh-signout').addEventListener('click', () => {
    if (!uncommitted().length || confirmed($('#gh-signout'), 'uncommitted changes stay in this browser · click again')) signOut();
  });
  // Edits happen in the page lists: keep the commit button current.
  for (const root of document.querySelectorAll('.dev-main')) {
    for (const ev of ['input', 'change', 'click']) root.addEventListener(ev, () => setTimeout(renderBar));
  }
}

function renderBar() {
  const bar = $('#gh-bar');
  bar.hidden = SITE.mode !== 'dev' || !current;
  if (bar.hidden || !SIGNED_IN) return;
  const names = uncommitted();
  $('#gh-who').textContent = `· ${gh.user ? `signed in as ${gh.user}` : 'checking GitHub…'} · ${SITE.branch} at ${gh.head ? gh.head.slice(0, 7) : '?'} ·`;
  const c = $('#gh-commit');
  c.textContent = gh.busy === 'commit' ? 'committing…' : names.length ? `commit ${names.map((n) => `${n}.js`).join(' + ')}` : 'nothing to commit';
  c.disabled = !names.length || !!gh.busy || !!gh.error;
  $('#gh-rel').textContent = gh.ahead == null ? '' : gh.ahead ? `· playable is ${gh.ahead} commit${gh.ahead > 1 ? 's' : ''} behind ${SITE.branch}` : '· playable is up to date';
  const r = $('#gh-release');
  if (!r.classList.contains('armed')) r.textContent = gh.busy === 'release' ? 'releasing…' : 'release to playable';
  r.disabled = !!gh.busy || !!gh.error || !gh.ahead || names.length > 0;
  r.title = names.length ? 'commit your changes first' : '';
  $('#gh-msg').innerHTML = gh.msg;
}

// Read-only: disable every editing control, also after the lists
// re-render. Expand/collapse and the preview panel keep working.
function lockEditing() {
  const lock = () => {
    for (const el of document.querySelectorAll('.dev-main input, .dev-main select, .dev-main textarea, .dev-main button[data-act], #de-new, #ds-new, #de-apply, #ds-apply')) el.disabled = true;
  };
  for (const root of document.querySelectorAll('.dev-main')) new MutationObserver(lock).observe(root, { childList: true, subtree: true });
  lock();
}

export function showDev(view) {
  current = view;
  if (view === 'dev/enemies') renderEnemies();
  else if (view === 'dev/skills') renderSkills();
  renderBanner();
  renderBar();
}

export function initDev({ getState } = {}) {
  initEnemies({ getState });
  initSkills();
  if (READONLY) lockEditing();
  buildBar();
  for (const id of ['#de-apply', '#ds-apply']) {
    $(id).addEventListener('click', async () => { await flush(); location.reload(); });
  }
  // A save, commit or check finished: refresh the visible page.
  onChange(() => { if (current) showDev(current); });
  initStore();
}
