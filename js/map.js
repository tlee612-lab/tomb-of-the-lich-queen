// Grid maps. Dirs: 0=N, 1=E, 2=S, 3=W.
//
// Tile characters:
//   '#' wall   '.' floor   'S' start (becomes floor; row-format maps only)
//   'D' closed door (bump or interact to open)   'd' open door
//   'L' locked door (needs a key; see map.locks)
//   'G' closed gate (opened by a plate or switch)   'g' open gate
//   'M' gem-socket door (see map.sockets)
//   'W' one-way door: opens only from one side (map.oneway['x,y'] = the direction you must be travelling), then stays open
//   'P' pressure plate  'T' teleporter  'O' spinner
//   'H' shrine (stand on it, press F)
//   'X' hidden pit trap     '<' '>' stairs up / down (see map.stairs)
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['N', 'E', 'S', 'W'];

export const SOLID = new Set(['#', 'D', 'L', 'G', 'M', 'W']);

// A floor spec is either `rows` (strings) or `w`,`h`,`carve` (rectangles of floor) plus `set` (special tiles).
export function buildMap(spec) {
  let grid;
  if (spec.rows) grid = spec.rows.map(r => r.split(''));
  else {
    grid = Array.from({ length: spec.h }, () => Array(spec.w).fill('#'));
    for (const [x1, y1, x2, y2] of spec.carve)
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) grid[y][x] = '.';
    for (const [k, ch] of Object.entries(spec.set || {})) { const [x, y] = k.split(',').map(Number); grid[y][x] = ch; }
  }
  let start = spec.start || { x: 1, y: 1, dir: 2 };
  const traps = {};
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === 'S') { start = { x, y, dir: 2 }; grid[y][x] = '.'; }
      if (grid[y][x] === 'X') traps[`${x},${y}`] = { found: false };
    }
  const copy = o => JSON.parse(JSON.stringify(o ?? null));
  return {
    name: spec.name || 'Unnamed', dark: !!spec.dark, grid, w: grid[0].length, h: grid.length, start,
    items: copy(spec.items) || [], locks: copy(spec.locks) || {}, oneway: copy(spec.oneway) || {},
    plates: (copy(spec.plates) || []).map(p => ({ ...p, pressed: false })),
    switches: (copy(spec.switches) || []).map(s => ({ ...s, found: !s.hidden, on: false })),
    teleports: copy(spec.teleports) || [], monsters: copy(spec.monsters) || [], shrines: copy(spec.shrines) || [],
    stairs: copy(spec.stairs) || [], sockets: copy(spec.sockets) || {},
    lamps: (copy(spec.lamps) || []).map(l => ({ ...l, lit: true })), traps, rescue: spec.rescue || null, wall: spec.wall || null,
    npcs: (copy(spec.npcs) || []).map(n => ({ ...n, freed: false })),
    inscriptions: (copy(spec.inscriptions) || []).map(i => ({ ...i, seen: false })),
  };
}

// The small test map the rule tests are written against.
const TEST = {
  name: 'Test Halls',
  rows: [
    '################',
    '#S..#...#......#',
    '#...D...L..P...#',
    '#...#...#......#',
    '#########G######',
    '#.......#....H.#',
    '#...O...#...T..#',
    '#.......#......#',
    '#######G########',
    '#######.########',
    '################',
  ],
  items: [
    { x: 6, y: 2, kind: 'key', id: 'bronze', name: 'bronze key' },
    { x: 12, y: 1, kind: 'ration', name: 'rations', amount: 2 },
    { x: 14, y: 3, kind: 'potion', id: 'heal', name: 'healing potion' },
    { x: 2, y: 7, kind: 'potion', id: 'return', name: 'draught of return' },
    { x: 3, y: 1, kind: 'ration', name: 'rations', amount: 2 },
  ],
  shrines: [{ x: 13, y: 5, charges: 2 }],
  locks: { '8,2': 'bronze' },
  plates: [{ x: 11, y: 2, targets: [[9, 4]] }],
  switches: [{ x: 0, y: 6, face: 1, hidden: true, targets: [[7, 8]] }],
  teleports: [{ x: 12, y: 6, to: { x: 2, y: 6, dir: 0 } }],
  monsters: [
    { type: 'tomb_rat', x: 6, y: 1 }, { type: 'tomb_rat', x: 13, y: 2 }, { type: 'tomb_rat', x: 14, y: 1 },
    { type: 'bone_wretch', x: 14, y: 7 }, { type: 'bone_wretch', x: 6, y: 5 },
  ],
};
export const loadMap = () => buildMap(TEST);

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return '#';
  return map.grid[y][x];
}

export function isSolid(map, x, y) { return SOLID.has(tileAt(map, x, y)); }
