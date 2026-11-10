// Prestige and essence shop items. Written by the dev/shop screen on every
// edit, but can also be edited by hand.
//
//   id         P.. prestige items, N.. essence items. Never reuse an id: saves
//              keep the levels bought by id
//   shop       'prestige' (bought with prestige points) | 'essence'
//   name
//   retired    true: out of the game; saves that bought it get the cost back
//              on load (in points or essence) and lose the levels. Clear it
//              to bring the item back
//   max        highest level (essence items: optional, none = no cap)
//   cost       { base, step }: the next level costs base + step x levels bought
//
// What each level gives (any combination):
//   effects      [{ stat, kind: 'flat' | 'pct', v }] attribute bonus per level
//                (stats: data.js ATTRS; 'pct' multiplies, 0.01 = 1%)
//   unlockSkill  skill id the item unlocks (level 1; e.g. a special)
//   unlockEnemies [enemy id] (prestige): these enemies are hidden until the
//                item is owned
//   slots        extra skill slots per level
//   startKills   { enemy, n }: every prestige starts with n kills of that
//                enemy per level (never above its max kills)
//   limitGrowth  [rank]: max kills growth/shrink on for those ranks (LIMIT_GROWTH;
//                essence items only while essence is on)
//   limitShrink  true: enemies at their max kills cap shrink again (without
//                it they stay at the cap)
//   minKills     { rank: n }: when bought, enemies of that rank still growing
//                get at least n max kills
//   requires     item id (either shop) that must be owned before this one
//                can be bought
//   free         random free skills per prestige; freeExclude [skill id] never picked
//   autoEquip    true: auto-equip toggles for skills unlocked at prestige start
export const SHOP = [
  { id: 'P01', shop: 'prestige', name: 'whetstone', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P02', shop: 'prestige', name: 'thick skin', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P03', shop: 'prestige', name: 'quick hands', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P04', shop: 'prestige', name: 'focus', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P05', shop: 'prestige', name: 'spare slot', retired: true, max: 1, cost: { base: 1, step: 0 }, slots: 1 },
  { id: 'P06', shop: 'prestige', name: 'muscle memory', retired: true, max: 1, cost: { base: 3, step: 0 }, free: 1, freeExclude: ['S01'] },
  { id: 'P08', shop: 'prestige', name: 'routine', retired: true, max: 1, cost: { base: 10, step: 0 }, autoEquip: true },
  { id: 'P12', shop: 'prestige', name: 'improved fighting', max: 1, cost: { base: 1, step: 0 }, unlockSkill: 'X05' },
  { id: 'P13', shop: 'prestige', name: 'essence collector', retired: true, max: 1, cost: { base: 10, step: 0 } },
  { id: 'P09', shop: 'prestige', name: 'limit breaker', max: 1, cost: { base: 0, step: 0 }, limitGrowth: ['common'] },
  { id: 'P10', shop: 'prestige', name: 'limit breaker: elites', retired: true, max: 1, cost: { base: 1, step: 0 }, limitGrowth: ['elite'], requires: 'P09' },
  { id: 'P11', shop: 'prestige', name: 'limit breaker: bosses', retired: true, max: 1, cost: { base: 1, step: 0 }, limitGrowth: ['boss'], requires: 'P09' },
  { id: 'P07', shop: 'prestige', name: 'head start', max: 10, cost: { base: 1, step: 0 }, startKills: { enemy: 'E001', n: 1 } },
  { id: 'P14', shop: 'prestige', name: 'new targets', max: 1, cost: { base: 1, step: 0 }, unlockEnemies: ['E015', 'E016'] },
  { id: 'P15', shop: 'prestige', name: 'fire wizard apprentice', max: 1, cost: { base: 1, step: 0 }, unlockEnemies: ['E004'] },
  { id: 'P16', shop: 'prestige', name: 'inward connection', max: 1, cost: { base: 5, step: 0 }, slots: 1 },
  { id: 'N01', shop: 'essence', name: 'attack', cost: { base: 20, step: 20 }, effects: [{ stat: 'damage', kind: 'pct', v: 0.01 }] },
  { id: 'N02', shop: 'essence', name: 'attack speed', cost: { base: 20, step: 20 }, effects: [{ stat: 'attackSpeed', kind: 'pct', v: 0.01 }] },
  { id: 'N03', shop: 'essence', name: 'magic power', cost: { base: 20, step: 20 }, effects: [{ stat: 'magicPower', kind: 'pct', v: 0.01 }] },
  { id: 'N04', shop: 'essence', name: 'cast speed', cost: { base: 20, step: 20 }, effects: [{ stat: 'magicSpeed', kind: 'pct', v: 0.01 }] },
  { id: 'N05', shop: 'essence', name: 'armor', cost: { base: 20, step: 20 }, effects: [{ stat: 'armor', kind: 'pct', v: 0.01 }] },
  { id: 'N06', shop: 'essence', name: 'hp', cost: { base: 20, step: 20 }, effects: [{ stat: 'maxHp', kind: 'pct', v: 0.01 }] },
  { id: 'N07', shop: 'essence', name: 'recovery', max: 1, cost: { base: 500, step: 0 }, unlockSkill: 'X04' },
  { id: 'N08', shop: 'essence', name: 'limit breaker: elites', max: 1, cost: { base: 500, step: 0 }, limitGrowth: ['elite'], requires: 'P09' },
  { id: 'N09', shop: 'essence', name: 'limit breaker: bosses', max: 1, cost: { base: 2000, step: 0 }, limitGrowth: ['boss'], requires: 'P09' },
  { id: 'N10', shop: 'essence', name: 'limit shrinker', max: 1, cost: { base: 5000, step: 0 }, limitShrink: true, requires: 'P09' },
];
