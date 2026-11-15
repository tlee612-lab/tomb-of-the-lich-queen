// Gear a hero can wear or wield. A weapon id must be a key of WEAPONS (js/data/weapons.js); armor has a value that
// replaces the hero's armor number. `classes` lists who may use it. The first piece of each kind is what a class starts with.
export const GEAR = {
  // ---- weapons ----
  'Broadsword':      { slot: 'weapon', classes: ['Warden'] },
  'Tombguard Sword': { slot: 'weapon', classes: ['Warden'],   text: 'A sword from the tomb armory: 1d8+1, a little quicker.' },
  'Dagger':          { slot: 'weapon', classes: ['Cutpurse'] },
  'Stiletto':        { slot: 'weapon', classes: ['Cutpurse'],  text: 'A guard\'s thin blade: 1d4+1 and quick.' },
  'Sling':           { slot: 'weapon', classes: ['Votary'] },
  'Silver Sling':    { slot: 'weapon', classes: ['Votary'],    text: 'A sling with a silver cup: 1d4+1.' },
  'Staff':           { slot: 'weapon', classes: ['Magister'] },
  'Rune Staff':      { slot: 'weapon', classes: ['Magister'],  text: 'A runed staff that is swung by wit, not strength: 1d4, uses Wits.' },
  // ---- armor ----
  'Scale Hauberk':   { slot: 'armor', armor: 3, classes: ['Warden'] },
  'Leather Jerkin':  { slot: 'armor', armor: 1, classes: ['Cutpurse'] },
  'Vestments':       { slot: 'armor', armor: 2, classes: ['Votary'] },
  'Robes':           { slot: 'armor', armor: 0, classes: ['Magister'] },
  'Chain Mail':      { slot: 'armor', armor: 4, classes: ['Warden', 'Votary'], text: 'Linked rings. Armor 4.' },
  'Boiled Leather':  { slot: 'armor', armor: 2, classes: ['Cutpurse', 'Magister', 'Votary'], text: 'Hardened leather that does not clink. Armor 2.' },
  'Ward Robe':       { slot: 'armor', armor: 1, classes: ['Magister', 'Votary'], text: 'A robe stitched with wards. Armor 1.' },
  'Plate Harness':   { slot: 'armor', armor: 5, classes: ['Warden'], text: 'Heavy plate for a front-line fighter. Armor 5.' },
  // ---- accessories (one per hero; no class starts with one) ----
  'Ring of Vigor':     { slot: 'accessory', classes: ['Warden', 'Cutpurse', 'Votary', 'Magister'], hp: 6,   text: 'Adds 6 to maximum health.' },
  'Charm of Warding':  { slot: 'accessory', classes: ['Warden', 'Cutpurse', 'Votary', 'Magister'], def: 1,  text: 'Adds 1 to Defense.' },
  'Ring of Keen Edge': { slot: 'accessory', classes: ['Warden', 'Cutpurse'],                       dmg: 1,  text: 'Adds 1 to every weapon blow.' },
  'Sage Pendant':      { slot: 'accessory', classes: ['Votary', 'Magister'],                      spell: 1, text: 'Adds 1 to the damage or healing of every spell.' },
};

// What a class starts with.
export const START_GEAR = {
  Warden:   { weapon: 'Broadsword', armor: 'Scale Hauberk' },
  Cutpurse: { weapon: 'Dagger',     armor: 'Leather Jerkin' },
  Votary:   { weapon: 'Sling',      armor: 'Vestments' },
  Magister: { weapon: 'Staff',      armor: 'Robes' },
};

// What a hero's accessory adds: { hp, def, dmg, spell } (any may be missing).
export const accessoryOf = h => (h && h.accessory && GEAR[h.accessory]) || {};
export const canUse = (h, id) => !!GEAR[id] && GEAR[id].classes.includes(h.class);
