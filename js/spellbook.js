// Spell slots and the default memorized loadout. Kept separate so combat and party can share it.
import { CLASSES } from './data/classes.js';

// Casters get their class slots plus one more every two levels.
export const slotsFor = h => { const c = CLASSES[h.class]; return c.slots > 0 ? c.slots + Math.floor((h.level - 1) / 2) : 0; };
export const loadoutFor = h => Array.from({ length: slotsFor(h) }, (_, i) => h.spellsKnown[i % h.spellsKnown.length]);
