// Monsters. def = defense the attacker must reach with d20 + bonus. dmg = [count, sides, bonus].
// atkMs = time between attacks, moveMs = time per step, aggro = path distance at which it hunts.
// `sprite` (optional image path) replaces the drawn placeholder.
export const MONSTERS = {
  tomb_rat:    { name: 'Tomb Rat',    hp: 5,  def: 11, atk: 1, dmg: [1, 3, 0], atkMs: 900,  moveMs: 500,  aggro: 6, xp: 5,  kind: 'rat',    undead: false },
  bone_wretch: { name: 'Bone Wretch', hp: 14, def: 12, atk: 2, dmg: [1, 6, 0], atkMs: 1800, moveMs: 1100, aggro: 5, xp: 20, kind: 'wretch', undead: true  },
};
