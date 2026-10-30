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
//   max        highest level (prestige items; essence items have no cap)
//   cost       { base, step }: the next level costs base + step x levels bought
//
// What each level gives (any combination):
//   effects      [{ stat, kind: 'flat' | 'pct', v }] attribute bonus per level
//                (stats: data.js ATTRS; 'pct' multiplies, 0.01 = 1%)
//   slots        extra skill slots per level
//   startKills   { enemy, n }: every prestige starts with n kills of that
//                enemy per level (never above its max kills)
//   limitGrowth  [rank]: max kills growth/shrink on for those ranks (LIMIT_GROWTH)
//   minKills     { rank: n }: when bought, enemies of that rank still growing
//                get at least n max kills
//   requires     item id that must be owned before this one can be bought
//   essence      true: unlocks essence (gain, essence shop and its bonuses)
//   free         random free skills per prestige; freeExclude [skill id] never picked
//   autoEquip    true: auto-equip toggles for skills unlocked at prestige start
export const SHOP = [
  { id: 'P01', shop: 'prestige', name: 'whetstone', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P02', shop: 'prestige', name: 'thick skin', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P03', shop: 'prestige', name: 'quick hands', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P04', shop: 'prestige', name: 'focus', retired: true, cost: { base: 1, step: 1 } },
  { id: 'P05', shop: 'prestige', name: 'spare slot', max: 1, cost: { base: 1, step: 0 }, slots: 1 },
  { id: 'P06', shop: 'prestige', name: 'muscle memory', retired: true, max: 1, cost: { base: 3, step: 0 }, free: 1, freeExclude: ['S01'] },
  { id: 'P07', shop: 'prestige', name: 'head start', max: 10, cost: { base: 1, step: 0 }, startKills: { enemy: 'E001', n: 1 } },
  { id: 'P08', shop: 'prestige', name: 'routine', retired: true, max: 1, cost: { base: 10, step: 0 }, autoEquip: true },
  { id: 'P09', shop: 'prestige', name: 'limit breaker', max: 1, cost: { base: 10, step: 0 }, limitGrowth: ['common'], minKills: { common: 100 } },
  { id: 'P10', shop: 'prestige', name: 'limit breaker: elites', max: 1, cost: { base: 1, step: 0 }, limitGrowth: ['elite'], requires: 'P09' },
  { id: 'P11', shop: 'prestige', name: 'limit breaker: bosses', max: 1, cost: { base: 1, step: 0 }, limitGrowth: ['boss'], requires: 'P09' },
  { id: 'P12', shop: 'prestige', name: 'improved fighting', max: 1, cost: { base: 1, step: 0 }, effects: [{ stat: 'damage', kind: 'flat', v: 0.5 }, { stat: 'attackSpeed', kind: 'flat', v: 0.2 }, { stat: 'maxHp', kind: 'flat', v: 5 }] },
  { id: 'P13', shop: 'prestige', name: 'essence collector', max: 1, cost: { base: 3, step: 0 }, essence: true },
  { id: 'N01', shop: 'essence', name: 'attack', cost: { base: 100, step: 100 }, effects: [{ stat: 'damage', kind: 'pct', v: 0.01 }] },
  { id: 'N02', shop: 'essence', name: 'attack speed', cost: { base: 100, step: 100 }, effects: [{ stat: 'attackSpeed', kind: 'pct', v: 0.01 }] },
  { id: 'N03', shop: 'essence', name: 'magic power', cost: { base: 100, step: 100 }, effects: [{ stat: 'magicPower', kind: 'pct', v: 0.01 }] },
  { id: 'N04', shop: 'essence', name: 'cast speed', cost: { base: 100, step: 100 }, effects: [{ stat: 'magicSpeed', kind: 'pct', v: 0.01 }] },
  { id: 'N05', shop: 'essence', name: 'armor', cost: { base: 100, step: 100 }, effects: [{ stat: 'armor', kind: 'pct', v: 0.01 }] },
  { id: 'N06', shop: 'essence', name: 'hp', cost: { base: 100, step: 100 }, effects: [{ stat: 'maxHp', kind: 'pct', v: 0.01 }] },
];
