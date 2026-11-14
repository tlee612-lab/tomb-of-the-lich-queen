// Grid maps. '#' wall, '.' floor, 'S' player start (floor).
// Dirs: 0=N, 1=E, 2=S, 3=W.
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const DIR_NAMES = ['N', 'E', 'S', 'W'];

const TEST = [
  '################',
  '#.....#........#',
  '#.###.#.######.#',
  '#.#...#.#....#.#',
  '#.#.###.#.##.#.#',
  '#.#.#...#.#..#.#',
  '#...#.###.#.##.#',
  '###.#.....#....#',
  '#...#######.####',
  '#.###.....#....#',
  '#.....###.#.##.#',
  '#####.#...#.#S.#',
  '#.....#.###.#..#',
  '#.#####.....#..#',
  '#..............#',
  '################',
];

export function loadMap() {
  const grid = TEST.map(r => r.split(''));
  let start = { x: 1, y: 1, dir: 2 };
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++)
      if (grid[y][x] === 'S') { start = { x, y, dir: 0 }; grid[y][x] = '.'; }
  return { grid, w: grid[0].length, h: grid.length, start };
}

export function isWall(map, x, y) {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true;
  return map.grid[y][x] === '#';
}
