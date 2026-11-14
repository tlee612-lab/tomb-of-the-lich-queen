// Layered perspective renderer: draws visible cells back to front (painter's order).
import { DX, DY, tileAt, SOLID } from './map.js';
import { MONSTERS } from './data/monsters.js';

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

let reach = DEPTH + 1.2;     // how far the light carries; the Lantern Ward extends it
function shade(base, z) {
  const f = Math.max(0.12, 1 - z / reach);
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
  } else if (ch === 'H') {
    const glow = 0.5 + 0.15 * Math.sin(t / 400);
    floorMark(ctx, z0, z1, 0.8, shade([70, 55, 20], zm), shade([240, 200, 90], zm));
    floorMark(ctx, z0, z1, glow * 0.7, shade([230, 190, 80], zm), null);
  } else if (ch === 'O') {
    floorMark(ctx, z0, z1, 0.8, shade([90, 40, 110], zm), shade([180, 110, 200], zm));
    floorMark(ctx, z0, z1, 0.4, shade([50, 20, 70], zm), null);
  }
}

// ---- monsters ----------------------------------------------------------------------
const spriteCache = {};
function spriteImage(src) {
  if (!src) return null;
  if (!(src in spriteCache)) {
    const img = new Image(); img.src = src; spriteCache[src] = img;
    img.onerror = () => { spriteCache[src] = null; };
  }
  const img = spriteCache[src];
  return img && img.complete && img.naturalWidth ? img : null;
}

const mix = (c, f) => c.map(v => Math.min(255, v + (255 - v) * f));
const circle = (ctx, x, y, r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, 7); ctx.fill(); };
const ellipse = (ctx, x, y, rx, ry, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, 7); ctx.fill(); };

// Placeholder monster art, drawn with shapes. Set `sprite` in js/data/monsters.js to use an image instead.
function drawMonster(ctx, e, zc, t, spriteSrc) {
  const [cx, fy] = proj(0, HALF_H, zc), u = FOCAL / zc;       // u = pixels per world unit at this depth
  const f = e.flash > 0 ? 0.65 : 0;
  const c = base => shade(mix(base, f), zc);
  const img = spriteImage(spriteSrc);
  if (img) {
    const h = (e.kind === 'rat' ? 0.45 : 1.0) * u, w = (img.naturalWidth / img.naturalHeight) * h;
    ctx.drawImage(img, cx - w / 2, fy - h, w, h); return h;
  }
  const bob = Math.sin(t / 220 + e.x * 3 + e.y) * 0.015 * u;
  if (e.kind === 'rat') {
    ellipse(ctx, cx, fy - 0.17 * u + bob, 0.27 * u, 0.15 * u, c([96, 70, 48]));
    ctx.strokeStyle = c([150, 110, 100]); ctx.lineWidth = Math.max(1, 0.03 * u);        // tail
    ctx.beginPath(); ctx.moveTo(cx + 0.24 * u, fy - 0.1 * u); ctx.quadraticCurveTo(cx + 0.5 * u, fy - 0.02 * u, cx + 0.42 * u, fy - 0.2 * u); ctx.stroke();
    circle(ctx, cx - 0.2 * u, fy - 0.3 * u + bob, 0.06 * u, c([120, 90, 70]));          // ears
    circle(ctx, cx + 0.2 * u, fy - 0.3 * u + bob, 0.06 * u, c([120, 90, 70]));
    ellipse(ctx, cx, fy - 0.25 * u + bob, 0.13 * u, 0.11 * u, c([116, 86, 62]));        // head
    circle(ctx, cx - 0.05 * u, fy - 0.27 * u + bob, 0.025 * u, '#d33');
    circle(ctx, cx + 0.05 * u, fy - 0.27 * u + bob, 0.025 * u, '#d33');
    return 0.4 * u;
  }
  // wretch: a slumped skeletal figure
  const bone = c([200, 190, 165]), dark = shade([20, 16, 12], zc);
  ctx.fillStyle = bone;
  ctx.fillRect(cx - 0.16 * u, fy - 0.45 * u, 0.08 * u, 0.45 * u);                      // legs
  ctx.fillRect(cx + 0.08 * u, fy - 0.45 * u, 0.08 * u, 0.45 * u);
  ellipse(ctx, cx, fy - 0.68 * u + bob, 0.24 * u, 0.26 * u, c([176, 166, 142]));       // ribcage
  ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, 0.025 * u);
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(cx - 0.18 * u, fy - 0.68 * u + i * 0.08 * u + bob); ctx.lineTo(cx + 0.18 * u, fy - 0.68 * u + i * 0.08 * u + bob); ctx.stroke(); }
  ctx.fillStyle = bone;
  ctx.fillRect(cx - 0.34 * u, fy - 0.85 * u + bob, 0.07 * u, 0.55 * u);                // arms
  ctx.fillRect(cx + 0.27 * u, fy - 0.85 * u + bob, 0.07 * u, 0.55 * u);
  circle(ctx, cx, fy - 1.0 * u + bob, 0.15 * u, c([214, 204, 180]));                   // skull
  circle(ctx, cx - 0.055 * u, fy - 1.02 * u + bob, 0.035 * u, dark);
  circle(ctx, cx + 0.055 * u, fy - 1.02 * u + bob, 0.035 * u, dark);
  ctx.fillStyle = shade([120, 255, 160], zc); ctx.fillRect(cx - 0.065 * u, fy - 1.02 * u + bob, 0.02 * u, 0.02 * u); ctx.fillRect(cx + 0.045 * u, fy - 1.02 * u + bob, 0.02 * u, 0.02 * u);
  return 1.15 * u;
}

function drawEnemies(ctx, p, cx, cy, z0, z1, t) {
  const zc = (z0 + z1) / 2, u = FOCAL / zc;
  let top = 0;
  for (const e of p.enemies) {
    if (e.hp <= 0 || e.x !== cx || e.y !== cy) continue;
    top = Math.max(top, drawMonster(ctx, { ...e, kind: MONSTERS[e.type].kind }, zc, t, MONSTERS[e.type].sprite));
  }
  for (const f of p.fx) {
    if (f.cell.x !== cx || f.cell.y !== cy) continue;
    const [sx, sy] = proj(0, HALF_H, zc), rise = (f.age / f.ttl) * 0.35 * u;
    ctx.font = `bold ${Math.max(10, 0.2 * u) | 0}px monospace`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, sx, sy - (top || 0.8 * u) - rise);
    ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy - (top || 0.8 * u) - rise);
  }
}

export function render(ctx, map, p, t = 0) {
  reach = p.lightMs > 0 ? DEPTH + 4 : DEPTH + 1.2;
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
    const item = map.items.find(i => i.x === cx && i.y === cy);
    if (item) {
      const col = { key: [230, 200, 70], ration: [170, 120, 70], potion: item.id === 'return' ? [200, 90, 220] : [220, 70, 70] }[item.kind] || [230, 200, 70];
      floorMark(ctx, z0, z1, 0.25, shade(col, (z0 + z1) / 2), shade([255, 255, 255].map((v, i) => col[i] * 0.5), (z0 + z1) / 2));
    }
    if (solid(k, -1)) sideWall(ctx, -0.5, z0, z1, tile(k, -1));
    if (solid(k, 1)) sideWall(ctx, 0.5, z0, z1, tile(k, 1));
    if (solid(k + 1, 0)) frontWall(ctx, 0, z1, tile(k + 1, 0), switchOn(k + 1, 0));
    if (k >= 1 && p.enemies) drawEnemies(ctx, p, cx, cy, z0, z1, t);
  }
}
