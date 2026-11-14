// Monsters. def = defense the attacker must reach with d20 + bonus. dmg = [count, sides, bonus].
// atkMs = time between attacks, moveMs = time per step, aggro = path distance at which it hunts.
// `sprite` (optional image path) replaces the drawn placeholder.
export const MONSTERS = {
  tomb_rat:    { name: 'Tomb Rat',    hp: 6,  def: 11, atk: 2, dmg: [1, 4, 0], atkMs: 800,  moveMs: 450,  aggro: 6, xp: 5,  kind: 'rat',    undead: false },
  bone_wretch: { name: 'Bone Wretch', hp: 18, def: 12, atk: 3, dmg: [1, 8, 0], atkMs: 1700, moveMs: 1000, aggro: 5, xp: 21, kind: 'wretch', undead: true  },
  mire_ooze:         { name: 'Mire Ooze',         hp: 20, def: 9,  atk: 3, dmg: [1, 6, 1], atkMs: 1300, moveMs: 1300, aggro: 5, xp: 16, kind: 'ooze',   undead: false, poison: true, splits: true },   // fire splits it in two (splitOoze in combat.js)
  gravebound_guard:  { name: 'Gravebound Guard',  hp: 36, def: 14, atk: 5, dmg: [1, 10, 1], atkMs: 1900, moveMs: 1500, aggro: 5, xp: 39, kind: 'guard',  undead: true  },
  sepulchral_spider: { name: 'Sepulchral Spider', hp: 14, def: 13, atk: 5, dmg: [1, 6, 1], atkMs: 1500, moveMs: 700,  aggro: 7, xp: 26, kind: 'spider', undead: false, ranged: { range: 3, web: true } },
  cinder_wraith:     { name: 'Cinder Wraith',     hp: 24, def: 14, atk: 5, dmg: [1, 8, 1], atkMs: 1400, moveMs: 1000, aggro: 6, xp: 42, kind: 'wraith', undead: true, strikesBack: true },
  // The Lich Queen: warded while any phylactery lamp burns; stays in her chamber (leash = x1,y1,x2,y2).
  veshara:           { name: 'Veshara', hp: 120, def: 15, atk: 6, dmg: [1, 10, 0], atkMs: 1800, moveMs: 1400, aggro: 14, xp: 400, kind: 'queen', undead: true,
                       wardedByLamps: true, holdWhileWarded: true, ranged: { range: 4, bolt: [1, 6, 1] }, leash: [3, 1, 11, 3], summons: [0.66, 0.33], summonCount: 3 },
};
