// dev/skills: create and edit skills (shared by the player and enemies).
import { MODS } from '../data.js';
import * as G from '../game.js';
import { store, persist, statusText, appliedToGame } from './store.js';
import {
  esc, num, getP, setP, delP, move, nextId, open, saveOpen, renameOpen,
  numInput, textInput, boolInput, select, btn, xBtn, field, readInput, confirmed, wire,
} from './ui.js';

const $ = (sel) => document.querySelector(sel);
const S = () => store.skills;
const E = () => store.enemies;

// Properties an attack/spell can have (paths inside the action).
const ACTION_PROPS = [
  { path: 'base', label: 'base hit', def: 1 },
  { path: 'scaling', label: 'power scaling', def: 1 },
  { path: 'time', label: 'interval (s)', def: 1 },
  { path: 'speedScaling', label: 'speed scaling', def: 1 },
  { path: 'pctMaxHp', label: '+ target max hp per hit (0.1 = 10%)', def: 0.1 },
  { path: 'hits', label: 'hits per use', def: 2, int: true },
  { path: 'cost', label: 'mana cost', def: 5 },
  { path: 'lifesteal', label: 'lifesteal (1 = 100%)', def: 0.5 },
  { path: 'countdown', label: 'show countdown (special)', def: true, bool: true },
  { path: 'dot.pctMaxHp', label: 'dot: target max hp/s (0.01 = 1%)', def: 0.01 },
  { path: 'dot.pctScaling', label: 'dot: + target max hp/s per power (0.001 = 0.1%)', def: 0.001 },
  { path: 'dot.base', label: 'dot: base/s', def: 1 },
  { path: 'dot.scaling', label: 'dot: power scaling', def: 0.2 },
  { path: 'dot.duration', label: 'dot: duration (s)', def: 4 },
  { path: 'shield.base', label: 'shield: base', def: 20 },
  { path: 'shield.scaling', label: 'shield: power scaling', def: 1 },
  { path: 'shield.duration', label: 'shield: duration (s)', def: 8 },
  { path: 'heal.pctMaxHp', label: 'heal: own max hp (0.1 = 10%)', def: 0.1 },
  { path: 'heal.base', label: 'heal: base', def: 10 },
  { path: 'heal.scaling', label: 'heal: power scaling', def: 1 },
];
const PARTS = {
  attack: { label: 'attack (dmg, aspd; on-hit, empower)', make: () => ({ type: 'physical', base: 1, time: 1 }) },
  attackPenalty: { label: 'attack penalty (player, with this many attacks or more)', make: () => ({ at: 3, mods: { damage: -0.1, attackSpeed: -0.1 } }) },
  spell: { label: 'spell (mag pwr, mag spd)', make: () => ({ type: 'magic', base: 1, time: 2 }) },
  onHit: { label: 'on-hit damage', make: () => ({ type: 'physical', base: 1 }) },
  empower: { label: 'empower (next attack)', make: () => ({ mult: 1, cooldown: 5 }) },
  mods: { label: 'attribute bonuses', make: () => ({ damageFlat: 1 }) },
  slots: { label: 'skill slots', make: () => 1 },
  rush: { label: 'rush (attack speed at fight start, decaying; enemies)', make: () => ({ attackSpeed: 3, duration: 4 }) },
  winHeal: { label: 'heal after each win (max hp fraction; player)', make: () => 0.05 },
  aura: { label: 'aura (damage/s to the opponent in fights)', make: () => ({ type: 'magic', base: 1 }) },
};
const SIMPLE = {
  onHit: [['base', 'base'], ['scaling', 'scaling (x dmg)']],
  empower: [['mult', 'bonus (1 = +100%)'], ['cooldown', 'cooldown (s)'], ['armorPen', 'armor pen']],
  rush: [['attackSpeed', 'aspd bonus at the start'], ['duration', 'falls to 0 over (s)']],
  aura: [['base', 'damage/s'], ['pctMaxHp', '+ own max hp/s (0.05 = 5%)']],
};

// Who uses / awards a skill.
function refs(id) {
  const awards = [];
  const users = [];
  for (const e of E()) {
    for (const u of e.skillRewards || []) if (u.skill === id) awards.push({ e, u });
    for (const u of e.skills || []) if (u.skill === id) users.push({ e, u });
  }
  // enemy profiles that give the skill to their enemies (power.js)
  for (const p of store.power.filter((x) => x.kind === 'profile')) {
    for (const u of p.skills || []) if (u.skill === id) users.push({ e: { id: `profile ${p.id}` }, u });
  }
  return { awards, users };
}
const atText = (u, e) => (u.at === 'first' ? 'first kill' : u.at === 'final' ? `final kill (${e.limit})` : `kill ${u.at}`);

// ---------- validation ----------
function problems() {
  const per = new Map(S().map((k) => [k, []]));
  const ids = S().map((k) => k.id);
  for (const k of S()) {
    const p = per.get(k);
    if (!k.id) p.push('missing id');
    else if (ids.filter((x) => x === k.id).length > 1) p.push(`id ${k.id} is used more than once`);
    if (!k.levels.length) p.push('no levels');
    k.levels.forEach((_, i) => {
      const m = G.mergeLevels(k.levels, i + 1);
      for (const kind of ['attack', 'spell']) if (m[kind] && !(m[kind].time > 0)) p.push(`lv${i + 1}: ${kind} needs an interval above 0`);
      for (const key of Object.keys(k.levels[i].mods || {})) if (!MODS[key]) p.push(`lv${i + 1}: unknown bonus ${key}`);
      for (const key of Object.keys(k.levels[i].attackPenalty?.mods || {})) if (!MODS[key]) p.push(`lv${i + 1}: unknown penalty ${key}`);
      if (k.levels[i].attackPenalty && !m.attack) p.push(`lv${i + 1}: attack penalty on a skill without an attack (never counts it)`);
      if (m.attackPenalty && !(m.attackPenalty.at > 0)) p.push(`lv${i + 1}: attack penalty needs a number of attacks above 0`);
    });
  }
  return per;
}

// ---------- rendering ----------
// Attribute bonus rows (keys in MODS) for the mods object at path, plus a
// "+ bonus" select. def: value of a newly added bonus.
function modsTable(i, path, mods = {}, def = 1, addLabel = '+ bonus') {
  const rows = Object.entries(mods).map(([key, v]) => `<tr>
      <td>${select(`data-i="${i}" data-p="${path}" data-t="mod-key" data-k="${esc(key)}"`, Object.entries(MODS).filter(([m]) => m === key || !(m in mods)).map(([m, d]) => [m, d.label]).concat(MODS[key] ? [] : [[key, `${key} (unknown)`]]), key)}</td>
      <td>${numInput(i, `${path}.${key}`, v)}</td>
      <td>${xBtn('prop-del', `data-i="${i}" data-p="${path}.${key}"`)}</td></tr>`).join('');
  const left = Object.keys(MODS).filter((m) => !(m in mods));
  return `<table class="dev-table">${rows}</table>
    ${left.length ? `<div class="addrow">${select(`data-act="mod-add" data-i="${i}" data-p="${path}" data-def="${def}"`, [['', addLabel], ...left.map((m) => [m, MODS[m].label])], '')}</div>` : ''}`;
}

function propRows(i, base, obj, props) {
  return props.filter((p) => getP(obj, p.path) !== undefined).map((p) => {
    const v = getP(obj, p.path);
    const input = p.bool ? boolInput(i, `${base}.${p.path}`, v) : numInput(i, `${base}.${p.path}`, v, { int: p.int });
    return `<tr><td class="lbl">${p.label}</td><td>${input}</td><td>${xBtn('prop-del', `data-i="${i}" data-p="${base}.${p.path}"`)}</td></tr>`;
  }).join('');
}

// Damage type select (physical: armor/block apply, lifesteal attribute;
// magic: ignores armor/block). Shows the default when the level sets none.
function typeRow(i, base, obj, kind) {
  return `<div class="addrow"><span class="muted">damage</span> ${select(`data-i="${i}" data-p="${base}.type" data-t="text"`, [['physical', 'physical (armor/block apply)'], ['magic', 'magic (ignores armor/block)']], G.damageType(obj, kind))}</div>`;
}

function partBlock(k, i, L, l, part) {
  const base = `levels.${l}.${part}`;
  let body = '';
  const typed = part === 'attack' || part === 'spell' || part === 'onHit' || part === 'aura';
  if (part === 'attack' || part === 'spell') {
    const a = L[part];
    const missing = ACTION_PROPS.filter((p) => getP(a, p.path) === undefined);
    body = `<table class="dev-table">${propRows(i, base, a, ACTION_PROPS)}</table>
      ${missing.length ? `<div class="addrow">${select(`data-act="prop-add" data-i="${i}" data-l="${l}" data-part="${part}"`, [['', '+ property'], ...missing.map((p) => [p.path, p.label])], '')}</div>` : ''}`;
  } else if (SIMPLE[part]) {
    const props = SIMPLE[part].map(([path, label]) => ({ path, label, def: 1 }));
    const missing = props.filter((p) => L[part][p.path] === undefined);
    body = `<table class="dev-table">${propRows(i, base, L[part], props)}</table>
      ${missing.length ? `<div class="addrow">${select(`data-act="prop-add" data-i="${i}" data-l="${l}" data-part="${part}"`, [['', '+ property'], ...missing.map((p) => [p.path, p.label])], '')}</div>` : ''}`;
  } else if (part === 'mods') {
    body = modsTable(i, base, L.mods);
  } else if (part === 'attackPenalty') {
    const p = L.attackPenalty;
    body = `<table class="dev-table"><tr><td class="lbl">active with this many attacks or more</td><td>${numInput(i, `${base}.at`, p.at, { int: true })}</td></tr></table>
      <div class="muted">penalties (negative bonuses, -0.1 = -10%):</div>
      ${modsTable(i, `${base}.mods`, p.mods, -0.1, '+ penalty')}`;
  } else if (part === 'slots') {
    body = `<table class="dev-table"><tr><td class="lbl">extra slots</td><td>${numInput(i, base, L.slots, { int: true })}</td></tr></table>`;
  } else if (part === 'winHeal') {
    body = `<table class="dev-table"><tr><td class="lbl">heals (0.05 = 5% max hp)</td><td>${numInput(i, base, L.winHeal)}</td></tr></table>`;
  }
  // later levels of an action inherit its type; only the level that adds it shows the select
  const merged = G.mergeLevels(k.levels, l);
  const typeSel = typed && !(merged[part] && merged[part].type) ? typeRow(i, base, L[part], part) : '';
  return `<div class="act">
    <div class="ident"><b>${PARTS[part]?.label || part}</b><span class="spacer"></span>${xBtn('part-del', `data-i="${i}" data-l="${l}" data-part="${part}"`)}</div>
    ${typeSel}${body}
  </div>`;
}

function levelBlock(k, i, L, l, awards) {
  const key = `sk:${k.id}:lv${l + 1}`;
  const parts = Object.keys(PARTS).filter((p) => L[p] !== undefined);
  const missing = Object.keys(PARTS).filter((p) => L[p] === undefined);
  const aw = awards.filter((x) => (x.u.level || 1) === l + 1).map((x) => `${x.e.id} ${atText(x.u, x.e)}`);
  const n = k.levels.length;
  const body = `
    <div class="ident">
      <span class="calc">${l > 0 ? 'adds to the levels before it · ' : ''}${aw.length ? `player gets it at ${aw.join(', ')}` : (k.special || l === 0 ? 'not awarded to the player' : '')}</span>
      <span class="spacer"></span>
      ${btn('↑', 'lv-up', `data-i="${i}" data-l="${l}" ${l === 0 ? 'disabled' : ''}`, 'quiet')}
      ${btn('↓', 'lv-down', `data-i="${i}" data-l="${l}" ${l === n - 1 ? 'disabled' : ''}`, 'quiet')}
      ${btn('delete level', 'lv-del', `data-i="${i}" data-l="${l}"`, 'quiet')}
    </div>
    ${parts.map((p) => partBlock(k, i, L, l, p)).join('') || '<div class="muted">empty level</div>'}
    ${missing.length ? `<div class="addrow">${select(`data-act="part-add" data-i="${i}" data-l="${l}"`, [['', '+ effect'], ...missing.map((p) => [p, PARTS[p].label])], '')}</div>` : ''}`;
  return field(key, `level ${l + 1}`, `<span class="muted">${parts.map((p) => (p === 'mods' ? Object.keys(L.mods).join(', ') : p === 'attackPenalty' ? 'attack penalty' : p)).join(' · ')}</span>`, body);
}

// Skill groups shown on the page, in this order: monster skills by id (M..),
// specials by the special flag, everything else is a player skill.
const GROUPS = [
  { id: 'player', label: 'player skills', prefix: 'S' },
  { id: 'special', label: 'special skills', prefix: 'X' },
  { id: 'monster', label: 'monster skills', prefix: 'M' },
];
const groupOf = (k) => (/^M/.test(k.id) ? 'monster' : k.special ? 'special' : 'player');

// Moves skill i to the next / previous skill of the same group.
function moveInGroup(i, d) {
  const g = groupOf(S()[i]);
  for (let j = i + d; j >= 0 && j < S().length; j += d) {
    if (groupOf(S()[j]) === g) { const [x] = S().splice(i, 1); S().splice(j, 0, x); return; }
  }
}

function skillBlock(k, i, warns, first = false, last = false) {
  const { awards, users } = refs(k.id);
  const summary = [`${k.levels.length} level${k.levels.length === 1 ? '' : 's'}`];
  if (awards.length) summary.push(`player: ${awards.map((x) => `${x.e.id} lv${x.u.level}`).join(', ')}`);
  if (users.length) summary.push(`used by ${users.map((x) => x.e.id).join(', ')}`);
  const key = `sk:${k.id}`;
  return `<details class="en" data-key="${esc(key)}"${open.has(key) ? ' open' : ''} data-skill="${esc(k.id)}">
    <summary>${esc(k.id)} ${esc(k.name)}${k.special ? ' <span class="warn">special</span>' : ''} <span class="muted">· ${summary.join(' · ')}</span>${warns.length ? ` <span class="warn">· ${warns.length} issue${warns.length > 1 ? 's' : ''}</span>` : ''}</summary>
    <div class="body">
      <div class="ident">
        <label>id</label>${textInput(i, 'id', k.id, 'w-id')}
        <label>name</label>${textInput(i, 'name', k.name, 'w-name')}
        <label title="always active once unlocked, never loaded into a slot">${boolInput(i, 'special', k.special)}special</label>
        <span class="spacer"></span>
        ${btn('↑', 'sk-up', `data-i="${i}" ${first ? 'disabled' : ''}`, 'quiet')}
        ${btn('↓', 'sk-down', `data-i="${i}" ${last ? 'disabled' : ''}`, 'quiet')}
        ${btn('duplicate', 'sk-dup', `data-i="${i}"`, 'quiet')}
        ${btn('delete', 'sk-del', `data-i="${i}"`, 'quiet')}
      </div>
      ${warns.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}
      ${k.levels.map((L, l) => levelBlock(k, i, L, l, awards)).join('')}
      <div class="addrow">${btn('+ level', 'lv-add', `data-i="${i}"`)}</div>
    </div>
  </details>`;
}

export function renderSkills() {
  const per = problems();
  // grouped (player / special / monster), keeping the file order inside each group
  $('#ds-list').innerHTML = GROUPS.map((g) => {
    const list = S().map((k, i) => [k, i]).filter(([k]) => groupOf(k) === g.id);
    return `<h3 class="de-tier">${g.label} <span class="muted">(${list.length})</span> ${btn(`+ ${g.id}`, 'sk-new', `data-group="${g.id}"`, 'quiet')}</h3>`
      + list.map(([k, i], n) => skillBlock(k, i, per.get(k), n === 0, n === list.length - 1)).join('');
  }).join('');
  $('#ds-count').textContent = `(${S().length})`;
  renderStatus();
  if (pendingFocus) {
    const el = document.querySelector(`#ds-list details[data-skill="${CSS.escape(pendingFocus)}"]`);
    pendingFocus = null;
    if (el) el.scrollIntoView({ block: 'start' });
  }
}

function renderStatus() {
  $('#ds-status').innerHTML = statusText('skills');
  $('#ds-apply').disabled = appliedToGame();
  const msg = $('#ds-msg');
  if (msg && msgUntil < Date.now()) msg.textContent = '';
}
let msgUntil = 0;
function flash(text) {
  $('#ds-msg').textContent = text;
  msgUntil = Date.now() + 5000;
  setTimeout(renderStatus, 5100);
}

// ---------- editing ----------
function renameRefs(oldId, newId) {
  let changed = false;
  for (const e of E()) {
    for (const u of [...(e.skills || []), ...(e.skillRewards || [])]) if (u.skill === oldId) { u.skill = newId; changed = true; }
  }
  if (changed) persist('enemies');
  let inPower = false;
  for (const p of store.power) for (const u of p.skills || []) if (u.skill === oldId) { u.skill = newId; inPower = true; }
  if (inPower) persist('power');
}

function onInput(el) {
  const k = S()[Number(el.dataset.i)];
  const path = el.dataset.p;
  if (el.dataset.t === 'mod-key') {
    const mods = getP(k, path);
    const out = {};
    for (const [key, v] of Object.entries(mods)) out[key === el.dataset.k ? el.value : key] = v;
    setP(k, path, out);
  } else if (path === 'id') {
    const old = k.id;
    k.id = el.value.trim();
    renameOpen(`sk:${old}`, `sk:${k.id}`);
    renameRefs(old, k.id);
  } else if (path === 'special') {
    if (el.checked) k.special = true; else delete k.special;
  } else {
    readInput(k, el);
  }
  persist('skills');
}

function onAction(el) {
  const act = el.dataset.act;
  const i = Number(el.dataset.i);
  const l = Number(el.dataset.l);
  const k = S()[i];
  const L = k && k.levels[l];
  switch (act) {
    case 'prop-add': {
      if (!el.value) return;
      const part = el.dataset.part;
      const p = (part === 'attack' || part === 'spell' ? ACTION_PROPS : SIMPLE[part].map(([path]) => ({ path, def: 1 })))
        .find((x) => x.path === el.value);
      setP(L[part], p.path, p.def);
      break;
    }
    case 'prop-del': delP(k, el.dataset.p, 3); break;
    case 'mod-add': if (!el.value) return; setP(k, `${el.dataset.p}.${el.value}`, Number(el.dataset.def) || 1); break;
    case 'part-add': if (!el.value) return; L[el.value] = PARTS[el.value].make(); break;
    case 'part-del': delete L[el.dataset.part]; break;
    case 'lv-add': k.levels.push({}); open.add(`sk:${k.id}:lv${k.levels.length}`); saveOpen(); break;
    case 'lv-del':
      if (!confirmed(el, 'confirm delete')) return;
      k.levels.splice(l, 1);
      break;
    case 'lv-up': move(k.levels, l, -1); break;
    case 'lv-down': move(k.levels, l, 1); break;
    case 'sk-up': moveInGroup(i, -1); break;
    case 'sk-down': moveInGroup(i, 1); break;
    case 'sk-dup': {
      const c = structuredClone(k);
      c.id = nextId(S(), /^[A-Z]+/.exec(k.id)?.[0] || 'S', 2);
      c.name = `${k.name} copy`;
      S().splice(i + 1, 0, c);
      open.add(`sk:${c.id}`);
      saveOpen();
      break;
    }
    case 'sk-del': {
      const { awards, users } = refs(k.id);
      if (awards.length || users.length) {
        flash(`${k.id} is still used (${[...new Set([...awards, ...users].map((x) => x.e.id))].join(', ')}); remove it from those enemies first.`);
        return;
      }
      if (!confirmed(el, 'confirm delete')) return;
      S().splice(i, 1);
      break;
    }
    default: return;
  }
  persist('skills');
  renderSkills();
}

// ---------- used by dev/enemies ----------
let pendingFocus = null;
export function focusSkill(id) {
  pendingFocus = id;
  open.add(`sk:${id}`);
  open.add(`sk:${id}:lv1`);
  saveOpen();
  if (location.hash === '#dev/skills') renderSkills();
  else location.hash = '#dev/skills';
}

// prefix: 'S' player skill, 'M' monster skill, 'X' special
export function newSkill(name, prefix = 'S') {
  // monster skills start like the monster basic attack (hit = 100% of damage)
  const k = { id: nextId(S(), prefix, 2), name, levels: [prefix === 'M' ? { attack: { type: 'physical', scaling: 1, time: 1, speedScaling: 1 } } : { attack: { base: 1, time: 1 } }] };
  // specials are always active: they start with an attribute bonus, not an attack
  if (prefix === 'X') { k.special = true; k.levels = [{ mods: { damageFlat: 1 } }]; }
  // after the last skill of its group, so it shows at the bottom of the group
  const g = groupOf(k);
  let at = -1;
  S().forEach((x, j) => { if (groupOf(x) === g) at = j; });
  S().splice(at < 0 ? S().length : at + 1, 0, k);
  persist('skills');
  return k;
}

export function initSkills() {
  wire($('#ds-list'), { input: onInput, action: onAction, rerender: renderSkills, status: renderStatus });
  const add = (prefix) => {
    const k = newSkill(prefix === 'X' ? 'new special' : prefix === 'M' ? 'new monster skill' : 'new skill', prefix);
    open.add(`sk:${k.id}`);
    open.add(`sk:${k.id}:lv1`);
    saveOpen();
    renderSkills();
    document.querySelector(`#ds-list details[data-skill="${CSS.escape(k.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  };
  $('#ds-new').addEventListener('click', () => add('S'));
  // "+ player / + special / + monster" in the group headings
  $('#ds-list').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-act="sk-new"]');
    if (b) { ev.stopPropagation(); add(GROUPS.find((g) => g.id === b.dataset.group).prefix); }
  }, true);
  const setAll = (on) => {
    for (const k of S()) for (const key of [`sk:${k.id}`, ...k.levels.map((_, l) => `sk:${k.id}:lv${l + 1}`)]) on ? open.add(key) : open.delete(key);
    saveOpen();
    renderSkills();
  };
  $('#ds-expand').addEventListener('click', () => setAll(true));
  $('#ds-collapse').addEventListener('click', () => setAll(false));
}


