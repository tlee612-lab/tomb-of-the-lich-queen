// Spell slots and the default memorized loadout. Kept separate so combat and party can share it.
import { CLASSES } from './data/classes.js';

// Casters get their class slots plus one more every two levels.
export const slotsFor = h => { const c = CLASSES[h.class]; return c.slots > 0 ? c.slots + Math.floor((h.level - 1) / 2) : 0; };

// What a rest memorizes. h.plan (optional) is the player's choice per slot, set in the menu's Spells tab; any slot
// without a valid choice falls back to cycling through the known spells in order.
export const loadoutFor = h => Array.from({ length: slotsFor(h) }, (_, i) =>
  h.plan && h.spellsKnown.includes(h.plan[i]) ? h.plan[i] : h.spellsKnown[i % h.spellsKnown.length]);

// Spells a hero learns on reaching `level`.
export const learnedAt = (h, level) => (CLASSES[h.class].learn?.[level] || []).filter(s => !h.spellsKnown.includes(s));
