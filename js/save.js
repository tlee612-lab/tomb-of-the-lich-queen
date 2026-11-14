// Saving and loading. Pure functions over a storage object (localStorage in the browser), so they can be
// tested from Node. A save holds only what changes during play; the rest is rebuilt from the floor data.
import { loadCampaign } from './data/floors.js';
import { newGame } from './world.js';

export const SAVE_VERSION = 1;
export const SLOTS = [1, 2, 3];
const key = slot => `totlq.save.${slot}`;                 // slot is 1-3 or 'auto'
const clone = o => JSON.parse(JSON.stringify(o));

export function serialize(g) {
  g.map.enemies = g.enemies;                               // the current floor's live monsters
  return {
    v: SAVE_VERSION, savedAt: Date.now(),
    floor: g.floor, x: g.x, y: g.y, dir: g.dir, bag: [...g.bag], rations: g.rations,
    hungerMs: g.hungerMs, starving: g.starving, starveMs: g.starveMs, lightMs: g.lightMs, sanctMs: g.sanctMs,
    journal: clone(g.journal), party: clone(g.party),
    floors: g.floors.map(f => clone({
      grid: f.grid.map(r => r.join('')), items: f.items, plates: f.plates, switches: f.switches, shrines: f.shrines,
      traps: f.traps, lamps: f.lamps, inscriptions: f.inscriptions, placed: f.placed || {}, enemies: f.enemies,
    })),
  };
}

const isNum = v => Number.isFinite(v);
function valid(d, floorCount) {
  return d && d.v === SAVE_VERSION && Array.isArray(d.floors) && d.floors.length === floorCount
    && Number.isInteger(d.floor) && d.floor >= 0 && d.floor < floorCount
    && isNum(d.x) && isNum(d.y) && [0, 1, 2, 3].includes(d.dir) && Array.isArray(d.bag) && isNum(d.rations)
    && Array.isArray(d.party) && d.party.length === 4 && Array.isArray(d.journal)
    && d.party.every(h => h && typeof h.name === 'string' && isNum(h.hp) && isNum(h.hpMax) && Array.isArray(h.quickSlots))
    && d.floors.every(f => f && Array.isArray(f.grid) && Array.isArray(f.enemies) && Array.isArray(f.items));
}

// Rebuilds a running game from save data. Returns null if the data is not a valid save for this campaign.
export function restore(data, rng = Math.random) {
  const floors = loadCampaign();
  if (!valid(data, floors.length)) return null;
  const d = clone(data);
  const g = newGame(floors, rng);
  d.floors.forEach((s, i) => {
    const f = floors[i];
    if (s.grid.length !== f.h || s.grid.some(r => r.length !== f.w)) throw new Error('size mismatch');
    f.grid = s.grid.map(r => r.split(''));
    Object.assign(f, { items: s.items, plates: s.plates, switches: s.switches, shrines: s.shrines, traps: s.traps,
      lamps: s.lamps, inscriptions: s.inscriptions, placed: s.placed, enemies: s.enemies });
  });
  Object.assign(g, { floor: d.floor, map: floors[d.floor], x: d.x, y: d.y, dir: d.dir, bag: d.bag, rations: d.rations,
    hungerMs: d.hungerMs || 0, starving: !!d.starving, starveMs: d.starveMs || 0, lightMs: d.lightMs || 0, sanctMs: d.sanctMs || 0,
    journal: d.journal, party: d.party });
  g.enemies = g.map.enemies;
  return g;
}

export function saveGame(g, slot, storage) {
  try { storage.setItem(key(slot), JSON.stringify(serialize(g))); return { ok: true }; }
  catch (e) { return { ok: false, why: 'Could not save: browser storage is unavailable or full.' }; }
}

export function readSave(slot, storage) {
  let raw;
  try { raw = storage.getItem(key(slot)); } catch { return null; }          // storage unreadable: treat as empty
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return { damaged: true }; }       // something is there, but it is not a save
}

export function loadGame(slot, storage, rng) {
  const data = readSave(slot, storage);
  if (!data) return { ok: false, why: 'That slot is empty.' };
  try {
    const g = restore(data, rng);
    return g ? { ok: true, game: g } : { ok: false, why: 'That save is damaged or from another version.' };
  } catch { return { ok: false, why: 'That save is damaged or from another version.' }; }
}

// One line per slot for the menu: null if empty, { damaged: true } if unreadable.
export function describeSave(slot, storage, floorNames = loadCampaign().map(f => f.name)) {
  const d = readSave(slot, storage);
  if (!d) return null;
  if (!valid(d, floorNames.length)) return { slot, damaged: true };
  return { slot, savedAt: d.savedAt, floor: d.floor, floorName: floorNames[d.floor],
    party: d.party.map(h => `${h.name} L${h.level}`).join(', '), alive: d.party.filter(h => h.hp > 0).length };
}

export const listSaves = storage => ['auto', ...SLOTS].map(s => ({ slot: s, info: describeSave(s, storage) }));
