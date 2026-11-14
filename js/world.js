// Game rules for the map: movement, doors, keys, plates, switches, teleporters, spinners.
// No DOM here, so it can be tested from Node.
import { DX, DY, tileAt, isSolid } from './map.js';

export function newGame(map, rng = Math.random) {
  return { map, x: map.start.x, y: map.start.y, dir: map.start.dir, bag: [], msgs: [], rng };
}

const say = (g, m) => g.msgs.push(m);
const ahead = g => [g.x + DX[g.dir], g.y + DY[g.dir]];
const setTile = (map, x, y, ch) => { map.grid[y][x] = ch; };

function open(g, targets) {
  for (const [x, y] of targets) {
    if (tileAt(g.map, x, y) === 'G') setTile(g.map, x, y, 'g');
  }
}

// Reveal hidden switches directly in front of the party (the Cutpurse's passive search).
export function look(g) {
  const [ax, ay] = ahead(g);
  for (const s of g.map.switches) {
    if (!s.found && s.x === ax && s.y === ay && s.face === (g.dir + 2) % 4) {
      s.found = true; say(g, 'You notice a hidden switch in the wall!');
    }
  }
}

function enter(g) {
  const m = g.map;
  const it = m.items.findIndex(i => i.x === g.x && i.y === g.y);
  if (it >= 0) {
    const [item] = m.items.splice(it, 1);
    g.bag.push(item.id); say(g, `You pick up the ${item.name}.`);
  }
  const t = tileAt(m, g.x, g.y);
  if (t === 'P') {
    const p = m.plates.find(p => p.x === g.x && p.y === g.y);
    if (p && !p.pressed) { p.pressed = true; open(g, p.targets); say(g, 'Click. Somewhere, a gate grinds open.'); }
  } else if (t === 'T') {
    const tp = m.teleports.find(p => p.x === g.x && p.y === g.y);
    if (tp) { g.x = tp.to.x; g.y = tp.to.y; if (tp.to.dir != null) g.dir = tp.to.dir; say(g, 'The world lurches. You are elsewhere.'); }
  } else if (t === 'O') {
    g.dir = Math.floor(g.rng() * 4) % 4; say(g, 'You spin and lose your bearings!');
  }
  look(g);
}

export function interact(g) {
  const [ax, ay] = ahead(g);
  const t = tileAt(g.map, ax, ay);
  if (t === 'D') { setTile(g.map, ax, ay, 'd'); say(g, 'The door creaks open.'); return true; }
  if (t === 'L') {
    const need = g.map.locks[`${ax},${ay}`];
    if (g.bag.includes(need)) { setTile(g.map, ax, ay, 'd'); say(g, `The ${need} key turns. The door opens.`); }
    else say(g, `Locked. It needs a ${need} key.`);
    return true;
  }
  if (t === 'G') { say(g, 'The gate will not budge.'); return true; }
  if (t === '#') {
    const s = g.map.switches.find(s => s.x === ax && s.y === ay && s.face === (g.dir + 2) % 4 && s.found);
    if (s) {
      if (!s.on) { s.on = true; open(g, s.targets); say(g, 'You pull the switch. Stone grinds somewhere.'); }
      else say(g, 'The switch will not move again.');
      return true;
    }
  }
  return false;
}

export function turn(g, d) { g.dir = (g.dir + d + 4) % 4; look(g); }

// f = steps forward (negative = back), r = steps right (negative = left)
export function step(g, f, r) {
  const rx = -DY[g.dir], ry = DX[g.dir];
  const nx = g.x + DX[g.dir] * f + rx * r, ny = g.y + DY[g.dir] * f + ry * r;
  if (isSolid(g.map, nx, ny)) {
    if (f === 1 && r === 0 && tileAt(g.map, nx, ny) === 'D') { interact(g); return; }
    say(g, 'Blocked.'); return;
  }
  g.x = nx; g.y = ny; enter(g);
}
