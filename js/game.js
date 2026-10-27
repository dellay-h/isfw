// Game state and combat simulation. No DOM access here.
//
// The player and enemies are both "units": base attributes plus a set of
// active skills. A unit's attributes, attacks and spells are derived from
// those (see unit()). Combat runs the same rules for both sides.
import { PLAYER_BASE, ENEMIES, SKILLS, REGEN, SKILL_SLOTS, MODS, HEURISTIC, PRESTIGE_SHOP, LIMIT_GROWTH, RANKS, LEVELS, armorReduction } from './data.js';
import { key } from './site.js';

const SAVE_KEY = key('isfw.save.v3');
const LOG_MAX = 200;

// The enemy and skill lists everything below reads. The dev screens swap in
// their edited copies for previews (withContent).
let C = { enemies: ENEMIES, skills: SKILLS };
export function withContent(content, fn) {
  const prev = C;
  C = { ...C, ...content };
  try { return fn(); } finally { C = prev; }
}

export const enemyDef = (id) => C.enemies.find((e) => e.id === id);
export const skillDef = (id) => C.skills.find((k) => k.id === id);
export const specialDef = (id) => C.skills.find((k) => k.id === id && k.special);
export const specials = () => C.skills.filter((k) => k.special);
export const STAT_LABEL = {
  damage: 'dmg', maxHp: 'max hp', attackSpeed: 'aspd', magicPower: 'mag pwr', magicSpeed: 'mag spd',
  maxMana: 'max mp', manaRegen: 'mp regen', armor: 'armor', block: 'block', blockShred: 'block shred',
  regenFlat: 'regen',
};
export const rewardsOf = (e) => e.rewards || [];
// 'tutorial' | 'common' | 'elite' | 'boss'
export const rankOf = (e) => e.rank || (e.boss ? 'boss' : 'common');

export function newState() {
  return {
    hp: PLAYER_BASE.maxHp,               // current hp
    hpMax: PLAYER_BASE.maxHp,            // max hp that hp was last measured against (keeps % on change)
    mana: 0,                             // current mana
    kills: Object.fromEntries(C.enemies.map((e) => [e.id, 0])),
    slots: Array(SKILL_SLOTS).fill(null),
    fight: null,
    repeat: false,                       // repeat toggle: only the player changes it
    retry: null,                         // enemy id to rerun once hp is full (repeat after a defeat)
    log: [],
    stats: { fights: 0, wins: 0, losses: 0 },
    level: 1,                            // player level (kept through prestiges)
    xp: 0,                               // xp towards the next level
    known: {},                           // skills (and specials) ever unlocked: { id: true }
    fresh: {},                           // unlocked for the first time, not looked at yet: { id: true }
    prestige: { points: 0, count: 0, shop: {}, maxKills: {}, capped: {}, unlocked: {}, free: [], freeOff: {} }, // kept through prestiges; only a full reset clears it
                                         // shop: { item id: level bought }
                                         // maxKills: { enemy id: max kills after LIMIT_GROWTH }
                                         // capped: { enemy id: true } reached its cap (now shrinking)
                                         // unlocked: { enemy id: true } enemies bought with prestige points
                                         // free: [skill id] free skills this prestige (P06)
                                         // freeOff: { skill id: true } free skills the player unloaded
  };
}

export function load() {
  const s = newState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Attributes are never stored: every effect is recomputed from kills,
      // skill levels and loaded skills.
      Object.assign(s.stats, saved.stats || {});
      Object.assign(s.prestige, saved.prestige || {});
      s.prestige.shop = { ...(saved.prestige?.shop || {}) };
      s.prestige.maxKills = { ...(saved.prestige?.maxKills || {}) };
      s.prestige.capped = { ...(saved.prestige?.capped || {}) };
      // saves before v0.54 kept the kills added to the base limit
      if (saved.prestige?.limits && !saved.prestige.maxKills) {
        for (const [id, add] of Object.entries(saved.prestige.limits)) {
          const e = enemyDef(id);
          if (e && add > 0) s.prestige.maxKills[id] = e.limit + Math.floor(add);
        }
      }
      delete s.prestige.limits;
      s.prestige.unlocked = { ...(saved.prestige?.unlocked || {}) };
      s.prestige.free = Array.isArray(saved.prestige?.free) ? saved.prestige.free.filter((id) => skillDef(id) && !skillDef(id).special) : [];
      s.prestige.freeOff = { ...(saved.prestige?.freeOff || {}) };
      Object.assign(s.kills, saved.kills || {});
      // limits can be lowered: never keep more kills than an enemy allows
      for (const e of C.enemies) s.kills[e.id] = Math.max(0, Math.min(limitOf(s, e), Math.floor(s.kills[e.id] || 0)));
      syncSlots(s);
      if (Array.isArray(saved.slots)) {
        saved.slots.slice(0, s.slots.length).forEach((id, i) => { s.slots[i] = skillDef(id) ? id : null; });
      }
      s.log = Array.isArray(saved.log) ? saved.log.slice(-LOG_MAX) : [];
      s.hp = typeof saved.hp === 'number' ? saved.hp : PLAYER_BASE.maxHp;
      s.mana = typeof saved.mana === 'number' ? saved.mana : 0;
      s.repeat = !!saved.repeat;
      s.retry = saved.retry || null;
      s.hpMax = typeof saved.hpMax === 'number' ? saved.hpMax : null;
      s.level = Math.max(1, Math.floor(saved.level || 1));
      s.xp = Math.max(0, Number(saved.xp) || 0);
      s.known = { ...(saved.known || {}) };
      s.fresh = { ...(saved.fresh || {}) };
      // saves before v0.56 had no list: what is unlocked now counts as seen
      noteSkills(s, !!saved.known);
    }
  } catch { /* corrupt or unavailable storage: fresh state */ }
  s.slots = s.slots.map((id) => (id && canLoad(s, id) ? id : null));
  if (!s.hpMax) s.hpMax = derived(s).maxHp;
  syncHp(s);
  clampPools(s);
  return s;
}

export function save(s) {
  try {
    const { hp, hpMax, mana, kills, slots, stats, log, repeat, retry, prestige, known, fresh, level, xp } = s;
    localStorage.setItem(SAVE_KEY, JSON.stringify({ hp, hpMax, mana, kills, slots, stats, log, repeat, retry, prestige, known, fresh, level, xp }));
  } catch { /* storage unavailable: run without saving */ }
}

export function reset() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  return newState();
}

export function log(s, msg, kind = '') {
  s.log.push({ t: Date.now(), msg, kind });
  if (s.log.length > LOG_MAX) s.log.splice(0, s.log.length - LOG_MAX);
}

// When max hp changes, scale current hp so the hp % stays the same.
export function syncHp(s, d = derived(s)) {
  if (s.hpMax > 0 && d.maxHp !== s.hpMax) s.hp = s.hp * d.maxHp / s.hpMax;
  s.hpMax = d.maxHp;
}

function clampPools(s) {
  const d = derived(s);
  s.hp = Math.min(s.hp, d.maxHp);
  s.mana = Math.min(s.mana, d.maxMana);
}

// ---------- prestige ----------
// A soft reset, allowed at any time: every kill count goes back to 0 (and with
// it every kill reward and skill level), except challenge kills, which are
// kept (and so are the specials they award). It gives 1 prestige point per
// different boss defeated since the last prestige. Prestige points, shop
// upgrades, totals, log and the repeat setting are kept.
// ---------- max kills growth (LIMIT_GROWTH in data.js) ----------
// The rank's cap for max kills (never below the base limit).
// Ranks marked `fixed` (challenge, tutorial) never change max kills.
export const isFixed = (e) => !!RANKS[rankOf(e)]?.fixed;
export const capOf = (e) => (isFixed(e) ? e.limit : Math.max(e.limit, RANKS[rankOf(e)]?.cap ?? LIMIT_GROWTH.cap));
// lim: max kills this prestige; capped: reached the cap once (shrinking
// phase); pool: what all lim kills are worth, in base kills (grows with lim
// until the cap, then stays at the cap).
export function limitState(s, e) {
  const cap = capOf(e);
  if (isFixed(e)) return { lim: e.limit, cap, capped: false, pool: e.limit };
  const stored = Math.floor(s.prestige.maxKills[e.id] || 0);
  const lim = Math.max(1, stored > 0 ? Math.min(stored, cap) : e.limit);
  const capped = !!s.prestige.capped[e.id] || lim >= cap;
  return { lim, cap, capped, pool: capped ? cap : lim };
}
export const limitOf = (s, e) => (e ? limitState(s, e).lim : 0);
// Largest change in max kills this prestige can bring (with enough kills):
// + while growing, - after the cap (down to 1).
export function limitStep(s, e) {
  if (!e || isFixed(e)) return 0;
  const { lim, cap, capped } = limitState(s, e);
  const step = Math.ceil(lim * LIMIT_GROWTH.share);
  return capped ? -Math.max(0, Math.min(step, lim - 1)) : Math.max(0, Math.min(step, cap - lim));
}
// Change in max kills the next prestige will apply (1 per kill, up to
// limitStep).
export function limitGain(s, e) {
  const max = limitStep(s, e);
  const k = (e && s.kills[e.id]) || 0;
  return max < 0 ? -Math.min(k, -max) : Math.min(k, max);
}

// ---------- locked enemies ----------
// An enemy with unlockCost can't be fought until it is bought with that many
// prestige points. Stays unlocked through prestiges.
export const unlockCostOf = (e) => Math.max(0, Math.floor(e?.unlockCost || 0));
export const isUnlocked = (s, e) => !unlockCostOf(e) || !!s.prestige.unlocked[e.id];
export const canUnlock = (s, e) => !isUnlocked(s, e) && s.prestige.points >= unlockCostOf(e);

export function unlockEnemy(s, id) {
  const e = enemyDef(id);
  if (!e || !canUnlock(s, e)) return false;
  s.prestige.points -= unlockCostOf(e);
  s.prestige.unlocked[e.id] = true;
  log(s, `${e.id} ${e.name} unlocked (${s.prestige.points} point${s.prestige.points === 1 ? '' : 's'} left)`, 'warn');
  return true;
}

export const prestigeBosses = (s) => C.enemies.filter((e) => rankOf(e) === 'boss' && (s.kills[e.id] || 0) > 0);
export const prestigeGain = (s) => prestigeBosses(s).length;

export function prestige(s) {
  const gain = prestigeGain(s);
  // free skills for the next prestige: random picks among the skills
  // really unlocked in this one (a free skill's granted lv1 doesn't count)
  const pool = playerSkills().filter((k) => earnedLevel(s, k.id) > 0).map((k) => k.id);
  const free = [];
  for (let n = freeCount(s); n > 0 && pool.length; n--) free.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  s.prestige.free = free;
  s.prestige.freeOff = {};
  let grown = 0, shrunk = 0;
  for (const e of C.enemies) {
    const g = limitGain(s, e);
    if (!g) continue;
    const st = limitState(s, e);
    const lim = st.lim + g;
    s.prestige.maxKills[e.id] = lim;
    if (lim >= st.cap || st.capped) s.prestige.capped[e.id] = true;
    if (g > 0) grown++; else shrunk++;
  }
  s.fight = null;
  s.retry = null;
  s.kills = Object.fromEntries(C.enemies.map((e) => [e.id, rankOf(e) === 'challenge' ? s.kills[e.id] || 0 : 0]));
  const started = applyStartKills(s);
  s.slots = Array(SKILL_SLOTS).fill(null);
  syncSlots(s);
  noteSkills(s);
  s.prestige.points += gain;
  s.prestige.count++;
  for (const [e, n] of started) log(s, `${e.id} ${e.name} starts at ${n}/${limitOf(s, e)} kills (head start)`, 'warn');
  if (free.length) log(s, `free skill${free.length > 1 ? 's' : ''} this prestige (no slot needed): ${free.map((id) => `${id} ${skillDef(id).name}`).join(', ')}`, 'warn');
  const d = derived(s);
  s.hp = d.maxHp;
  s.hpMax = d.maxHp;
  s.mana = 0;
  log(s, `prestige ${s.prestige.count}: +${gain} point${gain === 1 ? '' : 's'} (${s.prestige.points} total), counts reset except challenges${grown ? `, max kills raised on ${grown} target${grown > 1 ? 's' : ''}` : ''}${shrunk ? `, max kills lowered on ${shrunk} target${shrunk > 1 ? 's' : ''}` : ''}`, 'warn');
  return gain;
}

// Kills every prestige starts with (shop startKills), per enemy id.
export function startKillsOf(s) {
  const out = {};
  for (const x of PRESTIGE_SHOP) {
    const lv = shopLevel(s, x.id);
    if (!lv || !x.startKills) continue;
    out[x.startKills.enemy] = (out[x.startKills.enemy] || 0) + x.startKills.n * lv;
  }
  return out;
}
// Adds them to the (just reset) kill counts; returns [[enemy, kills]] changed.
function applyStartKills(s) {
  const out = [];
  for (const [id, n] of Object.entries(startKillsOf(s))) {
    const e = enemyDef(id);
    if (!e || n <= 0) continue;
    const k = Math.min(limitOf(s, e), (s.kills[id] || 0) + Math.floor(n));
    if (k <= (s.kills[id] || 0)) continue;
    s.kills[id] = k;
    out.push([e, k]);
  }
  return out;
}

// ---------- prestige shop ----------
export const shopItems = () => PRESTIGE_SHOP;
export const shopDef = (id) => PRESTIGE_SHOP.find((x) => x.id === id);
export const shopLevel = (s, id) => Math.min(s.prestige.shop[id] || 0, shopDef(id)?.max ?? 0);
// Points for the next level, or null at max level.
export function shopCost(s, id) {
  const x = shopDef(id);
  const lv = shopLevel(s, id);
  if (!x || lv >= x.max) return null;
  return (x.cost?.base || 0) + (x.cost?.step || 0) * lv;
}
export const canBuy = (s, id) => { const c = shopCost(s, id); return c !== null && s.prestige.points >= c; };

export function buy(s, id) {
  if (!canBuy(s, id)) return false;
  const x = shopDef(id);
  s.prestige.points -= shopCost(s, id);
  s.prestige.shop[id] = shopLevel(s, id) + 1;
  syncSlots(s);
  syncHp(s);
  log(s, `prestige shop: ${x.id} ${x.name} lv${s.prestige.shop[id]} (${s.prestige.points} point${s.prestige.points === 1 ? '' : 's'} left)`, 'warn');
  return true;
}

// Attribute effects of the shop upgrades bought.
function shopEffects(s) {
  const out = [];
  for (const x of PRESTIGE_SHOP) {
    const lv = shopLevel(s, x.id);
    if (!lv) continue;
    for (const e of x.effects || []) out.push({ group: 'prestige', label: `${x.id} ${x.name} lv${lv}`, stat: e.stat, kind: e.kind, v: e.v * lv });
  }
  return out;
}

// ---------- player level (LEVELS in data.js) ----------
export const xpToNext = (s) => LEVELS.xpPer * s.level;
export const gameSpeed = (s) => 1 + LEVELS.speedPer * (s.level - 1);
export function gainXp(s, n = 1) {
  s.xp += n;
  while (s.xp >= xpToNext(s)) {
    s.xp -= xpToNext(s);
    s.level++;
    log(s, `level ${s.level} reached: game speed +${Math.round((gameSpeed(s) - 1) * 100)}%`, 'warn');
  }
}

// ---------- new-skill notices ----------
// The first time a skill or special is unlocked (ever: unlocking it again
// after a prestige doesn't count), it is marked fresh until the player looks
// at it. Kept through prestiges; a full reset clears it.
export function noteSkills(s, markFresh = true) {
  for (const k of C.skills) {
    if (s.known[k.id] || skillLevel(s, k.id) < 1) continue;
    s.known[k.id] = true;
    if (markFresh) s.fresh[k.id] = true;
  }
}
export const isFresh = (s, id) => !!s.fresh[id];
export function seeSkill(s, id) {
  if (!s.fresh[id]) return false;
  delete s.fresh[id];
  return true;
}
export function seeAllSkills(s) {
  const any = Object.keys(s.fresh).length > 0;
  s.fresh = {};
  return any;
}

// ---------- skill unlocks ----------
// Each enemy lists the skill levels it awards the player:
//   skillRewards: [{ skill, level, at: 'first' | 'final' | kill count }]
// A level nobody awards has { enemy: null } and can't be reached.
export function unlockReq(skillId, level = 1) {
  for (const e of C.enemies) {
    for (const u of e.skillRewards || []) {
      if (u.skill === skillId && (u.level || 1) === level) return { enemy: e.id, at: u.at ?? 'first' };
    }
  }
  return { enemy: null, at: 'first' };
}

// Requirement for level i (0-based) of a skill.
export const levelReq = (k, i) => unlockReq(k.id, i + 1);

// Kills needed for a requirement: 'first' = 1, 'final' = base limit, or a
// number. With a state, once the enemy's max kills are shrinking (after the
// cap): never more than its current max kills, so the last kill meets any
// higher requirement. While growing, the requirement stands as it is.
export function reqKills(req, s = null) {
  const e = enemyDef(req.enemy);
  if (!e) return Infinity;
  const n = typeof req.at === 'number' ? req.at : req.at === 'final' ? e.limit : 1;
  if (!s) return n;
  const st = limitState(s, e);
  return st.capped ? Math.min(n, st.lim) : n;
}

export function reqMet(s, req) {
  return (s.kills[req.enemy] || 0) >= reqKills(req, s);
}

// Level is derived from kills: levels are reached in order while their
// requirements are met.
// A free skill (prestige shop P06) starts at lv1 without its unlock; its
// higher levels still need their requirements.
export function skillLevel(s, id) {
  const k = skillDef(id);
  if (!k) return 0;
  let lv = !k.special && s.prestige.free.includes(id) ? 1 : 0;
  while (lv < k.levels.length && reqMet(s, levelReq(k, lv))) lv++;
  return lv;
}
// Level from kills alone (ignores the free lv1).
function earnedLevel(s, id) {
  const k = skillDef(id);
  if (!k) return 0;
  let lv = 0;
  while (lv < k.levels.length && reqMet(s, levelReq(k, lv))) lv++;
  return lv;
}

// Skills the player can ever get (awarded by some enemy), not specials.
export const playerSkills = () => C.skills.filter((k) => !k.special && k.levels.some((_, i) => levelReq(k, i).enemy));
export const specialUnlocked = (s, id) => !!specialDef(id) && skillLevel(s, id) > 0;
// Free skills (prestige shop P06): active without a slot (never loaded into
// one); the player can unload them and load them again.
export const freeCount = (s) => PRESTIGE_SHOP.reduce((n, x) => n + (x.free || 0) * shopLevel(s, x.id), 0);
export const freeSkills = (s) => s.prestige.free.filter((id) => skillDef(id));
export const isFree = (s, id) => s.prestige.free.includes(id);
export const freeActive = (s, id) => isFree(s, id) && !s.prestige.freeOff[id];
export function setFreeActive(s, id, on) {
  if (!isFree(s, id)) return false;
  if (on) delete s.prestige.freeOff[id]; else s.prestige.freeOff[id] = true;
  syncHp(s);
  clampPools(s);
  return true;
}
const canLoad = (s, id) => { const k = skillDef(id); return !!k && !k.special && !isFree(s, id) && skillLevel(s, id) > 0; };

// Sum of levels 1..lv: numbers add, nested objects merge, other values replace.
function addInto(dst, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (typeof v === 'number') dst[k] = (typeof dst[k] === 'number' ? dst[k] : 0) + v;
    else if (v && typeof v === 'object' && !Array.isArray(v)) dst[k] = addInto(dst[k] && typeof dst[k] === 'object' ? dst[k] : {}, v);
    else dst[k] = v;
  }
  return dst;
}
export function mergeLevels(levels, lv) {
  return levels.slice(0, lv).reduce((out, L) => addInto(out, L), {});
}

export const levelData = (s, id) => {
  const lv = skillLevel(s, id);
  return lv ? mergeLevels(skillDef(id).levels, lv) : null;
};

export function slotCount(s) {
  let n = SKILL_SLOTS;
  for (const k of specials()) {
    const L = levelData(s, k.id);
    if (L) n += L.slots || 0;
  }
  for (const x of PRESTIGE_SHOP) n += (x.slots || 0) * shopLevel(s, x.id);
  return n;
}

// Grow (or shrink) the slot list to match the current slot count.
function syncSlots(s) {
  const n = slotCount(s);
  while (s.slots.length < n) s.slots.push(null);
  if (s.slots.length > n) s.slots.length = n;
}

export function equip(s, id) {
  if (!canLoad(s, id) || s.slots.includes(id)) return false;
  const i = s.slots.indexOf(null);
  if (i < 0) return false;
  s.slots[i] = id;
  syncHp(s);
  return true;
}

export function unequip(s, i) {
  if (!s.slots[i]) return false;
  s.slots[i] = null;
  syncHp(s);
  clampPools(s);
  return true;
}

// ---------- units ----------
// Which stats an action kind uses.
export const KIND_STATS = {
  attack: { power: 'damage', speed: 'attackSpeed' },
  spell: { power: 'magicPower', speed: 'magicSpeed' },
};
export const actionHit = (a, power) => (a.base || 0) + power * (a.scaling || 0);
export const actionRate = (a, speed) => (a.time ? 1 / a.time : 0) + (a.speedScaling || 0) * speed;

// Attributes are never modified directly. Everything that changes one is an
// effect { group, label, stat, kind: 'flat' | 'pct', v }.
// group is 'enemies' (kill rewards), 'skills' (active skills) or 'prestige'
// (prestige shop).
// Each attribute = (base + sum of flat effects) x (1 + sum of pct effects).
const STATS = ['maxHp', 'damage', 'attackSpeed', 'magicPower', 'magicSpeed', 'maxMana', 'manaRegen',
  'armor', 'block', 'blockShred', 'regenFlat', 'regenIn', 'regenOut', 'lifesteal'];
const ZERO = Object.fromEntries(STATS.map((k) => [k, 0]));
const PLAYER = () => ({ ...ZERO, ...PLAYER_BASE, regenIn: REGEN.inCombat, regenOut: REGEN.outOfCombat });

// Damage types. Every attack, spell and on-hit has one: physical (reduced
// by armor and block, feeds the lifesteal attribute) or magic (ignores armor
// and block). Defaults: attacks and on-hit physical, spells magic.
export const DAMAGE_TYPES = ['physical', 'magic'];
export const damageType = (def, kind) => (DAMAGE_TYPES.includes(def?.type) ? def.type : kind === 'spell' ? 'magic' : 'physical');

const modEffects = (label, mods) => Object.entries(mods || {}).flatMap(([k, v]) =>
  (MODS[k] ? MODS[k].to : []).map(([stat, kind]) => ({ group: 'skills', label, stat, kind, v })));

// base: attribute values; active: [{ id, L }] merged level data of each active
// skill; extra: other effects (kill rewards).
function unit(base, active, extra = [], idleFlat = 0) {
  const flat = {}, pct = {};
  for (const st of STATS) {
    flat[st] = [{ label: 'base', v: base[st] || 0 }];
    pct[st] = [];
  }
  const fx = [...extra];
  for (const { id, L } of active) fx.push(...modEffects(`${id} ${skillDef(id)?.name ?? ''}`, L.mods));
  for (const x of fx) (x.kind === 'pct' ? pct : flat)[x.stat].push(x);

  const sum = (arr) => arr.reduce((a, x) => a + x.v, 0);
  const val = {};
  for (const st of STATS) val[st] = sum(flat[st]) * (1 + sum(pct[st]));

  const empowers = [];
  const onHits = [];
  const actions = [];
  for (const { id, L } of active) {
    const name = skillDef(id)?.name ?? id;
    if (L.empower) {
      empowers.push({ id, mult: L.empower.mult || 0, cooldown: L.empower.cooldown || 0, armorPen: L.empower.armorPen || 0 });
    }
    if (L.onHit) onHits.push({ id, dmg: actionHit(L.onHit, val.damage), type: damageType(L.onHit, 'onHit') });
    for (const kind of ['attack', 'spell']) {
      const def = L[kind];
      if (!def) continue;
      const ks = KIND_STATS[kind];
      const power = val[ks.power];
      const rate = actionRate(def, val[ks.speed]);
      if (rate <= 0) continue;
      actions.push({
        id, kind, def, name,
        type: damageType(def, kind),
        key: `${id}:${kind}`,
        hit: actionHit(def, power),
        hits: def.hits || 1,
        rate,
        interval: 1 / rate,
        cost: def.cost || 0,
        // the skill's own lifesteal (on all its damage); the unit's lifesteal
        // attribute is added on physical damage when it hits (use())
        lifesteal: def.lifesteal || 0,
        countdown: !!def.countdown,
        // % of target max hp per second = pctMaxHp + power x pctScaling; plus a flat base + power x scaling
        dot: def.dot ? { pct: (def.dot.pctMaxHp || 0) + power * (def.dot.pctScaling || 0), dps: actionHit(def.dot, power), duration: def.dot.duration || 0 } : null,
        shield: def.shield ? { amount: actionHit(def.shield, power), duration: def.shield.duration || 0 } : null,
        heal: def.heal ? (def.heal.pctMaxHp || 0) * val.maxHp + actionHit(def.heal, power) : 0,
      });
    }
  }
  const onHit = onHits.reduce((a, x) => a + x.dmg, 0);
  return {
    ...val,
    actions,
    empowers,
    onHits,
    onHit,
    // direct hit damage per second, incl. on-hit (burns depend on the target, not included)
    dps: actions.filter((x) => !x.countdown).reduce((a, x) => a + x.rate * x.hits * (x.hit + (x.kind === 'attack' ? onHit : 0)), 0),
    // hp per second
    regenInHp: val.regenIn * val.maxHp + val.regenFlat,
    regenOutHp: val.regenOut * val.maxHp + val.regenFlat + idleFlat,
    parts: { flat, pct },
  };
}

// Share of an enemy's base total earned after n kills. Without a state: the
// base max kills (each kill 1 / limit). With a state: the current max kills
// (LIMIT_GROWTH), each kill giving pool / lim of a base kill, so the share at
// lim kills is pool / limit (above 1 once max kills have grown).
export function rewardShare(e, n, s = null) {
  if (!(n > 0) || !(e.limit > 0)) return 0;
  if (!s) return Math.min(n, e.limit) / e.limit;
  const { lim, pool } = limitState(s, e);
  return (Math.min(n, lim) * pool) / (lim * e.limit);
}

// Balancing heuristic: the total a common enemy's reward should have so that
// defeating it fully raises the player's attribute by HEURISTIC.share, measured
// with every enemy of a lower tier fully defeated (kill rewards only).
export function suggestTotal(e, r) {
  if (r.type === 'percent') return { total: HEURISTIC.share, value: null };
  const kills = {};
  for (const x of C.enemies) if ((x.tier || 0) < (e.tier || 0)) kills[x.id] = x.limit;
  const s = newState();
  Object.assign(s.kills, kills);
  const d = derived(s);
  const value = (d[r.stat] || 0) + (HEURISTIC.offset[r.stat] || 0);
  return { total: Number((HEURISTIC.share * value).toPrecision(3)), value, attr: d[r.stat] || 0 };
}

// Kill-reward effects for a kill set.
export function killEffects(kills, s = null) {
  const out = [];
  for (const e of C.enemies) {
    const n = kills[e.id] || 0;
    if (!n) continue;
    const share = rewardShare(e, n, s);
    for (const r of rewardsOf(e)) {
      out.push({
        group: 'enemies',
        label: `${e.id} ${e.name} ×${n}`,
        stat: r.stat,
        kind: r.type === 'percent' ? 'pct' : 'flat',
        v: (r.total || 0) * share,
      });
    }
  }
  return out;
}

// Player: base attributes + kill rewards + prestige shop + unlocked specials
// + loaded skills.
export function derived(s) {
  const active = [];
  for (const k of specials()) {
    const L = levelData(s, k.id);
    if (L) active.push({ id: k.id, L });
  }
  for (const id of s.slots) {
    const L = id && levelData(s, id);
    if (L) active.push({ id, L });
  }
  for (const id of freeSkills(s)) {
    const L = freeActive(s, id) && !s.slots.includes(id) && levelData(s, id);
    if (L) active.push({ id, L });
  }
  return unit(PLAYER(), active, [...killEffects(s.kills, s), ...shopEffects(s)], REGEN.outOfCombatFlat);
}

// Enemy: its base attributes + its skills (always active, at the listed level).
export function enemyUnit(e) {
  const active = [];
  for (const u of e.skills || []) {
    const k = skillDef(u.skill);
    if (k) active.push({ id: k.id, L: mergeLevels(k.levels, Math.min(u.level || 1, k.levels.length)) });
  }
  return unit({ ...ZERO, ...(e.base || {}) }, active);
}

// Size of each reward's increase from the n-th kill (for the log).
export function rewardStep(e, n, r = rewardsOf(e)[0], s = null) {
  return r ? (r.total || 0) * (rewardShare(e, n, s) - rewardShare(e, n - 1, s)) : 0;
}

// Sustained damage per second of an enemy's actions, before the player's
// defenses. Dots count every stack they keep up. Countdown actions are
// listed but not included in the total.
export function enemyDps(e, playerMaxHp) {
  const u = enemyUnit(e);
  const parts = u.actions.map((a) => {
    const onHit = a.kind === 'attack' ? u.onHit : 0;
    const dot = a.dot ? (a.dot.dps + a.dot.pct * playerMaxHp) * a.dot.duration : 0;
    return { a, onHit, hit: a.rate * a.hits * (a.hit + onHit), dot: dot * a.rate };
  });
  const total = parts.filter((x) => !x.a.countdown).reduce((acc, x) => acc + x.hit + x.dot, 0);
  return { total, parts, unit: u };
}

// Hit damage after armor (%) then block (flat). Never negative.
export function mitigate(dmg, armor, block) {
  return Math.max(0, dmg * (1 - armorReduction(armor)) - Math.max(0, block));
}

// ---------- combat ----------
export function canFight(s, id) {
  const e = enemyDef(id);
  return e && isUnlocked(s, e) && (s.kills[id] || 0) < limitOf(s, e) && s.hp > 0;
}

export function startFight(s, id) {
  if (s.fight || !canFight(s, id)) return false;
  const u = enemyUnit(enemyDef(id));
  s.retry = null;
  s.fight = {
    enemyId: id,
    eHp: u.maxHp,
    eMana: u.maxMana,
    eShield: null,                    // { amount, left } temporary hp
    pShield: null,
    pDots: [],                        // debuffs on the player { dps, pct, left, name }
    eDots: [],                        // debuffs on the enemy
    timers: {},                       // player action timers by skill id + kind
    eTimers: {},                      // enemy action timers
    empower: {},                      // seconds since each player empower was used
    eEmpower: {},
    pShred: 0,                        // block removed by the other side's block shred
    eShred: 0,
    eBlock: u.block,                  // enemy's current block (for display)
    elapsed: 0,
  };
  return true;
}

export function stopFight(s) {
  s.fight = null;
  s.retry = null;
}

// Apply damage to a shield first, then return what is left.
function absorb(shield, amount) {
  if (!shield || shield.amount <= 0) return amount;
  const used = Math.min(shield.amount, amount);
  shield.amount -= used;
  return amount - used;
}

// Damage from a list of dots over dt; drops expired ones. pct dots are a
// fraction of maxHp (the victim's) per second.
function tickDots(dots, dt, maxHp = 0) {
  let dmg = 0;
  for (const x of dots) {
    dmg += (x.dps + (x.pct || 0) * maxHp) * Math.min(dt, x.left);
    x.left -= dt;
  }
  for (let i = dots.length - 1; i >= 0; i--) if (dots[i].left <= 0) dots.splice(i, 1);
  return dmg;
}

function tickShield(sh, dt) {
  if (!sh) return null;
  sh.left -= dt;
  return sh.left > 0 && sh.amount > 0 ? sh : null;
}

// The two sides of a fight, as views on the state.
function sides(s, f, d, eu) {
  const P = {
    u: d, dots: f.pDots, timers: f.timers, empower: f.empower,
    get hp() { return s.hp; }, set hp(v) { s.hp = v; },
    get mana() { return s.mana; }, set mana(v) { s.mana = v; },
    get shield() { return f.pShield; }, set shield(v) { f.pShield = v; },
    get shred() { return f.pShred; }, set shred(v) { f.pShred = v; },
  };
  const E = {
    u: eu, dots: f.eDots, timers: f.eTimers, empower: f.eEmpower,
    get hp() { return f.eHp; }, set hp(v) { f.eHp = v; },
    get mana() { return f.eMana; }, set mana(v) { f.eMana = v; },
    get shield() { return f.eShield; }, set shield(v) { f.eShield = v; },
    get shred() { return f.eShred; }, set shred(v) { f.eShred = v; },
  };
  return { P, E };
}

// Advance the simulation by dt seconds.
export function step(s, dt) {
  const d = derived(s);
  const f = s.fight;
  syncHp(s, d);
  s.mana = Math.min(d.maxMana, s.mana + d.manaRegen * dt);

  if (!f) {
    s.hp = Math.min(d.maxHp, s.hp + d.regenOutHp * dt);
    // Repeat after a defeat: rerun the same enemy once hp is fully restored.
    if (s.retry && s.hp >= d.maxHp) {
      if (s.repeat && startFight(s, s.retry)) log(s, `${s.fight.enemyId} retried at full hp`, 'muted');
      s.retry = null;
    }
    return;
  }

  const e = enemyDef(f.enemyId);
  if (!e) { s.fight = null; return; }
  const eu = enemyUnit(e);
  const { P, E } = sides(s, f, d, eu);
  f.elapsed += dt;
  if (d.regenInHp) s.hp = Math.min(d.maxHp, s.hp + d.regenInHp * dt);
  f.eMana = Math.min(eu.maxMana, f.eMana + eu.manaRegen * dt);
  f.pShield = tickShield(f.pShield, dt);
  f.eShield = tickShield(f.eShield, dt);

  // Continuous damage: enemy decay and burns, player debuffs (shields absorb).
  const eRegen = eu.regenInHp * dt;
  f.eHp += Math.min(0, eRegen) - absorb(f.eShield, tickDots(f.eDots, dt, eu.maxHp));
  if (f.eHp <= 0) return win(s, e);
  f.eHp = Math.min(eu.maxHp, f.eHp + Math.max(0, eRegen));
  s.hp -= absorb(f.pShield, tickDots(f.pDots, dt, d.maxHp));
  if (s.hp <= 0) return lose(s, e, 'debuff');

  // Advance timers. Skills loaded mid-fight start from 0.
  for (const side of [P, E]) {
    for (const a of side.u.actions) side.timers[a.key] = (side.timers[a.key] || 0) + dt;
    for (const p of side.u.empowers) side.empower[p.id] = (side.empower[p.id] || 0) + dt;
  }

  // Resolve due events in chronological order ("rem" = time until due;
  // more negative = was due earlier). Ties go to the player.
  for (;;) {
    let best = null;
    for (const side of [P, E]) {
      for (const a of side.u.actions) {
        if (a.cost > side.mana + 1e-9) {
          // not enough mana: hold the action ready until it is affordable
          side.timers[a.key] = Math.min(side.timers[a.key], a.interval);
          continue;
        }
        const rem = a.interval - side.timers[a.key];
        if (rem <= 0 && (!best || rem < best.rem)) best = { rem, a, side };
      }
    }
    if (!best) break;
    if (best.side === E) {
      if (use(E, P, best.a)) return lose(s, e, best.a.name);
    } else if (use(P, E, best.a)) {
      return win(s, e);
    }
  }
  f.eBlock = Math.max(0, eu.block - f.eShred);
}

// One use of an action by src against dst. Returns true if dst died.
function use(src, dst, a) {
  src.timers[a.key] -= a.interval;
  src.mana -= a.cost;
  if (a.dot) dst.dots.push({ name: a.name, dps: a.dot.dps, pct: a.dot.pct, left: a.dot.duration });
  if (a.shield) src.shield = { amount: a.shield.amount, left: a.shield.duration };
  if (a.heal) src.hp = Math.min(src.u.maxHp, src.hp + a.heal);

  const attack = a.kind === 'attack';
  let mult = 1;
  let pen = 0;
  if (attack && a.hit) {
    // first ready empower is consumed by this attack
    const p = src.u.empowers.find((x) => src.empower[x.id] >= x.cooldown);
    if (p) {
      mult += p.mult;
      pen = p.armorPen;
      src.empower[p.id] = 0;
    }
  }
  let dealt = 0;
  let physical = 0;
  for (let h = 0; h < a.hits; h++) {
    const sources = attack
      ? [{ raw: a.hit * mult, type: a.type }, ...src.u.onHits.map((o) => ({ raw: o.dmg, type: o.type }))]
      : [{ raw: a.hit, type: a.type }];
    if (attack && src.u.blockShred) dst.shred = Math.min(dst.u.block, dst.shred + src.u.blockShred);
    for (const { raw, type } of sources) {
      if (!raw) continue;
      // physical: armor (minus armor pen) then block; magic: unreduced
      const dmg = type === 'physical' ? mitigate(raw, dst.u.armor - pen, dst.u.block - dst.shred) : raw;
      dealt += dmg;
      if (type === 'physical') physical += dmg;
      dst.hp -= absorb(dst.shield, dmg);
    }
  }
  const healed = dealt * a.lifesteal + physical * (src.u.lifesteal || 0);
  if (healed > 0) src.hp = Math.min(src.u.maxHp, src.hp + healed);
  return dst.hp <= 0;
}

function win(s, e) {
  const n = (s.kills[e.id] || 0) + 1;
  const all = C.skills;
  const before = all.map((k) => skillLevel(s, k.id));
  s.kills[e.id] = n;
  syncSlots(s);
  syncHp(s);
  s.stats.fights++;
  s.stats.wins++;
  gainXp(s, 1);
  const lim = limitOf(s, e);
  const tag = n === 1 ? ' [first]' : n === lim ? ' [final]' : '';
  const rText = rewardsOf(e).map((r) => {
    const g = rewardStep(e, n, r, s);
    return `${STAT_LABEL[r.stat]} +${r.type === 'percent' ? `${(g * 100).toFixed(2)}%` : g.toFixed(3)}`;
  }).join(', ');
  log(s, `${e.id} ${e.name} cleared ${n}/${lim} in ${s.fight.elapsed.toFixed(1)}s  ${rText}${tag}`, 'ok');
  s.fight = null;
  noteSkills(s);
  all.forEach((k, i) => {
    const lv = skillLevel(s, k.id);
    if (lv <= before[i]) return;
    const what = k.special ? 'special' : 'skill';
    log(s, lv === 1 ? `${what} ${k.id} ${k.name} unlocked` : `${what} ${k.id} ${k.name} upgraded to lv${lv}`, 'warn');
  });
  if (n >= lim) {
    log(s, `${e.id} ${e.name} limit reached`, 'warn');
  } else if (s.repeat) {
    startFight(s, e.id); // repeat immediately with current hp
  }
}

function lose(s, e, cause) {
  const eu = enemyUnit(e);
  s.hp = 0;
  s.stats.fights++;
  s.stats.losses++;
  log(s, `${e.id} ${e.name} hp depleted by ${cause}, left process (target hp ${Math.max(0, s.fight.eHp).toFixed(1)}/${eu.maxHp})`, 'err');
  s.fight = null; // repeat toggle stays as it is
  // repeat retries after a defeat, except against bosses
  if (s.repeat && rankOf(e) !== 'boss') {
    s.retry = e.id;
    log(s, `${e.id} retry queued, waiting for full hp`, 'muted');
  }
}
