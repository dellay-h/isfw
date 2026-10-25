// Enemy data. Written by the dev/enemies screen on every edit, but can also
// be edited by hand.
//
// Enemies work like the player: base attributes plus a set of skills.
//   id, name
//   tier          enemies are grouped in tiers (default 0)
//   rank          'tutorial' | 'common' | 'elite' | 'boss' (RANKS in data.js); common
//                 enemies give their rewards in two waves (REWARD in data.js)
//   limit         maximum number of kills
//   base          base attributes, same keys as the player's (data.js ATTRS):
//                 maxHp, damage, attackSpeed, magicPower, magicSpeed, maxMana,
//                 manaRegen, armor, block, blockShred, regenFlat (hp/s, negative = decay)
//   skills        [{ skill, level }] its own skills (from skills.js), always active
//   rewards       [{ stat, total, type?: 'flat' | 'percent' }] attribute the player
//                 gains over all kills. Each kill gives its share; the first
//                 kill counts more (REWARD in data.js).
//   skillRewards  [{ skill, level, at }] skill levels the player is awarded.
//                 at: 'first' | 'final' | kill count. Levels are reached in order.
export const ENEMIES = [
  {
    id: 'E013', name: 'elder sapling', tier: 0, rank: 'challenge', limit: 1,
    base: { maxHp: 60, regenFlat: 4, block: 4 },
    skills: [],
    rewards: [],
    skillRewards: [
      { skill: 'X03', level: 1, at: 'first' },
    ],
  },
  {
    id: 'E001', name: 'rotting plant', tier: 0, rank: 'tutorial', limit: 10,
    base: { maxHp: 30, regenFlat: -3 },
    skills: [],
    rewards: [
      { stat: 'damage', total: 2 },
    ],
    skillRewards: [
      { skill: 'S01', level: 1, at: 'first' },
      { skill: 'S01', level: 2, at: 'final' },
    ],
  },
  {
    id: 'E002', name: 'slime', tier: 1, rank: 'common', limit: 200,
    base: { maxHp: 60, attackSpeed: -0.09 },
    skills: [{ skill: 'S01', level: 1 }],
    rewards: [
      { stat: 'maxHp', total: 4 },
    ],
    skillRewards: [
      { skill: 'S02', level: 1, at: 'first' },
      { skill: 'S02', level: 2, at: 50 },
      { skill: 'S02', level: 3, at: 'final' },
    ],
  },
  {
    id: 'E003', name: 'archer', tier: 1, rank: 'common', limit: 200,
    base: { maxHp: 80, attackSpeed: 0 },
    skills: [{ skill: 'S03', level: 1 }],
    rewards: [
      { stat: 'attackSpeed', total: 0.2 },
    ],
    skillRewards: [
      { skill: 'S03', level: 1, at: 'first' },
      { skill: 'S03', level: 2, at: 50 },
      { skill: 'S03', level: 3, at: 'final' },
    ],
  },
  {
    id: 'E011', name: 'goblin', tier: 1, rank: 'common', limit: 200,
    base: { maxHp: 30, attackSpeed: -0.333 },
    skills: [{ skill: 'S03', level: 1 }],
    rewards: [
      { stat: 'damage', total: 0.8 },
    ],
    skillRewards: [
      { skill: 'S11', level: 1, at: 'first' },
      { skill: 'S11', level: 2, at: 100 },
      { skill: 'S11', level: 3, at: 'final' },
    ],
  },
  {
    id: 'E012', name: 'dropout sorcerer', tier: 1, rank: 'common', limit: 200,
    base: { maxHp: 80, magicPower: 1, manaRegen: 0.5 },
    skills: [{ skill: 'S13', level: 1 }, { skill: 'S15', level: 1 }],
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
    id: 'E004', name: 'fire wizard apprentice', tier: 1, rank: 'elite', limit: 25,
    base: { maxHp: 300, magicPower: 1, magicSpeed: 0, maxMana: 0, manaRegen: 0.5 },
    skills: [{ skill: 'S04', level: 1 }, { skill: 'S14', level: 1 }],
    rewards: [
      { stat: 'manaRegen', total: 1.75 },
    ],
    skillRewards: [
      { skill: 'S04', level: 1, at: 'first' },
      { skill: 'X01', level: 1, at: 'final' },
    ],
  },
  {
    id: 'E010', name: 'werewolf', tier: 1, rank: 'boss', limit: 5,
    base: { maxHp: 300, armor: 10, damage: 0, attackSpeed: -0.1667, lifesteal: 1.5 },
    skills: [{ skill: 'S01', level: 1 }, { skill: 'S10', level: 1 }],
    rewards: [
      { stat: 'damage', total: 2 },
      { stat: 'attackSpeed', total: 0.3 },
      { stat: 'armor', total: 15 },
      { stat: 'block', total: 0.5 },
    ],
    skillRewards: [
      { skill: 'X02', level: 1, at: 'first' },
      { skill: 'S10', level: 1, at: 'final' },
    ],
  },
  {
    id: 'E005', name: 'assassin', tier: 2, rank: 'elite', limit: 25,
    base: { maxHp: 180, damage: 0.5 },
    skills: [{ skill: 'S01', level: 1 }, { skill: 'S06', level: 1 }],
    rewards: [
      { stat: 'damage', total: 1.8 },
    ],
    skillRewards: [
      { skill: 'S05', level: 1, at: 'first' },
      { skill: 'S06', level: 2, at: 'final' },
    ],
  },
  {
    id: 'E006', name: 'ogre', tier: 2, rank: 'common', limit: 200,
    base: { maxHp: 400, damage: 2, attackSpeed: -0.444, regenFlat: 2 },
    skills: [{ skill: 'S01', level: 1 }],
    rewards: [
      { stat: 'maxHp', total: 4.8 },
    ],
    skillRewards: [
      { skill: 'S06', level: 1, at: 'first' },
      { skill: 'S05', level: 2, at: 50 },
    ],
  },
  {
    id: 'E007', name: 'guard', tier: 2, rank: 'elite', limit: 25,
    base: { maxHp: 400, armor: 50, block: 2, damage: 1, attackSpeed: -0.5, magicSpeed: -0.0833, manaRegen: 1 },
    skills: [{ skill: 'S01', level: 1 }, { skill: 'S04', level: 1 }],
    rewards: [
      { stat: 'armor', total: 30 },
    ],
    skillRewards: [
      { skill: 'S07', level: 1, at: 'first' },
      { skill: 'S07', level: 2, at: 'final' },
    ],
  },
  {
    id: 'E008', name: 'satyr archer', tier: 2, rank: 'common', limit: 200,
    base: { maxHp: 300, damage: 5, attackSpeed: 0.25 },
    skills: [{ skill: 'S03', level: 1 }, { skill: 'S08', level: 1 }],
    rewards: [
      { stat: 'attackSpeed', total: 0.3 },
    ],
    skillRewards: [
      { skill: 'S08', level: 1, at: 'first' },
      { skill: 'S08', level: 2, at: 50 },
    ],
  },
  {
    id: 'E009', name: 'arcane wizard apprentice', tier: 2, rank: 'elite', limit: 25,
    base: { maxHp: 350, magicPower: 5, manaRegen: 1 },
    skills: [{ skill: 'S13', level: 1 }, { skill: 'S09', level: 1 }],
    rewards: [
      { stat: 'magicSpeed', total: 0.35 },
    ],
    skillRewards: [
      { skill: 'S09', level: 1, at: 'final' },
    ],
  },
];
