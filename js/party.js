// Hero data format (see docs/DESIGN.md 4.5). Quick-start party for now.
export function makeHero(o) {
  return {
    level: 1, xp: 0, status: [], inventory: [], quickSlots: [null, null],
    spellsKnown: [], spellsMemorized: [], ...o,
    hp: o.hpMax,
  };
}

export const QUICK_START_PARTY = [
  makeHero({ id: 'h1', name: 'Brannoch', class: 'Warden', row: 0, hpMax: 34,
    attrs: { might: 16, agility: 11, wits: 9, spirit: 10 }, weapon: 'Broadsword' }),
  makeHero({ id: 'h2', name: 'Sela', class: 'Cutpurse', row: 0, hpMax: 22,
    attrs: { might: 11, agility: 16, wits: 12, spirit: 9 }, weapon: 'Dagger' }),
  makeHero({ id: 'h3', name: 'Ioreth', class: 'Votary', row: 1, hpMax: 24,
    attrs: { might: 10, agility: 10, wits: 11, spirit: 16 }, weapon: 'Mace' }),
  makeHero({ id: 'h4', name: 'Quillon', class: 'Magister', row: 1, hpMax: 16,
    attrs: { might: 8, agility: 11, wits: 17, spirit: 12 }, weapon: 'Staff' }),
];
