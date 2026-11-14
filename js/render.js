// Layered perspective renderer: draws visible cells back to front (painter's order).
import { DX, DY, isWall } from './map.js';

const W = 448, H = 300;
const CX = W / 2, CY = H / 2 + 6;
const FOCAL = 230;
const HALF_H = 0.55;     // wall half-height in world units
const DEPTH = 4;         // cells ahead drawn
const edge = k => k + 0.45;   // distance of the near edge of cell k

function proj(x, y, z) { return [CX + (x * FOCAL) / z, CY + (y * FOCAL) / z]; }

function shade(base, z) {
  const f = Math.max(0.12, 1 - z / (DEPTH + 1.2));
  return `rgb(${(base[0] * f) | 0},${(base[1] * f) | 0},${(base[2] * f) | 0})`;
}

function quad(ctx, pts, fill, line) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (line) { ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke(); }
}

// Wall facing the viewer, centered at lateral offset lx (cell centre), at distance z.
function frontWall(ctx, lx, z) {
  const a = proj(lx - 0.5, -HALF_H, z), b = proj(lx + 0.5, HALF_H, z);
  const fill = shade([120, 100, 78], z);
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(a[0]), Math.round(a[1]), Math.round(b[0] - a[0]) + 1, Math.round(b[1] - a[1]) + 1);
  ctx.strokeStyle = shade([60, 48, 36], z); ctx.lineWidth = 1;
  const rows = 4, hgt = b[1] - a[1], wid = b[0] - a[0];
  for (let r = 1; r < rows; r++) {
    const y = Math.round(a[1] + (hgt * r) / rows) + 0.5;
    ctx.beginPath(); ctx.moveTo(a[0], y); ctx.lineTo(b[0], y); ctx.stroke();
    const off = r % 2 ? 0.25 : 0.75;
    for (let c = 0; c < 2; c++) {
      const x = Math.round(a[0] + wid * (off + c * 0.5 - (off > 0.5 ? 0.5 : 0))) + 0.5;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + hgt / rows); ctx.stroke();
    }
  }
}

// Side wall at lateral x (negative = left), spanning distance z0..z1.
function sideWall(ctx, x, z0, z1) {
  const p = [proj(x, -HALF_H, z0), proj(x, -HALF_H, z1), proj(x, HALF_H, z1), proj(x, HALF_H, z0)];
  quad(ctx, p, shade([96, 80, 62], (z0 + z1) / 2), shade([50, 40, 30], (z0 + z1) / 2));
}

export function render(ctx, map, p) {
  // ceiling and floor
  const g1 = ctx.createLinearGradient(0, 0, 0, CY);
  g1.addColorStop(0, '#0a0806'); g1.addColorStop(1, '#2b231a');
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, CY);
  const g2 = ctx.createLinearGradient(0, CY, 0, H);
  g2.addColorStop(0, '#1a1510'); g2.addColorStop(1, '#4a3b2a');
  ctx.fillStyle = g2; ctx.fillRect(0, CY, W, H - CY);

  const fx = DX[p.dir], fy = DY[p.dir];
  const rx = -fy, ry = fx;           // right vector
  const wallAt = (f, r) => isWall(map, p.x + fx * f + rx * r, p.y + fy * f + ry * r);

  for (let k = DEPTH - 1; k >= 0; k--) {
    const z0 = edge(k), z1 = edge(k + 1);
    // side cells of the corridor: their front faces are visible when the side is open
    for (const side of [-1, 1]) {
      if (!wallAt(k, side) && wallAt(k + 1, side) && !wallAt(k, 0)) {
        frontWall(ctx, side, z1);
      }
    }
    if (wallAt(k, 0)) continue;       // cell k itself is solid; stop drawing beyond handled by order
    if (wallAt(k, -1)) sideWall(ctx, -0.5, z0, z1);
    if (wallAt(k, 1)) sideWall(ctx, 0.5, z0, z1);
    if (wallAt(k + 1, 0)) frontWall(ctx, 0, z1);
  }
}
