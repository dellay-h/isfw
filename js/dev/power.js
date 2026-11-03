// dev/enemies, top: tier power levels and enemy profiles (js/power.js).
// An enemy with a profile gets its tier's power level x the profile (mult,
// then add), plus its own base on top (game.js enemyBase).
import { ATTRS, RANKS } from '../data.js';
import { store, persist, statusText } from './store.js';
import {
  esc, num, getP, setP, delP, open, saveOpen, renameOpen, numInput, textInput, select, btn, xBtn, field, readInput, confirmed, wire,
} from './ui.js';

const $ = (sel) => document.querySelector(sel);
const P = () => store.power;
const E = () => store.enemies;
const S = () => store.skills;
// ranks that can have a bonus (elite, boss)
const BONUS_RANKS = ['elite', 'boss'].filter((r) => RANKS[r]);
const pct = (v) => `${v >= 0 ? '+' : ''}${num((v || 0) * 100)}%`;
const LABEL = Object.fromEntries(ATTRS.map((a) => [a.key, a.label]));
const DEF = { maxHp: 100, damage: 1, attackSpeed: 0, magicPower: 1, magicSpeed: 0, maxMana: 20, manaRegen: 1, armor: 10, block: 1, blockShred: 1, regenFlat: 1, regenIn: 0.01, lifesteal: 0.1 };
let afterEdit = () => {};

const tiers = () => P().map((x, i) => [x, i]).filter(([x]) => x.kind === 'tier').sort((a, b) => a[0].tier - b[0].tier);
const profs = () => P().map((x, i) => [x, i]).filter(([x]) => x.kind === 'profile');
const users = (id) => E().filter((e) => e.profile === id);
const short = (obj, fmtV) => Object.entries(obj || {}).map(([k, v]) => `${LABEL[k] || k} ${fmtV(v)}`).join(', ');

// rows of attribute: value pairs at `path` (an object), with key selects
function attrRows(i, path, obj, kind) {
  const rows = Object.entries(obj || {}).map(([k, v]) => `<tr>
      <td>${select(`data-i="${i}" data-p="${path}" data-t="pw-key" data-k="${esc(k)}"`, ATTRS.filter((a) => a.key === k || !(a.key in obj)).map((a) => [a.key, a.label]).concat(LABEL[k] ? [] : [[k, `${k} (unknown)`]]), k)}</td>
      <td>${kind === 'mult' ? '×' : kind === 'add' ? '+' : ''} ${numInput(i, `${path}.${k}`, v)}</td>
      <td>${xBtn('pw-del', `data-i="${i}" data-p="${path}.${k}"`)}</td></tr>`).join('');
  const left = ATTRS.filter((a) => !(a.key in (obj || {})));
  return `<table class="dev-table">${rows}</table>
    ${left.length ? `<div class="addrow">${select(`data-act="pw-add" data-i="${i}" data-p="${path}" data-kind="${kind}"`, [['', '+ attribute'], ...left.map((a) => [a.key, a.label])], '')}</div>` : ''}`;
}

function tierBlock(x, i) {
  const n = E().filter((e) => e.profile && Math.abs(e.tier || 0) === x.tier).length;
  const body = `<div class="ident"><label>tier</label>${numInput(i, 'tier', x.tier, { int: true, cls: 'w-id' })}
      <span class="calc">base attributes of the enemies of this tier that have a profile (${n} now)</span>
      <span class="spacer"></span>${btn('delete', 'tier-del', `data-i="${i}"`, 'quiet')}</div>
    ${attrRows(i, 'base', x.base, 'base')}`;
  return field(`pw:tier:${x.tier}`, `tier ${x.tier}`, `<span class="muted">${esc(short(x.base, num))}</span>`, body);
}

function skillRows(x, i) {
  const own = x.skills || [];
  const label = (k) => `${k.id} ${k.name}${k.special ? ' (special)' : ''}`;
  const rows = own.map((u, j) => {
    const k = S().find((y) => y.id === u.skill);
    const max = k ? k.levels.length : 1;
    return `<tr>
      <td>${select(`data-i="${i}" data-p="skills.${j}.skill" data-t="text"`, S().filter((y) => !y.special).map((y) => [y.id, label(y)]).concat(k ? [] : [[u.skill, `${u.skill} (unknown)`]]), u.skill)}</td>
      <td>lv ${select(`data-i="${i}" data-p="skills.${j}.level" data-t="int"`, Array.from({ length: Math.max(max, u.level || 1) }, (_, n) => [n + 1, n + 1]), u.level)}</td>
      <td>${xBtn('pskill-del', `data-i="${i}" data-j="${j}"`)}</td></tr>`;
  }).join('');
  const used = new Set(own.map((u) => u.skill));
  const left = S().filter((y) => !y.special && !used.has(y.id));
  return `${rows ? `<table class="dev-table">${rows}</table>` : '<div class="muted">none</div>'}
    ${left.length ? `<div class="addrow">${select(`data-act="pskill-add" data-i="${i}"`, [['', '+ skill'], ...left.map((y) => [y.id, label(y)])], '')}</div>` : ''}`;
}

function profileBlock(x, i) {
  const u = users(x.id);
  const body = `<div class="ident"><label>id</label>${textInput(i, 'id', x.id, 'w-name')}<label>name</label>${textInput(i, 'name', x.name, 'w-name')}
      <span class="spacer"></span>${btn('delete', 'prof-del', `data-i="${i}"`, 'quiet')}</div>
    <div class="calc">used by ${u.length ? u.map((e) => `${e.id} ${esc(e.name)}`).join(', ') : 'no enemy'} · attribute = tier base × multiplier + added</div>
    <div class="act"><div class="ident"><b>multipliers</b> <span class="muted">(others ×1)</span></div>${attrRows(i, 'mult', x.mult, 'mult')}</div>
    <div class="act"><div class="ident"><b>added</b> <span class="muted">(flat, after multiplying)</span></div>${attrRows(i, 'add', x.add, 'add')}</div>
    <div class="act"><div class="ident"><b>skills</b> <span class="muted">(every enemy with this profile has them, besides its own)</span></div>${skillRows(x, i)}</div>`;
  const info = [short(x.mult, (v) => `×${num(v)}`), short(x.add, (v) => `+${num(v)}`), (x.skills || []).map((u) => u.skill).join(', ')].filter(Boolean).join(' · ') || 'no change';
  return field(`pw:prof:${x.id}`, `${esc(x.id)}${x.name && x.name !== x.id ? ` ${esc(x.name)}` : ''}`, `<span class="muted">${esc(info)} · ${u.length} enem${u.length === 1 ? 'y' : 'ies'}</span>`, body);
}

function problems() {
  const out = [];
  const seenT = new Set();
  for (const [x] of tiers()) { if (seenT.has(x.tier)) out.push(`tier ${x.tier} has more than one power level`); seenT.add(x.tier); }
  const ids = profs().map(([x]) => x.id);
  for (const id of ids) if (!id) out.push('a profile has no id'); else if (ids.filter((y) => y === id).length > 1) out.push(`profile id ${id} is used more than once`);
  for (const [x] of profs()) {
    for (const u of x.skills || []) {
      const k = S().find((y) => y.id === u.skill);
      if (!k) out.push(`profile ${x.id}: unknown skill ${u.skill}`);
      else if (u.level > k.levels.length) out.push(`profile ${x.id}: ${u.skill} has no level ${u.level}`);
    }
  }
  return out;
}

function rankRows() {
  return BONUS_RANKS.map((r) => {
    const i = P().findIndex((x) => x.kind === 'rank' && x.rank === r);
    const v = i >= 0 ? P()[i].bonus : 0;
    const n = E().filter((e) => (e.rank || (e.boss ? 'boss' : 'common')) === r).length;
    return `<tr><td class="lbl">${RANKS[r].label}</td>
      <td><input type="number" step="any" data-p="bonus" data-t="rank-bonus" data-rank="${r}" value="${esc(v)}"> <span class="muted">${pct(v)} to every attribute · ${n} enem${n === 1 ? 'y' : 'ies'}</span></td></tr>`;
  }).join('');
}

export function renderPower() {
  const warns = problems();
  const T = tiers();
  const Pr = profs();
  const rb = BONUS_RANKS.map((r) => `${r} ${pct(P().find((x) => x.kind === 'rank' && x.rank === r)?.bonus)}`).join(', ');
  $('#de-power').innerHTML = `
    <details class="en" data-key="pw:ranks"${open.has('pw:ranks') ? ' open' : ''}>
      <summary>rank bonus <span class="muted">· ${rb}</span></summary>
      <div class="body"><div class="calc">every attribute of elites / bosses (0.5 = +50%), applied last, like the player's level bonus (negative values shrink towards 0)</div>
        <table class="dev-table">${rankRows()}</table></div>
    </details>
    <details class="en" data-key="pw:tiers"${open.has('pw:tiers') ? ' open' : ''}>
      <summary>tier power levels <span class="muted">· ${T.map(([x]) => `tier ${x.tier}`).join(', ') || 'none'}</span></summary>
      <div class="body">${T.map(([x, i]) => tierBlock(x, i)).join('')}<div class="addrow">${btn('+ tier', 'tier-add')}</div></div>
    </details>
    <details class="en" data-key="pw:profiles"${open.has('pw:profiles') ? ' open' : ''}>
      <summary>enemy profiles <span class="muted">· ${Pr.map(([x]) => esc(x.id)).join(', ') || 'none'}</span></summary>
      <div class="body">${Pr.map(([x, i]) => profileBlock(x, i)).join('')}<div class="addrow">${btn('+ profile', 'prof-add')}</div></div>
    </details>
    ${warns.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}
    <div class="dev-status">${statusText('power')}</div>`;
}

function onInput(el) {
  if (el.dataset.t === 'rank-bonus') {
    const v = parseFloat(el.value);
    let x = P().find((y) => y.kind === 'rank' && y.rank === el.dataset.rank);
    if (!x) { x = { kind: 'rank', rank: el.dataset.rank, bonus: 0 }; P().push(x); }
    x.bonus = Number.isFinite(v) ? v : 0;
    persist('power');
    return;
  }
  const x = P()[Number(el.dataset.i)];
  const path = el.dataset.p;
  if (el.dataset.t === 'pw-key') {
    const obj = getP(x, path);
    const outObj = {};
    for (const [k, v] of Object.entries(obj)) outObj[k === el.dataset.k ? el.value : k] = v;
    setP(x, path, outObj);
  } else if (path === 'id' && x.kind === 'profile') {
    const old = x.id;
    x.id = el.value.trim();
    renameOpen(`pw:prof:${old}`, `pw:prof:${x.id}`);
    let changed = false;
    for (const e of E()) if (e.profile === old) { e.profile = x.id; changed = true; }
    if (changed) persist('enemies');
  } else if (path === 'tier') {
    const old = x.tier;
    readInput(x, el);
    renameOpen(`pw:tier:${old}`, `pw:tier:${x.tier}`);
  } else {
    readInput(x, el);
  }
  persist('power');
}

function onAction(el) {
  const act = el.dataset.act;
  const i = Number(el.dataset.i);
  const x = P()[i];
  switch (act) {
    case 'pw-add': {
      if (!el.value) return;
      const obj = getP(x, el.dataset.p) || {};
      obj[el.value] = el.dataset.kind === 'mult' ? 1 : el.dataset.kind === 'add' ? 1 : (DEF[el.value] ?? 1);
      setP(x, el.dataset.p, obj);
      break;
    }
    case 'pw-del': delP(x, el.dataset.p, 99); break;
    case 'pskill-add': if (!el.value) return; (x.skills ??= []).push({ skill: el.value, level: 1 }); break;
    case 'pskill-del':
      x.skills.splice(Number(el.dataset.j), 1);
      if (!x.skills.length) delete x.skills;
      break;
    case 'tier-add': {
      const top = tiers().reduce((m, [t]) => Math.max(m, t.tier), 0);
      const last = tiers().at(-1)?.[0];
      const t = { kind: 'tier', tier: top + 1, base: structuredClone(last?.base || { maxHp: 100, damage: 1 }) };
      P().push(t);
      open.add('pw:tiers'); open.add(`pw:tier:${t.tier}`); saveOpen();
      break;
    }
    case 'tier-del': {
      const n = E().filter((e) => e.profile && Math.abs(e.tier || 0) === x.tier).length;
      if (!confirmed(el, n ? `${n} enemies use it · confirm` : 'confirm delete')) return;
      P().splice(i, 1);
      break;
    }
    case 'prof-add': {
      let n = 1;
      while (P().some((y) => y.kind === 'profile' && y.id === `profile${n}`)) n++;
      const p = { kind: 'profile', id: `profile${n}`, name: `profile${n}`, mult: {}, add: {} };
      P().push(p);
      open.add('pw:profiles'); open.add(`pw:prof:${p.id}`); saveOpen();
      break;
    }
    case 'prof-del': {
      const u = users(x.id);
      if (u.length) { el.textContent = `used by ${u.map((e) => e.id).join(', ')}`; setTimeout(() => afterEdit(), 3000); return; }
      if (!confirmed(el, 'confirm delete')) return;
      P().splice(i, 1);
      break;
    }
    default: return;
  }
  for (const y of P()) { if (y.kind === 'profile') { y.mult ??= {}; y.add ??= {}; } if (y.kind === 'tier') y.base ??= {}; }
  persist('power');
  afterEdit();
}

export function initPower({ rerender }) {
  afterEdit = rerender;
  // while typing only the status line changes (a full re-render would drop the focus)
  const status = () => { const el = $('#de-power .dev-status'); if (el) el.innerHTML = statusText('power'); };
  wire($('#de-power'), { input: onInput, action: onAction, rerender, status });
}
