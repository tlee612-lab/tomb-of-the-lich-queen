// Premade heroes. Add entries here (same shape as createHero input) to extend the roster.
// `portrait` is an optional image path, e.g. 'assets/portraits/brannoch.png'.
export const ROSTER = [
  { id: 'brannoch', name: 'Brannoch', class: 'Warden',   attrs: { might: 16, agility: 11, wits: 9,  spirit: 10 } },
  { id: 'sela',     name: 'Sela',     class: 'Cutpurse', attrs: { might: 11, agility: 16, wits: 10, spirit: 9  } },
  { id: 'ioreth',   name: 'Ioreth',   class: 'Votary',   attrs: { might: 10, agility: 10, wits: 10, spirit: 16 } },
  { id: 'quillon',  name: 'Quillon',  class: 'Magister', attrs: { might: 8,  agility: 11, wits: 16, spirit: 11 } },
  { id: 'dagny',    name: 'Dagny',    class: 'Warden',   attrs: { might: 14, agility: 14, wits: 9,  spirit: 9  } },
  { id: 'osric',    name: 'Osric',    class: 'Magister', attrs: { might: 9,  agility: 9,  wits: 14, spirit: 14 } },
];
export const QUICK_START = ['brannoch', 'sela', 'ioreth', 'quillon'];
