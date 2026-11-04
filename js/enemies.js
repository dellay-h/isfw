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
    id: 'E012', name: 'dropout sorcerer', tier: -3, rank: 'common', limit: 25, unlockCost: 1,
    base: { maxHp: 80, magicPower: 1, manaRegen: 0.5 },
    skills: [],
    rewards: [
      { stat: 'magicSpeed', total: 0.05 },
    ],
    skillRewards: [
      { skill: 'S12', level: 1, at: 'first' },
      { skill: 'S12', level: 2, at: 100 },
      { skill: 'S12', level: 3, at: 'final' },
    ],
  },
  {
    id: 'E004', name: 'fire wizard apprentice', tier: 2, rank: 'elite', profile: 'magic', limit: 5,
    skills: [],
    rewards: [
      { stat: 'manaRegen', total: 1.75 },
    ],
    skillRewards: [
      { skill: 'S04', level: 1, at: 'first' },
      { skill: 'X01', level: 1, at: 'final' },
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
    id: 'E005', name: 'assassin', tier: -3, rank: 'elite', limit: 5,
    base: { maxHp: 180, damage: 2.1667 },
    skills: [{ skill: 'M03', level: 1 }],
    rewards: [
      { stat: 'damage', total: 1.8 },
    ],
    skillRewards: [
      { skill: 'S05', level: 1, at: 'first' },
      { skill: 'S06', level: 2, at: 'final' },
    ],
  },
  {
    id: 'E006', name: 'ogre', tier: -3, rank: 'common', limit: 25,
    base: { maxHp: 400, damage: 4, attackSpeed: -0.444, regenFlat: 2 },
    skills: [{ skill: 'M03', level: 1 }],
    rewards: [
      { stat: 'maxHp', total: 4.8 },
    ],
    skillRewards: [
      { skill: 'S06', level: 1, at: 'first' },
      { skill: 'S05', level: 2, at: 100 },
    ],
  },
  {
    id: 'E007', name: 'guard', tier: -3, rank: 'elite', limit: 5,
    base: { maxHp: 400, armor: 50, block: 2, damage: 2.6667, attackSpeed: -0.5, magicSpeed: -0.0833, manaRegen: 1 },
    skills: [{ skill: 'M03', level: 1 }],
    rewards: [
      { stat: 'armor', total: 30 },
    ],
    skillRewards: [
      { skill: 'S07', level: 1, at: 'first' },
      { skill: 'S07', level: 2, at: 'final' },
    ],
  },
  {
    id: 'E008', name: 'satyr archer', tier: -3, rank: 'common', limit: 25,
    base: { maxHp: 300, damage: 5, attackSpeed: 0.25 },
    skills: [],
    rewards: [
      { stat: 'attackSpeed', total: 0.3 },
    ],
    skillRewards: [
      { skill: 'S08', level: 1, at: 'first' },
      { skill: 'S08', level: 2, at: 100 },
    ],
  },
  {
    id: 'E017', name: 'orc', tier: 2, rank: 'common', profile: 'default', limit: 25,
    skills: [],
    rewards: [
      { stat: 'damage', total: 1 },
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
      { skill: 'S06', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E016', name: 'quickling', tier: 1, rank: 'elite', profile: 'quick', limit: 5,
    skills: [],
    rewards: [
      { stat: 'attackSpeed', total: 0.2 },
    ],
    skillRewards: [],
  },
  {
    id: 'E009', name: 'arcane wizard apprentice', tier: -3, rank: 'elite', limit: 5,
    base: { maxHp: 350, magicPower: 5, manaRegen: 1 },
    skills: [],
    rewards: [
      { stat: 'magicSpeed', total: 0.35 },
    ],
    skillRewards: [
      { skill: 'S09', level: 1, at: 'final' },
    ],
  },
  {
    id: 'E018', name: 'hunter', tier: 2, rank: 'common', profile: 'offensive', limit: 25,
    skills: [],
    rewards: [
      { stat: 'damage', total: 1 },
    ],
    skillRewards: [],
  },
  {
    id: 'E019', name: 'troll', tier: 2, rank: 'common', profile: 'defensive', limit: 25,
    skills: [],
    rewards: [
      { stat: 'damage', total: 1 },
    ],
    skillRewards: [
      { skill: 'S19', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E020', name: 'paladin', tier: 2, rank: 'boss', profile: 'tank', limit: 1,
    base: { armor: 100, maxHp: -250 },
    skills: [{ skill: 'M04', level: 1 }],
    rewards: [
      { stat: 'damage', total: 1 },
    ],
    skillRewards: [],
  },
];
