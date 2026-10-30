// dev/shop: create and edit prestige and essence shop items (js/shop.js).
import { ATTRS, RANKS } from '../data.js';
import { store, persist, statusText, appliedToGame } from './store.js';
import {
  esc, num, nextId, open, saveOpen, renameOpen,
  numInput, textInput, boolInput, select, btn, xBtn, readInput, confirmed, wire,
} from './ui.js';

const $ = (sel) => document.querySelector(sel);
const SH = () => store.shop;
const E = () => store.enemies;
const K = () => store.skills;

const SHOPS = [['prestige', 'prestige'], ['essence', 'essence']];
const STATS = ATTRS.map((a) => [a.key, a.label]);
const KINDS = [['flat', 'flat (adds)'], ['pct', '% (0.01 = 1%)']];
const GROW = Object.keys(RANKS).filter((r) => !RANKS[r].fixed); // ranks whose max kills can grow
const group = (x) => (x.retired ? 'retired' : x.shop);
const GROUPS = [['prestige', 'prestige shop'], ['essence', 'essence shop'], ['retired', 'retired (out of the game; saves that bought them are refunded)']];

// What a level can give besides attribute bonuses. prestige: the game only
// reads it on prestige shop items.
const FEATURES = {
  slots: { label: 'skill slots', prestige: true, make: () => 1 },
  startKills: { label: 'start kills', prestige: true, make: () => ({ enemy: E()[0]?.id || '', n: 1 }) },
  limitGrowth: { label: 'max kills growth', prestige: true, make: () => ['common'] },
  minKills: { label: 'max kills at least', prestige: true, make: () => ({ common: 100 }) },
  requires: { label: 'requires item', prestige: true, make: (x) => SH().find((y) => y.shop === 'prestige' && y.id !== x.id)?.id || '' },
  essence: { label: 'unlocks essence', prestige: true, make: () => true },
  free: { label: 'free skills', prestige: true, make: () => 1 },
  freeExclude: { label: 'free skills never pick', prestige: true, make: () => [] },
  autoEquip: { label: 'auto-equip', prestige: true, make: () => true },
};

// ---------- validation ----------
function problems() {
  const per = new Map(SH().map((x) => [x, []]));
  const ids = SH().map((x) => x.id);
  const enemyIds = new Set(E().map((e) => e.id));
  const skillIds = new Set(K().map((k) => k.id));
  for (const x of SH()) {
    const p = per.get(x);
    if (!x.id) p.push('missing id');
    else if (ids.filter((y) => y === x.id).length > 1) p.push(`id ${x.id} is used more than once`);
    if (!['prestige', 'essence'].includes(x.shop)) p.push('pick a shop');
    if (x.shop === 'prestige' && !(x.max >= 1)) p.push('max level must be 1 or more');
    if (!x.cost || !Number.isFinite(x.cost.base)) p.push('missing cost');
    for (const [j, f] of (x.effects || []).entries()) {
      if (!ATTRS.some((a) => a.key === f.stat)) p.push(`bonus ${j + 1}: unknown attribute ${f.stat}`);
      if (!['flat', 'pct'].includes(f.kind)) p.push(`bonus ${j + 1}: kind must be flat or %`);
    }
    if (x.shop === 'essence') for (const k of Object.keys(FEATURES)) if (x[k] !== undefined && FEATURES[k].prestige) p.push(`${FEATURES[k].label} only works on prestige items`);
    if (x.requires !== undefined) {
      const r = SH().find((y) => y.id === x.requires);
      if (!r) p.push(`requires ${x.requires || '(none)'}: no such item`);
      else if (r === x) p.push('requires itself');
      else if (r.retired) p.push(`requires ${r.id}, which is retired`);
      else if (r.shop !== 'prestige') p.push(`requires ${r.id}, not a prestige item`);
    }
    if (x.startKills && !enemyIds.has(x.startKills.enemy)) p.push(`start kills: unknown enemy ${x.startKills.enemy || '(none)'}`);
    for (const id of x.freeExclude || []) if (!skillIds.has(id)) p.push(`free skills never pick: unknown skill ${id}`);
    if (x.limitGrowth && !x.limitGrowth.length) p.push('max kills growth: no rank ticked');
  }
  return per;
}

// ---------- rendering ----------
const costAt = (x, lv) => (x.cost?.base || 0) + (x.cost?.step || 0) * lv;
function costLine(x) {
  const unit = x.shop === 'essence' ? ' essence' : ' pt';
  const n = x.shop === 'prestige' ? Math.max(0, Math.floor(x.max || 0)) : 5;
  const shown = Math.min(n, 5);
  const each = Array.from({ length: shown }, (_, l) => `lv${l + 1} ${num(costAt(x, l))}`).join(' · ');
  const more = x.shop === 'essence' ? ' … (no cap)' : n > shown ? ' …' : '';
  let total = '';
  if (x.shop === 'prestige' && n > 1) {
    let t = 0;
    for (let l = 0; l < n; l++) t += costAt(x, l);
    total = ` · all ${n} levels ${num(t)}${unit}`;
  }
  return `<div class="calc">cost: ${each}${more}${total}${shown === 1 ? unit : ''}</div>`;
}

const fxText = (f) => `${ATTRS.find((a) => a.key === f.stat)?.label || f.stat} +${f.kind === 'pct' ? `${num(f.v * 100)}%` : num(f.v)}`;
function summary(x) {
  const out = (x.effects || []).map(fxText);
  if (x.slots) out.push(`slots +${x.slots}`);
  if (x.startKills) out.push(`start kills ${x.startKills.enemy} +${x.startKills.n}`);
  if (x.limitGrowth) out.push(`growth ${x.limitGrowth.join('/')}`);
  if (x.minKills) out.push(Object.entries(x.minKills).map(([r, n]) => `${r} ≥ ${n}`).join(', '));
  if (x.requires) out.push(`needs ${x.requires}`);
  if (x.essence) out.push('unlocks essence');
  if (x.free) out.push(`free skill +${x.free}`);
  if (x.autoEquip) out.push('auto-equip');
  return out.join(', ');
}

function featureRow(x, i, k) {
  const del = xBtn('feat-del', `data-i="${i}" data-k="${k}"`);
  let input = '';
  if (k === 'slots' || k === 'free') input = numInput(i, k, x[k], { int: true });
  else if (k === 'startKills') {
    input = `${select(`data-i="${i}" data-p="startKills.enemy" data-t="text"`, E().map((e) => [e.id, `${e.id} ${e.name}`]).concat(E().some((e) => e.id === x.startKills.enemy) ? [] : [[x.startKills.enemy, `${x.startKills.enemy || '(none)'} (unknown)`]]), x.startKills.enemy)}
      <span class="muted">kills per level</span> ${numInput(i, 'startKills.n', x.startKills.n, { int: true, cls: 'w-v' })}`;
  } else if (k === 'limitGrowth') {
    input = GROW.map((r) => `<label><input type="checkbox" data-i="${i}" data-p="limitGrowth" data-t="rank-list" data-rank="${r}" ${x.limitGrowth.includes(r) ? 'checked' : ''}> ${r}</label>`).join(' ');
  } else if (k === 'minKills') {
    input = GROW.map((r) => `<label class="muted">${r}</label> <input type="number" step="1" class="w-v" data-i="${i}" data-p="minKills" data-t="min-kills" data-rank="${r}" value="${esc(x.minKills[r] ?? '')}" placeholder="—">`).join(' ');
  } else if (k === 'requires') {
    const opts = SH().filter((y) => y.shop === 'prestige' && y.id !== x.id && !y.retired).map((y) => [y.id, `${y.id} ${y.name}`]);
    if (!opts.some(([id]) => id === x.requires)) opts.push([x.requires, `${x.requires || '(none)'} (not available)`]);
    input = select(`data-i="${i}" data-p="requires" data-t="text"`, opts, x.requires);
  } else if (k === 'freeExclude') {
    input = `<input type="text" class="w-name" data-i="${i}" data-p="freeExclude" data-t="id-list" value="${esc((x.freeExclude || []).join(', '))}" placeholder="skill ids, e.g. S01, S02">`;
  } else input = '<span class="muted">on</span>';
  return `<tr><td class="lbl">${FEATURES[k].label}</td><td>${input}</td><td>${del}</td></tr>`;
}

function itemBlock(x, i, warns, first, last) {
  const key = `sh:${x.id}`;
  const fx = x.effects || [];
  const feats = Object.keys(FEATURES).filter((k) => x[k] !== undefined);
  const missing = Object.keys(FEATURES).filter((k) => x[k] === undefined && (x.shop === 'prestige' || !FEATURES[k].prestige));
  const head = [x.shop === 'prestige' ? `max ${x.max ?? '?'}` : 'no cap', `cost ${num(x.cost?.base || 0)}${x.cost?.step ? ` +${num(x.cost.step)}/lv` : ''}`];
  const what = summary(x);
  return `<details class="en${x.retired ? ' retired' : ''}" data-key="${esc(key)}"${open.has(key) ? ' open' : ''} data-item="${esc(x.id)}">
    <summary>${esc(x.id)} ${esc(x.name)}${x.retired ? ' <span class="muted">retired</span>' : ''} <span class="muted">· ${head.join(' · ')}${what ? ` · ${esc(what)}` : ''}</span>${warns.length ? ` <span class="warn">· ${warns.length} issue${warns.length > 1 ? 's' : ''}</span>` : ''}</summary>
    <div class="body">
      <div class="ident">
        <label>id</label>${textInput(i, 'id', x.id, 'w-id')}
        <label>name</label>${textInput(i, 'name', x.name, 'w-name')}
        <label>shop</label>${select(`data-i="${i}" data-p="shop" data-t="text"`, SHOPS, x.shop)}
        <label title="out of the game; saves that bought it get the cost back">${boolInput(i, 'retired', x.retired)}retired</label>
        <span class="spacer"></span>
        ${btn('↑', 'it-up', `data-i="${i}" ${first ? 'disabled' : ''}`, 'quiet')}
        ${btn('↓', 'it-down', `data-i="${i}" ${last ? 'disabled' : ''}`, 'quiet')}
        ${btn('duplicate', 'it-dup', `data-i="${i}"`, 'quiet')}
        ${btn('delete', 'it-del', `data-i="${i}"`, 'quiet')}
      </div>
      ${warns.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}
      <table class="dev-table">
        ${x.shop === 'prestige' ? `<tr><td class="lbl">max level</td><td>${numInput(i, 'max', x.max, { int: true })}</td></tr>` : ''}
        <tr><td class="lbl">cost (first level)</td><td>${numInput(i, 'cost.base', x.cost?.base)}</td></tr>
        <tr><td class="lbl">cost + per level bought</td><td>${numInput(i, 'cost.step', x.cost?.step)}</td></tr>
      </table>
      ${costLine(x)}
      <div class="act">
        <div class="ident"><b>attribute bonuses per level</b></div>
        <table class="dev-table">${fx.map((f, j) => `<tr>
          <td>${select(`data-i="${i}" data-p="effects.${j}.stat" data-t="text"`, STATS.concat(STATS.some(([s]) => s === f.stat) ? [] : [[f.stat, `${f.stat} (unknown)`]]), f.stat)}</td>
          <td>${select(`data-i="${i}" data-p="effects.${j}.kind" data-t="text"`, KINDS, f.kind)}</td>
          <td>${numInput(i, `effects.${j}.v`, f.v, { cls: 'w-v' })}</td>
          <td class="muted">${esc(fxText(f))}</td>
          <td>${xBtn('fx-del', `data-i="${i}" data-j="${j}"`)}</td></tr>`).join('')}</table>
        <div class="addrow">${btn('+ bonus', 'fx-add', `data-i="${i}"`)}</div>
      </div>
      <div class="act">
        <div class="ident"><b>other effects per level</b></div>
        ${feats.length ? `<table class="dev-table">${feats.map((k) => featureRow(x, i, k)).join('')}</table>` : '<div class="muted">none</div>'}
        ${missing.length ? `<div class="addrow">${select(`data-act="feat-add" data-i="${i}"`, [['', '+ effect'], ...missing.map((k) => [k, FEATURES[k].label])], '')}</div>` : ''}
      </div>
    </div>
  </details>`;
}

export function renderShop() {
  const per = problems();
  const html = [];
  for (const [g, title] of GROUPS) {
    const idx = SH().map((x, i) => [x, i]).filter(([x]) => group(x) === g);
    if (!idx.length && g === 'retired') continue;
    html.push(`<h3 class="dp-shop">${title} <span class="muted">(${idx.length})</span></h3>`);
    idx.forEach(([x, i], n) => html.push(itemBlock(x, i, per.get(x), n === 0, n === idx.length - 1)));
  }
  $('#dp-list').innerHTML = html.join('');
  $('#dp-count').textContent = `(${SH().length})`;
  renderStatus();
}

function renderStatus() {
  $('#dp-status').innerHTML = statusText('shop');
  $('#dp-apply').disabled = appliedToGame();
  if (msgUntil < Date.now()) $('#dp-msg').textContent = '';
}
let msgUntil = 0;
function flash(text) {
  $('#dp-msg').textContent = text;
  msgUntil = Date.now() + 5000;
  setTimeout(renderStatus, 5100);
}

// ---------- editing ----------
// Move within the item's own group (prestige / essence / retired).
function moveInGroup(i, d) {
  const g = group(SH()[i]);
  for (let j = i + d; j >= 0 && j < SH().length; j += d) {
    if (group(SH()[j]) === g) { const [a] = SH().splice(i, 1); SH().splice(j, 0, a); return; }
  }
}

function onInput(el) {
  const x = SH()[Number(el.dataset.i)];
  const path = el.dataset.p;
  const t = el.dataset.t;
  if (path === 'id') {
    const old = x.id;
    x.id = el.value.trim();
    renameOpen(`sh:${old}`, `sh:${x.id}`);
    for (const y of SH()) if (y.requires === old) y.requires = x.id;
  } else if (path === 'retired') {
    if (el.checked) x.retired = true; else delete x.retired;
  } else if (path === 'shop') {
    x.shop = el.value;
    if (x.shop === 'prestige' && x.max === undefined) x.max = 1;
    if (x.shop === 'essence') delete x.max;
  } else if (t === 'rank-list') {
    const set = new Set(x.limitGrowth);
    if (el.checked) set.add(el.dataset.rank); else set.delete(el.dataset.rank);
    x.limitGrowth = GROW.filter((r) => set.has(r));
  } else if (t === 'min-kills') {
    const v = parseInt(el.value, 10);
    if (v > 0) x.minKills[el.dataset.rank] = v; else delete x.minKills[el.dataset.rank];
  } else if (t === 'id-list') {
    x.freeExclude = el.value.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  } else {
    readInput(x, el);
  }
  persist('shop');
}

function onAction(el) {
  const act = el.dataset.act;
  const i = Number(el.dataset.i);
  const x = SH()[i];
  switch (act) {
    case 'fx-add': (x.effects ??= []).push({ stat: 'damage', kind: x.shop === 'essence' ? 'pct' : 'flat', v: x.shop === 'essence' ? 0.01 : 1 }); break;
    case 'fx-del':
      x.effects.splice(Number(el.dataset.j), 1);
      if (!x.effects.length) delete x.effects;
      break;
    case 'feat-add': if (!el.value) return; x[el.value] = FEATURES[el.value].make(x); break;
    case 'feat-del': delete x[el.dataset.k]; break;
    case 'it-up': moveInGroup(i, -1); break;
    case 'it-down': moveInGroup(i, 1); break;
    case 'it-dup': {
      const c = structuredClone(x);
      c.id = nextId(SH(), x.shop === 'essence' ? 'N' : 'P', 2);
      c.name = `${x.name} copy`;
      SH().splice(i + 1, 0, c);
      open.add(`sh:${c.id}`);
      saveOpen();
      break;
    }
    case 'it-del': {
      const users = SH().filter((y) => y.requires === x.id).map((y) => y.id);
      if (users.length) { flash(`${x.id} is required by ${users.join(', ')}; change those first.`); return; }
      if (!confirmed(el, 'delete? (retire refunds saves instead)')) return;
      SH().splice(i, 1);
      break;
    }
    default: return;
  }
  persist('shop');
  renderShop();
}

function newItem(shop) {
  const x = shop === 'essence'
    ? { id: nextId(SH(), 'N', 2), shop, name: 'new item', cost: { base: 100, step: 100 }, effects: [{ stat: 'damage', kind: 'pct', v: 0.01 }] }
    : { id: nextId(SH(), 'P', 2), shop, name: 'new item', max: 1, cost: { base: 1, step: 0 } };
  // after the last item of its shop (retired ones aside)
  let at = SH().length;
  for (let j = SH().length - 1; j >= 0; j--) if (group(SH()[j]) === shop) { at = j + 1; break; }
  SH().splice(at, 0, x);
  open.add(`sh:${x.id}`);
  saveOpen();
  persist('shop');
  renderShop();
  document.querySelector(`#dp-list details[data-item="${CSS.escape(x.id)}"]`)?.scrollIntoView({ block: 'nearest' });
}

export function initShop() {
  wire($('#dp-list'), { input: onInput, action: onAction, rerender: renderShop, status: renderStatus });
  $('#dp-new').addEventListener('click', () => newItem('prestige'));
  $('#dp-new-ess').addEventListener('click', () => newItem('essence'));
  const setAll = (on) => {
    for (const x of SH()) on ? open.add(`sh:${x.id}`) : open.delete(`sh:${x.id}`);
    saveOpen();
    renderShop();
  };
  $('#dp-expand').addEventListener('click', () => setAll(true));
  $('#dp-collapse').addEventListener('click', () => setAll(false));
}
