// Static game data. Everything tunable lives here.

export const PLAYER_BASE = {
  maxHp: 20,
  damage: 0,        // attack power: scales attacks and on-hit damage
  attackSpeed: 0,   // added to each attack's rate, times its speed scaling
  magicPower: 0,    // scales spells
  magicSpeed: 0,    // added to each spell's rate, times its speed scaling
  maxMana: 0,
  manaRegen: 0,     // mana per second, only during fights (mana empties when a fight ends)
  armor: 0,         // % reduction of physical hits taken = armor / (armor + 100)
  block: 0,         // flat reduction of each physical hit taken (after armor)
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
// rank is picked in dev/enemies). The highest max kills reachable by
// LIMIT_GROWTH is LIMIT_GROWTH.capMult x the enemy's base max kills.
export const RANKS = {
  challenge: { label: 'challenge', limit: 1, fixed: true }, // shown above tier 0, award specials; max kills never change
  tutorial: { label: 'tutorial', limit: 10, fixed: true }, // max kills never change
  common: { label: 'common', limit: 25 },
  elite: { label: 'elite', limit: 5 },
  boss: { label: 'boss', limit: 1 },
};

// Max kills change with prestiges, in two phases, applied on the next
// prestige. Each kill in a prestige moves that enemy's max kills by 1, up to
// `share` of its max kills at the start of the prestige (rounded up).
//   growing:   +1 per kill until the rank's cap (RANKS cap, default `cap`).
//              Every kill gives the same reward, so the total grows with the
//              max kills (base 100 -> 110 = +10% total).
//   shrinking: once the cap is reached, -1 per kill, down to 1. The total
//              stays at its cap value and is spread over fewer kills. Only
//              with a shop item with `limitShrink` (N10); without it max
//              kills stay at the cap.
// Ranks with `fixed` (challenge, tutorial) never change.
// Growth and shrink only happen for the ranks a prestige shop item with
// `limitGrowth` covers (P09 common, P10 elite, P11 boss); other enemies keep
// their max kills where they are.
// Max kills growth (limit breaker): each prestige can raise an enemy's max
// kills by up to share x max kills, up to capMult x its base max kills (the
// cap). Its total attribute reward at the cap is rewardMult x the base total:
// the base max kills give 1x (each kill the same), the kills after them give
// the remaining (rewardMult - 1)x, falling linearly (the last kill before the
// cap gets 1 portion, the one before it 2, and so on; see rewardCurve).
export const LIMIT_GROWTH = { share: 0.1, capMult: 40, rewardMult: 4 };

// Kill rewards. Each enemy lists rewards: [{ stat, total, type? }]. total is
// what the player gains over its base max kills; every kill (the first
// included) gives the same share: after n kills the player has
// total x n / limit; kills past the base max kills (grown max kills) give
// less and less (see LIMIT_GROWTH).

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

// Player level: starts at 0; 1 xp per enemy defeated; going from level n to
// n + 1 takes xpPer x (n + 1) xp. Each level adds attrPer to a bonus on every
// player attribute (level n = +n x attrPer), applied last (after all other
// bonuses) and always in the player's favour: positive values grow by it,
// negative ones shrink towards 0 (divided by the same factor). Kept through
// prestiges.
export const LEVELS = { xpPer: 100, attrPer: 0.01 };

// Prestige and essence shops: their items live in shop.js (the dev/shop
// screen saves every edit there); PRESTIGE_SHOP, ESSENCE_SHOP and
// RETIRED_SHOP are built from it at the end of this file.
// Prestige upgrades are kept through prestiges (only a full reset clears them).

// Essence: a granular resource for small, specific upgrades. Gained like xp
// (perKill for every enemy kill), kept through prestiges; a full reset
// clears it. Spent in the essence shop. Locked until a boss of tier
// unlockTier is defeated for the first time (kept for good; a full reset
// locks it again).
export const ESSENCE = { perKill: 1, unlockTier: 2 };
// TODO: essence shop unlock items (qol, features, skills): one level, cost only.
// TODO: an item that costs one resource and increases the gain of another
//       (e.g. pay prestige points for more essence per kill).

// Reveal rules: what stays hidden from the monitor (and locked) until a
// condition is met. Once met it stays revealed for good (kept through
// prestiges; a full reset hides it again). The dev pages always show everything.
//   tiers    { tier: condition } every enemy of that tier
//   enemies  { enemy id: condition } one enemy (takes the place of its tier's rule)
//   shop     { item id: condition } a prestige shop item
// Conditions (a list = all of them):
//   { enemy, kills }   that enemy defeated `kills` times in one prestige (default 1)
//   { tier: n }        any enemy of tier n defeated
//   { prestiges: n }   n prestiges done
//   { level: n }       player level n reached
// Skills and specials have no rule of their own: they show when an enemy that
// is not hidden awards their lv1 (or the player has them).
//   tierBoss  true: besides the rules above, every tier from 2 up is shown
//             only while a boss of the tier before it has been defeated in
//             the current prestige (not kept: hidden again after a prestige)
// Boss lock: a tier's boss can't be fought until this many kills of the
// other enemies of its tier (commons, elites; this prestige). Its row in the
// targets table shows the progress instead.
export const BOSS_LOCK = { kills: 50 };

export const REVEAL = {
  tierBoss: true,
  tiers: {
    1: { enemy: 'E001', kills: 5 },      // tier 1 after 5 rotting plant kills (kept for good)
  },
  enemies: {
    E013: { enemy: 'E010', kills: 1 },   // elder sapling after the first vampire kill
  },
  shop: {
    P15: { tier: 2 },                    // fire wizard apprentice after the first tier 2 kill
  },
};

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
  { key: 'regenOutFlat', label: 'idle regen (hp/s, out of fights)' },
  { key: 'regenIn', label: 'regen % max hp/s (in fights)' },
  { key: 'lifesteal', label: 'lifesteal on physical damage (1 = 100%)' },
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
  regenOutFlat: { label: 'idle regen +hp/s (out of fights)', to: [['regenOutFlat', 'flat']] },
  regenPct: { label: 'regen +% max hp/s (0.01 = 1%)', to: [['regenIn', 'flat'], ['regenOut', 'flat']] },
  regenIn: { label: 'regen in process +% max hp/s', to: [['regenIn', 'flat']] },
  regenOut: { label: 'regen idle +% max hp/s', to: [['regenOut', 'flat']] },
  lifesteal: { label: 'lifesteal on physical dmg (0.1 = 10%)', to: [['lifesteal', 'flat']] },
};

// ---------- enemies, skills and shop items ----------
// They live in enemies.js, skills.js, shop.js and power.js (the dev screens
// commit edits there). In the dev version, edits not committed yet are kept
// in the browser as drafts and used instead.
import { SITE, key } from './site.js';
import { loadRemote, token } from './github.js';
import { ENEMIES as LOCAL_ENEMIES } from './enemies.js';
import { SKILLS as LOCAL_SKILLS } from './skills.js';
import { SHOP as LOCAL_SHOP } from './shop.js';
import { POWER as LOCAL_POWER } from './power.js';

// Online dev version, signed in: use the latest files on the dev branch
// (REMOTE.error is set if that failed; the files served with the page are
// used then, and nothing can be committed).
export const REMOTE = SITE.mode === 'dev' && token.get() ? await loadRemote().catch((error) => ({ error })) : null;
const fromRemote = !!(REMOTE && !REMOTE.error);
const FILE_ENEMIES = fromRemote ? REMOTE.enemies.data : LOCAL_ENEMIES;
const FILE_SKILLS = fromRemote ? REMOTE.skills.data : LOCAL_SKILLS;
const FILE_SHOP = fromRemote ? REMOTE.shop.data : LOCAL_SHOP;
const FILE_POWER = fromRemote ? REMOTE.power.data : LOCAL_POWER;

export const FILES = { enemies: FILE_ENEMIES, skills: FILE_SKILLS, shop: FILE_SHOP, power: FILE_POWER };
export const DRAFT_KEYS = { enemies: key('isfw.dev.enemies.v3'), skills: key('isfw.dev.skills.v3'), shop: key('isfw.dev.shop.v1'), power: key('isfw.dev.power.v1') };

// Short hash of a data list, to tell which version of a file a draft was
// made from.
export function dataHash(x) {
  const str = JSON.stringify(x);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export const FILE_HASH = { enemies: dataHash(FILE_ENEMIES), skills: dataHash(FILE_SKILLS), shop: dataHash(FILE_SHOP), power: dataHash(FILE_POWER) };

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

const drafts = { enemies: readDraft('enemies'), skills: readDraft('skills'), shop: readDraft('shop'), power: readDraft('power') };
export const USING_DRAFT = !!(drafts.enemies || drafts.skills || drafts.shop || drafts.power);
export const ENEMIES = drafts.enemies || structuredClone(FILE_ENEMIES);
export const SKILLS = drafts.skills || structuredClone(FILE_SKILLS);
export const SHOP = drafts.shop || structuredClone(FILE_SHOP);
// Tier power levels and enemy profiles (power.js).
export const POWER = drafts.power || structuredClone(FILE_POWER);

// The shops the game uses (shop.js; retired items left out).
const inShop = (shop) => SHOP.filter((x) => x.shop === shop && !x.retired);
export const PRESTIGE_SHOP = inShop('prestige');
export const ESSENCE_SHOP = inShop('essence');
// Retired items { id: item }: saves that bought them are refunded on load.
export const RETIRED_SHOP = Object.fromEntries(SHOP.filter((x) => x.retired).map((x) => [x.id, x]));
