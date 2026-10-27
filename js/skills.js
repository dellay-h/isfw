// Skill data, shared by the player and enemies. Written by the dev/skills
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
//     attack: scales with damage and attack speed; triggers on-hit damage,
//             empower and block shred
//     spell:  scales with magic power and magic speed
//     type                damage type: 'physical' (reduced by armor and block;
//                         the lifesteal attribute heals from it) or 'magic'
//                         (ignores armor and block). Default: attacks
//                         physical, spells magic
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
//   onHit:   { type, base, scaling } extra damage on each attack hit (scaling x
//            damage); type default physical
//   empower: { mult, cooldown, armorPen } next attack deals +mult x damage
//   mods:    attribute bonuses (keys in data.js MODS)
//   slots:   extra skill slots (player)
export const SKILLS = [
  {
    id: 'S01', name: 'basic attack',
    levels: [
      { attack: { type: 'physical', base: 2, scaling: 1, time: 1, speedScaling: 1 } },
      { mods: { damageFlat: 1 } },
    ],
  },
  {
    id: 'S02', name: 'gel coat',
    levels: [
      { mods: { hpFlat: 20 } },
      { mods: { regenPct: 0.004 } },
      { mods: { manaRegenFlat: 0.5 } },
    ],
  },
  {
    id: 'S03', name: 'quick attack',
    levels: [
      { attack: { type: 'physical', base: 1, scaling: 0.6, time: 0.6, speedScaling: 1 } },
      { mods: { attackSpeedFlat: 0.25 } },
      { mods: { magicPowerFlat: 1 } },
    ],
  },
  {
    id: 'S04', name: 'burn',
    levels: [
      { spell: { type: 'magic', time: 4, speedScaling: 1, cost: 5, dot: { pctMaxHp: 0.03, pctScaling: 0.001, duration: 5 } }, mods: { manaFlat: 10 } },
    ],
  },
  {
    id: 'S05', name: 'sharpen',
    levels: [
      { mods: { damage: 0.2 } },
      { mods: { blockShredFlat: 1 } },
    ],
  },
  {
    id: 'S06', name: 'heavy blow',
    levels: [
      { empower: { mult: 3, cooldown: 5 } },
      { empower: { armorPen: 25 } },
    ],
  },
  {
    id: 'S07', name: 'shield',
    levels: [
      { mods: { blockFlat: 2 } },
      { mods: { armorFlat: 20 } },
    ],
  },
  {
    id: 'S08', name: 'barbed tips',
    levels: [
      { onHit: { type: 'physical', base: 1, scaling: 0.25 } },
      { mods: { attackSpeedFlat: 0.2 } },
    ],
  },
  {
    id: 'S09', name: 'arcane shield',
    levels: [
      { spell: { type: 'magic', time: 8, speedScaling: 1, cost: 8, shield: { base: 15, scaling: 5, duration: 8 } }, mods: { manaFlat: 10 } },
    ],
  },
  {
    id: 'S10', name: 'lifesteal',
    levels: [
      { mods: { lifesteal: 0.05 } },
    ],
  },
  {
    id: 'S11', name: 'brute force',
    levels: [
      { mods: { damageFlat: 1 } },
      { mods: { damageFlat: 0.5, damage: 0.05 } },
      { mods: { damage: 0.1 } },
    ],
  },
  {
    id: 'S12', name: 'quick casting',
    levels: [
      { mods: { magicSpeedFlat: 0.1 } },
      { mods: { manaRegenFlat: 0.5 } },
      { mods: { armorFlat: 10 } },
    ],
  },
  {
    id: 'S13', name: 'magic bolt',
    levels: [
      { spell: { type: 'magic', base: 1, scaling: 1, time: 2.5, speedScaling: 1 } },
      { spell: { base: 1 } },
    ],
  },
  {
    id: 'S14', name: 'fireball',
    levels: [
      { spell: { type: 'magic', base: 10, scaling: 5, time: 15, speedScaling: 1, cost: 10, countdown: true }, mods: { manaFlat: 10 } },
    ],
  },
  {
    id: 'S15', name: 'heal',
    levels: [
      { spell: { type: 'magic', time: 12, speedScaling: 1, cost: 5, heal: { pctMaxHp: 0.15 } }, mods: { manaFlat: 10 } },
    ],
  },
  {
    id: 'X01', name: 'arcane focus', special: true,
    levels: [
      { slots: 1 },
    ],
  },
  {
    id: 'X02', name: 'pack instinct', special: true,
    levels: [
      { slots: 1 },
    ],
  },
  {
    id: 'X03', name: 'deep roots', special: true,
    levels: [
      { slots: 1 },
    ],
  },
  {
    id: 'S16', name: 'warrior\'s bundle',
    levels: [
      { mods: { damage: 0.05, maxHp: 0.05, hpFlat: 5 } },
    ],
  },
];
