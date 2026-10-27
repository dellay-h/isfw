// Entry point: game loop, rendering and input.
import { ENEMIES, REGEN, USING_DRAFT, armorReduction } from './data.js';
import * as G from './game.js';
import { initDev, showDev } from './dev.js';
import { SITE, key } from './site.js';

let s = G.load();
const $ = (sel) => document.querySelector(sel);

const fmt = (n, d = 2) => Number(n).toFixed(d);
const signed = (n, d = 2) => (n >= 0 ? '+' : '') + fmt(n, d);
const time = (t) => new Date(t).toTimeString().slice(0, 8);
const esc = (str) => String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');


// ---------- static table rows ----------
// Rebuilt when the set of enemies not hidden (REVEAL) changes.
let targetsKey = '';
const visibleKey = () => G.visibleEnemies(s).map((e) => e.id).join(',');
function buildTargets() {
  const body = $('#targets tbody');
  body.innerHTML = '';
  targetsKey = visibleKey();
  // challenges first, then grouped by tier (stable within a group)
  const tierOf = (e) => (G.rankOf(e) === 'challenge' ? -1 : e.tier || 0);
  const byTier = G.visibleEnemies(s).map((e, i) => [e, i]).sort((a, b) => tierOf(a[0]) - tierOf(b[0]) || a[1] - b[1]).map(([e]) => e);
  const tag = { boss: 'warn', elite: 'muted', challenge: 'ok' };
  for (const e of byTier) {
    const tr = document.createElement('tr');
    const rank = G.rankOf(e);
    tr.dataset.id = e.id;
    if (body.lastElementChild && tierOf(G.enemyDef(body.lastElementChild.dataset.id)) !== tierOf(e)) tr.classList.add('tier-start');
    tr.innerHTML = `
      <td>${e.id}</td>
      <td class="num">${rank === 'challenge' ? '—' : tierOf(e)}</td>
      <td>${e.name}${tag[rank] ? ` <span class="${tag[rank]}">${rank}</span>` : ''}</td>
      <td><span class="hov" data-bd="stats:${e.id}">stats</span>${(e.skillRewards || []).length ? `<span class="m-only"><br><span class="hov" data-bd="unlocks:${e.id}">unlocks</span></span>` : ''}</td>
      <td>${(e.skillRewards || []).length ? `<span class="hov" data-bd="unlocks:${e.id}" data-f="unlocks">unlocks</span>` : '<span class="muted">—</span>'}</td>
      <td class="num">${G.rewardsOf(e).length ? `<span class="hov" data-bd="rewards:${e.id}" data-f="rewards"></span>` : '<span class="muted">—</span>'}</td>
      <td class="num" data-f="kills"></td>
      <td data-f="status"></td>
      <td><button data-act="run">run</button></td>`;
    body.appendChild(tr);
  }
}

// ---------- skill descriptions ----------
// Exact value for bonus texts: up to 3 decimals, no trailing zeros (0.5, not 1).
const exact = (n) => String(Number(Number(n).toFixed(3)));
const MOD_TEXT = {
  damage: (v) => `dmg +${exact(v * 100)}%`,
  damageFlat: (v) => `dmg +${exact(v)}`,
  attackSpeed: (v) => `aspd +${exact(v * 100)}%`,
  attackSpeedFlat: (v) => `aspd +${exact(v)}`,
  manaFlat: (v) => `max mp +${exact(v)}`,
  manaRegenFlat: (v) => `mp regen +${exact(v)}/s`,
  magicPowerFlat: (v) => `mag pwr +${exact(v)}`,
  magicSpeedFlat: (v) => `mag spd +${exact(v)}`,
  armorFlat: (v) => `armor +${exact(v)}`,
  blockFlat: (v) => `block +${exact(v)}`,
  blockShredFlat: (v) => `block shred +${exact(v)}/hit`,
  maxHp: (v) => `max hp +${exact(v * 100)}%`,
  hpFlat: (v) => `max hp +${exact(v)}`,
  regenFlat: (v) => `regen +${exact(v)} hp/s`,
  regenIn: (v) => `regen in process +${exact(v * 100)}% max hp/s`,
  regenOut: (v) => `regen idle +${exact(v * 100)}% max hp/s`,
  regenPct: (v) => `regen +${exact(v * 100)}% max hp/s`,
  lifesteal: (v) => `lifesteal +${exact(v * 100)}% of physical dmg`,
};
const modText = (k, v) => (MOD_TEXT[k] ? MOD_TEXT[k](v) : `${k} ${v}`);

// Seconds, 2 decimals without trailing zeros.
const secs = (x) => String(Number(Number(x).toFixed(2)));

// Hover formula: "label: Y = B + (A × attribute)".
const formula = (label, y, b, a, attr) => `${label}: ${exact(y)} = ${exact(b || 0)} + (${exact(a || 0)} × ${attr})`;

// An attack or spell. Formulas are only shown on hover.
function describeAction(kind, L, total, prev, d) {
  const a = total[kind];
  const ks = G.KIND_STATS[kind];
  const power = d[ks.power];
  const speed = d[ks.speed];
  const pl = G.STAT_LABEL[ks.power];
  const sl = G.STAT_LABEL[ks.speed];
  const n = (x) => x || 0;
  const tip = [];
  const bits = [];
  if (n(a.base) || n(a.scaling)) {
    tip.push(formula('hit', G.actionHit(a, power), a.base, a.scaling, pl));
    bits.push(`hit ${fmt(G.actionHit(a, power))}${n(a.hits) > 1 ? ` ×${a.hits}` : ''}`);
  }
  const rate = G.actionRate(a, speed);
  // seconds per use = 1 / (1 / interval + speed scaling x speed); only the result is shown
  bits.push(`cooldown ${rate > 0 ? `${secs(1 / rate)}s` : '—'}`);
  if (a.dot) {
    const o = a.dot;
    const p = [];
    if (o.pctMaxHp || o.pctScaling) {
      const pct = (n(o.pctMaxHp) + power * n(o.pctScaling)) * 100;
      p.push(`${exact(pct)}% target max hp`);
      tip.push(formula('burn % target max hp/s', pct, n(o.pctMaxHp) * 100, n(o.pctScaling) * 100, pl));
    }
    if (o.base || o.scaling) {
      p.push(fmt(G.actionHit(o, power)));
      tip.push(formula('burn/s', G.actionHit(o, power), o.base, o.scaling, pl));
    }
    bits.push(`burn ${p.join(' + ')}/s for ${fmt(n(o.duration), 0)}s`);
  }
  if (a.shield) {
    const o = a.shield;
    tip.push(formula('shield', G.actionHit(o, power), o.base, o.scaling, pl));
    bits.push(`shield ${fmt(G.actionHit(o, power))} for ${fmt(n(o.duration), 0)}s`);
  }
  if (a.heal) {
    const o = a.heal;
    bits.push(`heal ${o.pctMaxHp ? `${fmt(o.pctMaxHp * 100, 0)}% max hp + ` : ''}${fmt(G.actionHit(o, power))}`);
  }
  if (a.lifesteal) bits.push(`lifesteal ${fmt(a.lifesteal * 100, 0)}%`);
  if (a.cost) bits.push(`cost ${fmt(a.cost, 0)} mp`);
  // Only the word "attack" / "spell" is shown; its description and formulas
  // are in the hover.
  const type = G.damageType(a, kind);
  const lines = [`${type} damage`, ...bits];
  if (prev[kind]) {
    // later level: what it adds, then the resulting action
    const added = (obj, pre = '') => Object.entries(obj).flatMap(([k, v]) =>
      v && typeof v === 'object' ? added(v, `${pre}${k} `) : [`${pre}${k} ${typeof v === 'number' ? `+${fmt(v)}` : v}`]);
    lines.unshift(`adds ${added(L[kind]).join(', ')}`, '');
  }
  if (tip.length) lines.push('', ...tip);
  return `<span class="tip" tabindex="0" data-tip="${esc(lines.join('\n'))}">${kind}</span> <span class="muted">${type === 'physical' ? 'phys' : 'mag'}</span>`;
}

// One level's effect. L is what this level adds; total is the skill's data
// up to and including it; prev is the data before it.
function describe(L, total, prev, d) {
  const parts = [];
  for (const kind of ['attack', 'spell']) if (L[kind]) parts.push(describeAction(kind, L, total, prev, d));
  if (L.onHit) {
    const o = total.onHit;
    const f = formula('on hit', G.actionHit(o, d.damage), o.base, o.scaling, 'dmg');
    parts.push(`<span class="tip" tabindex="0" data-tip="${esc(f)}">on hit ${fmt(G.actionHit(o, d.damage))} ${G.damageType(o, 'onHit')} per attack hit</span>`);
  }
  if (L.empower) {
    const p = L.empower;
    if (!prev.empower) {
      parts.push(`next attack +${fmt((p.mult || 0) * 100, 0)}%, then ${fmt(p.cooldown || 0, 0)}s cooldown`);
      if (p.armorPen) parts.push(`armor pen ${fmt(p.armorPen, 0)}`);
    } else {
      if (p.mult) parts.push(`empowered attack +${fmt(p.mult * 100, 0)}%`);
      if (p.cooldown) parts.push(`cooldown ${p.cooldown > 0 ? '+' : ''}${fmt(p.cooldown, 1)}s`);
      if (p.armorPen) parts.push(`empowered attack armor pen +${fmt(p.armorPen, 0)}`);
    }
  }
  for (const [k, v] of Object.entries(L.mods || {})) parts.push(modText(k, v));
  if (L.slots) parts.push(`skill slots +${L.slots}`);
  return parts;
}

// "req E001 3/10", or "not awarded" when no enemy awards it.
// "lv2 req E002 3/50", or "lv2 not awarded" when no enemy awards it.
function reqText(r, level) {
  if (!r.enemy || !G.enemyDef(r.enemy)) return `lv${level} not awarded`;
  if (!G.enemyRevealed(s, G.enemyDef(r.enemy))) return `lv${level} req ???`;
  const need = G.reqKills(r, s);
  return `lv${level} req ${r.enemy} ${Math.min(s.kills[r.enemy] || 0, need)}/${need}`;
}

// One line per level; levels not yet reached are muted with their requirement.
function levelLines(k, lv, d) {
  return k.levels.map((L, i) => {
    const reached = i < lv;
    const r = G.levelReq(k, i);
    const total = G.mergeLevels(k.levels, i + 1);
    const prev = G.mergeLevels(k.levels, i);
    // one line per bonus, one "lvN" per level; the requirement on its own line
    const lines = describe(L, total, prev, d).map((x) => `<div>${x}</div>`);
    if (!reached) lines.push(`<div class="muted">${reqText(r, i + 1).replace(/^lv\d+ /, '')}</div>`);
    return `<div class="lvl ${reached ? '' : 'muted'}"><span class="lv muted">lv${i + 1}</span><div class="parts">${lines.join('')}</div></div>`;
  }).join('');
}

// ---------- attribute breakdowns ----------
// Rows: [label, value, class]
const GROUPS = ['enemies', 'prestige', 'skills'];
const sumV = (a) => a.reduce((x, y) => x + y.v, 0);

// Rows for a list of effects: ungrouped items (base) first, then one total
// per group (individual sources are not shown).
function grouped(items, show, rows, skipZero = false) {
  for (const x of items) if (!x.group && !(skipZero && !x.v)) rows.push([x.label, show(x.v, true)]);
  for (const g of GROUPS) {
    const members = items.filter((x) => x.group === g);
    if (members.length) rows.push([g, show(sumV(members))]);
  }
}

function enemyBreakdown(e, d) {
  const rows = [];
  const { total, parts, unit: u } = G.enemyDps(e, d.maxHp);
  // physical damage is reduced by your armor and block; magic isn't
  const vsT = (type, raw) => (type === 'physical' ? G.mitigate(raw, d.armor, d.block) : raw);
  const vsOnHit = u.onHits.reduce((x, o) => x + vsT(o.type, o.dmg), 0);
  const vsText = (v, raw) => (v !== raw ? ` <span class="muted">(${fmt(v)} vs you)</span>` : '');
  let vsYou = 0;
  for (const { a, onHit, hit, dot } of parts) {
    rows.push([a.name + (a.countdown ? ' (special)' : ''), `${a.kind}, ${a.type}, every ${fmt(a.interval, 1)}s`, 'head']);
    if (a.hit) rows.push(['hit', `${fmt(a.hit)}${a.hits > 1 ? ` ×${a.hits}` : ''}${vsText(vsT(a.type, a.hit), a.hit)}`]);
    if (onHit) rows.push(['on hit', `${fmt(onHit)}${a.hits > 1 ? ` ×${a.hits}` : ''}${vsText(vsOnHit, onHit)}`]);
    if (a.dot) {
      const p = [];
      if (a.dot.pct) p.push(`${exact(a.dot.pct * 100)}% max hp`);
      if (a.dot.dps) p.push(fmt(a.dot.dps));
      rows.push(['dot, stacks', `${p.join(' + ')}/s for ${fmt(a.dot.duration, 0)}s`]);
    }
    if (a.shield) rows.push(['shield', `${fmt(a.shield.amount)} for ${fmt(a.shield.duration, 0)}s`]);
    if (a.lifesteal) rows.push(['lifesteal', `${fmt(a.lifesteal * 100, 0)}%`]);
    if (a.heal) rows.push(['heals itself', fmt(a.heal)]);
    if (a.cost) rows.push(['mana', `${fmt(a.cost, 0)} per use`]);
    if (hit || dot) rows.push(['dps', a.countdown ? `${fmt(hit + dot)} <span class="muted">not in total</span>` : fmt(hit + dot)]);
    if (!a.countdown) vsYou += a.rate * a.hits * (vsT(a.type, a.hit) + (onHit ? vsOnHit : 0)) + dot;
  }
  if (u.empowers.length) rows.push(['empowered attacks', u.empowers.map((p) => `+${fmt(p.mult * 100, 0)}% / ${fmt(p.cooldown, 0)}s`).join(', ')]);
  rows.push(['total', fmt(total), 'total']);
  rows.push(['vs your armor/block', fmt(vsYou)]);
  return rows;
}

// Enemy stats hover: attributes, then its attacks and spells.
function statsBreakdown(e, d) {
  const u = G.enemyUnit(e);
  const rows = [['attributes', '', 'head'], ['hp', fmt(u.maxHp, 0)]];
  if (u.regenInHp) rows.push([u.regenInHp < 0 ? 'decay' : 'regen', `${signed(u.regenInHp, 1)}/s${u.regenIn ? ` <span class="muted">(${fmt(u.regenIn * 100, 1)}% max hp)</span>` : ''}`]);
  if (u.armor) rows.push(['armor', `${fmt(u.armor, 0)} <span class="muted">(-${fmt(armorReduction(u.armor) * 100, 0)}% physical dmg)</span>`]);
  if (u.block) rows.push(['block', fmt(u.block, 1)]);
  for (const [k, label, dp] of [['damage', 'dmg', 2], ['attackSpeed', 'aspd', 2], ['magicPower', 'mag pwr', 2], ['magicSpeed', 'mag spd', 2], ['maxMana', 'max mp', 0], ['manaRegen', 'mp regen', 2], ['blockShred', 'block shred', 1]]) {
    if (u[k]) rows.push([label, fmt(u[k], dp)]);
  }
  if (u.lifesteal) rows.push(['lifesteal', `${fmt(u.lifesteal * 100, 0)}% of physical dmg dealt`]);
  if (!u.actions.length) {
    rows.push(['actions', '', 'head'], ['none', 'does not attack']);
    return rows;
  }
  return rows.concat(enemyBreakdown(e, d));
}

// Rewards column: "earned/total attribute" per attribute reward.
const amount = (v, pct) => (pct ? `${num(v * 100)}%` : num(v));
const num = (v) => (v === 0 ? '0' : Math.abs(v) >= 100 ? fmt(v, 0) : String(Number(v.toPrecision(3))));
function rewardCounter(e) {
  const n = s.kills[e.id] || 0;
  return G.rewardsOf(e).map((r) => {
    const pct = r.type === 'percent';
    const t = r.total || 0;
    return `<div>${amount(t * G.rewardShare(e, n, s), pct)}/${amount(t * G.rewardShare(e, G.limitOf(s, e), s), pct)} ${G.STAT_LABEL[r.stat]}</div>`;
  }).join('');
}

// Unlocks hover: the skills this enemy awards and at which kill.
function unlocksBreakdown(e) {
  const rows = [['unlocks', `${s.kills[e.id] || 0}/${G.limitOf(s, e)} kills`, 'head']];
  const n = s.kills[e.id] || 0;
  for (const u of e.skillRewards || []) {
    const k = G.skillDef(u.skill);
    const need = G.reqKills({ enemy: e.id, at: u.at }, s);
    const raw = G.reqKills({ enemy: e.id, at: u.at });
    const at = u.at === 'first' ? 'first kill' : need < raw ? `kill ${need} (last, was ${raw})` : u.at === 'final' ? `kill ${e.limit}${G.limitOf(s, e) === e.limit ? ' (final)' : ''}` : `kill ${u.at}`;
    const label = k ? `${k.id} ${k.name}${k.levels.length > 1 ? ` lv${u.level}` : ''}${k.special ? ' <span class="muted">special</span>' : ''}` : u.skill;
    rows.push([label, n >= need ? `<span class="ok">${at} ✓</span>` : at]);
  }
  return rows;
}

// Rewards hover: attribute rewards (total, earned, next kill).
function rewardsBreakdown(e) {
  const rows = [];
  const n = s.kills[e.id] || 0;
  const lim = G.limitOf(s, e);
  const rs = G.rewardsOf(e);
  if (rs.length) {
    rows.push(['attributes', `${n}/${lim} kills`, 'head']);
    for (const r of rs) {
      const pct = r.type === 'percent';
      const show = (v) => (pct ? `+${fmt(v * 100, 2)}%` : `+${fmt(v, v < 1 ? 3 : 2)}`);
      const t = r.total || 0;
      rows.push([G.STAT_LABEL[r.stat], `${show(t * G.rewardShare(e, lim, s))} total`, 'grp']);
      if (lim !== e.limit) rows.push(['base', `${show(t)} over ${e.limit} kills`, 'sub']);
      rows.push(['earned', show(t * G.rewardShare(e, n, s))]);
      rows.push(['per kill', show(G.rewardStep(e, 1, r, s))]);
    }
  }
  if (!rows.length) rows.push(['none', '']);
  const g = G.limitGain(s, e);
  const st = G.limitState(s, e);
  if (G.isFixed(e)) {
    if (G.rankOf(e) !== 'challenge') rows.push(['max kills', `${lim} (fixed)`, 'head']);
  } else {
    rows.push(['max kills', `${lim}`, 'head']);
    rows.push(['base', `${e.limit}`]);
    rows.push([st.capped ? 'shrinking' : 'growing', st.capped ? `cap ${st.cap} reached, down to 1` : `up to ${st.cap}`]);
    if (g) rows.push(['next prestige', `${g > 0 ? '+' : ''}${g}`]);
  }
  return rows;
}

// Level bonus text: "+2%" on a positive value, "÷1.02" on a negative one
// (it shrinks towards 0, in the player's favour).
const levelText = (v, m) => (v >= 0 ? `+${fmt((m - 1) * 100, 0)}%` : `÷${fmt(m, 2)} (towards 0)`);

function breakdown(key, d) {
  if (key.startsWith('enemy:')) return enemyBreakdown(G.enemyDef(key.slice(6)), d);
  if (key.startsWith('stats:')) return statsBreakdown(G.enemyDef(key.slice(6)), d);
  if (key.startsWith('rewards:')) return rewardsBreakdown(G.enemyDef(key.slice(8)));
  if (key.startsWith('unlocks:')) return unlocksBreakdown(G.enemyDef(key.slice(8)));
  const P = d.parts;
  const sum = sumV;
  const rows = [];
  if (['maxHp', 'damage', 'attackSpeed', 'magicPower', 'magicSpeed', 'maxMana', 'manaRegen', 'armor', 'block'].includes(key)) {
    const dp = 3;
    grouped(P.flat[key], (v, plain) => (plain ? fmt(v, dp) : signed(v, dp)), rows);
    if (P.pct[key].length) {
      rows.push(['subtotal', fmt(sum(P.flat[key]), dp), 'sep']);
      grouped(P.pct[key], (v) => `${v >= 0 ? '+' : ''}${fmt(v * 100, 0)}%`, rows);
    }
    if (P.lvl !== 1) rows.push([`lvl ${s.level} bonus`, levelText(sum(P.flat[key]) * (1 + sum(P.pct[key])), P.lvl), 'sep']);
    rows.push(['total', fmt(d[key], dp), 'total']);
    if (key === 'armor') rows.push(['hit reduction', `${fmt(armorReduction(d.armor) * 100, 1)}%`]);
    if (key === 'block' && d.blockShred) rows.push(['your block shred', `${fmt(d.blockShred, 1)}/hit`]);
  } else if (key === 'dps') {
    if (!d.actions.length) rows.push(['no attack or spell loaded', '0']);
    for (const a of d.actions) {
      rows.push([`${a.id} ${G.skillDef(a.id).name}`, `${a.kind}, ${a.type}`, 'head']);
      if (a.hit) rows.push(['hit / interval', `${fmt(a.hit)}${a.hits > 1 ? ` ×${a.hits}` : ''} / ${secs(a.interval)}s = ${fmt(a.hit * a.hits * a.rate)}`]);
      if (a.kind === 'attack' && d.onHit) rows.push(['on hit / interval', `${fmt(d.onHit)}${a.hits > 1 ? ` ×${a.hits}` : ''} / ${secs(a.interval)}s = ${fmt(d.onHit * a.hits * a.rate)}`]);
      if (a.dot) rows.push(['burn (not in total)', `${a.dot.pct ? `${exact(a.dot.pct * 100)}% target hp + ` : ''}${fmt(a.dot.dps)}/s`]);
      if (a.shield) rows.push(['shield', `${fmt(a.shield.amount)} for ${fmt(a.shield.duration, 0)}s`]);
      if (a.cost) rows.push(['mana', `${fmt(a.cost * a.rate)}/s needed`]);
    }
    rows.push(['total', fmt(d.dps, 3), 'total']);
  } else if (key === 'regen') {
    const block = (title, st, total, baseFlat = 0) => {
      rows.push([title, '', 'head']);
      grouped(P.flat[st], (v) => `${fmt(v * 100, 1)}% max hp`, rows, true);
      grouped(P.pct[st], (v) => `${v >= 0 ? '+' : ''}${fmt(v * 100, 0)}% of that`, rows);
      // the % before the level bonus (the bonus row below applies to the whole sum)
      const pre = sum(P.flat[st]) * (1 + sum(P.pct[st]));
      if (pre) rows.push([`× ${fmt(d.maxHp, 0)} max hp`, fmt(pre * d.maxHp, 2)]);
      if (baseFlat) rows.push(['base flat', signed(baseFlat, 2)]);
      grouped(P.flat.regenFlat, (v) => signed(v, 2), rows, true);
      grouped(P.pct.regenFlat, (v) => `${v >= 0 ? '+' : ''}${fmt(v * 100, 0)}% flat regen`, rows);
      if (P.lvl !== 1 && total) rows.push([`lvl ${s.level} bonus`, levelText(total, P.lvl), 'sep']);
      rows.push(['total', `${fmt(total, 2)}/s`, 'total']);
    };
    block('idle', 'regenOut', d.regenOutHp, REGEN.outOfCombatFlat);
    block('in process', 'regenIn', d.regenInHp);
  }
  return rows;
}

const popup = $('#popup');
let popKey = null;
let popAnchor = null;

function renderPopup(d) {
  if (!popKey) return;
  popup.innerHTML = '<table>' + breakdown(popKey, d)
    .map(([l, v, c = '']) => `<tr class="${c}"><td>${l}</td><td class="num">${v}</td></tr>`)
    .join('') + '</table>';
}

// Phones: no hover. A tap opens the breakdown below the marker (kept inside
// the screen); tapping it again or anywhere else closes it.
const narrow = () => window.innerWidth <= 640;
let popOpened = 0;
function openPopup(q) {
  popAnchor = q;
  popKey = q.dataset.bd;
  popOpened = Date.now();
  renderPopup(G.derived(s));
  const r = q.getBoundingClientRect();
  if (narrow()) {
    popup.hidden = false;
    const w = popup.offsetWidth;
    popup.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + window.scrollX}px`;
    popup.style.top = `${r.bottom + window.scrollY + 4}px`;
    return;
  }
  if (/^(enemy|stats|rewards|unlocks):/.test(popKey)) {
    // below the marker, kept inside the window
    const w = 260;
    popup.style.left = `${Math.min(r.left, window.innerWidth - w - 8) + window.scrollX}px`;
    popup.style.top = `${r.bottom + window.scrollY + 4}px`;
  } else {
    const panel = q.closest('section').getBoundingClientRect();
    popup.style.left = `${panel.right + window.scrollX + 4}px`;
    popup.style.top = `${r.top + window.scrollY - 4}px`;
  }
  popup.hidden = false;
}
function closePopup() {
  popAnchor = popKey = null;
  popup.hidden = true;
}
document.addEventListener('mouseover', (ev) => {
  const q = ev.target.closest('[data-bd]');
  if (q && q !== popAnchor) openPopup(q);
});
document.addEventListener('click', (ev) => {
  const q = ev.target.closest('[data-bd]');
  if (!q) { if (popAnchor) closePopup(); return; }
  // a tap also sends mouseover just before the click: only a later tap closes
  if (q === popAnchor && Date.now() - popOpened > 400) closePopup();
  else if (q !== popAnchor) openPopup(q);
});
document.addEventListener('mouseout', (ev) => {
  if (narrow()) return; // phones close on the next tap instead
  if (popAnchor && ev.target.closest('[data-bd]') === popAnchor && !popAnchor.contains(ev.relatedTarget)) closePopup();
});

// ---------- render ----------
let lastLogKey = '';
let lastSkillKey = '';

function dotText(dots, maxHp = 0) {
  if (!dots.length) return '';
  const total = dots.reduce((a, x) => a + x.dps + (x.pct || 0) * maxHp, 0);
  return `<span class="muted">${dots[0].name} ×${dots.length} -${fmt(total)}/s</span>`;
}

function shieldText(sh) {
  return sh && sh.amount > 0 ? `<span class="muted">shield ${fmt(sh.amount, 1)} (${fmt(sh.left, 1)}s)</span>` : '';
}

function bar(cur, max) {
  const pct = Math.max(0, Math.min(1, cur / max)) * 100;
  return `<span class="bar"><span style="width:${pct}%"></span></span>`;
}

// New-skill notices: a "new" tag on the row, a count next to the library /
// special headers and on the phone's skills tab. Hovering a row (or loading
// the skill) marks it seen; on phones, leaving the skills tab marks all seen.
const newTag = (id) => (G.isFresh(s, id) ? '<span class="badge" title="new">•</span>' : '');
const freshAttr = (id) => (G.isFresh(s, id) ? ` data-fresh="${id}"` : '');
function renderNew() {
  const lib = G.playerSkills().filter((k) => G.isFresh(s, k.id) && G.skillVisible(s, k.id)).length;
  const sp = G.specials().filter((k) => G.isFresh(s, k.id) && G.skillVisible(s, k.id)).length;
  const put = (sel, n, text) => {
    const el = $(sel);
    el.hidden = !n;
    if (n && el.textContent !== text) el.textContent = text;
  };
  put('#new-lib', lib, `${lib} new`);
  put('#new-sp', sp, `${sp} new`);
  put('#m-new', lib + sp, `${lib + sp}`);
}
$('#skills').addEventListener('mouseover', (ev) => {
  const tr = ev.target.closest('tr[data-fresh]');
  if (tr && !narrow() && G.seeSkill(s, tr.dataset.fresh)) render();
});

function renderSkills(d) {
  // Rebuild only when something changed, so buttons stay clickable.
  // skills / specials no enemy that is not hidden can award stay hidden
  const lib = G.playerSkills().filter((k) => G.skillVisible(s, k.id));
  const sps = G.specials().filter((k) => G.skillVisible(s, k.id));
  const levels = lib.map((k) => G.skillLevel(s, k.id));
  const key = JSON.stringify([s.slots, s.prestige.free, s.prestige.freeOff, s.prestige.auto, s.prestige.shop, s.revealed, levels, sps.map((x) => G.skillLevel(s, x.id)), s.kills, s.fresh, fmt(d.damage, 3), fmt(d.attackSpeed, 3), fmt(d.magicPower, 3), fmt(d.magicSpeed, 3)]);
  if (key === lastSkillKey) return;
  lastSkillKey = key;


  $('#slots tbody').innerHTML = s.slots.map((id, i) => {
    const k = id && G.skillDef(id);
    if (!k) return `<tr><td class="muted">${i}</td><td class="muted" colspan="3">empty</td><td></td></tr>`;
    const lv = G.skillLevel(s, id);
    return `<tr><td class="muted">${i}</td><td>${k.id}</td><td>${k.name}</td><td>${levelLines(k, lv, d)}</td>
      <td><button data-act="unequip" data-i="${i}">unload</button></td></tr>`;
  }).join('') + G.freeSkills(s).map((id) => {
    // free skills (prestige shop): lv1 without unlocking, no slot; can be unloaded
    const k = G.skillDef(id);
    const lv = G.skillLevel(s, id);
    const on = G.freeActive(s, id);
    const tip = 'free skill, chosen at random on the last prestige: lv1 without unlocking it, uses no slot';
    const b = on ? `<button data-act="free-off" data-id="${id}">unload</button>` : `<button data-act="free-on" data-id="${id}">load</button>`;
    return `<tr${on ? '' : ' class="muted"'}><td class="muted"><span class="tip" tabindex="0" data-tip="${esc(tip)}">f</span></td><td>${k.id}</td><td>${k.name}</td><td>${levelLines(k, lv, d)}</td><td>${b}</td></tr>`;
  }).join('');

  const full = !s.slots.includes(null);
  // auto-equip toggle (prestige shop P08): skills already unlocked when the
  // next prestige starts, no more than the slots it starts with
  const autoN = G.autoSkills(s).length;
  const autoMax = G.startSlots(s);
  const autoBtn = (k) => {
    if (!G.canAuto(s, k.id)) return '';
    const on = G.isAuto(s, k.id);
    const tip = on
      ? 'Loaded into a slot at the start of every prestige. Click to turn off.'
      : `Load into a slot at the start of every prestige (up to ${autoMax}, the slots a prestige starts with).`;
    return `<div><button class="auto${on ? ' on' : ''}" data-act="${on ? 'auto-off' : 'auto-on'}" data-id="${k.id}" title="${esc(tip)}" ${on || G.canAutoOn(s, k.id) ? '' : 'disabled'}>auto ${on ? 'on' : 'off'}</button></div>`;
  };
  $('#library tbody').innerHTML = lib.map((k, idx) => {
    const lv = levels[idx];
    if (!lv) {
      return `<tr class="muted"><td></td><td>${k.id}</td><td>${k.name}</td><td>${reqText(G.levelReq(k, 0), 1)}</td><td>${autoBtn(k)}</td></tr>`;
    }
    const btn = G.isFree(s, k.id)
      ? (G.freeActive(s, k.id) ? '<span class="muted">free</span>' : `<button data-act="free-on" data-id="${k.id}">load</button>`)
      : s.slots.includes(k.id)
      ? '<span class="muted">loaded</span>'
      : `<button data-act="equip" data-id="${k.id}" ${full ? 'disabled' : ''}>load</button>`;
    return `<tr${freshAttr(k.id)}><td>${newTag(k.id)}</td><td>${k.id}</td><td>${k.name}</td><td>${levelLines(k, lv, d)}</td><td>${btn}${autoBtn(k)}</td></tr>`;
  }).join('');

  $('#special tbody').innerHTML = sps.map((x) => {
    const lv = G.skillLevel(s, x.id);
    if (!lv) {
      return `<tr class="muted"><td></td><td>${x.id}</td><td>${x.name}</td><td>${reqText(G.unlockReq(x.id, 1), 1)}</td><td></td></tr>`;
    }
    return `<tr${freshAttr(x.id)}><td>${newTag(x.id)}</td><td>${x.id}</td><td>${x.name}</td><td>${levelLines(x, lv, d)}</td><td class="muted">active</td></tr>`;
  }).join('');

  $('#slot-count').textContent = `${s.slots.filter(Boolean).length}/${s.slots.length}`;
  const ac = $('#auto-count');
  ac.hidden = !G.autoEquipOwned(s);
  ac.textContent = `auto ${autoN}/${autoMax}`;
  ac.title = 'skills auto-equipped at the start of a prestige / slots a prestige starts with';
}

function render() {
  if (visibleKey() !== targetsKey) buildTargets();
  const d = G.derived(s);

  $('#p-lvl').innerHTML = `<span class="muted">${fmt(s.xp, 0)}/${G.xpToNext(s)} xp</span> ${s.level}`;
  $('#p-xpbar').innerHTML = bar(s.xp, G.xpToNext(s));
  $('#p-lbonus').textContent = `+${fmt((G.levelBonus(s) - 1) * 100, 0)}%`;
  $('#p-hp').textContent = `${fmt(Math.max(0, s.hp), 1)} / ${fmt(d.maxHp, 1)}`;
  const mhp = `hp ${fmt(Math.max(0, s.hp), 0)}/${fmt(d.maxHp, 0)}${s.fight ? ` · ${s.fight.enemyId}` : s.retry ? ' · regen' : ''}`;
  if ($('#m-hp').textContent !== mhp) $('#m-hp').textContent = mhp;
  $('#p-hpbar').innerHTML = bar(s.hp, d.maxHp);
  $('#p-dmg').textContent = fmt(d.damage, 3);
  $('#p-aspd').textContent = fmt(d.attackSpeed, 3);
  $('#p-mpow').textContent = fmt(d.magicPower, 3);
  $('#p-mspd').textContent = fmt(d.magicSpeed, 3);
  $('#p-mp').textContent = `${fmt(s.mana, 1)} / ${fmt(d.maxMana, 0)}`;
  $('#p-mpbar').innerHTML = bar(s.mana, d.maxMana || 1);
  $('#p-mpregen').textContent = `${fmt(d.manaRegen, 2)}/s`;
  $('#p-armor').innerHTML = `<span class="muted">${fmt(armorReduction(d.armor) * 100, 0)}%</span> ${fmt(d.armor, 1)}`;
  $('#p-block').textContent = fmt(d.block, 1);
  $('#p-dps').textContent = fmt(d.dps, 3);
  $('#p-regen').textContent = `${fmt(s.fight ? d.regenInHp : d.regenOutHp, 1)}/s`;
  $('#st-fights').textContent = s.stats.fights;
  $('#st-wins').textContent = s.stats.wins;
  $('#st-losses').textContent = s.stats.losses;
  $('#st-ppoints').textContent = s.prestige.points;
  $('#st-pcount').textContent = s.prestige.count;
  renderPrestige();
  renderPopup(d);

  for (const tr of document.querySelectorAll('#targets tbody tr')) {
    const e = G.enemyDef(tr.dataset.id);
    const k = s.kills[e.id];
    const lim = G.limitOf(s, e);
    const g = G.limitGain(s, e);
    const kc = tr.querySelector('[data-f=kills]');
    const step = G.limitStep(s, e);
    const gs = g > 0 ? `+${g}` : `${g}`;
    const help = step > 0
      ? `Each kill increases maximum kills on next prestige, up to +${step}. Increases total attribute reward.`
      : `Each kill decreases maximum kills on next prestige, up to ${step}. Doesn't decrease total attribute reward.`;
    const kt = `<span class="nw">${k || 0}/${lim}</span>${g ? ` <span class="tip muted" tabindex="0" data-tip="${esc(help)}">(${gs})</span>` : ''}`;
    if (kc.dataset.v !== kt) { kc.dataset.v = kt; kc.innerHTML = kt; }
    const rc = tr.querySelector('[data-f=rewards]');
    if (rc) { const html = rewardCounter(e); if (rc.dataset.v !== html) { rc.dataset.v = html; rc.innerHTML = html; } }
    // active: in a fight with it, or regenerating to retry it (repeat after a defeat)
    const active = s.fight ? s.fight.enemyId === e.id : s.retry === e.id;
    const locked = !G.isUnlocked(s, e);
    tr.querySelector('[data-f=status]').textContent =
      locked ? 'locked' : active ? 'active' : k >= lim ? 'closed' : 'open';
    tr.classList.toggle('active', !!active);
    tr.classList.toggle('locked', locked);
    const b = tr.querySelector('button');
    const act = locked ? 'unlock' : active ? 'stop' : 'run';
    const label = locked ? `unlock ${G.unlockCostOf(e)} pt` : act;
    if (b.dataset.act !== act || b.textContent !== label) { b.dataset.act = act; b.textContent = label; }
    b.title = locked ? `costs ${G.unlockCostOf(e)} prestige point${G.unlockCostOf(e) === 1 ? '' : 's'}; stays unlocked through prestiges` : '';
    b.disabled = locked ? !G.canUnlock(s, e) : !active && (!!s.fight || k >= lim || s.hp <= 0);
  }

  const f = s.fight;
  const pane = $('#proc');
  if (f) {
    const e = G.enemyDef(f.enemyId);
    const u = G.enemyUnit(e);
    pane.innerHTML = `
      <div class="row"><span class="k">src</span><span class="v">${fmt(Math.max(0, s.hp), 1)} / ${fmt(d.maxHp, 1)}</span>${bar(s.hp, d.maxHp)}${dotText(f.pDots, d.maxHp)}${shieldText(f.pShield)}</div>
      ${d.maxMana ? `<div class="row"><span class="k">mp</span><span class="v">${fmt(s.mana, 1)} / ${fmt(d.maxMana, 0)}</span>${bar(s.mana, d.maxMana)}</div>` : ''}
      <div class="row"><span class="k">${e.id}</span><span class="v">${fmt(Math.max(0, f.eHp), 1)} / ${fmt(u.maxHp, 1)}</span>${bar(f.eHp, u.maxHp)}${dotText(f.eDots, u.maxHp)}${shieldText(f.eShield)}${u.block ? `<span class="muted">block ${fmt(f.eBlock, 1)}</span>` : ''}</div>
      <div class="row"><span class="k">t</span><span class="v">${fmt(f.elapsed, 1)}s</span>${d.actions.length ? '' : '<span class="muted">no attack or spell loaded</span>'}</div>
      ${d.empowers.map((p) => {
        const left = p.cooldown - (f.empower[p.id] || 0);
        return `<div class="row"><span class="k"></span><span class="v">${left > 0 ? fmt(left, 1) + 's' : 'ready'}</span><span class="muted">${p.id} ${G.skillDef(p.id).name}</span></div>`;
      }).join('')}
      ${u.actions.map((a) => {
        if (!a.countdown) return '';
        return `<div class="row warn"><span class="k"></span><span class="v">${fmt(Math.max(0, a.interval - (f.eTimers[a.key] || 0)), 1)}s</span><span>${e.id} ${a.name} (${fmt(a.hit, 0)})</span></div>`;
      }).join('')}`;
  } else if (s.retry) {
    pane.innerHTML = `
      <div class="row"><span class="k">src</span><span class="v">${fmt(Math.max(0, s.hp), 1)} / ${fmt(d.maxHp, 1)}</span>${bar(s.hp, d.maxHp)}</div>
      <div class="row muted">regenerating, retrying ${s.retry} at full hp</div>`;
  } else {
    pane.innerHTML = '<div class="row muted">idle</div>';
  }
  $('#btn-stop').disabled = !f && !s.retry;
  $('#auto').checked = s.repeat;

  renderSkills(d);
  renderNew();
  renderShop();

  const lt = s.log.length ? s.log[s.log.length - 1].t : 0;
  const logKey = `${s.log.length}:${lt}`;
  if (logKey !== lastLogKey) {
    lastLogKey = logKey;
    $('#log').innerHTML = s.log
      .slice(-80)
      .reverse()
      .map((l) => `<div class="${l.kind}"><span class="muted">${time(l.t)}</span> ${l.msg}</div>`)
      .join('');
  }
}

// ---------- input ----------
// The repeat checkbox is a saved setting; only the player changes it.
$('#targets').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'stop') { stop(); return; }
  const id = btn.closest('tr').dataset.id;
  if (btn.dataset.act === 'unlock') {
    if (G.unlockEnemy(s, id)) { G.save(s); render(); }
    return;
  }
  if (G.startFight(s, id)) {
    render();
  }
});

// Ends the current fight, or cancels the pending retry while regenerating.
function stop() {
  if (s.fight) G.log(s, `${s.fight.enemyId} aborted`, 'muted');
  else if (s.retry) G.log(s, `${s.retry} retry cancelled`, 'muted');
  G.stopFight(s);
  render();
}

$('#auto').addEventListener('change', (ev) => {
  s.repeat = ev.target.checked;
});

$('#btn-stop').addEventListener('click', stop);

$('#skills').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'equip') { G.equip(s, btn.dataset.id); G.seeSkill(s, btn.dataset.id); }
  if (btn.dataset.act === 'unequip') G.unequip(s, Number(btn.dataset.i));
  if (btn.dataset.act === 'free-on') G.setFreeActive(s, btn.dataset.id, true);
  if (btn.dataset.act === 'free-off') G.setFreeActive(s, btn.dataset.id, false);
  if (btn.dataset.act === 'auto-on' || btn.dataset.act === 'auto-off') { G.setAuto(s, btn.dataset.id, btn.dataset.act === 'auto-on'); G.save(s); }
  render();
});

// Prestige button: "prestige +N" (N = different bosses defeated this
// prestige). Always allowed. Two clicks, like reset.
function renderPrestige() {
  const b = $('#btn-prestige');
  const bosses = G.prestigeBosses(s);
  const gains = ENEMIES.map((e) => G.limitGain(s, e));
  const up = gains.filter((g) => g > 0).reduce((a, g) => a + g, 0);
  const down = gains.filter((g) => g < 0).reduce((a, g) => a - g, 0);
  b.title = `resets every count except challenges; +1 point per boss defeated${bosses.length ? `: ${bosses.map((e) => `${e.id} ${e.name}`).join(', ')}` : ' (none yet)'}; max kills +${up}${down ? ` / -${down}` : ''} in total`;
  if (!b.dataset.armed) {
    const label = `prestige +${bosses.length}`;
    if (b.textContent !== label) b.textContent = label;
  }
}

$('#btn-prestige').addEventListener('click', () => {
  const b = $('#btn-prestige');
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = 'confirm prestige';
    setTimeout(() => { delete b.dataset.armed; renderPrestige(); }, 3000);
    return;
  }
  delete b.dataset.armed;
  G.prestige(s);
  G.save(s);
  lastLogKey = lastSkillKey = lastShopKey = '';
  render();
});

// ---------- prestige shop ----------
let lastShopKey = '';
const effectText = (e) => `${G.STAT_LABEL[e.stat] || e.stat} +${e.kind === 'pct' ? `${exact(e.v * 100)}%` : exact(e.v)}`;
function shopLines(x) {
  const out = (x.effects || []).map(effectText);
  if (x.slots) out.push(`skill slots +${x.slots}`);
  if (x.startKills) {
    const e = G.enemyDef(x.startKills.enemy);
    const name = e ? e.name : x.startKills.enemy;
    out.push(`<span class="tip" tabindex="0" data-tip="${esc(`Every prestige starts with ${x.startKills.n} ${name} kill${x.startKills.n === 1 ? '' : 's'} per level already done (never above its max kills), with the rewards and unlocks of those kills. Applies from the next prestige.`)}">start kills +${x.startKills.n}</span>`);
  }
  if (x.autoEquip) out.push(`<span class="tip" tabindex="0" data-tip="${esc('Skills already unlocked when a prestige starts (challenge specials and head start kills) get an auto-equip toggle in the library: toggled skills are loaded into the slots at the start of every prestige, no more than the slots a prestige starts with.')}">auto-equip</span>`);
  if (x.free) out.push(`<span class="tip" tabindex="0" data-tip="${esc(`On every prestige, ${x.free === 1 ? 'one skill' : `${x.free} skills`} chosen at random from the skills unlocked in the prestige that ended is free in the next one: level 1 without unlocking it (higher levels need their usual unlocks), active without using a skill slot, and can be unloaded. Applies from the next prestige.`)}">free skill +${x.free}</span>`);
  return out.join(', ');
}
function renderShop() {
  const items = G.visibleShop(s);
  const key = JSON.stringify([s.prestige.points, s.prestige.shop, s.revealed]);
  if (key === lastShopKey) return;
  lastShopKey = key;
  $('#shop-points').textContent = `${s.prestige.points} pt${s.prestige.points === 1 ? '' : 's'}`;
  $('#shop-items tbody').innerHTML = items.map((x) => {
    const lv = G.shopLevel(s, x.id);
    const cost = G.shopCost(s, x.id);
    const btn = cost === null
      ? '<span class="muted">max</span>'
      : `<button data-act="buy" data-id="${x.id}" ${G.canBuy(s, x.id) ? '' : 'disabled'}>${cost} pt</button>`;
    return `<tr${lv ? '' : ' class="muted"'}><td>${x.id}</td><td>${x.name}<div class="muted">lv ${lv}/${x.max}</div></td><td>${shopLines(x)}<span class="muted">/lv</span></td><td>${btn}</td></tr>`;
  }).join('');
}

$('#shop').addEventListener('click', (ev) => {
  const btn = ev.target.closest('button[data-act=buy]');
  if (!btn) return;
  if (G.buy(s, btn.dataset.id)) {
    G.save(s);
    lastSkillKey = '';
    render();
  }
});

$('#btn-reset').addEventListener('click', () => {
  const b = $('#btn-reset');
  if (!b.dataset.armed) {
    b.dataset.armed = '1';
    b.textContent = 'confirm reset';
    setTimeout(() => { delete b.dataset.armed; b.textContent = 'reset'; }, 3000);
    return;
  }
  s = G.reset();
  delete b.dataset.armed;
  b.textContent = 'reset';
  lastLogKey = lastSkillKey = lastShopKey = '';
  render();
});

// ---------- phone section tabs ----------
// Only visible on narrow screens (css): one section of the monitor at a time.
const MTAB_KEY = key('isfw.mtab');
function setMtab(t) {
  // leaving the skills tab: its new skills have been seen
  if (document.body.dataset.mtab === 'skills' && t !== 'skills') G.seeAllSkills(s);
  document.body.dataset.mtab = t;
  for (const b of document.querySelectorAll('#mtabs [data-mtab]')) b.classList.toggle('on', b.dataset.mtab === t);
  try { localStorage.setItem(MTAB_KEY, t); } catch {}
  closePopup();
}
$('#mtabs').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-mtab]');
  if (b) { setMtab(b.dataset.mtab); window.scrollTo(0, 0); }
});
let mtab = 'run';
try { mtab = localStorage.getItem(MTAB_KEY) || 'run'; } catch {}
setMtab(document.querySelector(`#mtabs [data-mtab="${mtab}"]`) ? mtab : 'run');

// ---------- loop ----------
const TICK = 50;          // ms between simulation updates
const SUBSTEP = 0.05;     // max seconds simulated per sub-step
const MAX_CATCHUP = 3600; // cap seconds simulated after the tab was asleep
let last = performance.now();
let saveTimer = 0;

function tick() {
  const now = performance.now();
  let dt = Math.min((now - last) / 1000, MAX_CATCHUP);
  last = now;
  while (dt > 0) {
    const d = Math.min(dt, SUBSTEP);
    G.step(s, d);
    dt -= d;
  }
  saveTimer += TICK;
  if (saveTimer >= 2000) {
    saveTimer = 0;
    G.save(s);
  }
  render();
}

// ---------- views (top band nav) ----------
// The playable version (SITE.mode 'play') has no dev pages at all.
const PLAY = SITE.mode === 'play';
const VIEWS = PLAY ? { monitor: '#view-monitor' } : { monitor: '#view-monitor', 'dev/enemies': '#view-dev-enemies', 'dev/skills': '#view-dev-skills' };
if (PLAY) {
  for (const a of document.querySelectorAll('header nav a')) if (a.dataset.view !== 'monitor') a.remove();
}
if (SITE.mode === 'dev') {
  $('#version').textContent += ' · dev';
  $('#draft-tag').title = 'enemies/skills come from dev edits not committed to the dev branch yet';
}
function showView() {
  let v = location.hash.slice(1);
  if (v === 'dev') v = 'dev/enemies';
  if (!VIEWS[v]) v = 'monitor';
  if (PLAY && location.hash && location.hash !== '#monitor') history.replaceState(null, '', '#monitor');
  for (const [name, sel] of Object.entries(VIEWS)) $(sel).hidden = name !== v;
  for (const a of document.querySelectorAll('header nav a')) a.classList.toggle('on', a.dataset.view === v);
  document.title = `isfw / ${v}`;
  if (!PLAY) showDev(v.startsWith('dev/') ? v : null);
}
$('#draft-tag').hidden = !USING_DRAFT;
if (!PLAY) initDev({ getState: () => s });
window.addEventListener('hashchange', showView);
showView();

buildTargets();
if (!s.log.length) G.log(s, 'session initialised', 'muted');
render();
setInterval(tick, TICK);
window.addEventListener('beforeunload', () => G.save(s));
// Expose for debugging in the console.
window.isfw = { get state() { return s; }, G };
