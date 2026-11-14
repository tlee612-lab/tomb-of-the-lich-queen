// Spells. target: 'enemy' (the monster ahead), 'ally' (pick a hero), 'party' (no target).
// cd = the caster's cooldown after casting, in ms. dmg = [count, sides, bonus] added to the stat modifier.
export const SPELLS = {
  "Mender's Touch": { target: 'ally',  cd: 1500, heal: [1, 8, 0], stat: 'spirit', text: 'Heals an ally for 1d8 + Spirit.' },
  'Field Dressing': { target: 'ally',  cd: 1500, heal: [1, 6, 0], stat: 'might',  text: "Binds an ally's wounds for 1d6 + Might. A fighter's field medicine." },
  'Lantern Ward':  { target: 'party', cd: 1500, lightMs: 120000, reveal: 5, text: 'Brightens the way and reveals hidden switches nearby for two minutes.' },
  'Cinder Dart':    { target: 'enemy', cd: 1500, dmg: [1, 6, 2], stat: 'wits', fire: true, text: 'Fire damage to the enemy ahead. Never misses. Mire Oozes split when burned.' },
  'Frostbind':      { target: 'enemy', cd: 1500, slowMs: 6000, text: 'Slows the enemy ahead for six seconds.' },
  'Unbind':         { target: 'ally',  cd: 1500, cure: true, text: 'Cures an ally of poison and sticky web.' },
  'Bulwark':        { target: 'ally',  cd: 1500, defMs: 20000, def: 3, text: "Raises an ally's Defense by 3 for twenty seconds." },
  'Mirror Veil':    { target: 'ally',  cd: 1500, veil: true, text: 'The next blow that would land on an ally is absorbed whole.' },
  'Arc of Sparks':  { target: 'enemy', cd: 1500, dmg: [1, 6, 0], stat: 'wits', chain: true, text: 'Lightning for 1d6 + Wits that leaps to a second enemy within two cells. Never misses.' },
  'Gale Burst':     { target: 'enemy', cd: 1800, dmg: [1, 4, 1], stat: 'wits', push: true, text: 'Hits every enemy in the line ahead (up to three cells) and shoves each back a step, staggering it for a moment.' },
  'Dread Sight':    { target: 'enemy', cd: 1500, sight: true, text: 'Shows the health, defense and weaknesses of enemies nearby until they fall.' },
};
