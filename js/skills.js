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
//     pctMaxHp            + this fraction of the target's max hp on each hit
//     time, speedScaling  uses per second = 1 / time + speed x speedScaling
//     hits                hits per use (default 1)
//     cost                mana per use (waits until affordable)
//     lifesteal           heals this fraction of the damage dealt
//     dot: { pctMaxHp, pctScaling, base, scaling, duration }   damage over time
//          per stack per second = (pctMaxHp + power x pctScaling) x target max hp
//          + base + power x scaling
//     shield: { base, scaling, duration, type }    temporary hp, absorbs first;
//                         type 'physical' or 'magic': only absorbs that type
//     heal: { pctMaxHp, base, scaling }            heals the user
//     countdown           shows a countdown in the process panel
//   onHit:   { type, base, scaling } extra damage on each attack hit (scaling x
//            damage); type default physical
//   empower: { mult, cooldown, armorPen } next attack deals +mult x damage
//   mods:    attribute bonuses (keys in data.js MODS)
//   attackPenalty: { at, mods } (player, attack skills) once the player has
//            at least "at" active skills with an attack, mods apply (negative
//            bonuses, keys in data.js MODS). Each attack skill applies its own.
//   slots:   extra skill slots (player)
//   rush:    { attackSpeed, duration } +attackSpeed at the start of a fight,
//            falling to 0 over duration seconds (player and enemies)
//   winHeal: heals this fraction of max hp after each win (player)
//   aura:    { type, base, pctMaxHp } damage per second to the opponent during
//            a fight = base + pctMaxHp x own max hp; type default magic
//            (physical: reduced by armor, not block)
export const SKILLS = [
  {
    id: 'S01', name: 'basic attack',
    levels: [
      { attack: { type: 'physical', base: 2, scaling: 1, time: 1.5, speedScaling: 1 }, attackPenalty: { at: 2, mods: { damage: -0.1, attackSpeed: -0.1 } } },
      { attack: { base: 0.8 } },
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
    id: 'S02', name: 'gel coat',
    levels: [
      { mods: { hpFlat: 20 } },
      { mods: { regenPct: 0.01 } },
      { mods: { manaRegenFlat: 0.5 } },
    ],
  },
  {
    id: 'S03', name: 'quick attack',
    levels: [
      { attack: { type: 'physical', base: 1.48, scaling: 0.6, time: 0.9, speedScaling: 1 }, attackPenalty: { at: 2, mods: { damage: -0.1, attackSpeed: -0.1 } } },
      { mods: { attackSpeedFlat: 0.25 } },
      { mods: { magicPowerFlat: 1 } },
    ],
  },
  {
    id: 'S04', name: 'burn',
    levels: [
      { spell: { type: 'magic', time: 4, speedScaling: 1, cost: 5, dot: { duration: 3, base: 6 } }, mods: { manaFlat: 10 } },
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
      { spell: { type: 'magic', time: 6, speedScaling: 1, cost: 8, shield: { base: 15, scaling: 5, duration: 8 } }, mods: { manaFlat: 10 } },
    ],
  },
  {
    id: 'S10', name: 'lifesteal',
    levels: [
      { mods: { lifesteal: 0.2 } },
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
    id: 'X04', name: 'recovery', special: true,
    levels: [
      { winHeal: 0.05 },
    ],
  },
  {
    id: 'X05', name: 'improved fighting', special: true,
    levels: [
      { mods: { damageFlat: 0.5, attackSpeedFlat: 0.2, hpFlat: 5 } },
    ],
  },
  {
    id: 'S16', name: 'warrior\'s bundle',
    levels: [
      { mods: { damageFlat: 0.5, hpFlat: 5, armorFlat: 10, attackSpeedFlat: 0.2 } },
      { mods: { damage: 0.1, maxHp: 0.1, attackSpeed: 0.1, armor: 0.1 } },
    ],
  },
  {
    id: 'M01', name: 'explosion',
    levels: [
      { attack: { type: 'physical', base: 0, scaling: 10, time: 7, speedScaling: 0 } },
    ],
  },
  {
    id: 'M02', name: 'quick start',
    levels: [
      { rush: { attackSpeed: 3, duration: 4 } },
    ],
  },
  {
    id: 'M03', name: 'basic attack',
    levels: [
      { attack: { type: 'physical', scaling: 1, time: 1.6, speedScaling: 1 } },
    ],
  },
  {
    id: 'S17', name: 'heavy attack',
    levels: [
      { attack: { type: 'physical', base: 6.6, scaling: 2, time: 2.5, speedScaling: 0.5 }, attackPenalty: { at: 2, mods: { damage: -0.1, attackSpeed: -0.1 } } },
      { mods: { damageFlat: 1 } },
    ],
  },
  {
    id: 'S18', name: 'patient strikes',
    levels: [
      { mods: { damage: 0.5, attackSpeed: -0.3 } },
    ],
  },
  {
    id: 'S19', name: 'troll aura',
    levels: [
      { aura: { type: 'magic', base: 2, pctMaxHp: 0.05 } },
    ],
  },
  {
    id: 'S20', name: 'fire bolt',
    levels: [
      { spell: { type: 'magic', base: 4, scaling: 1, time: 1.5, speedScaling: 1, cost: 2 } },
    ],
  },
  {
    id: 'S21', name: 'frenzy',
    levels: [
      { rush: { attackSpeed: 1, duration: 6 } },
      { rush: { attackSpeed: 0.5 } },
    ],
  },
  {
    id: 'S22', name: 'fyndhorn vigor',
    levels: [
      { mods: { hpFlat: 30, manaFlat: 10, manaRegenFlat: 0.5 } },
      { mods: { hpFlat: 20, manaFlat: 5, manaRegenFlat: 0.25 } },
    ],
  },
  {
    id: 'M06', name: 'fyndhorn barrier',
    levels: [
      { spell: { type: 'magic', time: 6, speedScaling: 0, shield: { base: 40, duration: 6, type: 'physical' } } },
    ],
  },
  {
    id: 'M04', name: 'paladin smite',
    levels: [
      { attack: { type: 'magic', scaling: 3, time: 4 } },
    ],
  },
  {
    id: 'M05', name: 'basic magic attack',
    levels: [
      { spell: { type: 'magic', scaling: 1, time: 2, speedScaling: 1, cost: 5 } },
    ],
  },
];
