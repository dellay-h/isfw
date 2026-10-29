// dev/run: edit the current run of this browser's game save directly – kills
// per enemy this run, their current max kills, the prestige points, the
// player's level and the prestige shop upgrades (bought or not). Not
// tied to the data files, so it stays editable in the read-only dev version.
import * as G from '../game.js';
import { esc } from './ui.js';

const $ = (sel) => document.querySelector(sel);
let getState = () => null;
let save = () => {};
let visible = false;

// challenges first, then by tier, keeping the file order (like the monitor)
const tierKey = (e) => (G.rankOf(e) === 'challenge' ? -1 : e.tier || 0);
// the game's enemies (enemies in development are not in the game)
const enemies = () => G.gameEnemies().map((e, i) => [e, i])
  .sort((a, b) => tierKey(a[0]) - tierKey(b[0]) || a[1] - b[1]).map(([e]) => e);

const numIn = (attrs, v, extra = '') => `<input type="number" step="1" ${attrs} value="${esc(v)}" ${extra}>`;

export function renderRun() {
  const s = getState();
  if (!s) return;
  const rows = enemies().map((e) => {
    const st = G.limitState(s, e);
    const fixed = G.isFixed(e);
    const hidden = !G.enemyRevealed(s, e);
    const locked = !G.isUnlocked(s, e);
    const notes = [hidden ? 'hidden' : '', locked ? 'locked' : ''].filter(Boolean).join(', ');
    return `<tr data-id="${esc(e.id)}"${hidden ? ' class="muted"' : ''}>
      <td>${esc(e.id)}</td>
      <td class="num">${e.tier || 0}</td>
      <td>${esc(e.name)} <span class="muted">${G.rankOf(e)}${notes ? ` · ${notes}` : ''}</span></td>
      <td>${numIn(`data-run="kills" min="0" max="${st.lim}"`, s.kills[e.id] || 0)} <span class="muted">/ <span data-f="lim">${st.lim}</span></span></td>
      <td>${fixed ? `<span class="muted">${st.lim} (fixed)</span>` : numIn(`data-run="max" min="1" max="${st.cap}"`, st.lim)}</td>
      <td class="muted">${e.limit}${fixed ? '' : ` · cap ${st.cap}`}</td>
      <td>${fixed ? '' : `<label><input type="checkbox" data-run="shrink" ${s.prestige.capped[e.id] ? 'checked' : ''}> shrinking</label>`}</td>
    </tr>`;
  }).join('');
  $('#dr-points').value = s.prestige.points;
  $('#dr-level').value = s.level;
  $('#dr-xp').value = Math.floor(s.xp);
  $('#dr-xpnext').textContent = `/ ${G.xpToNext(s)}`;
  $('#dr-info').textContent = `prestige ${s.prestige.count}`;
  $('#dr-list tbody').innerHTML = rows;
  // prestige shop: set any level, nothing spent or refunded
  $('#dr-shop tbody').innerHTML = G.shopItems().map((x) => `<tr data-shop="${esc(x.id)}">
      <td>${esc(x.id)}</td><td>${esc(x.name)}</td>
      <td>${numIn(`data-run="shop" min="0" max="${x.max}"`, G.shopLevel(s, x.id))} <span class="muted">/ ${x.max}</span></td>
    </tr>`).join('');
}

// Keep the numbers current while the game runs (fights add kills), without
// touching the field being typed in.
function refresh() {
  const s = getState();
  if (!visible || !s) return;
  const pts = $('#dr-points');
  if (document.activeElement !== pts && Number(pts.value) !== s.prestige.points) pts.value = s.prestige.points;
  for (const [sel, v] of [['#dr-level', s.level], ['#dr-xp', Math.floor(s.xp)]]) {
    const el = $(sel);
    if (document.activeElement !== el && Number(el.value) !== v) el.value = v;
  }
  const nx = `/ ${G.xpToNext(s)}`;
  if ($('#dr-xpnext').textContent !== nx) $('#dr-xpnext').textContent = nx;
  for (const tr of document.querySelectorAll('#dr-list tbody tr')) {
    const e = G.enemyDef(tr.dataset.id);
    if (!e) continue;
    const st = G.limitState(s, e);
    const k = tr.querySelector('[data-run=kills]');
    if (k && document.activeElement !== k && Number(k.value) !== (s.kills[e.id] || 0)) k.value = s.kills[e.id] || 0;
    if (k) k.max = st.lim;
    const lim = tr.querySelector('[data-f=lim]');
    if (lim && lim.textContent !== String(st.lim)) lim.textContent = st.lim;
  }
}

function onChange(ev) {
  const s = getState();
  const el = ev.target;
  if (!s) return;
  if (el.id === 'dr-points') {
    G.devSetPoints(s, el.value);
  } else if (el.id === 'dr-level') {
    G.devSetLevel(s, el.value);
  } else if (el.id === 'dr-xp') {
    G.devSetLevel(s, s.level, el.value);
  } else if (el.dataset.run === 'shop') {
    G.devSetShop(s, el.closest('tr[data-shop]').dataset.shop, el.value);
  } else {
    const tr = el.closest('tr[data-id]');
    if (!tr) return;
    const id = tr.dataset.id;
    if (el.dataset.run === 'kills') G.devSetKills(s, id, el.value);
    else if (el.dataset.run === 'max') G.devSetMaxKills(s, id, el.value);
    else if (el.dataset.run === 'shrink') G.devSetMaxKills(s, id, G.limitOf(s, G.enemyDef(id)), el.checked);
    else return;
  }
  save();
  renderRun();
}

export function showRun(on) {
  visible = on;
  if (on) renderRun();
}

export function initRun(opts = {}) {
  if (opts.getState) getState = opts.getState;
  if (opts.save) save = opts.save;
  $('#view-dev-run').addEventListener('change', onChange);
  setInterval(refresh, 500);
}
