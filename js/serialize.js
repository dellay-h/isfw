// Turns the enemy and skill lists into the source text of js/enemies.js and
// js/skills.js. Used by the dev screens, which save on every edit.

const ENEMIES_HEADER = `// Enemy data. Written by the dev/enemies screen on every edit, but can also
// be edited by hand.
//
// Enemies work like the player: base attributes plus a set of skills.
//   id, name
//   tier          enemies are grouped in tiers (default 0)
//   rank          'challenge' | 'tutorial' | 'common' | 'elite' | 'boss' (RANKS in data.js)
//   limit         maximum number of kills
//   unlockCost    optional: prestige points to unlock it (locked until paid;
//                 stays unlocked through prestiges)
//   base          base attributes, same keys as the player's (data.js ATTRS):
//                 maxHp, damage, attackSpeed, magicPower, magicSpeed, maxMana,
//                 manaRegen, armor, block, blockShred, regenFlat (hp/s, negative = decay)
//   skills        [{ skill, level }] its own skills (from skills.js), always active
//   rewards       [{ stat, total, type?: 'flat' | 'percent' }] attribute the player
//                 gains over all kills. Every kill gives the same share
//                 (total / limit).
//   skillRewards  [{ skill, level, at }] skill levels the player is awarded.
//                 at: 'first' | 'final' | kill count. Levels are reached in order.
`;

const SKILLS_HEADER = `// Skill data, shared by the player and enemies. Written by the dev/skills
// screen on every edit, but can also be edited by hand.
//
//   id        S.. skills, X.. specials (enemies use the same skills as the player)
//   name
//   special   always active once unlocked, never loaded into a slot (player)
//   levels    each level lists what it adds; a skill's data is the sum of the
//             levels reached (numbers add, nested values merge)
//
// Per level:
//   attack / spell   an action:
//     attack: scales with damage and attack speed; reduced by armor and block;
//             triggers on-hit damage and empower
//     spell:  scales with magic power and magic speed; ignores armor and block
//     base, scaling       hit = base + power x scaling
//     time, speedScaling  uses per second = 1 / time + speed x speedScaling
//     hits                hits per use (default 1)
//     cost                mana per use (waits until affordable)
//     lifesteal           heals this fraction of the damage dealt
//     dot: { pctMaxHp, pctScaling, base, scaling, duration }   damage over time
//          per stack per second = (pctMaxHp + power x pctScaling) x target max hp
//          + base + power x scaling
//     shield: { base, scaling, duration }          temporary hp, absorbs first
//     heal: { pctMaxHp, base, scaling }            heals the user
//     countdown           shows a countdown in the process panel
//   onHit:   { base, scaling } extra damage on each attack hit (scaling x damage)
//   empower: { mult, cooldown, armorPen } next attack deals +mult x damage
//   mods:    attribute bonuses (keys in data.js MODS)
//   slots:   extra skill slots (player)
`;

const ENEMY_ORDER = ['id', 'name', 'tier', 'rank', 'boss', 'limit', 'unlockCost', 'base', 'skills', 'rewards', 'skillRewards'];
const ACTION_ORDER = ['base', 'scaling', 'time', 'speedScaling', 'hits', 'cost', 'lifesteal', 'dot', 'shield', 'heal', 'countdown'];
const LEVEL_ORDER = ['attack', 'spell', 'onHit', 'empower', 'mods', 'slots'];

const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
const str = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function ordered(obj, order) {
  const keys = Object.keys(obj);
  return [...order.filter((k) => keys.includes(k)), ...keys.filter((k) => !order.includes(k))];
}

// Single-line literal. orders: key order per nesting depth name.
export function lit(v, order = []) {
  if (Array.isArray(v)) return `[${v.map((x) => lit(x, order)).join(', ')}]`;
  if (v && typeof v === 'object') {
    const parts = ordered(v, order).filter((k) => v[k] !== undefined)
      .map((k) => `${key(k)}: ${lit(v[k], k === 'attack' || k === 'spell' ? ACTION_ORDER : [])}`);
    return parts.length ? `{ ${parts.join(', ')} }` : '{}';
  }
  if (typeof v === 'string') return str(v);
  return String(v);
}

function list(items, order, indent) {
  if (!items || !items.length) return '[]';
  return `[\n${items.map((x) => `${indent}  ${lit(x, order)},`).join('\n')}\n${indent}]`;
}

function enemyText(e) {
  const pad = '    ';
  const head = ['id', 'name', 'tier', 'rank', 'boss', 'limit', 'unlockCost'].filter((k) => e[k] !== undefined).map((k) => `${k}: ${lit(e[k])}`);
  const lines = [head.join(', ') + ','];
  for (const k of ordered(e, ENEMY_ORDER)) {
    if (['id', 'name', 'tier', 'rank', 'boss', 'limit', 'unlockCost'].includes(k) || e[k] === undefined) continue;
    if (k === 'rewards') lines.push(`rewards: ${list(e[k], ['stat', 'total', 'type'], pad)},`);
    else if (k === 'skillRewards') lines.push(`skillRewards: ${list(e[k], ['skill', 'level', 'at'], pad)},`);
    else if (k === 'skills') lines.push(`skills: ${lit(e[k], ['skill', 'level'])},`);
    else lines.push(`${key(k)}: ${lit(e[k])},`);
  }
  return `  {\n${lines.map((l) => pad + l).join('\n')}\n  },`;
}

function skillText(k) {
  const pad = '    ';
  const head = ['id', 'name', 'special'].filter((x) => k[x] !== undefined).map((x) => `${x}: ${lit(k[x])}`);
  const lines = [head.join(', ') + ','];
  lines.push(`levels: ${list(k.levels, LEVEL_ORDER, pad)},`);
  for (const x of Object.keys(k)) if (!['id', 'name', 'special', 'levels'].includes(x)) lines.push(`${key(x)}: ${lit(k[x])},`);
  return `  {\n${lines.map((l) => pad + l).join('\n')}\n  },`;
}

export function enemiesSource(enemies) {
  return `${ENEMIES_HEADER}export const ENEMIES = [\n${enemies.map(enemyText).join('\n')}\n];\n`;
}

export function skillsSource(skills) {
  return `${SKILLS_HEADER}export const SKILLS = [\n${skills.map(skillText).join('\n')}\n];\n`;
}
