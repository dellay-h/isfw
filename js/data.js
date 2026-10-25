// Static game data. Everything tunable lives here.

export const PLAYER_BASE = {
  maxHp: 20,
  damage: 0,        // attack power: scales attacks and on-hit damage
  attackSpeed: 0,   // added to each attack's rate, times its speed scaling
  magicPower: 0,    // scales spells
  magicSpeed: 0,    // added to each spell's rate, times its speed scaling
  maxMana: 0,
  manaRegen: 0,     // mana per second (in and out of combat)
  armor: 0,         // % reduction of attack hits taken = armor / (armor + 100)
  block: 0,         // flat reduction of each attack hit taken (after armor)
  blockShred: 0,    // each of your attack hits lowers the target's block by
                    // this amount for the rest of the fight
};

// Armor -> fraction of hit damage removed. Diminishing, never reaches 100%.
export const armorReduction = (armor) => Math.max(0, armor) / (Math.max(0, armor) + 100);

// Fraction of max hp regenerated per second, plus a flat hp/s out of combat.
export const REGEN = {
  outOfCombat: 0.10,
  inCombat: 0,
  outOfCombatFlat: 1,
};

// How many skills can be equipped at once (attacks count), before specials.
export const SKILL_SLOTS = 2;

// Enemy ranks. limit is the default max kills for the rank (set when the
// rank is picked in dev/enemies).
export const RANKS = {
  challenge: { label: 'challenge', limit: 1 }, // shown above tier 0, award specials
  tutorial: { label: 'tutorial', limit: 10 },
  common: { label: 'common', limit: 50 },
  elite: { label: 'elite', limit: 5 },
  boss: { label: 'boss', limit: 1 },
};

// Max kills grow with prestiges: each kill in a prestige adds 1 to that
// enemy's max kills, up to `share` of its max kills at the start of the
// prestige (rounded up), applied on the next prestige; never above `max`.
// Challenges don't grow.
export const LIMIT_GROWTH = { share: 0.1, max: 1000 };

// Kill rewards. Each enemy lists rewards: [{ stat, total, type? }]. total is
// what the player gains over all kills; every kill (the first included) gives
// the same share: after n kills the player has total x n / limit. Kills added
// by LIMIT_GROWTH give the same amount each, so they raise the total
// proportionally (limit 100 + 10 = +10% total).

// Balancing heuristic (dev/enemies "20% suggestion"): a common enemy, fully
// defeated, should raise the player's attribute by `share`, measured when the
// player reaches it (every enemy of a lower tier fully defeated, no skills).
// Attributes that start at 0 are measured with what they act on (offset):
// dmg adds to the starting attack's 2 hit, aspd to its 1 attack/s, mag spd to
// the first spell's 0.25 casts/s.
export const HEURISTIC = {
  share: 0.2,
  offset: { damage: 2, attackSpeed: 1, magicSpeed: 0.25, magicPower: 1 },
};

// Prestige shop: permanent upgrades bought with prestige points. They are
// kept through prestiges (only a full reset clears them).
//   id, name
//   max       highest level
//   cost      points for the next level = cost.base + cost.step x current level
//   effects   per level: [{ stat, kind: 'flat' | 'pct', v }] (stats as in ATTRS)
//   slots     per level: extra skill slots
export const PRESTIGE_SHOP = [
  { id: 'P01', name: 'whetstone', max: 5, cost: { base: 1, step: 1 }, effects: [{ stat: 'damage', kind: 'pct', v: 0.1 }] },
  { id: 'P02', name: 'thick skin', max: 5, cost: { base: 1, step: 1 }, effects: [{ stat: 'maxHp', kind: 'pct', v: 0.1 }] },
  { id: 'P03', name: 'quick hands', max: 5, cost: { base: 1, step: 1 }, effects: [{ stat: 'attackSpeed', kind: 'pct', v: 0.05 }] },
  { id: 'P04', name: 'focus', max: 5, cost: { base: 1, step: 1 }, effects: [{ stat: 'magicPower', kind: 'pct', v: 0.1 }] },
  { id: 'P05', name: 'spare slot', max: 1, cost: { base: 3, step: 0 }, slots: 1 },
];

// Attributes shared by the player and enemies (enemy `base` uses these keys).
export const ATTRS = [
  { key: 'maxHp', label: 'max hp' },
  { key: 'damage', label: 'dmg' },
  { key: 'attackSpeed', label: 'aspd' },
  { key: 'magicPower', label: 'mag pwr' },
  { key: 'magicSpeed', label: 'mag spd' },
  { key: 'maxMana', label: 'max mp' },
  { key: 'manaRegen', label: 'mp regen' },
  { key: 'armor', label: 'armor' },
  { key: 'block', label: 'block' },
  { key: 'blockShred', label: 'block shred' },
  { key: 'regenFlat', label: 'regen (hp/s)' },
  { key: 'regenIn', label: 'regen % max hp/s (in fights)' },
  { key: 'lifesteal', label: 'lifesteal on all attacks (1 = 100%)' },
];

// Skill mods (attribute bonuses while a skill is active):
// key -> label and the attribute(s) it changes ('flat' adds, 'pct' multiplies).
export const MODS = {
  hpFlat: { label: 'max hp +', to: [['maxHp', 'flat']] },
  maxHp: { label: 'max hp +% (0.1 = 10%)', to: [['maxHp', 'pct']] },
  damageFlat: { label: 'dmg +', to: [['damage', 'flat']] },
  damage: { label: 'dmg +% (0.1 = 10%)', to: [['damage', 'pct']] },
  attackSpeedFlat: { label: 'aspd +', to: [['attackSpeed', 'flat']] },
  attackSpeed: { label: 'aspd +% (0.1 = 10%)', to: [['attackSpeed', 'pct']] },
  magicPowerFlat: { label: 'mag pwr +', to: [['magicPower', 'flat']] },
  magicSpeedFlat: { label: 'mag spd +', to: [['magicSpeed', 'flat']] },
  manaFlat: { label: 'max mp +', to: [['maxMana', 'flat']] },
  manaRegenFlat: { label: 'mp regen +/s', to: [['manaRegen', 'flat']] },
  armorFlat: { label: 'armor +', to: [['armor', 'flat']] },
  blockFlat: { label: 'block +', to: [['block', 'flat']] },
  blockShredFlat: { label: 'block shred +/hit', to: [['blockShred', 'flat']] },
  regenFlat: { label: 'regen +hp/s', to: [['regenFlat', 'flat']] },
  regenPct: { label: 'regen +% max hp/s (0.01 = 1%)', to: [['regenIn', 'flat'], ['regenOut', 'flat']] },
  regenIn: { label: 'regen in process +% max hp/s', to: [['regenIn', 'flat']] },
  regenOut: { label: 'regen idle +% max hp/s', to: [['regenOut', 'flat']] },
};

// ---------- enemies and skills ----------
// They live in enemies.js and skills.js (the dev screens save every edit
// there). If a save failed, the edits kept in the browser are used instead
// until they are saved.
import { SITE, key } from './site.js';
import { loadRemote, token } from './github.js';
import { ENEMIES as LOCAL_ENEMIES } from './enemies.js';
import { SKILLS as LOCAL_SKILLS } from './skills.js';

// Online dev version, signed in: use the latest files on the dev branch
// (REMOTE.error is set if that failed; the files served with the page are
// used then, and nothing can be committed).
export const REMOTE = SITE.mode === 'dev' && token.get() ? await loadRemote().catch((error) => ({ error })) : null;
const fromRemote = !!(REMOTE && !REMOTE.error);
const FILE_ENEMIES = fromRemote ? REMOTE.enemies.data : LOCAL_ENEMIES;
const FILE_SKILLS = fromRemote ? REMOTE.skills.data : LOCAL_SKILLS;

export const FILES = { enemies: FILE_ENEMIES, skills: FILE_SKILLS };
export const DRAFT_KEYS = { enemies: key('isfw.dev.enemies.v3'), skills: key('isfw.dev.skills.v3') };

// Short hash of a data list, to tell which version of a file a draft was
// made from.
export function dataHash(x) {
  const str = JSON.stringify(x);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export const FILE_HASH = { enemies: dataHash(FILE_ENEMIES), skills: dataHash(FILE_SKILLS) };

// Drafts set aside because the file changed after they were made (kept in
// localStorage under isfw.dev.stale.<name>, never used automatically).
export const STALE_DRAFTS = [];
function setAside(name, raw) {
  try { localStorage.setItem(key(`isfw.dev.stale.${name}`), raw); } catch {}
  STALE_DRAFTS.push(name);
}

// A draft is { base, data }: used only while the file still is the version it
// was made from (base); otherwise the file wins and the draft is set aside.
function readDraft(name) {
  if (SITE.mode === 'play') return null; // the playable version never uses dev edits
  try {
    const raw = localStorage.getItem(DRAFT_KEYS[name]);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.data) || d.base !== FILE_HASH[name]) {
      setAside(name, raw);
      localStorage.removeItem(DRAFT_KEYS[name]);
      return null;
    }
    if (dataHash(d.data) === FILE_HASH[name]) { localStorage.removeItem(DRAFT_KEYS[name]); return null; }
    return d.data;
  } catch { return null; }
}

// Drafts from older versions of the dev screens: set aside, never used.
if (SITE.mode === 'local') try {
  for (const [old, name] of [['isfw.dev.enemies', 'enemies'], ['isfw.dev.enemies.v2', 'enemies'], ['isfw.dev.skills.v2', 'skills']]) {
    const raw = localStorage.getItem(old);
    if (raw) { setAside(name, raw); localStorage.removeItem(old); }
  }
} catch { /* storage unavailable */ }

const drafts = { enemies: readDraft('enemies'), skills: readDraft('skills') };
export const USING_DRAFT = !!(drafts.enemies || drafts.skills);
export const ENEMIES = drafts.enemies || structuredClone(FILE_ENEMIES);
export const SKILLS = drafts.skills || structuredClone(FILE_SKILLS);
