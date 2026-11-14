// Monsters. def = defense the attacker must reach with d20 + bonus. dmg = [count, sides, bonus].
// atkMs = time between attacks, moveMs = time per step, aggro = path distance at which it hunts.
// `sprite` (optional image path) replaces the drawn placeholder.
export const MONSTERS = {
  tomb_rat:    { name: 'Tomb Rat',    hp: 5,  def: 11, atk: 1, dmg: [1, 3, 0], atkMs: 900,  moveMs: 500,  aggro: 6, xp: 5,  kind: 'rat',    undead: false },
  bone_wretch: { name: 'Bone Wretch', hp: 14, def: 12, atk: 2, dmg: [1, 6, 0], atkMs: 1800, moveMs: 1100, aggro: 5, xp: 20, kind: 'wretch', undead: true  },
  mire_ooze:         { name: 'Mire Ooze',         hp: 12, def: 9,  atk: 1, dmg: [1, 4, 0], atkMs: 1500, moveMs: 1300, aggro: 5, xp: 15, kind: 'ooze',   undead: false, poison: true },
  gravebound_guard:  { name: 'Gravebound Guard',  hp: 24, def: 14, atk: 3, dmg: [1, 8, 0], atkMs: 2200, moveMs: 1500, aggro: 5, xp: 35, kind: 'guard',  undead: true  },
  sepulchral_spider: { name: 'Sepulchral Spider', hp: 10, def: 13, atk: 3, dmg: [1, 4, 0], atkMs: 1800, moveMs: 700,  aggro: 7, xp: 25, kind: 'spider', undead: false, ranged: { range: 3, web: true } },
  cinder_wraith:     { name: 'Cinder Wraith',     hp: 16, def: 14, atk: 3, dmg: [1, 6, 0], atkMs: 1600, moveMs: 1000, aggro: 6, xp: 40, kind: 'wraith', undead: true, strikesBack: true },
  // The Lich Queen: warded while any phylactery lamp burns; stays in her chamber (leash = x1,y1,x2,y2).
  veshara:           { name: 'Veshara', hp: 70, def: 15, atk: 5, dmg: [1, 8, 0], atkMs: 2000, moveMs: 1400, aggro: 14, xp: 200, kind: 'queen', undead: true,
                       wardedByLamps: true, ranged: { range: 4, bolt: [1, 6, 1] }, leash: [3, 1, 11, 3], summons: [0.66, 0.33] },
};
