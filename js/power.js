// Enemy power: tier power levels and enemy profiles. Written by the
// dev/enemies screen on every edit, but can also be edited by hand.
//
//   { kind: 'tier', tier, base }      power level of a tier: the base
//                                     attributes of every enemy of that tier
//                                     that has a profile (keys: data.js ATTRS)
//   { kind: 'profile', id, name, mult, add }
//                                     an enemy profile: each attribute =
//                                     tier base x mult (default 1) + add
//                                     (default 0); the enemy's own base is
//                                     added on top
export const POWER = [
  { kind: 'tier', tier: 1, base: { maxHp: 30, damage: 1, attackSpeed: -0.333 } },
  { kind: 'profile', id: 'default', name: 'default', mult: {}, add: {} },
  { kind: 'profile', id: 'defensive', name: 'defensive', mult: { maxHp: 2, damage: 0.5 }, add: {} },
  { kind: 'profile', id: 'offensive', name: 'offensive', mult: { maxHp: 0.6, damage: 2 }, add: {} },
  { kind: 'profile', id: 'tank', name: 'tank', mult: { maxHp: 4, damage: 0.8 }, add: { armor: 10, block: 1 } },
];
