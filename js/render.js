// Layered perspective renderer: draws visible cells back to front (painter's order).
import { DX, DY, tileAt, SOLID } from './map.js';

const W = 448, H = 300;
const CX = W / 2, CY = H / 2 + 6;
const FOCAL = 230;
const HALF_H = 0.55;     // wall half-height in world units
const DEPTH = 4;         // cells ahead drawn
const edge = k => k + 0.45;   // distance of the near edge of cell k

const PALETTE = {
  '#': { fill: [120, 100, 78], side: [96, 80, 62], line: [60, 48, 36] },
  D:   { fill: [112, 72, 36],  side: [90, 58, 28], line: [50, 30, 14] },
  L:   { fill: [96, 64, 40],   side: [78, 52, 32], line: [40, 26, 14] },
  G:   { fill: [34, 32, 36],   side: [30, 28, 32], line: [20, 20, 24] },
};

function proj(x, y, z) { return [CX + (x * FOCAL) / z, CY + (y * FOCAL) / z]; }

function shade(base, z) {
  const f = Math.max(0.12, 1 - z / (DEPTH + 1.2));
  return `rgb(${(base[0] * f) | 0},${(base[1] * f) | 0},${(base[2] * f) | 0})`;
}

function poly(ctx, pts, fill, line) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke(); }
}

// Wall face toward the viewer, centred at lateral offset lx, at distance z.
function frontWall(ctx, lx, z, ch, sw) {
  const pal = PALETTE[ch] || PALETTE['#'];
  const a = proj(lx - 0.5, -HALF_H, z), b = proj(lx + 0.5, HALF_H, z);
  const x0 = Math.round(a[0]), y0 = Math.round(a[1]);
  const w = Math.round(b[0] - a[0]) + 1, h = Math.round(b[1] - a[1]) + 1;
  ctx.fillStyle = shade(pal.fill, z);
  ctx.fillRect(x0, y0, w, h);
  ctx.strokeStyle = shade(pal.line, z); ctx.lineWidth = 1;
  const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

  if (ch === 'G') {                                  // iron bars
    ctx.fillStyle = shade([130, 130, 140], z);
    for (let i = 1; i < 8; i++) ctx.fillRect(x0 + Math.round((w * i) / 8) - 1, y0, Math.max(2, w / 40), h);
    ctx.fillRect(x0, y0 + h * 0.2, w, Math.max(2, h / 40));
    ctx.fillRect(x0, y0 + h * 0.75, w, Math.max(2, h / 40));
  } else if (ch === 'D' || ch === 'L') {             // planks, frame and handle
    for (let i = 1; i < 5; i++) { const x = x0 + (w * i) / 5 + 0.5; line(x, y0, x, y0 + h); }
    ctx.strokeRect(x0 + 2.5, y0 + 2.5, w - 5, h - 5);
    const hx = x0 + w * 0.8, hy = y0 + h * 0.55, r = Math.max(2, w / 24);
    ctx.fillStyle = ch === 'L' ? shade([200, 170, 60], z) : shade([170, 150, 120], z);
    ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill();
    if (ch === 'L') ctx.fillRect(hx - r, hy + r, r * 2, r * 2.4);  // lock plate
  } else {                                           // brick
    const rows = 4;
    for (let r = 1; r < rows; r++) {
      const y = Math.round(y0 + (h * r) / rows) + 0.5;
      line(x0, y, x0 + w, y);
      const off = r % 2 ? 0.25 : 0.75;
      for (const c of [off, off - 0.5 < 0 ? off + 0.5 : off - 0.5]) {
        const x = Math.round(x0 + w * c) + 0.5; line(x, y, x, y + h / rows);
      }
    }
  }
  if (sw) {                                          // wall switch: plate + lever
    const px = x0 + w * 0.5, py = y0 + h * 0.5, s = w * 0.08;
    ctx.fillStyle = shade([60, 55, 50], z); ctx.fillRect(px - s, py - s * 1.6, s * 2, s * 3.2);
    ctx.fillStyle = shade(sw.on ? [90, 200, 90] : [220, 190, 70], z);
    ctx.fillRect(px - s * 0.4, sw.on ? py + s * 0.2 : py - s * 1.3, s * 0.8, s * 1.1);
  }
}

// Side wall at lateral x (negative = left), spanning distance z0..z1.
function sideWall(ctx, x, z0, z1, ch) {
  const pal = PALETTE[ch] || PALETTE['#'];
  const zm = (z0 + z1) / 2;
  poly(ctx, [proj(x, -HALF_H, z0), proj(x, -HALF_H, z1), proj(x, HALF_H, z1), proj(x, HALF_H, z0)],
    shade(pal.side, zm), shade(pal.line, zm));
}

// Flat marker on the floor of the cell between z0 and z1, scaled by s (0..1 of the cell).
function floorMark(ctx, z0, z1, s, fill, line) {
  const zc = (z0 + z1) / 2, dz = ((z1 - z0) * s) / 2, hx = 0.5 * s;
  poly(ctx, [proj(-hx, HALF_H, zc - dz), proj(hx, HALF_H, zc - dz), proj(hx, HALF_H, zc + dz), proj(-hx, HALF_H, zc + dz)],
    fill, line);
}

function floorDecal(ctx, ch, z0, z1, t) {
  const zm = (z0 + z1) / 2;
  if (ch === 'P') floorMark(ctx, z0, z1, 0.7, shade([55, 48, 40], zm), shade([140, 125, 100], zm));
  else if (ch === 'T') {
    const pulse = 0.5 + 0.2 * Math.sin(t / 250);
    floorMark(ctx, z0, z1, 0.8, shade([40, 70, 150], zm), shade([120, 170, 255], zm));
    floorMark(ctx, z0, z1, pulse, shade([90, 140, 230], zm), null);
  } else if (ch === 'O') {
    floorMark(ctx, z0, z1, 0.8, shade([90, 40, 110], zm), shade([180, 110, 200], zm));
    floorMark(ctx, z0, z1, 0.4, shade([50, 20, 70], zm), null);
  }
}

export function render(ctx, map, p, t = 0) {
  const g1 = ctx.createLinearGradient(0, 0, 0, CY);
  g1.addColorStop(0, '#0a0806'); g1.addColorStop(1, '#2b231a');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, CY);
  const g2 = ctx.createLinearGradient(0, CY, 0, H);
  g2.addColorStop(0, '#1a1510'); g2.addColorStop(1, '#4a3b2a');
  ctx.fillStyle = g2; ctx.fillRect(0, CY, W, H - CY);

  const fx = DX[p.dir], fy = DY[p.dir];
  const rx = -fy, ry = fx;
  const cell = (f, r) => [p.x + fx * f + rx * r, p.y + fy * f + ry * r];
  const tile = (f, r) => tileAt(map, ...cell(f, r));
  const solid = (f, r) => SOLID.has(tile(f, r));
  const switchOn = (f, r) => {
    const [cx, cy] = cell(f, r), face = (p.dir + 2) % 4;
    const s = map.switches.find(s => s.x === cx && s.y === cy && s.face === face && s.found);
    return s || null;
  };

  for (let k = DEPTH - 1; k >= 0; k--) {
    const z0 = edge(k), z1 = edge(k + 1);
    for (const side of [-1, 1]) {
      if (!solid(k, side) && solid(k + 1, side) && !solid(k, 0)) frontWall(ctx, side, z1, tile(k + 1, side), null);
    }
    if (solid(k, 0)) continue;
    const [cx, cy] = cell(k, 0);
    floorDecal(ctx, tile(k, 0), z0, z1, t);
    if (map.items.some(i => i.x === cx && i.y === cy)) {
      floorMark(ctx, z0, z1, 0.25, shade([230, 200, 70], (z0 + z1) / 2), shade([120, 100, 30], (z0 + z1) / 2));
    }
    if (solid(k, -1)) sideWall(ctx, -0.5, z0, z1, tile(k, -1));
    if (solid(k, 1)) sideWall(ctx, 0.5, z0, z1, tile(k, 1));
    if (solid(k + 1, 0)) frontWall(ctx, 0, z1, tile(k + 1, 0), switchOn(k + 1, 0));
  }
}
