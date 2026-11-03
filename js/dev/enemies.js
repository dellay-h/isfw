// dev/enemies: create and edit enemies, plus a preview of the player's
// attributes for a chosen set of kills.
import { ATTRS, RANKS, HEURISTIC } from '../data.js';
import * as G from '../game.js';
import { store, persist, statusText, appliedToGame } from './store.js';
import {
  esc, fmt, num, getP, setP, delP, move, nextId, open, saveOpen, renameOpen,
  numInput, textInput, boolInput, select, btn, xBtn, field, readInput, confirmed, wire,
} from './ui.js';
import { focusSkill, newSkill } from './skills.js';
import { initPower, renderPower } from './power.js';
import { key } from '../site.js';

const $ = (sel) => document.querySelector(sel);
const E = () => store.enemies;
const S = () => store.skills;
const content = () => ({ enemies: store.enemies, skills: store.skills, power: store.power });
const withC = (fn) => G.withContent(content(), fn);

// Attributes: hp and max kills are always present, the rest can be added.
const ATTR_DEFS = [
  { key: 'maxHp', label: 'hp', path: 'base.maxHp', required: true, def: 100 },
  { key: 'limit', label: 'max kills', path: 'limit', required: true, def: 100, int: true },
  { key: 'tier', label: 'tier (-X = in development for tier X)', path: 'tier', def: 0, int: true },
  { key: 'unlockCost', label: 'unlock cost (prestige pts)', path: 'unlockCost', def: 1, int: true },
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
// skills the player can get (awarded by an enemy); enemies should use monster skills instead
const playerSkillIds = () => new Set(E().flatMap((e) => (e.skillRewards || []).map((u) => u.skill)));
function problems() {
  const out = [];
  const per = new Map(E().map((e) => [e, []]));
  const ids = E().map((e) => e.id);
  const awarded = new Map();
  for (const e of E()) {
    const p = per.get(e);
    if (!e.id) p.push('missing id');
    else if (ids.filter((x) => x === e.id).length > 1) p.push(`id ${e.id} is used more than once`);
    if (e.profile) {
      const prof = store.power.find((x) => x.kind === 'profile' && x.id === e.profile);
      if (!prof) p.push(`unknown profile ${e.profile}`);
      if (!store.power.some((x) => x.kind === 'tier' && x.tier === G.tierAbs(e))) p.push(`tier ${G.tierAbs(e)} has no power level (add it under tier power levels)`);
    }
    if (!(withC(() => G.enemyBase(e)).maxHp > 0)) p.push('hp must be above 0');
    if (!(e.limit >= 1)) p.push('max kills must be at least 1');
    for (const u of e.skills || []) {
      const k = G.withContent(content(), () => G.skillDef(u.skill));
      if (k && playerSkillIds().has(u.skill)) p.push(`${u.skill} ${k.name} is a player skill (enemies use monster skills, M..)`);
      if (!k) p.push(`unknown skill ${u.skill}`);
      else if (u.level > k.levels.length) p.push(`${u.skill} has no level ${u.level}`);
    }
    (e.rewards || []).forEach((r, i) => { if (!G.STAT_LABEL[r.stat]) p.push(`attribute reward ${i + 1} has no attribute`); });
    for (const u of e.skillRewards || []) {
      const k = S().find((x) => x.id === u.skill);
      if (!k) { p.push(`skill reward: unknown skill ${u.skill}`); continue; }
      if (u.level < 1 || u.level > k.levels.length) p.push(`${u.skill} has no level ${u.level} (max ${k.levels.length})`);
      const n = killsOf(e, u.at);
      // kills above max kills are allowed: max kills grow with prestiges (up to the rank's cap)
      const top = G.capOf(e);
      if (!(n >= 1) || n > top) p.push(`${u.skill} lv${u.level} is awarded at kill ${u.at}, outside 1–${top}`);
      const key = `${u.skill} lv${u.level}`;
      if (!G.inDev(e)) awarded.set(key, [...(awarded.get(key) || []), e.id]);
    }
  }
  for (const [key, who] of awarded) if (who.length > 1) out.push(`${key} is awarded more than once (${who.join(', ')}); the first one counts`);
  // enemies in development: note awards already given by an enemy in the game
  for (const e of E().filter(G.inDev)) {
    for (const u of e.skillRewards || []) {
      const who = awarded.get(`${u.skill} lv${u.level}`);
      if (who) per.get(e).push(`${u.skill} lv${u.level} is also awarded by ${who.join(', ')} (in the game)`);
    }
  }
  return { out, per };
}

// ---------- rendering ----------
function attrsField(e, i) {
  const rankRow = `<tr><td class="lbl">rank</td><td>${select(`data-i="${i}" data-p="rank" data-t="rank"`, Object.entries(RANKS).map(([k, r]) => [k, `${r.label} (${r.limit} kills)`]), G.rankOf(e))}</td><td></td></tr>`;
  const profs = store.power.filter((x) => x.kind === 'profile');
  const profOpts = [['', 'none (own attributes only)'], ...profs.map((x) => [x.id, x.name && x.name !== x.id ? `${x.id} ${x.name}` : x.id])];
  if (e.profile && !profs.some((x) => x.id === e.profile)) profOpts.push([e.profile, `${e.profile} (unknown)`]);
  const profRow = `<tr><td class="lbl">profile</td><td>${select(`data-i="${i}" data-p="profile" data-t="profile"`, profOpts, e.profile || '')}</td><td></td></tr>`;
  // with a profile, hp comes from the tier power level and own values are extra on top
  const req = (a) => a.required && !(e.profile && a.key === 'maxHp');
  const label = (a) => (e.profile && a.path.startsWith('base.') ? `+ ${a.label} (extra)` : a.label);
  const rows = rankRow + profRow + ATTR_DEFS.filter((a) => req(a) || getP(e, a.path) !== undefined).map((a) => {
    const v = getP(e, a.path);
    const input = a.bool ? boolInput(i, a.path, v) : numInput(i, a.path, v, { int: a.int });
    return `<tr><td class="lbl">${label(a)}</td><td>${input}</td><td>${req(a) ? '' : xBtn('attr-del', `data-i="${i}" data-p="${a.path}"`)}</td></tr>`;
  }).join('');
  const missing = ATTR_DEFS.filter((a) => !req(a) && getP(e, a.path) === undefined);
  const add = missing.length
    ? `<div class="addrow">${select(`data-act="attr-add" data-i="${i}"`, [['', '+ attribute'], ...missing.map((a) => [a.key, a.label])], '')}</div>`
    : '';
  const n = ATTR_DEFS.filter((a) => getP(e, a.path) !== undefined).length;
  const b = withC(() => G.enemyBase(e));
  const rb = withC(() => G.rankBonus(e));
  const rbText = rb ? `<div class="calc">includes the ${G.rankOf(e)} bonus: +${num(rb * 100)}% on ${e.profile ? 'tier power × profile (extra attributes are added after it)' : 'its attributes'}; skills come after it</div>` : '';
  const calc = (e.profile
    ? `<div class="calc">tier ${G.tierAbs(e)} power × ${esc(e.profile)}${rb ? ` × ${G.rankOf(e)} bonus` : ''}${e.base ? ' + extra' : ''} → ${ATTRS.filter((a) => b[a.key]).map((a) => `${a.label} ${num(b[a.key])}`).join(' · ') || 'all 0'}</div>`
    : '<div class="calc">no profile: uses only the attributes set here</div>') + rbText;
  return field(`${e.id}:attrs`, 'attributes', `(${e.profile ? `${esc(e.profile)} profile` : n})`, `<table class="dev-table">${rows}</table>${add}${calc}`);
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
    const b = [`${a.kind} (${a.type})`];
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
  const ownBase = withC(() => G.enemyBase(e));
  const changed = ATTRS.filter((a) => Math.abs((unit[a.key] || 0) - (ownBase[a.key] || 0)) > 1e-9)
    .map((a) => `${a.label} ${num(unit[a.key])}`);
  if (changed.length) lines.push(`<div>with skills: ${changed.join(', ')}</div>`);
  if (unit.empowers.length) lines.push(`<div>empower: ${unit.empowers.map((p) => `+${fmt(p.mult * 100, 0)}% every ${num(p.cooldown)}s`).join(', ')}</div>`);
  const fromProfile = withC(() => G.enemySkills(e)).filter((u) => u.fromProfile);
  if (fromProfile.length) lines.unshift(`<div>from the ${esc(e.profile)} profile: ${fromProfile.map((u) => `${u.skill} lv${u.level || 1}`).join(', ')}</div>`);
  const used = new Set(own.map((u) => u.skill));
  const addable = opts.filter((k) => !used.has(k.id));
  const body = `${rows ? `<table class="dev-table">${rows}</table>` : fromProfile.length ? '<div class="muted">no own skills (only its profile\'s)</div>' : '<div class="muted">no skills: this enemy does not act</div>'}
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
  const rows = (e.rewards || []).map((r, j) => {
    const pct = r.type === 'percent';
    const show = (v) => (pct ? `${num(v * 100)}%` : num(v));
    const t = r.total || 0;
    const per = `+${show(t * G.rewardShare(e, 1))} per kill`;
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
  const how = 'every kill gives the same share (total / max kills).';
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
  const dev = G.inDev(e);
  // the summary line stays short: power level (vs the player preview);
  // hp, dps, skills, rewards etc. are inside the entry
  const pw = withC(() => G.enemyPower(e)).power;
  const ratio = `<span class="pwr" data-pw="${pw}">${ratioText(pw)}</span>`;
  const pwTip = 'power level = max hp × dps (dps before the player\'s defenses; burns on a 20 hp player). Compared with the player preview\'s power level';
  const summary = [`<span title="${pwTip}">power ${num(pw)}${ratio}</span>`];
  const n = E().length;
  return `<details class="en${dev ? ' wip' : ''}" data-key="${esc(e.id)}"${open.has(e.id) ? ' open' : ''}>
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

// Power level of the player preview (its kills, level and loaded skills);
// enemies show theirs relative to it.
let previewPower = 0;
const ratioText = (pw) => (previewPower > 0 ? ` (${num(pw / previewPower)}× player)` : '');
function updateRatios() {
  for (const el of document.querySelectorAll('#de-list .pwr')) {
    const txt = ratioText(Number(el.dataset.pw));
    if (el.textContent !== txt) el.textContent = txt;
  }
}

export function renderEnemies() {
  renderPower();
  previewPower = withC(() => G.playerPower(previewState())).power;
  const { out, per } = problems();
  // grouped by tier (absolute value: enemies in development sit with the tier
  // they're made for), keeping the file order inside each group
  const tiers = [...new Set(E().map(G.tierAbs))].sort((a, b) => a - b);
  $('#de-list').innerHTML = tiers.map((t) => {
    const list = E().map((e, i) => [e, i]).filter(([e]) => G.tierAbs(e) === t);
    return `<h3 class="de-tier">tier ${t}</h3>`
      + list.map(([e, i]) => enemyBlock(e, i, per.get(e))).join('');
  }).join('');
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
  if (t === 'profile') {
    if (el.value) e.profile = el.value; else delete e.profile;
  } else if (t === 'rank') {
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
      const k = newSkill(`${e.name} attack`, 'M'); // monster skill: enemies don't use player skills
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
// loaded skills (in slot order), skill levels set by hand ({ id: level },
// instead of the level from the kills) and player level of the preview
const PREVIEW_OPT_KEY = key('isfw.dev.preview.opts');
let pvOpts = { loaded: [], levels: {}, level: 0 };
try { const o = JSON.parse(localStorage.getItem(PREVIEW_OPT_KEY)) || {}; pvOpts = { loaded: o.loaded || [], levels: o.levels || {}, level: o.level || 0 }; } catch {}
const savePreview = () => {
  try {
    localStorage.setItem(PREVIEW_KEY, JSON.stringify(preview));
    localStorage.setItem(PREVIEW_OPT_KEY, JSON.stringify(pvOpts));
  } catch {}
};
let getGameState = () => null;

const PREVIEW_ATTRS = [
  ['maxHp', 'hp', 1], ['damage', 'dmg', 3], ['attackSpeed', 'aspd', 3], ['magicPower', 'mag pwr', 3],
  ['magicSpeed', 'mag spd', 3], ['maxMana', 'mp', 1], ['manaRegen', 'mp regen', 2], ['armor', 'armor', 1],
  ['block', 'block', 1], ['blockShred', 'block shred', 1], ['regenOutHp', 'regen idle', 1],
];

// The preview player: kills, player level, skill levels set by hand, then
// the loaded skills (those at level 1 or more; no slot limit here).
function previewState(withLevels = true) {
  return withC(() => {
    const s = G.newState();
    for (const r of preview) {
      const e = G.enemyDef(r.enemy);
      if (e) s.kills[e.id] = Math.max(0, Math.min(e.limit, Math.floor(r.kills || 0)));
    }
    s.level = Math.max(0, Math.floor(pvOpts.level || 0));
    if (withLevels) s.devLevels = { ...pvOpts.levels };
    G.syncSlots(s);
    // no slot limit in the preview: add a slot whenever they are all in use
    for (const id of pvOpts.loaded) {
      const added = !s.slots.includes(null);
      if (added) s.slots.push(null);
      if (!G.equip(s, id) && added) s.slots.pop(); // not loadable: drop the slot added for it
    }
    G.syncHp(s);
    return s;
  });
}

function renderPreview() {
  const s = previewState();
  const { d, base, skills, sps, slots } = withC(() => ({
    d: G.derived(s),
    base: G.derived(G.newState()),
    skills: G.playerSkills().map((k) => [k, G.skillLevel(s, k.id)]),
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
  // per skill: a toggle to load / unload it (disabled at level 0; no slot
  // limit) and its level (from the kills unless set here)
  const fromKills = previewState(false);
  const sk = skills.map(([k, lv]) => {
    const on = s.slots.includes(k.id);
    const kl = withC(() => G.skillLevel(fromKills, k.id));
    const why = lv < 1 ? 'disabled title="level 0: not unlocked"' : 'title="load / unload"';
    return `<tr${lv < 1 ? ' class="muted"' : ''}>
      <td><label class="pv-load"><input type="checkbox" data-pv="load" data-id="${esc(k.id)}" ${on ? 'checked' : ''} ${why}> ${k.id}</label></td>
      <td class="pv-name" title="${esc(k.name)}">${esc(k.name)}</td>
      <td class="nw">lv <input type="number" step="1" min="0" max="${k.levels.length}" class="w-lv" data-pv="slevel" data-id="${esc(k.id)}" value="${lv}"> <span class="muted">/ ${k.levels.length}</span>${lv !== kl ? ` <span class="warn" title="set by hand; the kills give level ${kl}">(kills ${kl})</span>` : ''}</td></tr>`;
  }).join('');
  const loaded = s.slots.filter(Boolean);
  const pp = withC(() => G.playerPower(s));
  previewPower = pp.power;
  updateRatios();
  const pwHtml = `<h2>power level</h2>
    <table class="dev-table kv">
      <tr><td class="lbl">hp × dps</td><td class="num">${num(pp.hp)} × ${num(pp.dps)}</td></tr>
      <tr><td class="lbl">power level</td><td class="num">${num(pp.power)}</td></tr>
    </table>
    <div class="calc">${loaded.length ? `with ${loaded.join(', ')} loaded` : 'no skill loaded: tick skills below to get a dps'} · enemies show their power level relative to this</div>`;
  const sp = sps.map(([k]) => `<div>${k.id} ${esc(k.name)}</div>`).join('');
  $('#de-preview').innerHTML = `
    <h2>player preview</h2>
    <div class="calc">attributes after these kills, at this level, with the ticked skills loaded (skill levels from the kills unless set below)</div>
    <table class="dev-table"><tr><td class="lbl">player level</td><td><input type="number" step="1" min="0" class="w-kill" data-pv="level" value="${esc(s.level)}"> <span class="muted">+${num(s.level)}% to all attributes</span></td></tr></table>
    ${rows ? `<table class="dev-table">${rows}</table>` : '<div class="muted">no kills</div>'}
    <div class="addrow">
      ${btn('+ enemy', 'pv-add')}
      ${btn('all at max', 'pv-max', '', 'quiet')}
      ${btn('from game', 'pv-game', '', 'quiet')}
      ${btn('clear', 'pv-clear', '', 'quiet')}
    </div>
    <h2>attributes</h2>
    <table class="dev-table kv">${attrs}</table>
    ${pwHtml}
    <h2>skills <span class="${loaded.length > slots ? 'warn' : 'muted'}" title="loaded skills / slots the player would have (no limit in this preview)">· ${loaded.length}/${slots} slots loaded</span></h2>
    <table class="dev-table pv-skills">${sk}</table>${sp ? `<h2>specials</h2>${sp}` : ''}`;
}

function onPreview(ev) {
  const el = ev.target;
  const j = Number(el.dataset.j);
  if (el.dataset.pv === 'enemy') preview[j].enemy = el.value;
  else if (el.dataset.pv === 'kills') preview[j].kills = Math.max(0, parseInt(el.value, 10) || 0);
  else if (el.dataset.pv === 'level') pvOpts.level = Math.max(0, parseInt(el.value, 10) || 0);
  else if (el.dataset.pv === 'slevel') {
    const v = parseInt(el.value, 10);
    if (!Number.isFinite(v)) return false;
    const k = withC(() => G.skillDef(el.dataset.id));
    const lv = Math.max(0, Math.min(k ? k.levels.length : v, v));
    const kl = withC(() => G.skillLevel(previewState(false), el.dataset.id));
    // back to the kills' level: no override
    if (lv === kl) delete pvOpts.levels[el.dataset.id]; else pvOpts.levels[el.dataset.id] = lv;
    if (lv < 1) pvOpts.loaded = pvOpts.loaded.filter((x) => x !== el.dataset.id);
  }
  else if (el.dataset.pv === 'load') {
    const id = el.dataset.id;
    pvOpts.loaded = pvOpts.loaded.filter((x) => x !== id);
    if (el.checked) pvOpts.loaded.push(id);
  } else return false;
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
  else if (act === 'pv-max') preview = E().filter((e) => !G.inDev(e)).map((e) => ({ enemy: e.id, kills: e.limit })); // the game's enemies only
  else if (act === 'pv-clear') { preview = []; pvOpts = { loaded: [], levels: {}, level: 0 }; }
  else if (act === 'pv-game') {
    // kills, player level and loaded skills of the game save (skill levels from the kills)
    const gs = getGameState();
    if (gs) {
      preview = Object.entries(gs.kills).filter(([, n]) => n > 0).map(([enemy, kills]) => ({ enemy, kills }));
      pvOpts = { loaded: (gs.slots || []).filter(Boolean), levels: {}, level: gs.level || 0 };
    }
  } else return;
  savePreview();
  renderPreview();
}

// ---------- wiring ----------
export function initEnemies(opts = {}) {
  if (opts.getState) getGameState = opts.getState;
  wire($('#de-list'), { input: onInput, action: onAction, rerender: renderEnemies, status: renderStatus });
  initPower({ rerender: renderEnemies });
  const pv = $('#de-preview');
  pv.addEventListener('input', (ev) => { if (['kills', 'level', 'slevel'].includes(ev.target.dataset.pv) && onPreview(ev)) renderPreviewKeepFocus(ev.target); });
  pv.addEventListener('change', (ev) => { if (onPreview(ev)) renderPreview(); });
  pv.addEventListener('click', (ev) => { const b = ev.target.closest('button[data-act]'); if (b) onPreviewAction(b); });

  $('#de-new').addEventListener('click', () => {
    const e = { id: nextId(E(), 'E', 3), name: 'new enemy', tier: 1, rank: 'common', profile: 'default', limit: RANKS.common.limit, skills: [], rewards: [{ stat: 'damage', total: 1 }], skillRewards: [] };
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
  const again = el.dataset.pv === 'slevel' ? document.querySelector(`#de-preview input[data-pv="slevel"][data-id="${CSS.escape(el.dataset.id)}"]`)
    : el.dataset.pv === 'level' ? document.querySelector('#de-preview input[data-pv="level"]')
    : document.querySelector(`#de-preview input[data-pv="kills"][data-j="${j}"]`);
  if (again) { again.focus(); const v = again.value; again.value = ''; again.value = v; }
}
