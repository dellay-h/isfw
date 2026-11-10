// Enemy data. Written by the dev/enemies screen on every edit, but can also
// be edited by hand.
//
// Enemies work like the player: base attributes plus a set of skills.
//   id, name
//   tier          enemies are grouped in tiers (default 0)
//   rank          'challenge' | 'tutorial' | 'common' | 'elite' | 'boss' (RANKS in data.js)
//   profile       optional: enemy profile id (power.js). With a profile its
//                 attributes are its tier's power level x the profile x its
//                 rank bonus, plus base as extra on top; without one, base
//                 is all it has (with the rank bonus)
//   limit         maximum number of kills
//   unlockCost    optional: prestige points to unlock it (locked until paid;
//                 stays unlocked through prestiges)
//   base          attributes (extra on top of tier x profile when it has a
//                 profile), same keys as the player's (data.js ATTRS):
//                 maxHp, damage, attackSpeed, magicPower, magicSpeed, maxMana,
//                 manaRegen, armor, block, blockShred, regenFlat (hp/s, negative = decay)
//   skills        [{ skill, level }] its own skills (from skills.js), always active
//   rewards       [{ stat, total, type?: 'flat' | 'percent' }] attribute the player
//                 gains over all kills. Every kill gives the same share
//                 (total / limit).
//   skillRewards  [{ skill, level, at }] skill levels the player is awarded.
//                 at: 'first' | 'final' | kill count. Levels are reached in order.
export const ENEMIES = [
  {
    id: 'E013', name: 'elder sapling', tier: 1, rank: 'challenge', limit: 1,
    base: { maxHp: 60, regenFlat: 4, block: 2 },
    skills: [],
    rewards: [],
    skillRewards: [
      { skill: 'X03', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E014', name: 'squire', tier: 2, rank: 'challenge', limit: 1,
    base: { maxHp: 50, block: 5, damage: 3, attackSpeed: -0.2, armor: 100 },
    skills: [{ skill: 'M03', level: 1 }],
    rewards: [],
    skillRewards: [
      { skill: 'S16', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E001', name: 'rotting plant', tier: 0, rank: 'tutorial', limit: 10,
    base: { maxHp: 30, regenFlat: -3 },
    skills: [],
    rewards: [
      { stat: 'damage', total: 1 },
    ],
    skillRewards: [
      { skill: 'S01', level: 1, at: 'first' },
      { skill: 'S01', level: 2, at: 'final' },
    ],
  },
  {
    id: 'E011', name: 'goblin', tier: 1, rank: 'common', profile: 'default', limit: 25,
    skills: [],
    rewards: [
      { stat: 'damage', total: 1 },
    ],
    skillRewards: [
      { skill: 'S11', level: 1, at: 'first' },
      { skill: 'S11', level: 2, at: 100 },
      { skill: 'S11', level: 3, at: 200 },
    ],
  },
  {
    id: 'E002', name: 'slime', tier: 1, rank: 'common', profile: 'defensive', limit: 25,
    base: { maxHp: 10 },
    skills: [],
    rewards: [
      { stat: 'maxHp', total: 5 },
    ],
    skillRewards: [
      { skill: 'S02', level: 1, at: 'first' },
      { skill: 'S02', level: 2, at: 100 },
      { skill: 'S02', level: 3, at: 'final' },
    ],
  },
  {
    id: 'E003', name: 'archer', tier: 1, rank: 'common', profile: 'offensive', limit: 25,
    base: { maxHp: 10 },
    skills: [],
    rewards: [
      { stat: 'attackSpeed', total: 0.2 },
    ],
    skillRewards: [
      { skill: 'S03', level: 1, at: 'first' },
      { skill: 'S03', level: 2, at: 100 },
      { skill: 'S03', level: 3, at: 'final' },
    ],
  },
  {
    id: 'E017', name: 'orc', tier: 2, rank: 'common', profile: 'default', limit: 25,
    skills: [],
    rewards: [
      { stat: 'damage', total: 2 },
    ],
    skillRewards: [
      { skill: 'S18', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E015', name: 'exploder', tier: 1, rank: 'elite', profile: 'exploder', limit: 5,
    skills: [],
    rewards: [
      { stat: 'maxHp', total: 5 },
    ],
    skillRewards: [
      { skill: 'S17', level: 1, at: 'first' },
      { skill: 'S17', level: 2, at: 25 },
    ],
  },
  {
    id: 'E016', name: 'quickling', tier: 1, rank: 'elite', profile: 'quick', limit: 5,
    skills: [],
    rewards: [
      { stat: 'armor', total: 10 },
    ],
    skillRewards: [
      { skill: 'S21', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E010', name: 'vampire', tier: 1, rank: 'boss', profile: 'defensive', limit: 1,
    base: { lifesteal: 0.4, damage: 1, attackSpeed: -0.15 },
    skills: [],
    rewards: [
      { stat: 'damage', total: 0.5 },
      { stat: 'attackSpeed', total: 0.1 },
    ],
    skillRewards: [
      { skill: 'S10', level: 1, at: 1 },
    ],
  },
  {
    id: 'E018', name: 'druid', tier: 2, rank: 'common', profile: 'magic', limit: 25,
    skills: [],
    rewards: [
      { stat: 'manaRegen', total: 1 },
    ],
    skillRewards: [
      { skill: 'S09', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E019', name: 'troll', tier: 2, rank: 'common', profile: 'defensive', limit: 25,
    skills: [],
    rewards: [
      { stat: 'maxHp', total: 12 },
    ],
    skillRewards: [
      { skill: 'S19', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E004', name: 'fire wizard apprentice', tier: 2, rank: 'common', profile: 'magic', limit: 25,
    skills: [],
    rewards: [
      { stat: 'magicPower', total: 3 },
    ],
    skillRewards: [
      { skill: 'S20', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E005', name: 'assassin', tier: 2, rank: 'elite', profile: 'offensive', limit: 5,
    skills: [],
    rewards: [
      { stat: 'damage', total: 1.8 },
    ],
    skillRewards: [
      { skill: 'S06', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E020', name: 'paladin', tier: 2, rank: 'boss', profile: 'tank', limit: 1,
    base: { armor: 0, maxHp: 0, block: 0, damage: -4 },
    skills: [{ skill: 'M04', level: 1 }],
    rewards: [
      { stat: 'damage', total: 1 },
    ],
    skillRewards: [],
  },
];
