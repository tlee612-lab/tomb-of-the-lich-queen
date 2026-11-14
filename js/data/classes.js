// Class definitions (docs/DESIGN.md 4.3). Replace or extend this file to change the classes.
export const CLASSES = {
  Warden:   { hpBase: 30, armor: 3, weapon: 'Broadsword', row: 0, slots: 1, spells: ['Field Dressing'],
              blurb: 'Front-line fighter. Most HP, best melee. Field Dressing mends allies.' },
  Cutpurse: { hpBase: 22, armor: 1, weapon: 'Dagger',     row: 0, slots: 0, spells: [],
              blurb: 'Backstabs fresh or slowed foes, spots hidden switches from afar, picks locks, disarms pits.' },
  Votary:   { hpBase: 22, armor: 2, weapon: 'Sling',      row: 1, slots: 2, spells: ["Mender's Touch", 'Lantern Ward'],
              learn: { 2: ['Unbind'], 3: ['Bulwark'] },
              blurb: 'Healer. Sanctify aura harms undead. Learns Unbind and Bulwark.' },
  Magister: { hpBase: 14, armor: 0, weapon: 'Staff',      row: 1, slots: 2, spells: ['Cinder Dart', 'Frostbind'],
              learn: { 2: ['Arc of Sparks'], 3: ['Mirror Veil'], 4: ['Gale Burst'], 5: ['Dread Sight'] },
              blurb: 'Fragile, strongest spells. Learns four more as the party levels.' },
};

export const ATTRS = ['might', 'agility', 'wits', 'spirit'];
export const ATTR_BASE = 8, ATTR_MAX = 16, ATTR_POINTS = 14;   // creation point-buy
