// dev/enemies: create and edit enemies, plus a preview of the player's
// attributes for a chosen set of kills.
import { ATTRS, REWARD, RANKS, HEURISTIC } from '../data.js';
import * as G from '../game.js';
import { store, persist, statusText, appliedToGame } from './store.js';
import {
  esc, fmt, num, getP, setP, delP, move, nextId, open, saveOpen, renameOpen,
  numInput, textInput, boolInput, select, btn, xBtn, field, readInput, confirmed, wire,
} from './ui.js';
import { focusSkill, newSkill } from './skills.js';
import { key } from '../site.js';

const $ = (sel) => document.querySelector(sel);
const E = () => store.enemies;
const S = () => store.skills;
const content = () => ({ enemies: store.enemies, skills: store.skills });
const withC = (fn) => G.withContent(content(), fn);

// Attributes: hp and max kills are always present, the rest can be added.
const ATTR_DEFS = [
  { key: 'maxHp', label: 'hp', path: 'base.maxHp', required: true, def: 100 },
  { key: 'limit', label: 'max kills', path: 'limit', required: true, def: 100, int: true },
  { key: 'tier', label: 'tier', path: 'tier', def: 0, int: true },
  ...ATTRS.filter((a) => a.key !== 'maxHp').map((a) => ({
    key: a.key,
    label: a.key === 'regenFlat' ? 'regen (hp/s, negative = decay)' : a.label,
    path: `base.${a.key}`,
    def: { damage: 1, attackSpeed: 0.1, magicPower: 1, magicSpeed: 0.1, maxMana: 20, manaRegen: 1, armor: 10, block: 1, blockShred: 1, regenFlat: 1, regenIn: 0.01, lifesteal: 0.25 }[a.key] ?? 1,
  })),
];
const FIELDS = ['attrs', 'skills', 'rews', 'skrews'];

const skillLabel = (k) => `${k.id} ${k.name}${k.special ? ' (special)' : ''}`;
const killsOf = (e, at) => (at === 'first' ? 1 : at === 'final' ? e.limit : Number(at));

// ---------- validation ----------
function problems() {
  const out = [];
  const per = new Map(E().map((e) => [e, []]));
  const ids = E().map((e) => e.id);
  const awarded = new Map();
  for (const e of E()) {
    const p = per.get(e);
    if (!e.id) p.push('missing id');
    else if (ids.filter((x) => x === e.id).length > 1) p.push(`id ${e.id} is used more than once`);
    if (!(e.base?.maxHp > 0)) p.push('hp must be above 0');
    if (!(e.limit >= 1)) p.push('max kills must be at least 1');
    for (const u of e.skills || []) {
      const k = G.withContent(content(), () => G.skillDef(u.skill));
      if (!k) p.push(`unknown skill ${u.skill}`);
      else if (u.level > k.levels.length) p.push(`${u.skill} has no level ${u.level}`);
    }
    (e.rewards || []).forEach((r, i) => { if (!G.STAT_LABEL[r.stat]) p.push(`attribute reward ${i + 1} has no attribute`); });
    for (const u of e.skillRewards || []) {
      const k = S().find((x) => x.id === u.skill);
      if (!k) { p.push(`skill reward: unknown skill ${u.skill}`); continue; }
      if (u.level < 1 || u.level > k.levels.length) p.push(`${u.skill} has no level ${u.level} (max ${k.levels.length})`);
      const n = killsOf(e, u.at);
      if (!(n >= 1) || n > e.limit) p.push(`${u.skill} lv${u.level} is awarded at kill ${u.at}, outside 1–${e.limit}`);
      const key = `${u.skill} lv${u.level}`;
      awarded.set(key, [...(awarded.get(key) || []), e.id]);
    }
  }
  for (const [key, who] of awarded) if (who.length > 1) out.push(`${key} is awarded more than once (${who.join(', ')}); the first one counts`);
  return { out, per };
}

// ---------- rendering ----------
function attrsField(e, i) {
  const rankRow = `<tr><td class="lbl">rank</td><td>${select(`data-i="${i}" data-p="rank" data-t="rank"`, Object.entries(RANKS).map(([k, r]) => [k, `${r.label} (${r.limit} kills)`]), G.rankOf(e))}</td><td></td></tr>`;
  const rows = rankRow + ATTR_DEFS.filter((a) => a.required || getP(e, a.path) !== undefined).map((a) => {
    const v = getP(e, a.path);
    const input = a.bool ? boolInput(i, a.path, v) : numInput(i, a.path, v, { int: a.int });
    return `<tr><td class="lbl">${a.label}</td><td>${input}</td><td>${a.required ? '' : xBtn('attr-del', `data-i="${i}" data-p="${a.path}"`)}</td></tr>`;
  }).join('');
  const missing = ATTR_DEFS.filter((a) => !a.required && getP(e, a.path) === undefined);
  const add = missing.length
    ? `<div class="addrow">${select(`data-act="attr-add" data-i="${i}"`, [['', '+ attribute'], ...missing.map((a) => [a.key, a.label])], '')}</div>`
    : '';
  const n = ATTR_DEFS.filter((a) => getP(e, a.path) !== undefined).length;
  return field(`${e.id}:attrs`, 'attributes', `(${n})`, `<table class="dev-table">${rows}</table>${add}`);
}

function skillsField(e, i) {
  const own = e.skills || [];
  const opts = S().filter((k) => !k.special);
  const rows = own.map((u, j) => {
    const k = S().find((x) => x.id === u.skill);
    const max = k ? k.levels.length : 1;
    return `<tr>
      <td>${select(`data-i="${i}" data-p="skills.${j}.skill" data-t="skill"`, [['', '—'], ...opts.map((x) => [x.id, skillLabel(x)])], u.skill)}</td>
      <td>lv ${select(`data-i="${i}" data-p="skills.${j}.level" data-t="int"`, Array.from({ length: Math.max(max, u.level || 1) }, (_, n) => [n + 1, n + 1]), u.level)}</td>
      <td>${k ? btn('edit', 'goto-skill', `data-id="${esc(k.id)}"`, 'quiet') : ''}</td>
      <td>${xBtn('own-del', `data-i="${i}" data-j="${j}"`)}</td></tr>`;
  }).join('');
  const { parts, unit } = withC(() => G.enemyDps(e, 20));
  const lines = parts.map(({ a, onHit, hit, dot }) => {
    const b = [`${a.kind}`];
    if (a.hit) b.push(`hit ${num(a.hit)}${a.hits > 1 ? ` x${a.hits}` : ''}${onHit ? ` + ${num(onHit)} on hit` : ''}`);
    b.push(`every ${num(a.interval)}s`);
    if (a.dot) b.push(`dot ${num(a.dot.dps)}${a.dot.pct ? ` + ${fmt(a.dot.pct * 100, 1)}% max hp` : ''}/s for ${num(a.dot.duration)}s`);
    if (a.heal) b.push(`heals ${num(a.heal)}`);
    if (a.shield) b.push(`shield ${num(a.shield.amount)} for ${num(a.shield.duration)}s`);
    if (a.lifesteal) b.push(`lifesteal ${fmt(a.lifesteal * 100, 0)}%`);
    if (a.cost) b.push(`${num(a.cost)} mp`);
    if (a.countdown) b.push('countdown');
    return `<div>${esc(a.name)}: ${b.join(' · ')} → ${num(hit + dot)} dps</div>`;
  });
  // attributes changed by its skills
  const changed = ATTRS.filter((a) => Math.abs((unit[a.key] || 0) - (e.base?.[a.key] || 0)) > 1e-9)
    .map((a) => `${a.label} ${num(unit[a.key])}`);
  if (changed.length) lines.push(`<div>with skills: ${changed.join(', ')}</div>`);
  if (unit.empowers.length) lines.push(`<div>empower: ${unit.empowers.map((p) => `+${fmt(p.mult * 100, 0)}% every ${num(p.cooldown)}s`).join(', ')}</div>`);
  const used = new Set(own.map((u) => u.skill));
  const addable = opts.filter((k) => !used.has(k.id));
  const body = `${rows ? `<table class="dev-table">${rows}</table>` : '<div class="muted">no skills: this enemy does not act</div>'}
    <div class="addrow">
      ${addable.length ? select(`data-act="own-add" data-i="${i}"`, [['', '+ skill'], ...addable.map((k) => [k.id, skillLabel(k)])], '') : ''}
      ${btn('+ new skill', 'own-new', `data-i="${i}"`)}
    </div>
    <div class="calc">${lines.join('') || 'no attacks or spells'}</div>`;
  return field(`${e.id}:skills`, 'skills', `(${own.length}) · ${num(withC(() => G.enemyDps(e, 20)).total)} dps before defenses`, body);
}

function rewardsField(e, i) {
  const stats = Object.entries(G.STAT_LABEL);
  const common = G.rankOf(e) === 'common';
  const wave = REWARD.common.waveKills;
  const rows = (e.rewards || []).map((r, j) => {
    const pct = r.type === 'percent';
    const show = (v) => (pct ? `${num(v * 100)}%` : num(v));
    const t = r.total || 0;
    const step = (n) => t * (G.rewardShare(e, n) - G.rewardShare(e, n - 1));
    const per = common && e.limit > wave
      ? `first kill +${show(step(1))}, kills 2–${wave} +${show(step(2))} each, ${wave + 1}–${e.limit} +${show(step(wave + 1))} each`
      : `first kill +${show(step(1))}, then +${show(step(2))} per kill`;
    let hint = '';
    if (common && r.stat) {
      const sg = withC(() => G.suggestTotal(e, r));
      const ref = sg.value == null ? '' : ` (player ${G.STAT_LABEL[r.stat]} ${num(sg.attr)}${sg.value !== sg.attr ? `, measured as ${num(sg.value)}` : ''} with lower tiers done)`;
      hint = `<div>${fmt(HEURISTIC.share * 100, 0)}% suggestion: ${show(sg.total)}${ref} ${Math.abs(sg.total - t) > 1e-9 ? btn('use', 'rew-suggest', `data-i="${i}" data-j="${j}"`, 'quiet') : '<span class="ok">✓</span>'}</div>`;
    }
    return `<tr>
      <td>${select(`data-i="${i}" data-p="rewards.${j}.stat" data-t="text"`, [['', '—'], ...stats], r.stat)}</td>
      <td>total + ${numInput(i, `rewards.${j}.total`, r.total)}</td>
      <td>${select(`data-i="${i}" data-p="rewards.${j}.type" data-t="type"`, [['flat', 'flat'], ['percent', '% (0.01 = 1%)']], r.type || 'flat')}</td>
      <td>${xBtn('rew-del', `data-i="${i}" data-j="${j}"`)}</td>
      <td class="calc">${per}${hint}</td></tr>`;
  }).join('');
  const how = common
    ? `common: the first ${wave} kills give ${fmt(REWARD.common.waveShare * 100, 0)}% of the total (the first kill counts x${REWARD.firstMult}), the remaining kills give the rest evenly.`
    : `each kill gives its share; the first kill counts x${REWARD.firstMult}.`;
  const body = `${rows ? `<table class="dev-table">${rows}</table>` : '<div class="muted">no attribute rewards</div>'}
    <div class="addrow">${btn('+ attribute reward', 'rew-add', `data-i="${i}"`)}</div>
    <div class="calc">total gained over all ${e.limit} kills, so it stays the same if max kills changes. ${how}</div>`;
  return field(`${e.id}:rews`, 'attribute rewards', `(${(e.rewards || []).length})`, body);
}

function skillRewardsField(e, i) {
  const list = e.skillRewards || [];
  const rows = list.map((u, j) => {
    const k = S().find((x) => x.id === u.skill);
    const max = k ? k.levels.length : 1;
    const mode = u.at === 'first' || u.at === 'final' ? u.at : 'n';
    return `<tr>
      <td>${select(`data-i="${i}" data-p="skillRewards.${j}.skill" data-t="skill"`, [['', '—'], ...S().map((x) => [x.id, skillLabel(x)])], u.skill)}</td>
      <td>lv ${select(`data-i="${i}" data-p="skillRewards.${j}.level" data-t="int"`, Array.from({ length: Math.max(max, u.level || 1) }, (_, n) => [n + 1, n + 1]), u.level)}</td>
      <td>at ${select(`data-i="${i}" data-p="skillRewards.${j}.at" data-t="kill-mode"`, [['first', 'first kill'], ['final', `final kill (${e.limit})`], ['n', 'kill #']], mode)}
        ${mode === 'n' ? numInput(i, `skillRewards.${j}.at`, u.at, { cls: 'w-kill', int: true }) : ''}</td>
      <td>${xBtn('skr-del', `data-i="${i}" data-j="${j}"`)}</td></tr>`;
  }).join('');
  const body = `${rows ? `<table class="dev-table">${rows}</table>` : '<div class="muted">no skill rewards</div>'}
    <div class="addrow">${btn('+ skill reward', 'skr-add', `data-i="${i}"`)}</div>`;
  return field(`${e.id}:skrews`, 'skill rewards', `(${list.length}) ${list.map((u) => `${u.skill} lv${u.level}`).join(', ')}`, body);
}

function enemyBlock(e, i, warns) {
  const u = withC(() => G.enemyUnit(e));
  const summary = [`tier ${e.tier || 0}`, `hp ${num(u.maxHp)}`, `${e.limit} kills`, `${(e.skills || []).length} skills`]
    .concat((e.rewards || []).map((r) => `${G.STAT_LABEL[r.stat] || '?'} +${r.type === 'percent' ? `${num((r.total || 0) * 100)}%` : num(r.total || 0)} total`));
  const n = E().length;
  return `<details class="en" data-key="${esc(e.id)}"${open.has(e.id) ? ' open' : ''}>
    <summary>${esc(e.id)} ${esc(e.name)}${G.rankOf(e) === 'common' ? '' : ` <span class="${G.rankOf(e) === 'boss' ? 'warn' : 'muted'}">${G.rankOf(e)}</span>`} <span class="muted">· ${summary.join(' · ')}</span>${warns.length ? ` <span class="warn">· ${warns.length} issue${warns.length > 1 ? 's' : ''}</span>` : ''}</summary>
    <div class="body">
      <div class="ident">
        <label>id</label>${textInput(i, 'id', e.id, 'w-id')}
        <label>name</label>${textInput(i, 'name', e.name, 'w-name')}
        <span class="spacer"></span>
        ${btn('↑', 'en-up', `data-i="${i}" ${i === 0 ? 'disabled' : ''}`, 'quiet')}
        ${btn('↓', 'en-down', `data-i="${i}" ${i === n - 1 ? 'disabled' : ''}`, 'quiet')}
        ${btn('duplicate', 'en-dup', `data-i="${i}"`, 'quiet')}
        ${btn('delete', 'en-del', `data-i="${i}"`, 'quiet')}
      </div>
      ${warns.map((w) => `<div class="warn">${esc(w)}</div>`).join('')}
      ${attrsField(e, i)}
      ${skillsField(e, i)}
      ${rewardsField(e, i)}
      ${skillRewardsField(e, i)}
    </div>
  </details>`;
}

export function renderEnemies() {
  const { out, per } = problems();
  $('#de-list').innerHTML = E().map((e, i) => enemyBlock(e, i, per.get(e))).join('');
  $('#de-warn').innerHTML = out.map((w) => `<div>${esc(w)}</div>`).join('');
  $('#de-count').textContent = `(${E().length})`;
  renderStatus();
  renderPreview();
}

function renderStatus() {
  $('#de-status').innerHTML = statusText('enemies');
  $('#de-apply').disabled = appliedToGame();
}

// ---------- editing ----------
function onInput(el) {
  const e = E()[Number(el.dataset.i)];
  const path = el.dataset.p;
  const t = el.dataset.t;
  if (t === 'rank') {
    e.rank = el.value;
    delete e.boss;
    if (RANKS[el.value]) e.limit = RANKS[el.value].limit;
  } else if (t === 'type') {
    if (el.value === 'flat') delP(e, path); else setP(e, path, el.value);
  } else if (t === 'kill-mode') {
    setP(e, path, el.value === 'n' ? Math.max(1, Math.min(e.limit, 2)) : el.value);
  } else if (t === 'skill') {
    setP(e, path, el.value);
    const u = getP(e, path.replace(/\.skill$/, ''));
    const k = S().find((x) => x.id === el.value);
    if (k && u.level > k.levels.length) u.level = k.levels.length;
  } else if (path === 'id') {
    const old = e.id;
    e.id = el.value.trim();
    renameOpen(old, e.id);
  } else {
    readInput(e, el);
  }
  persist('enemies');
}

function onAction(el) {
  const act = el.dataset.act;
  const i = Number(el.dataset.i);
  const j = Number(el.dataset.j);
  const e = E()[i];
  switch (act) {
    case 'attr-add': {
      const a = ATTR_DEFS.find((x) => x.key === el.value);
      if (!a) return;
      setP(e, a.path, a.def);
      break;
    }
    case 'attr-del': delP(e, el.dataset.p); break;
    case 'own-add': if (!el.value) return; (e.skills ||= []).push({ skill: el.value, level: 1 }); break;
    case 'own-del': e.skills.splice(j, 1); break;
    case 'own-new': {
      const k = newSkill(`${e.name} attack`);
      (e.skills ||= []).push({ skill: k.id, level: 1 });
      persist('enemies');
      focusSkill(k.id);
      return;
    }
    case 'goto-skill': focusSkill(el.dataset.id); return;
    case 'rew-add': (e.rewards ||= []).push({ stat: 'damage', total: 1 }); break;
    case 'rew-del': e.rewards.splice(j, 1); break;
    case 'rew-suggest': e.rewards[j].total = withC(() => G.suggestTotal(e, e.rewards[j])).total; break;
    case 'skr-add': {
      // suggest the first skill level nobody awards yet (skipping enemy-only skills)
      const used = new Set(E().flatMap((x) => (x.skillRewards || []).map((u) => `${u.skill}:${u.level}`)));
      const enemyOwn = new Set(E().flatMap((x) => (x.skills || []).map((u) => u.skill)));
      let pick = null;
      for (const k of S()) {
        if (enemyOwn.has(k.id)) continue;
        for (let lv = 1; lv <= k.levels.length && !pick; lv++) if (!used.has(`${k.id}:${lv}`)) pick = { skill: k.id, level: lv };
        if (pick) break;
      }
      (e.skillRewards ||= []).push({ ...(pick || { skill: S()[0]?.id || '', level: 1 }), at: 'first' });
      break;
    }
    case 'skr-del': e.skillRewards.splice(j, 1); break;
    case 'en-up': move(E(), i, -1); break;
    case 'en-down': move(E(), i, 1); break;
    case 'en-dup': {
      const c = structuredClone(e);
      c.id = nextId(E(), 'E', 3);
      c.name = `${e.name} copy`;
      c.skillRewards = []; // a skill level should be awarded by one enemy only
      E().splice(i + 1, 0, c);
      open.add(c.id);
      saveOpen();
      break;
    }
    case 'en-del':
      if (!confirmed(el, 'confirm delete')) return;
      E().splice(i, 1);
      break;
    default: return;
  }
  persist('enemies');
  renderEnemies();
}

// ---------- player preview ----------
const PREVIEW_KEY = key('isfw.dev.preview');
let preview = [];
try { preview = JSON.parse(localStorage.getItem(PREVIEW_KEY)) || []; } catch {}
const savePreview = () => { try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview)); } catch {} };
let getGameState = () => null;

const PREVIEW_ATTRS = [
  ['maxHp', 'hp', 1], ['damage', 'dmg', 3], ['attackSpeed', 'aspd', 3], ['magicPower', 'mag pwr', 3],
  ['magicSpeed', 'mag spd', 3], ['maxMana', 'mp', 1], ['manaRegen', 'mp regen', 2], ['armor', 'armor', 1],
  ['block', 'block', 1], ['blockShred', 'block shred', 1], ['regenOutHp', 'regen idle', 1],
];

function previewState() {
  return withC(() => {
    const s = G.newState();
    for (const r of preview) {
      const e = G.enemyDef(r.enemy);
      if (e) s.kills[e.id] = Math.max(0, Math.min(e.limit, Math.floor(r.kills || 0)));
    }
    return s;
  });
}

function renderPreview() {
  const s = previewState();
  const { d, base, skills, sps, slots } = withC(() => ({
    d: G.derived(s),
    base: G.derived(G.newState()),
    skills: G.playerSkills().map((k) => [k, G.skillLevel(s, k.id)]).filter(([, lv]) => lv > 0),
    sps: G.specials().map((k) => [k, G.skillLevel(s, k.id)]).filter(([, lv]) => lv > 0),
    slots: G.slotCount(s),
  }));
  const rows = preview.map((r, j) => {
    const e = E().find((x) => x.id === r.enemy);
    return `<tr>
      <td>${select(`data-pv="enemy" data-j="${j}"`, [['', '—'], ...E().map((x) => [x.id, `${x.id} ${x.name}`])], r.enemy)}</td>
      <td><input type="number" step="1" min="0" class="w-kill" data-pv="kills" data-j="${j}" value="${esc(r.kills)}"></td>
      <td class="muted">/ ${e ? e.limit : '—'}</td>
      <td>${xBtn('pv-del', `data-j="${j}"`)}</td></tr>`;
  }).join('');
  const attrs = PREVIEW_ATTRS.map(([k, label, dp]) => {
    const dv = d[k] - base[k];
    return `<tr><td class="lbl">${label}</td><td class="num">${fmt(d[k], dp)}</td><td class="num muted">${Math.abs(dv) > 1e-9 ? `${dv > 0 ? '+' : ''}${fmt(dv, dp)}` : ''}</td></tr>`;
  }).join('');
  const sk = skills.map(([k, lv]) => `<div>${k.id} ${esc(k.name)} <span class="muted">lv${lv}/${k.levels.length}</span></div>`).join('') || '<div class="muted">none</div>';
  const sp = sps.map(([k]) => `<div>${k.id} ${esc(k.name)}</div>`).join('');
  $('#de-preview').innerHTML = `
    <h2>player preview</h2>
    <div class="calc">attributes after these kills (no skills loaded)</div>
    ${rows ? `<table class="dev-table">${rows}</table>` : '<div class="muted">no kills</div>'}
    <div class="addrow">
      ${btn('+ enemy', 'pv-add')}
      ${btn('all at max', 'pv-max', '', 'quiet')}
      ${btn('from game', 'pv-game', '', 'quiet')}
      ${btn('clear', 'pv-clear', '', 'quiet')}
    </div>
    <h2>attributes</h2>
    <table class="dev-table kv">${attrs}</table>
    <h2>skills unlocked <span class="muted">· ${slots} slots</span></h2>
    ${sk}${sp ? `<h2>specials</h2>${sp}` : ''}`;
}

function onPreview(ev) {
  const el = ev.target;
  const j = Number(el.dataset.j);
  if (el.dataset.pv === 'enemy') preview[j].enemy = el.value;
  else if (el.dataset.pv === 'kills') preview[j].kills = Math.max(0, parseInt(el.value, 10) || 0);
  else return false;
  savePreview();
  return true;
}

function onPreviewAction(el) {
  const act = el.dataset.act;
  const j = Number(el.dataset.j);
  if (act === 'pv-add') {
    const used = new Set(preview.map((r) => r.enemy));
    const e = E().find((x) => !used.has(x.id)) || E()[0];
    preview.push({ enemy: e?.id || '', kills: e?.limit || 1 });
  } else if (act === 'pv-del') preview.splice(j, 1);
  else if (act === 'pv-max') preview = E().map((e) => ({ enemy: e.id, kills: e.limit }));
  else if (act === 'pv-clear') preview = [];
  else if (act === 'pv-game') {
    const gs = getGameState();
    if (gs) preview = Object.entries(gs.kills).filter(([, n]) => n > 0).map(([enemy, kills]) => ({ enemy, kills }));
  } else return;
  savePreview();
  renderPreview();
}

// ---------- wiring ----------
export function initEnemies(opts = {}) {
  if (opts.getState) getGameState = opts.getState;
  wire($('#de-list'), { input: onInput, action: onAction, rerender: renderEnemies, status: renderStatus });
  const pv = $('#de-preview');
  pv.addEventListener('input', (ev) => { if (ev.target.dataset.pv === 'kills' && onPreview(ev)) renderPreviewKeepFocus(ev.target); });
  pv.addEventListener('change', (ev) => { if (onPreview(ev)) renderPreview(); });
  pv.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-act]'); if (b) onPreviewAction(b); });

  $('#de-new').addEventListener('click', () => {
    const e = { id: nextId(E(), 'E', 3), name: 'new enemy', tier: 0, rank: 'common', limit: RANKS.common.limit, base: { maxHp: 100 }, skills: [], rewards: [{ stat: 'damage', total: 1 }], skillRewards: [] };
    E().push(e);
    open.add(e.id);
    for (const f of FIELDS) open.add(`${e.id}:${f}`);
    saveOpen();
    persist('enemies');
    renderEnemies();
    $('#de-list').lastElementChild?.scrollIntoView({ block: 'nearest' });
  });
  const setAll = (on) => {
    for (const e of E()) for (const k of [e.id, ...FIELDS.map((f) => `${e.id}:${f}`)]) on ? open.add(k) : open.delete(k);
    saveOpen();
    renderEnemies();
  };
  $('#de-expand').addEventListener('click', () => setAll(true));
  $('#de-collapse').addEventListener('click', () => setAll(false));
}

// Re-render the preview while typing a kill count, keeping the cursor there.
function renderPreviewKeepFocus(el) {
  const j = el.dataset.j;
  renderPreview();
  const again = document.querySelector(`#de-preview input[data-pv="kills"][data-j="${j}"]`);
  if (again) { again.focus(); const v = again.value; again.value = ''; again.value = v; }
}
