// Enemy power: tier power levels and enemy profiles. Written by the
// dev/enemies screen on every edit, but can also be edited by hand.
//
//   { kind: 'tier', tier, base }      power level of a tier: the base
//                                     attributes of every enemy of that tier
//                                     that has a profile (keys: data.js ATTRS)
//   { kind: 'profile', id, name, mult, add, skills }
//                                     an enemy profile: each attribute =
//                                     tier base x mult (default 1) + add
//                                     (default 0); the enemy's own base is
//                                     added on top. skills [{ skill, level }]:
//                                     every enemy with the profile has them
//   { kind: 'rank', rank, bonus }     elites / bosses: +bonus (0.5 = +50%)
//                                     on the base stats (tier power x
//                                     profile), before the enemy's own
//                                     extra attributes and its skills
export const POWER = [
  { kind: 'tier', tier: 1, base: { maxHp: 20, damage: 2.5, attackSpeed: 0 } },
  { kind: 'profile', id: 'default', name: 'default', mult: {}, add: {}, skills: [{ skill: 'M03', level: 1 }] },
  { kind: 'profile', id: 'defensive', name: 'defensive', mult: { maxHp: 1.8, damage: 0.6 }, add: {}, skills: [{ skill: 'M03', level: 1 }] },
  { kind: 'profile', id: 'offensive', name: 'offensive', mult: { maxHp: 0.6, damage: 2 }, add: {}, skills: [{ skill: 'M03', level: 1 }] },
  { kind: 'profile', id: 'exploder', name: 'exploder', mult: { damage: 10 }, add: {}, skills: [{ skill: 'M01', level: 1 }] },
  { kind: 'profile', id: 'quick', name: 'quick', mult: {}, add: {}, skills: [{ skill: 'M03', level: 1 }, { skill: 'M02', level: 1 }] },
  { kind: 'rank', rank: 'elite', bonus: 0.2 },
  { kind: 'rank', rank: 'boss', bonus: 1 },
];
