// Hero data format (docs/DESIGN.md 4.5). Roster heroes, quick-start heroes and created
// heroes are all built by createHero, so there is one format.
import { CLASSES, ATTRS, ATTR_BASE, ATTR_MAX, ATTR_POINTS } from './data/classes.js';
import { ROSTER, QUICK_START } from './data/roster.js';

export const mod = v => Math.floor((v - 10) / 2);

export function validateHeroInput(o) {
  const errs = [];
  if (!o.name || !o.name.trim()) errs.push('Name is required.');
  else if (o.name.trim().length > 14) errs.push('Name is too long (14 characters max).');
  if (!CLASSES[o.class]) errs.push('Unknown class.');
  let spent = 0;
  for (const a of ATTRS) {
    const v = o.attrs?.[a];
    if (!Number.isInteger(v) || v < ATTR_BASE || v > ATTR_MAX) errs.push(`${a} must be ${ATTR_BASE}-${ATTR_MAX}.`);
    else spent += v - ATTR_BASE;
  }
  if (spent > ATTR_POINTS) errs.push(`Too many attribute points (${spent}/${ATTR_POINTS}).`);
  return errs;
}

export function createHero(o) {
  const errs = validateHeroInput(o);
  if (errs.length) throw new Error(errs.join(' '));
  const c = CLASSES[o.class];
  const hpMax = Math.max(1, c.hpBase + 2 * mod(o.attrs.might));
  return {
    id: o.id || 'h' + Math.random().toString(36).slice(2, 8),
    name: o.name.trim(), class: o.class, portrait: o.portrait || null,
    level: 1, xp: 0, attrs: { ...o.attrs }, hpMax, hp: hpMax, status: [], row: c.row,
    weapon: c.weapon, armor: c.armor, cd: 0, inventory: [], quickSlots: [null, null],
    spellsKnown: [...c.spells], spellsMemorized: c.spells.slice(0, c.slots),
  };
}

export const rosterHeroes = () => ROSTER.map(createHero);
export const quickStartParty = () => QUICK_START.map(id => createHero(ROSTER.find(r => r.id === id)));

// A party is four heroes with unique ids. Slots 0-1 are the front row, 2-3 the back row.
export function formParty(heroes) {
  const errs = [];
  if (heroes.length !== 4) errs.push('A party needs exactly 4 heroes.');
  if (new Set(heroes.map(h => h.id)).size !== heroes.length) errs.push('Each hero can only be chosen once.');
  if (errs.length) return { errs };
  return { errs, party: heroes.map((h, i) => ({ ...h, row: i < 2 ? 0 : 1 })) };
}
