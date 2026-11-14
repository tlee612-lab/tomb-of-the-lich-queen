// Game rules for the map: movement, doors, keys, plates, switches, teleporters, spinners,
// stairs, pits, gem sockets and lamps. No DOM here, so it can be tested from Node.
import { DX, DY, tileAt, isSolid } from './map.js';
import { buildEnemies, enemyAt, alive, dice, gainXp } from './combat.js';
import { useShrine } from './magic.js';

// A game is a list of floors (or a single map, which is wrapped into a one-floor game).
export function newGame(mapOrFloors, rng = Math.random) {
  const floors = Array.isArray(mapOrFloors) ? mapOrFloors : [mapOrFloors];
  for (const f of floors) f.enemies = buildEnemies(f);
  const map = floors[0];
  return { floors, floor: 0, map, x: map.start.x, y: map.start.y, dir: map.start.dir, bag: [], msgs: [], rng,
    party: [], enemies: map.enemies, fx: [], paused: false, defeated: false, won: false,
    rations: 4, hungerMs: 0, starving: false, starveMs: 0, lightMs: 0, sanctMs: 0 };
}

const say = (g, m) => g.msgs.push(m);
const ahead = g => [g.x + DX[g.dir], g.y + DY[g.dir]];
const setTile = (map, x, y, ch) => { map.grid[y][x] = ch; };
const GEMS = { redgem: 'ruby', bluegem: 'sapphire' };
const hasCutpurse = g => g.party.some(h => alive(h) && h.class === 'Cutpurse');

function open(g, targets) {
  for (const [x, y] of targets) {
    if (tileAt(g.map, x, y) === 'G') setTile(g.map, x, y, 'g');
  }
}

export function changeFloor(g, to) {
  g.map.enemies = g.enemies;                       // remember what is left alive on the floor we are leaving
  g.floor = to.floor; g.map = g.floors[to.floor]; g.enemies = g.map.enemies;
  g.x = to.x; g.y = to.y; g.dir = to.dir; g.fx = [];
  say(g, `You arrive at ${g.map.name}.`);
  look(g);
}

// Passive search: switches directly ahead are noticed, and a living Cutpurse spots pits in the next cell.
export function look(g) {
  const [ax, ay] = ahead(g);
  for (const s of g.map.switches) {
    if (!s.found && s.x === ax && s.y === ay && s.face === (g.dir + 2) % 4) {
      s.found = true; say(g, 'You notice a hidden switch in the wall!');
    }
  }
  const trap = g.map.traps[`${ax},${ay}`];
  if (trap && !trap.found && tileAt(g.map, ax, ay) === 'X' && hasCutpurse(g)) {
    trap.found = true; say(g, 'Your Cutpurse spots a pit trap ahead!');
  }
}

function pickUp(g, idx) {
  const item = g.map.items[idx];
  if (item.kind === 'ration') {
    g.rations += item.amount; say(g, `You find ${item.amount} rations. (${g.rations} total)`);
  } else if (item.kind === 'potion') {
    const h = g.party.find(h => h.hp > 0 && h.quickSlots.includes(null)) || g.party.find(h => h.quickSlots.includes(null));
    if (!h) { say(g, `You see a ${item.name}, but every quick slot is full.`); return; }
    h.quickSlots[h.quickSlots.indexOf(null)] = { id: item.id, name: item.name };
    say(g, `${h.name} takes the ${item.name}.`);
  } else if (item.kind === 'xp') {
    say(g, `You discover a ${item.name}! (+${item.amount} XP each)`);
    for (const h of g.party.filter(alive)) gainXp(g, h, item.amount);
  } else {
    g.bag.push(item.id); say(g, `You pick up the ${item.name}.`);
  }
  g.map.items.splice(idx, 1);
}

function enter(g) {
  const m = g.map;
  const it = m.items.findIndex(i => i.x === g.x && i.y === g.y);
  if (it >= 0) pickUp(g, it);
  const stairs = m.stairs.find(s => s.x === g.x && s.y === g.y);
  if (stairs) { changeFloor(g, stairs.to); return; }
  const t = tileAt(m, g.x, g.y);
  if (t === 'P') {
    const p = m.plates.find(p => p.x === g.x && p.y === g.y);
    if (p && !p.pressed) { p.pressed = true; open(g, p.targets); say(g, 'Click. Somewhere, a gate grinds open.'); }
  } else if (t === 'T') {
    const tp = m.teleports.find(p => p.x === g.x && p.y === g.y);
    if (tp) { g.x = tp.to.x; g.y = tp.to.y; if (tp.to.dir != null) g.dir = tp.to.dir; say(g, 'The world lurches. You are elsewhere.'); }
  } else if (t === 'H') {
    say(g, 'A shrine glows softly. Press F to pray here.');
  } else if (t === 'O') {
    g.dir = Math.floor(g.rng() * 4) % 4; say(g, 'You spin and lose your bearings!');
  } else if (t === 'X') {
    m.traps[`${g.x},${g.y}`].found = true;
    say(g, 'The floor gives way! The party tumbles into a pit.');
    for (const h of g.party.filter(alive)) { h.hp = Math.max(1, h.hp - dice(g, [1, 6, 0])); h.hurt = { text: '-', ttl: 800 }; }
  }
  look(g);
}

export function interact(g) {
  if (tileAt(g.map, g.x, g.y) === 'H' && useShrine(g)) return true;       // pray at the shrine you stand on
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
  if (t === 'M') {                                               // gem-socket door: set every gem you carry
    const key = `${ax},${ay}`, need = g.map.sockets[key] || [];
    g.map.placed = g.map.placed || {};
    const placed = g.map.placed[key] = g.map.placed[key] || [];
    for (const id of need) {
      const i = g.bag.indexOf(id);
      if (i >= 0 && !placed.includes(id)) { g.bag.splice(i, 1); placed.push(id); say(g, `You set the ${GEMS[id] || id} into the door.`); }
    }
    if (need.every(id => placed.includes(id))) { setTile(g.map, ax, ay, 'd'); say(g, 'The sockets blaze and the door grinds open.'); }
    else say(g, `The door has ${need.length} sockets (${placed.length} filled). It wants ${need.filter(id => !placed.includes(id)).map(id => 'a ' + (GEMS[id] || id)).join(' and ')}.`);
    return true;
  }
  if (t === 'X') {
    const trap = g.map.traps[`${ax},${ay}`];
    if (trap?.found) {
      if (hasCutpurse(g)) { setTile(g.map, ax, ay, '.'); say(g, 'Your Cutpurse disarms the pit trap and fills it in.'); }
      else say(g, 'A pit trap. Nobody here knows how to disarm it. You could risk crossing.');
      return true;
    }
    return false;
  }
  if (t === '#') {
    const face = (g.dir + 2) % 4;
    const lamp = g.map.lamps.find(l => l.x === ax && l.y === ay && l.face === face);
    if (lamp) {
      if (!lamp.lit) { say(g, 'The lamp is already dark.'); return true; }
      lamp.lit = false; say(g, 'You snuff out a phylactery lamp.');
      if (g.map.lamps.every(l => !l.lit)) say(g, 'The last lamp dies. The Queen\'s ward is broken!');
      return true;
    }
    const s = g.map.switches.find(s => s.x === ax && s.y === ay && s.face === face && s.found);
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
    const t = tileAt(g.map, nx, ny);
    if (f === 1 && r === 0 && (t === 'D' || t === 'M')) { interact(g); return; }
    say(g, 'Blocked.'); return;
  }
  const blocker = enemyAt(g, nx, ny);
  if (blocker) { say(g, `A ${blocker.name} blocks the way.`); return; }
  g.x = nx; g.y = ny; enter(g);
}
