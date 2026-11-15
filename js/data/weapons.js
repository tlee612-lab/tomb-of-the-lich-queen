// Weapons. dice = [count, sides, bonus]; ms = cooldown in milliseconds; stat = attribute used.
// reach/ranged weapons can be used from the back row; others only from the front row.
export const WEAPONS = {
  Broadsword: { dice: [1, 8, 0], ms: 1400, stat: 'might' },
  Dagger:     { dice: [1, 4, 0], ms: 700,  stat: 'agility' },
  Mace:       { dice: [1, 6, 0], ms: 1200, stat: 'might' },
  Staff:      { dice: [1, 4, 0], ms: 1000, stat: 'might', reach: true },
  Sling:      { dice: [1, 4, 0], ms: 1500, stat: 'agility', ranged: true },
  // found in the tomb (js/data/gear.js)
  'Tombguard Sword': { dice: [1, 8, 1], ms: 1300, stat: 'might' },
  Stiletto:          { dice: [1, 4, 1], ms: 650,  stat: 'agility' },
  'Silver Sling':    { dice: [1, 4, 1], ms: 1400, stat: 'agility', ranged: true },
  'Rune Staff':      { dice: [1, 4, 0], ms: 1000, stat: 'wits', reach: true },
};
