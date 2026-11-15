// Game rules for the map: movement, doors, keys, plates, switches, teleporters, spinners,
// stairs, pits, gem sockets and lamps. No DOM here, so it can be tested from Node.
import { DX, DY, tileAt, isSolid } from './map.js';
import { buildEnemies, enemyAt, alive, dice, gainXp, XP_LEVELS } from './combat.js';
import { useShrine } from './magic.js';
import { explore } from './automap.js';
import { createHero } from './party.js';
import { CLASSES } from './data/classes.js';
import { GEAR } from './data/gear.js';
const CLASSES_USING = id => GEAR[id].classes;

// A game is a list of floors (or a single map, which is wrapped into a one-floor game).
export function newGame(mapOrFloors, rng = Math.random) {
  const floors = Array.isArray(mapOrFloors) ? mapOrFloors : [mapOrFloors];
  for (const f of floors) f.enemies = buildEnemies(f);
  const map = floors[0];
  return { floors, floor: 0, map, x: map.start.x, y: map.start.y, dir: map.start.dir, bag: [], msgs: [], rng,
    party: [], enemies: map.enemies, fx: [], paused: false, defeated: false, won: false, journal: [],
    difficulty: 'normal', queenDown: false, stash: [], rations: 3, hungerMs: 0, starving: false, starveMs: 0, lightMs: 0, sanctMs: 0 };
}

const say = (g, m) => g.msgs.push(m);
const ahead = g => [g.x + DX[g.dir], g.y + DY[g.dir]];
const setTile = (map, x, y, ch) => { map.grid[y][x] = ch; };
const GEMS = { redgem: 'ruby', bluegem: 'sapphire' };
const hasCutpurse = g => g.party.some(h => alive(h) && h.class === 'Cutpurse');
export const CUTPURSE_SIGHT = 3;      // cells ahead in which a Cutpurse notices a hidden switch
export const PICK_DC = 12;            // d20 + level + Agility modifier must reach this to pick a lock
export const PICK_MS = 2500;          // each attempt keeps the Cutpurse busy this long
export const VAULT_LOCK = 'picklock'; // a lock no key fits: only a Cutpurse opens it (the thieves' vaults)
export const VAULT_DC = 14;           // vault locks are harder

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

// An inscription is read the first time you stand in front of it, or face it from up to two cells away.
function seesInscription(g, ins) {
  if (g.x === ins.x + DX[ins.face] && g.y === ins.y + DY[ins.face]) return true;
  if (ins.face !== (g.dir + 2) % 4) return false;
  for (let k = 1; k <= 2; k++) {
    const x = g.x + DX[g.dir] * k, y = g.y + DY[g.dir] * k;
    if (x === ins.x && y === ins.y) return true;
    if (isSolid(g.map, x, y)) return false;
  }
  return false;
}

// Passive search: inscriptions are read, switches directly ahead are noticed, and a living Cutpurse spots pits.
export function look(g) {
  explore(g);                                          // the automap remembers what has been seen
  for (const ins of g.map.inscriptions) {
    if (ins.seen || !seesInscription(g, ins)) continue;
    ins.seen = true;
    g.journal.push({ floor: g.floor, title: ins.title, text: ins.text });
    say(g, `You read an inscription, "${ins.title}". (Saved to your journal: J)`);
  }
  const [ax, ay] = ahead(g);
  const reach = hasCutpurse(g) ? CUTPURSE_SIGHT : 1;                   // a Cutpurse sees hidden switches from afar
  for (let k = 1; k <= reach; k++) {
    const cx = g.x + DX[g.dir] * k, cy = g.y + DY[g.dir] * k;
    for (const s of g.map.switches) {
      if (!s.found && s.x === cx && s.y === cy && s.face === (g.dir + 2) % 4) {
        s.found = true; say(g, k > 1 ? 'Your Cutpurse spots a hidden switch in the wall ahead!' : 'You notice a hidden switch in the wall!');
      }
    }
    if (isSolid(g.map, cx, cy)) break;
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
  } else if (item.kind === 'gear') {
    g.stash.push(item.id);
    const users = [...new Set(CLASSES_USING(item.id))].join(' or ');
    say(g, `You find ${item.id}. ${GEAR[item.id].text || ''} (For a ${users}. Equip it in the Inventory: I)`);
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
    for (const h of g.party.filter(alive)) { h.hp = Math.max(1, h.hp - dice(g, [1, 6, 2])); h.hurt = { text: '-', ttl: 800 }; }
  }
  look(g);
}

// ---- prisoners: one may join the party's fifth slot --------------------------------------------------------
export const npcAt = (map, x, y) => map.npcs?.find(n => !n.freed && n.x === x && n.y === y);

// Frees a prisoner. The party has one NPC slot: the first prisoner freed takes it, and joins at the party's average level,
// weak from captivity. A second one has to stay behind.
function freePrisoner(g, n) {
  if (n.princess) {                                                          // the reward at the end of the tomb
    n.freed = true; g.won = true;
    say(g, `${n.name}: "${n.thanks}"`);
    say(g, `You have won! ${n.name} is free, and the Lich Queen's tomb is silent at last.`);
    return;
  }
  const taken = g.party.find(h => h.npc);
  if (taken) { say(g, `${n.name}: "Take me, and I would follow, but you already travel with ${taken.name}. Go on. I'll find my own way out."`); return; }
  const living = g.party.filter(alive), lvl = Math.max(1, Math.round(living.reduce((t, h) => t + h.level, 0) / Math.max(1, living.length)));
  const h = createHero({ id: n.id, name: n.name, class: n.class, attrs: n.attrs, portrait: n.portrait });
  h.npc = true;
  const log = g.msgs; g.msgs = [];                                           // level them up quietly
  gainXp(g, h, XP_LEVELS[lvl - 1] || 0);
  g.msgs = log;
  h.hp = Math.max(1, Math.ceil(h.hpMax / 2)); h.cd = 0;
  n.freed = true; g.party.push(h);
  say(g, `${n.name}: "${n.thanks}"`);
  say(g, `${n.name}, a level ${h.level} ${n.class}, joins the party! (the fifth slot)`);
}

export function interact(g) {
  if (tileAt(g.map, g.x, g.y) === 'H' && useShrine(g)) return true;       // pray at the shrine you stand on
  const [ax, ay] = ahead(g);
  const npc = npcAt(g.map, ax, ay);
  if (npc) { freePrisoner(g, npc); return true; }
  const t = tileAt(g.map, ax, ay);
  if (t === 'D') { setTile(g.map, ax, ay, 'd'); say(g, 'The door creaks open.'); return true; }
  if (t === 'L') {
    const need = g.map.locks[`${ax},${ay}`];
    if (g.bag.includes(need)) { setTile(g.map, ax, ay, 'd'); say(g, `The ${need} key turns. The door opens.`); return true; }
    const thief = g.party.find(h => alive(h) && h.class === 'Cutpurse');
    if (!thief) { say(g, need === VAULT_LOCK ? 'Locked, and no key was ever cut for it. Only a thief could open this.' : `Locked. It needs a ${need} key.`); return true; }
    if ((thief.cd || 0) > 0) { say(g, `${thief.name} is still working at the lock.`); return true; }
    const roll = Math.floor(g.rng() * 20) + 1, bonus = thief.level + Math.floor((thief.attrs.agility - 10) / 2);
    thief.cdMax = thief.cd = PICK_MS;
    const dc = need === VAULT_LOCK ? VAULT_DC : PICK_DC;
    if (roll === 20 || (roll !== 1 && roll + bonus >= dc)) { setTile(g.map, ax, ay, 'd'); say(g, `${thief.name} picks the lock. The door opens.`); }
    else say(g, `${thief.name} fumbles at the lock.${need === VAULT_LOCK ? ' Try again.' : ` It needs a ${need} key, or another try.`}`);
    return true;
  }
  if (t === 'W') {                                               // one-way door: a handle on one side only
    if (g.dir === g.map.oneway[`${ax},${ay}`]) { setTile(g.map, ax, ay, 'd'); say(g, 'You work the handle and the door swings open. It will stay open now.'); }
    else say(g, 'A heavy door with no handle on this side. It was made to open from the other.');
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
    if (f === 1 && r === 0 && (t === 'D' || t === 'M' || t === 'W')) { interact(g); return; }
    say(g, 'Blocked.'); return;
  }
  if (npcAt(g.map, nx, ny)) { if (f === 1 && r === 0) interact(g); else say(g, 'Blocked.'); return; }
  const blocker = enemyAt(g, nx, ny);
  if (blocker) { say(g, `A ${blocker.name} blocks the way.`); return; }
  g.x = nx; g.y = ny; enter(g);
}
