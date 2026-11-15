// The automap: remembers what the party has seen on each floor, and draws it small (the corner minimap) or whole (the Map tab).
// map.explored is { 'x,y': 1 }, kept per floor and saved with the game. Monsters and items are never drawn: a map shows places, not spoilers.
import { DX, DY, SOLID } from './map.js';

const COLOR = {
  '#': '#5a4650', '.': '#2a2024', 'D': '#b07a3c', 'd': '#6e5230', 'L': '#d0503c', 'G': '#8a8a98', 'g': '#4a4a55', 'M': '#a06ad0', 'W': '#b07a3c',
  'P': '#2c2428', 'T': '#4aa8c8', 'O': '#4aa8c8', 'H': '#d8c060', 'X': '#2a2024', '<': '#e8e0c8', '>': '#e8e0c8', 'S': '#2a2024',
};

// Marks what the party can see from where it stands: the cells around it, and everything straight ahead up to the first wall or door.
export function explore(g) {
  const m = g.map, seen = m.explored || (m.explored = {});
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < m.w && y < m.h) seen[`${x},${y}`] = 1; };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(g.x + dx, g.y + dy);
  let x = g.x, y = g.y;
  for (let i = 0; i < 12; i++) {
    x += DX[g.dir]; y += DY[g.dir];
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) break;
    mark(x, y);
    // the cells beside each cell down the corridor are seen too, so side openings show up
    mark(x - DY[g.dir], y + DX[g.dir]); mark(x + DY[g.dir], y - DX[g.dir]);
    if (SOLID.has(m.grid[y][x])) break;
  }
}

// Draws the explored part of the floor. radius > 0: a window of (2r+1) cells centred on the party. radius 0: the whole floor, fitted.
export function drawMap(canvas, g, radius = 0) {
  const m = g.map, seen = m.explored || {}, c = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  c.fillStyle = '#050304'; c.fillRect(0, 0, W, H);
  let x0 = 0, y0 = 0, cols = m.w, rows = m.h;
  if (radius > 0) { cols = rows = radius * 2 + 1; x0 = g.x - radius; y0 = g.y - radius; }
  else {                                                   // the whole map: zoom to what has been explored, with a margin, never smaller than 12 cells
    let ax = m.w, ay = m.h, bx = 0, by = 0;
    for (const k of Object.keys(seen)) { const [x, y] = k.split(',').map(Number); ax = Math.min(ax, x); ay = Math.min(ay, y); bx = Math.max(bx, x); by = Math.max(by, y); }
    ax = Math.max(0, Math.min(ax, g.x) - 1); ay = Math.max(0, Math.min(ay, g.y) - 1); bx = Math.min(m.w - 1, Math.max(bx, g.x) + 1); by = Math.min(m.h - 1, Math.max(by, g.y) + 1);
    cols = Math.max(12, bx - ax + 1); rows = Math.max(12, by - ay + 1); x0 = ax; y0 = ay;
  }
  const cs = Math.floor(Math.min(W / cols, H / rows)), ox = Math.floor((W - cs * cols) / 2), oy = Math.floor((H - cs * rows) / 2);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = x0 + i, y = y0 + j;
    if (!seen[`${x},${y}`] || x < 0 || y < 0 || x >= m.w || y >= m.h) continue;
    const ch = m.grid[y][x], px = ox + i * cs, py = oy + j * cs;
    c.fillStyle = COLOR[ch] || COLOR['.']; c.fillRect(px, py, cs, cs);
    if (ch === '#') continue;
    if (ch === '<' || ch === '>' || ch === 'H' || ch === 'T' || ch === 'O') {        // a mark on the cell, so stairs and shrines read at a glance
      c.fillStyle = '#050304'; c.font = `bold ${Math.max(6, cs - 1)}px monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(ch === '<' ? '▲' : ch === '>' ? '▼' : ch === 'H' ? '+' : '*', px + cs / 2, py + cs / 2 + 1);
    }
  }
  // the party: a triangle pointing the way it faces
  const px = ox + (g.x - x0) * cs + cs / 2, py = oy + (g.y - y0) * cs + cs / 2, r = Math.max(3, cs * 0.45);
  const a = [[0, -1], [1, 0], [0, 1], [-1, 0]][g.dir], p = [-a[1], a[0]];
  c.fillStyle = '#ffe066'; c.beginPath();
  c.moveTo(px + a[0] * r, py + a[1] * r);
  c.lineTo(px - a[0] * r * 0.7 + p[0] * r * 0.8, py - a[1] * r * 0.7 + p[1] * r * 0.8);
  c.lineTo(px - a[0] * r * 0.7 - p[0] * r * 0.8, py - a[1] * r * 0.7 - p[1] * r * 0.8);
  c.closePath(); c.fill();
}
