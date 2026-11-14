// Spells. target: 'enemy' (the monster ahead), 'ally' (pick a hero), 'party' (no target).
// cd = the caster's cooldown after casting, in ms. dmg = [count, sides, bonus] added to the stat modifier.
export const SPELLS = {
  "Mender's Touch": { target: 'ally',  cd: 1500, heal: [1, 8, 0], stat: 'spirit', text: 'Heals an ally for 1d8 + Spirit.' },
  'Lantern Ward':   { target: 'party', cd: 1500, lightMs: 120000, reveal: 5, text: 'Brightens the way and reveals hidden switches nearby for two minutes.' },
  'Cinder Dart':    { target: 'enemy', cd: 1500, dmg: [1, 6, 2], stat: 'wits', text: 'Fire damage to the enemy ahead. Never misses.' },
  'Frostbind':      { target: 'enemy', cd: 1500, slowMs: 6000, text: 'Slows the enemy ahead for six seconds.' },
};
