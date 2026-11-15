// Layered perspective renderer: draws visible cells back to front (painter's order).
import { DX, DY, tileAt, SOLID } from './map.js';
import { MONSTERS } from './data/monsters.js';

const W = 448, H = 300;
const CX = W / 2, CY = H / 2 + 6;
const FOCAL = 230;
const HALF_H = 0.55;     // wall half-height in world units
const DEPTH = 4;         // cells ahead drawn
const NEAR = 0.45;           // the near edge of the cell you stand in; nothing nearer is drawn
let camZ = 0;                // camera offset in cells while a step animates (see js/anim.js)
const edge = k => k + NEAR + camZ;   // distance of the near edge of cell k

const PALETTE = {
  '#': { fill: [120, 100, 78], side: [96, 80, 62], line: [60, 48, 36] },
  D:   { fill: [112, 72, 36],  side: [90, 58, 28], line: [50, 30, 14] },
  L:   { fill: [96, 64, 40],   side: [78, 52, 32], line: [40, 26, 14] },
  G:   { fill: [34, 32, 36],   side: [30, 28, 32], line: [20, 20, 24] },
  M:   { fill: [64, 74, 96],   side: [52, 60, 80], line: [30, 36, 54] },
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

// ---- painted wall pictures ---------------------------------------------------------------------------------
// A floor may name a wall picture (`wall` in js/data/floors.js). It is used as painted, with only distance shading over it.
// The picture is a strip of brick; each wall face takes one of three windows of it, chosen by its cell, so walls do not all repeat.
let wallTex = null;
const WIN_X = [0, 340, 680], WIN_W = 340;
const winFor = (cx, cy, face) => WIN_X[Math.abs(cx * 7 + cy * 13 + face * 5) % 3];
const shadeAlpha = z => 1 - Math.max(0.12, 1 - z / reach);

// Wall face toward the viewer, centred at lateral offset lx, at distance z.
function frontWall(ctx, lx, z, ch, sw, cell) {
  const pal = PALETTE[ch] || PALETTE['#'];
  const a = proj(lx - 0.5, -HALF_H, z), b = proj(lx + 0.5, HALF_H, z);
  const x0 = Math.round(a[0]), y0 = Math.round(a[1]);
  const w = Math.round(b[0] - a[0]) + 1, h = Math.round(b[1] - a[1]) + 1;
  if (ch === '#' && wallTex && cell) {                                      // a painted brick wall
    ctx.drawImage(wallTex, winFor(cell[0], cell[1], 0), 0, WIN_W, wallTex.naturalHeight, x0, y0, w, h);
    ctx.fillStyle = '#000'; ctx.globalAlpha = shadeAlpha(z); ctx.fillRect(x0, y0, w, h); ctx.globalAlpha = 1;
    if (sw) drawWallFeature(ctx, sw, x0, y0, w, h, z);
    return;
  }
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
  } else if (ch === 'W') {                           // one-way door: iron-banded planks, no handle
    for (let i = 1; i < 5; i++) { const x = x0 + (w * i) / 5 + 0.5; line(x, y0, x, y0 + h); }
    ctx.strokeRect(x0 + 2.5, y0 + 2.5, w - 5, h - 5);
    ctx.fillStyle = shade([90, 96, 110], z);
    ctx.fillRect(x0, y0 + h * 0.2, w, Math.max(3, h / 14)); ctx.fillRect(x0, y0 + h * 0.7, w, Math.max(3, h / 14));
  } else if (ch === 'M') {                           // slab with two gem sockets
    ctx.strokeRect(x0 + 3.5, y0 + 3.5, w - 7, h - 7);
    for (const fx of [0.34, 0.66]) {
      const sx = x0 + w * fx, sy = y0 + h * 0.42, r = Math.max(2, w * 0.07);
      ctx.fillStyle = shade([14, 14, 24], z); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = shade([150, 170, 220], z); ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.stroke();
    }
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
  drawWallFeature(ctx, sw, x0, y0, w, h, z);
}

// What is mounted on a front wall: an inscription plaque, a phylactery lamp or a wall switch.
function drawWallFeature(ctx, sw, x0, y0, w, h, z) {
  if (sw && sw.plaque) {                             // inscription: a small parchment plaque
    const px = x0 + w * 0.5, py = y0 + h * 0.45, pw = w * 0.2, ph = h * 0.28;
    ctx.fillStyle = shade([205, 185, 140], z); ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
    ctx.fillStyle = shade([95, 72, 40], z);
    for (let i = 0; i < 4; i++) ctx.fillRect(px - pw * 0.38, py - ph * 0.34 + i * ph * 0.22, pw * (i === 3 ? 0.4 : 0.76), Math.max(1, ph * 0.05));
  } else if (sw && 'lit' in sw) {                    // phylactery lamp: bracket and flame
    const px = x0 + w * 0.5, py = y0 + h * 0.45, s = w * 0.07;
    ctx.fillStyle = shade([50, 45, 55], z); ctx.fillRect(px - s * 1.2, py + s * 0.6, s * 2.4, s * 1.2);
    ctx.fillStyle = shade(sw.lit ? [90, 40, 20] : [40, 40, 44], z); ctx.fillRect(px - s * 0.9, py - s * 0.6, s * 1.8, s * 1.4);
    if (sw.lit) {
      ctx.fillStyle = shade([255, 150, 40], z); ctx.beginPath(); ctx.ellipse(px, py - s * 1.3, s * 0.9, s * 1.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = shade([255, 230, 120], z); ctx.beginPath(); ctx.ellipse(px, py - s * 1.0, s * 0.45, s * 0.9, 0, 0, 7); ctx.fill();
    }
  } else if (sw) {                                   // wall switch: plate + lever
    const px = x0 + w * 0.5, py = y0 + h * 0.5, s = w * 0.08;
    ctx.fillStyle = shade([60, 55, 50], z); ctx.fillRect(px - s, py - s * 1.6, s * 2, s * 3.2);
    ctx.fillStyle = shade(sw.on ? [90, 200, 90] : [220, 190, 70], z);
    ctx.fillRect(px - s * 0.4, sw.on ? py + s * 0.2 : py - s * 1.3, s * 0.8, s * 1.1);
  }
}

// Side wall at lateral x (negative = left), spanning distance z0..z1.
function sideWall(ctx, x, z0, z1, ch, cell) {
  const pal = PALETTE[ch] || PALETTE['#'];
  const zm = (z0 + z1) / 2;
  if (ch === '#' && wallTex && cell) {                                      // painted brick, mapped with perspective column by column
    const xa = Math.round(CX + (x * FOCAL) / z0), xb = Math.round(CX + (x * FOCAL) / z1);
    const lo = Math.min(xa, xb), hi = Math.max(xa, xb), sx = winFor(cell[0], cell[1], 1), th = wallTex.naturalHeight;
    const i0 = 1 / z0, i1 = 1 / z1;
    ctx.fillStyle = '#000';
    for (let px = lo; px <= hi; px++) {
      const z = (x * FOCAL) / (px + 0.5 - CX);                            // depth at this screen column
      if (!(z >= Math.min(z0, z1) - 1e-6 && z <= Math.max(z0, z1) + 1e-6)) continue;
      const u = (1 / z - i0) / (i1 - i0);                                 // perspective-correct position along the wall, 0 near .. 1 far
      const top = CY - (HALF_H * FOCAL) / z, hgt = (2 * HALF_H * FOCAL) / z;
      ctx.drawImage(wallTex, sx + Math.min(WIN_W - 1, Math.max(0, u * WIN_W)), 0, 1, th, px, top, 1, hgt);
      ctx.globalAlpha = shadeAlpha(z); ctx.fillRect(px, top, 1, hgt); ctx.globalAlpha = 1;
    }
    return;
  }
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
  } else if (ch === '>' || ch === '<') {
    const down = ch === '>', base = down ? [30, 26, 24] : [150, 140, 120];
    floorMark(ctx, z0, z1, 0.9, shade(base, zm), shade([200, 190, 160], zm));
    for (let i = 1; i < 4; i++) floorMark(ctx, z0, z1, 0.9 - i * 0.2, shade(down ? base.map(v => v + i * 8) : base.map(v => v - i * 14), zm), null);
  } else if (ch === 'X') {
    floorMark(ctx, z0, z1, 0.85, shade([8, 6, 5], zm), shade([90, 70, 50], zm));
    floorMark(ctx, z0, z1, 0.5, shade([0, 0, 0], zm), null);
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
  if (e.kind === 'ooze') {
    const sq = 1 + 0.07 * Math.sin(t / 260 + e.x * 2);
    ellipse(ctx, cx, fy - 0.2 * u, 0.32 * u * sq, 0.2 * u / sq, c([60, 140, 78]));
    ellipse(ctx, cx - 0.09 * u, fy - 0.28 * u, 0.1 * u, 0.055 * u, c([150, 225, 160]));
    circle(ctx, cx - 0.1 * u, fy - 0.2 * u, 0.035 * u, '#102'); circle(ctx, cx + 0.1 * u, fy - 0.2 * u, 0.035 * u, '#102');
    return 0.42 * u;
  }
  if (e.kind === 'spider') {
    ctx.strokeStyle = c([60, 40, 70]); ctx.lineWidth = Math.max(1, 0.035 * u);
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) {
      const lx = cx + sd * 0.14 * u, ly = fy - 0.2 * u + (i - 1.5) * 0.02 * u;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(cx + sd * (0.32 + i * 0.05) * u, ly - 0.14 * u); ctx.lineTo(cx + sd * (0.4 + i * 0.06) * u, fy); ctx.stroke();
    }
    ellipse(ctx, cx, fy - 0.2 * u + bob, 0.2 * u, 0.15 * u, c([70, 46, 86]));
    circle(ctx, cx, fy - 0.3 * u + bob, 0.1 * u, c([90, 60, 104]));
    for (const dx of [-0.045, -0.015, 0.015, 0.045]) circle(ctx, cx + dx * u, fy - 0.32 * u + bob, 0.014 * u, '#f33');
    return 0.45 * u;
  }
  if (e.kind === 'guard') {
    const steel = c([120, 126, 140]), dark2 = c([60, 64, 76]);
    ctx.fillStyle = dark2; ctx.fillRect(cx - 0.17 * u, fy - 0.45 * u, 0.12 * u, 0.45 * u); ctx.fillRect(cx + 0.05 * u, fy - 0.45 * u, 0.12 * u, 0.45 * u);
    ctx.fillStyle = steel; ctx.fillRect(cx - 0.26 * u, fy - 0.95 * u + bob, 0.52 * u, 0.55 * u);                 // breastplate
    ctx.fillStyle = dark2; ctx.fillRect(cx - 0.05 * u, fy - 0.95 * u + bob, 0.1 * u, 0.55 * u);
    ctx.fillStyle = steel; ctx.fillRect(cx - 0.12 * u, fy - 1.18 * u + bob, 0.24 * u, 0.24 * u);                  // helm
    ctx.fillStyle = shade([20, 255, 140], zc); ctx.fillRect(cx - 0.08 * u, fy - 1.08 * u + bob, 0.16 * u, 0.03 * u);   // glowing visor slit
    ctx.fillStyle = c([90, 70, 50]); ctx.fillRect(cx - 0.42 * u, fy - 0.95 * u + bob, 0.15 * u, 0.4 * u);          // shield
    ctx.fillStyle = steel; ctx.fillRect(cx + 0.28 * u, fy - 1.1 * u + bob, 0.05 * u, 0.7 * u);                      // blade
    return 1.2 * u;
  }
  if (e.kind === 'wraith' || e.kind === 'queen') {
    const queen = e.kind === 'queen', sway = Math.sin(t / 300 + e.x) * 0.03 * u, hgt = queen ? 1.35 : 1.15;
    ctx.save();
    if (!queen) ctx.globalAlpha = 0.78;
    if (queen) { const g = ctx.createRadialGradient(cx, fy - hgt * 0.55 * u, 0.1 * u, cx, fy - hgt * 0.55 * u, 0.9 * u);
      g.addColorStop(0, 'rgba(160,90,255,0.35)'); g.addColorStop(1, 'rgba(160,90,255,0)'); ctx.fillStyle = g; ctx.fillRect(cx - u, fy - 1.6 * u, 2 * u, 1.7 * u); }
    const robe = queen ? c([70, 30, 100]) : c([110, 50, 40]);
    poly(ctx, [[cx - 0.1 * u + sway, fy - (hgt - 0.1) * u], [cx + 0.1 * u + sway, fy - (hgt - 0.1) * u], [cx + 0.34 * u, fy], [cx - 0.34 * u, fy]], robe, null);
    circle(ctx, cx + sway, fy - (hgt - 0.05) * u, 0.13 * u, queen ? c([200, 190, 215]) : c([30, 14, 12]));
    const eye = queen ? [190, 255, 255] : [255, 160, 60];
    circle(ctx, cx - 0.05 * u + sway, fy - (hgt - 0.05) * u, 0.025 * u, shade(eye, zc)); circle(ctx, cx + 0.05 * u + sway, fy - (hgt - 0.05) * u, 0.025 * u, shade(eye, zc));
    if (queen) {                                                                                                  // crown
      ctx.fillStyle = shade([240, 200, 70], zc);
      for (let i = -2; i <= 2; i++) ctx.fillRect(cx + i * 0.05 * u - 0.012 * u + sway, fy - (hgt + 0.2) * u + (i % 2 ? 0 : 0.03 * u), 0.025 * u, 0.1 * u);
      ctx.fillRect(cx - 0.13 * u + sway, fy - (hgt + 0.1) * u, 0.26 * u, 0.04 * u);
    }
    ctx.restore();
    return (hgt + (queen ? 0.3 : 0.15)) * u;
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

// A shackled prisoner: tattered robe with the hero's painted portrait for a face.
function drawNpc(ctx, map, cx, cy, z0, z1) {
  const n = map.npcs?.find(n => !n.freed && n.x === cx && n.y === cy);
  if (!n) return;
  const zc = (z0 + z1) / 2, [sx, fy] = proj(0, HALF_H, zc), u = FOCAL / zc;
  ctx.fillStyle = shade([84, 74, 64], zc);
  ctx.beginPath(); ctx.moveTo(sx - 0.3 * u, fy); ctx.lineTo(sx - 0.17 * u, fy - 0.75 * u); ctx.lineTo(sx + 0.17 * u, fy - 0.75 * u); ctx.lineTo(sx + 0.3 * u, fy); ctx.fill();
  ctx.fillStyle = shade([40, 40, 46], zc);                                  // manacles
  ctx.fillRect(sx - 0.2 * u, fy - 0.45 * u, 0.1 * u, 0.05 * u); ctx.fillRect(sx + 0.1 * u, fy - 0.45 * u, 0.1 * u, 0.05 * u);
  const img = spriteImage(n.portrait);
  if (img) ctx.drawImage(img, sx - 0.28 * u, fy - 1.32 * u, 0.56 * u, 0.56 * u);
  else circle(ctx, sx, fy - 1.0 * u, 0.2 * u, shade([180, 150, 120], zc));
}

function drawEnemies(ctx, p, cx, cy, z0, z1, t) {
  const zc = (z0 + z1) / 2, u = FOCAL / zc;
  let top = 0;
  for (const e of p.enemies) {
    if (e.hp <= 0 || e.x !== cx || e.y !== cy) continue;
    top = Math.max(top, drawMonster(ctx, { ...e, kind: MONSTERS[e.type].kind }, zc, t, MONSTERS[e.type].sprite));
    if (e.seen) {                                              // Dread Sight: a health bar over the monster
      const [bx, by] = proj(0, HALF_H, zc), bw = 0.5 * u, by2 = by - top - 0.1 * u;
      ctx.fillStyle = '#300'; ctx.fillRect(bx - bw / 2, by2, bw, Math.max(3, 0.05 * u));
      ctx.fillStyle = '#d33'; ctx.fillRect(bx - bw / 2, by2, bw * Math.max(0, e.hp) / e.hpMax, Math.max(3, 0.05 * u));
    }
  }
  for (const f of p.fx) {
    if (f.cell.x !== cx || f.cell.y !== cy) continue;
    const [sx, sy] = proj(0, HALF_H, zc), rise = (f.age / f.ttl) * 0.35 * u;
    ctx.font = `bold ${Math.max(10, 0.2 * u) | 0}px monospace`; ctx.textAlign = 'center';
    ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeText(f.text, sx, sy - (top || 0.8 * u) - rise);
    ctx.fillStyle = f.color; ctx.fillText(f.text, sx, sy - (top || 0.8 * u) - rise);
  }
}

export function render(ctx, map, p, t = 0, view = {}) {
  camZ = view.cz || 0;
  wallTex = map.wall ? spriteImage(map.wall) : null;          // painted walls, once the picture has loaded
  reach = p.lightMs > 0 ? DEPTH + 4 : (map.dark ? 2.6 : DEPTH + 1.2);   // dark floors need the Lantern Ward
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
    const lamp = map.lamps.find(l => l.x === cx && l.y === cy && l.face === face);
    if (lamp) return lamp;
    const ins = map.inscriptions.find(i => i.x === cx && i.y === cy && i.face === face);
    if (ins) return { plaque: true };
    const s = map.switches.find(s => s.x === cx && s.y === cy && s.face === face && s.found);
    return s || null;
  };

  for (let k = DEPTH - 1; k >= (camZ > 0 ? -1 : 0); k--) {       // while stepping forward, also draw the cell we are leaving
    const rz0 = edge(k), z1 = edge(k + 1);
    if (z1 <= NEAR) continue;                                    // wholly behind the camera
    const z0 = Math.max(rz0, NEAR);
    for (const side of [-1, 1]) {
      if (!solid(k, side) && solid(k + 1, side) && !solid(k, 0)) frontWall(ctx, side, z1, tile(k + 1, side), null, cell(k + 1, side));
    }
    if (solid(k, 0)) continue;
    const [cx, cy] = cell(k, 0);
    const ch = tile(k, 0);
    floorDecal(ctx, ch === 'X' && !map.traps[`${cx},${cy}`]?.found ? '.' : ch, z0, z1, t);
    const item = map.items.find(i => i.x === cx && i.y === cy);
    if (item) {
      const col = { key: [230, 200, 70], ration: [170, 120, 70], potion: item.id === 'return' ? [200, 90, 220] : item.id === 'antidote' ? [90, 210, 120] : [220, 70, 70],
        gem: item.id === 'redgem' ? [230, 40, 70] : [60, 120, 255], xp: [255, 240, 180] }[item.kind] || [230, 200, 70];
      floorMark(ctx, z0, z1, 0.25, shade(col, (z0 + z1) / 2), shade([255, 255, 255].map((v, i) => col[i] * 0.5), (z0 + z1) / 2));
    }
    if (solid(k, -1)) sideWall(ctx, -0.5, z0, z1, tile(k, -1), cell(k, -1));
    if (solid(k, 1)) sideWall(ctx, 0.5, z0, z1, tile(k, 1), cell(k, 1));
    if (solid(k + 1, 0)) frontWall(ctx, 0, z1, tile(k + 1, 0), switchOn(k + 1, 0), cell(k + 1, 0));
    if (k >= 1) drawNpc(ctx, map, cx, cy, rz0, z1);
    if (k >= 1 && p.enemies) drawEnemies(ctx, p, cx, cy, rz0, z1, t);
  }
  if (view.fade > 0 && view.snapshot) {                          // turns, sidesteps, teleports and stairs: dissolve from the last frame
    ctx.globalAlpha = view.fade; ctx.drawImage(view.snapshot, 0, 0); ctx.globalAlpha = 1;
  }
}
