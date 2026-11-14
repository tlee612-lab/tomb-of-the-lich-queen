// Class definitions (docs/DESIGN.md 4.3). Replace or extend this file to change the classes.
export const CLASSES = {
  Warden:   { hpBase: 30, armor: 3, weapon: 'Broadsword', row: 0, slots: 0, spells: [],
              blurb: 'Front-line fighter. Most HP, best melee.' },
  Cutpurse: { hpBase: 22, armor: 1, weapon: 'Dagger',     row: 0, slots: 0, spells: [],
              blurb: 'Finds hidden switches, opens locks, strikes first.' },
  Votary:   { hpBase: 22, armor: 2, weapon: 'Sling',      row: 1, slots: 2, spells: ["Mender's Touch", 'Lantern Ward'],
              blurb: 'Healer. Sanctify aura harms undead.' },
  Magister: { hpBase: 14, armor: 0, weapon: 'Staff',      row: 1, slots: 2, spells: ['Cinder Dart', 'Frostbind'],
              blurb: 'Fragile, strongest spells.' },
};

export const ATTRS = ['might', 'agility', 'wits', 'spirit'];
export const ATTR_BASE = 8, ATTR_MAX = 16, ATTR_POINTS = 14;   // creation point-buy
