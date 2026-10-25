// Converts enemies in the old format (hp, stats, actions, per-kill rewards)
// to the current one (base attributes + skills, total rewards).
// Used once, for dev edits that were kept in the browser before the change.

const r12 = (x) => Number(x.toPrecision(12));

export function migrateOldDraft(oldEnemies, skillsIn, REWARD) {
  const skills = structuredClone(skillsIn);
  const key = (name, level) => JSON.stringify([name, level]);
  const known = new Map(skills.map((k) => [key(k.name, k.levels), k.id]));
  let n = skills.reduce((m, k) => Math.max(m, Number(/^M(\d+)$/.exec(k.id)?.[1] || 0)), 0) + 1;
  // Reuse an identical skill if one exists, else add a new one.
  const skillFor = (name, levels) => {
    const k = key(name, levels);
    if (known.has(k)) return known.get(k);
    const id = `M${String(n++).padStart(2, '0')}`; // monster skill
    skills.push({ id, name, levels });
    known.set(k, id);
    return id;
  };

  const enemies = oldEnemies.map((e) => {
    if (e.base) return e; // already new
    const base = { maxHp: e.hp };
    for (const [k, v] of Object.entries(e.stats || {})) base[k] = v;
    if (e.armor) base.armor = e.armor;
    if (e.block) base.block = e.block;
    if (e.regen || e.decay) base.regenFlat = (e.regen || 0) - (e.decay || 0);
    const own = [];
    for (const a of e.actions || []) {
      const { name, kind = 'attack', special, ...rest } = a;
      const act = { ...rest };
      if (special) act.countdown = true;
      own.push({ skill: skillFor(name, [{ [kind]: act }]), level: 1 });
    }
    if (e.onHit) own.push({ skill: skillFor(`${e.name} barbs`, [{ onHit: { ...e.onHit } }]), level: 1 });
    const W = e.limit + 3 + 7; // old per-kill rules: first kill x4, final kill x8
    const rewards = (e.rewards || (e.reward ? [e.reward] : [])).map((r) => ({
      stat: r.stat, total: r12((r.amount || 0) * W), ...(r.type ? { type: r.type } : {}),
    }));
    const out = { id: e.id, name: e.name, tier: e.tier || 0 };
    if (e.boss) out.rank = 'boss';
    out.limit = e.limit;
    out.base = base;
    out.skills = own;
    out.rewards = rewards;
    out.skillRewards = e.skills || [];
    return out;
  });
  return { enemies, skills };
}
