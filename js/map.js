// Grid maps. Dirs: 0=N, 1=E, 2=S, 3=W.
//
// Tile characters:
//   '#' wall   '.' floor   'S' start (becomes floor)
//   'D' closed door (bump or interact to open)   'd' open door
//   'L' locked door (needs a key; see map.locks)
//   'G' closed gate (opened by a plate or switch)  'g' open gate
//   'P' pressure plate  'T' teleporter  'O' spinner
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['N', 'E', 'S', 'W'];

export const SOLID = new Set(['#', 'D', 'L', 'G']);

const TEST = {
  name: 'Test Halls',
  rows: [
    '################',
    '#S..#...#......#',
    '#...D...L..P...#',
    '#...#...#......#',
    '#########G######',
    '#.......#......#',
    '#...O...#...T..#',
    '#.......#......#',
    '#######G########',
    '#######.########',
    '################',
  ],
  // keys lying on the floor
  items: [{ x: 6, y: 2, kind: 'key', id: 'bronze', name: 'bronze key' }],
  // locked door position -> key id required
  locks: { '8,2': 'bronze' },
  // pressure plates: stay down once pressed, open every target
  plates: [{ x: 11, y: 2, targets: [[9, 4]] }],
  // wall switches: on wall cell (x,y), on the face looking toward `face`
  switches: [{ x: 0, y: 6, face: 1, hidden: true, targets: [[7, 8]] }],
  teleports: [{ x: 12, y: 6, to: { x: 2, y: 6, dir: 0 } }],
  monsters: [
    { type: 'tomb_rat', x: 6, y: 1 }, { type: 'tomb_rat', x: 13, y: 2 }, { type: 'tomb_rat', x: 14, y: 1 },
    { type: 'bone_wretch', x: 14, y: 7 }, { type: 'bone_wretch', x: 6, y: 5 },
  ],
};

export function loadMap() {
  const grid = TEST.rows.map(r => r.split(''));
  let start = { x: 1, y: 1, dir: 2 };
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++)
      if (grid[y][x] === 'S') { start = { x, y, dir: 2 }; grid[y][x] = '.'; }
  const copy = o => JSON.parse(JSON.stringify(o));
  return {
    name: TEST.name, grid, w: grid[0].length, h: grid.length, start,
    items: copy(TEST.items), locks: copy(TEST.locks),
    plates: copy(TEST.plates).map(p => ({ ...p, pressed: false })),
    switches: copy(TEST.switches).map(s => ({ ...s, found: !s.hidden, on: false })),
    teleports: copy(TEST.teleports), monsters: copy(TEST.monsters),
  };
}

export function tileAt(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return '#';
  return map.grid[y][x];
}

export function isSolid(map, x, y) { return SOLID.has(tileAt(map, x, y)); }
