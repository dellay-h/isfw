// Dev screens (dev/enemies, dev/skills). Both edit the same in-memory copies
// of the enemy and skill lists (dev/store.js), saved to their files on every
// change.
import { STALE_DRAFTS } from './data.js';
import { initStore, onChange, flush, server, READONLY } from './dev/store.js';
import { initEnemies, renderEnemies } from './dev/enemies.js';
import { initSkills, renderSkills } from './dev/skills.js';

const $ = (sel) => document.querySelector(sel);
let current = null;

function renderBanner() {
  const b = $('#dev-banner');
  const msgs = [];
  if (server.ok === false) msgs.push(server.msg);
  if (STALE_DRAFTS.length) msgs.push(`Unsaved dev edits to ${[...new Set(STALE_DRAFTS)].join(' and ')} were made on an older version of the file, so the file was used instead. They are kept aside in this browser (localStorage isfw.dev.stale.*).`);
  b.hidden = !current || !msgs.length;
  b.innerHTML = msgs.map((m) => `<div>${m}</div>`).join('');
}

export function showDev(view) {
  current = view;
  if (view === 'dev/enemies') renderEnemies();
  else if (view === 'dev/skills') renderSkills();
  renderBanner();
}

// Read-only (online copy): disable every editing control, also after the
// lists re-render. Expand/collapse and the preview panel keep working.
function lockEditing() {
  const lock = () => {
    for (const el of document.querySelectorAll('.dev-main input, .dev-main select, .dev-main textarea, .dev-main button[data-act], #de-new, #ds-new, #de-apply, #ds-apply')) el.disabled = true;
  };
  for (const root of document.querySelectorAll('.dev-main')) new MutationObserver(lock).observe(root, { childList: true, subtree: true });
  lock();
}

export function initDev({ getState } = {}) {
  initEnemies({ getState });
  initSkills();
  if (READONLY) lockEditing();
  for (const id of ['#de-apply', '#ds-apply']) {
    $(id).addEventListener('click', async () => { await flush(); location.reload(); });
  }
  // A save finished (or failed): refresh the visible page's status.
  onChange(() => { if (current) showDev(current); });
  initStore();
}
