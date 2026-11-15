// Real-time combat rules. No DOM here, so it can be tested from Node.
import { DX, DY, isSolid } from './map.js';
import { MONSTERS } from './data/monsters.js';
import { WEAPONS } from './data/weapons.js';
import { slotsFor, loadoutFor, learnedAt } from './spellbook.js';
import { diff } from './difficulty.js';
import { accessoryOf } from './data/gear.js';

const mod = v => Math.floor((v - 10) / 2);
export const XP_LEVELS = [0, 50, 130, 260, 420];   // XP_LEVELS[n] = XP needed to leave level n
export const MAX_LEVEL = 5;
export const POISON_MS = 10000, POISON_TICK = 2000, WEB_MS = 4000;
// Cutpurse backstab: extra dice on a monster that has not yet fought (nobody has hit it and it has not attacked)
// or that is slowed. It is added before a crit doubles the blow.
export const BACKSTAB = [2, 6, 0];
export const canBackstab = (h, e) => h.class === 'Cutpurse' && (!e.engaged || e.slowMs > 0);

export const d20 = g => Math.floor(g.rng() * 20) + 1;
export const dice = (g, [n, s, b]) => { let t = b; for (let i = 0; i < n; i++) t += Math.floor(g.rng() * s) + 1; return t; };
const say = (g, m) => g.msgs.push(m);
export const addFx = (g, cell, text, color) => g.fx.push({ cell: { x: cell.x, y: cell.y }, text, color, ttl: 900, age: 0 });

export const alive = h => h.hp > 0;
export const BULWARK_DEF = 3;
export const heroDefense = h => 10 + mod(h.attrs.agility) + (h.armor || 0) + (accessoryOf(h).def || 0) + (h.bulwarkMs > 0 ? BULWARK_DEF : 0);
export const enemyAt = (g, x, y) => g.enemies.find(e => e.hp > 0 && e.x === x && e.y === y);
export const enemyAhead = g => enemyAt(g, g.x + DX[g.dir], g.y + DY[g.dir]);

export function createMonster(type, x, y) {
  const t = MONSTERS[type];
  return { type, name: t.name, x, y, hp: t.hp, hpMax: t.hp, atkCd: t.atkMs, moveCd: t.moveMs, flash: 0, slowMs: 0, phase: 0, engaged: false };
}
export const buildEnemies = map => map.monsters.map(s => createMonster(s.type, s.x, s.y));
export function spawnEnemies(g) { g.map.enemies = buildEnemies(g.map); g.enemies = g.map.enemies; }

// The Lich Queen cannot be harmed while any phylactery lamp still burns.
export const isWarded = (g, e) => !!MONSTERS[e.type].wardedByLamps && g.map.lamps.some(l => l.lit);

// Applies damage unless the target is warded. Returns the damage dealt (0 if warded). The caller reports it
// and calls kill() when hp reaches 0, so messages read in order.
export function strike(g, e, dmg) {
  if (isWarded(g, e)) { addFx(g, e, 'warded', '#8cc8ff'); return 0; }
  e.hp -= dmg; e.flash = 150; e.engaged = true;
  return dmg;
}

// ---- party actions -------------------------------------------------------------------

export function canAct(g, i) {
  const h = g.party[i], w = h && WEAPONS[h.weapon];
  if (!h || !alive(h)) return { ok: false, why: 'fallen' };
  if ((h.cd || 0) > 0) return { ok: false, why: 'not ready' };
  if (h.row === 1 && !(w.reach || w.ranged)) return { ok: false, why: `${h.name} cannot reach from the back row.` };
  return { ok: true };
}

export function gainXp(g, h, n) {
  h.xp += n;
  while (h.level < MAX_LEVEL && h.xp >= XP_LEVELS[h.level]) {
    h.level++;
    const up = Math.max(3, 4 + mod(h.attrs.might));
    h.hpMax += up; h.hp = Math.min(h.hpMax, h.hp + up);
    say(g, `${h.name} reaches level ${h.level}! (+${up} max HP)`);
    for (const s of learnedAt(h, h.level)) {
      h.spellsKnown.push(s);
      say(g, `${h.name} learns ${s}! Memorize it in the menu's Spells tab, then rest.`);
    }
    const lo = loadoutFor(h);                                   // casters gain a memorized slot
    while (h.spellsMemorized.length < slotsFor(h)) h.spellsMemorized.push(lo[h.spellsMemorized.length]);
  }
}

export const MAX_OOZES = 8;      // a floor never holds more living splitting monsters than this

// A burned monster that can split divides what is left of its health with a new one on a free cell beside it.
// The new one is worth no XP, so burning an ooze over and over cannot be farmed. Returns the new monster or null.
export function splitOoze(g, e) {
  if (!MONSTERS[e.type].splits || e.hp < 4) return null;
  if (g.enemies.filter(x => x.hp > 0 && MONSTERS[x.type].splits).length >= MAX_OOZES) return null;
  for (let d = 0; d < 4; d++) {
    const x = e.x + DX[d], y = e.y + DY[d];
    if (isSolid(g.map, x, y) || enemyAt(g, x, y) || (x === g.x && y === g.y) || '<>X'.includes(g.map.grid[y]?.[x])) continue;
    const half = Math.floor(e.hp / 2), spawn = createMonster(e.type, x, y);
    spawn.hp = spawn.hpMax = half; spawn.spawn = true; spawn.engaged = true; spawn.atkCd = 1200; spawn.slowMs = e.slowMs;
    e.hp -= half;
    g.enemies.push(spawn);
    say(g, `The ${e.name} splits in two!`);
    return spawn;
  }
  return null;
}

export function kill(g, e) {
  const t = MONSTERS[e.type];
  say(g, `${e.name} is destroyed.`);
  const living = g.party.filter(alive);
  const sharers = Math.max(1, living.filter(h => !h.npc).length);   // a freed prisoner shares in XP without thinning the others' share
  for (const h of living) gainXp(g, h, e.spawn ? 0 : Math.ceil(t.xp / sharers));   // a split-off ooze is worth nothing
  if (e.type === 'veshara') {
    g.queenDown = true; g.fx = []; g.enemies.length = 0;         // her summoned dead fall with her
    if (g.map.rescue) { const [rx, ry] = g.map.rescue; if (g.map.grid[ry][rx] === 'G') g.map.grid[ry][rx] = 'g'; }
    say(g, 'The Lich Queen crumbles to ash and her dead fall still. Somewhere in the chamber, a gate grinds open.');
  }
}

export function heroAttack(g, i) {
  const can = canAct(g, i);
  if (!can.ok) return can;
  const h = g.party[i], w = WEAPONS[h.weapon], e = enemyAhead(g);
  if (!e) return { ok: false, why: 'Nothing to hit.' };
  const t = MONSTERS[e.type], stat = h.attrs[w.stat];
  h.cdMax = h.cd = Math.max(300, Math.round(w.ms * (1 - 0.03 * mod(h.attrs.agility))));
  const roll = d20(g);
  if (roll === 1 || (roll !== 20 && roll + h.level + mod(stat) < t.def)) {
    say(g, `${h.name} misses the ${e.name}.`); addFx(g, e, 'miss', '#bbb');
    return { ok: true, hit: false };
  }
  const stab = canBackstab(h, e);
  let dmg = Math.max(1, dice(g, w.dice) + mod(stat) + (accessoryOf(h).dmg || 0) + (stab ? dice(g, BACKSTAB) : 0));
  if (roll === 20) dmg *= 2;
  if (!strike(g, e, dmg)) {
    say(g, `${h.name}'s blow glances off ${e.name}. Her lamps still burn!`);
    return { ok: true, hit: false, warded: true };
  }
  say(g, `${h.name} ${stab ? 'backstabs' : roll === 20 ? 'crits' : 'hits'} the ${e.name} for ${dmg}.`);
  addFx(g, e, String(dmg), roll === 20 ? '#ffd24a' : '#fff');
  if (e.hp <= 0) kill(g, e);
  return { ok: true, hit: true, dmg };
}

// ---- enemies -------------------------------------------------------------------------

export function distances(g) {
  const m = g.map, dist = Array.from({ length: m.h }, () => Array(m.w).fill(undefined));
  const q = [[g.x, g.y]]; dist[g.y][g.x] = 0;
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d], ny = y + DY[d];
      if (isSolid(m, nx, ny) || dist[ny][nx] !== undefined) continue;
      dist[ny][nx] = dist[y][x] + 1; q.push([nx, ny]);
    }
  }
  return dist;
}

// Put `count` new monsters on open cells between min and max steps from the party.
export function spawnNear(g, type, min, max, count = 1) {
  const dist = distances(g), cells = [];
  for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++)
    if (dist[y][x] >= min && dist[y][x] <= max && !enemyAt(g, x, y)) cells.push([x, y]);
  const out = [];
  for (let i = 0; i < count && cells.length; i++) {
    const [x, y] = cells.splice(Math.floor(g.rng() * cells.length), 1)[0];
    const e = createMonster(type, x, y); e.atkCd = 1200; g.enemies.push(e); out.push(e);
  }
  return out;
}

// Clear straight line (same row or column, no solid between) to the party within `range`.
function lineOfFire(g, e, range) {
  if (e.x !== g.x && e.y !== g.y) return false;
  const dx = Math.sign(g.x - e.x), dy = Math.sign(g.y - e.y), dist = Math.abs(g.x - e.x) + Math.abs(g.y - e.y);
  if (dist > range) return false;
  for (let i = 1; i < dist; i++) if (isSolid(g.map, e.x + dx * i, e.y + dy * i)) return false;
  return true;
}

function pickTarget(g, e) {
  const t = MONSTERS[e.type];
  const behind = e.x === g.x - DX[g.dir] && e.y === g.y - DY[g.dir];
  const front = g.party.filter(h => alive(h) && h.row === 0), back = g.party.filter(h => alive(h) && h.row === 1);
  const backFirst = behind || t.strikesBack;
  const pool = backFirst ? (back.length ? back : front) : (front.length ? front : back);
  return pool.length ? pool[Math.floor(g.rng() * pool.length)] : null;
}

function enemyAttack(g, e, ranged) {
  const t = MONSTERS[e.type], h = pickTarget(g, e);
  if (!h) return;
  e.strikeMs = 450;                                          // drawn lunging for a moment (render.js)
  e.engaged = true;
  const roll = d20(g);
  if (roll === 1 || (roll !== 20 && roll + t.atk < heroDefense(h))) {
    h.hurt = { text: 'miss', ttl: 800 }; say(g, `The ${e.name} ${ranged ? 'shoots wide of' : 'misses'} ${h.name}.`); return;
  }
  if (h.veil) {                                                  // Mirror Veil: the blow is absorbed whole
    h.veil = false; h.hurt = { text: 'veiled', ttl: 800 };
    say(g, `${h.name}'s Mirror Veil shatters, absorbing the ${e.name}'s blow.`); return;
  }
  const base = ranged?.bolt || t.dmg;
  const dmg = Math.max(1, Math.round(dice(g, base) * (roll === 20 ? 2 : 1) * diff(g).enemyDmg));
  h.hp = Math.max(0, h.hp - dmg); h.hurt = { text: `-${dmg}`, ttl: 800 };
  say(g, `The ${e.name} ${ranged ? (ranged.web ? 'webs' : 'blasts') : 'hits'} ${h.name} for ${dmg}.`);
  if (ranged?.web && h.hp > 0) { h.webMs = WEB_MS; say(g, `${h.name} is caught in sticky web!`); }
  if (t.poison && h.hp > 0 && !h.poisonMs) say(g, `${h.name} is poisoned!`);
  if (t.poison && h.hp > 0) h.poisonMs = POISON_MS;
  if (h.hp === 0) { say(g, `${h.name} falls!`); h.poisonMs = 0; h.webMs = 0; }
}

export function tick(g, dt) {
  if (g.paused || g.defeated || g.won) return;
  for (const h of g.party) {
    const hdt = h.webMs > 0 ? dt / 2 : dt;                      // webbed heroes act at half speed
    if (h.cd > 0) h.cd = Math.max(0, h.cd - hdt);
    if (h.webMs > 0) h.webMs = Math.max(0, h.webMs - dt);
    if (h.bulwarkMs > 0) h.bulwarkMs = Math.max(0, h.bulwarkMs - dt);
    if (h.hurt && (h.hurt.ttl -= dt) <= 0) h.hurt = null;
    if (h.poisonMs > 0) {
      if (!alive(h)) { h.poisonMs = 0; continue; }
      h.poisonMs = Math.max(0, h.poisonMs - dt);
      h.poisonAcc = (h.poisonAcc || 0) + dt;
      while (h.poisonAcc >= POISON_TICK) { h.poisonAcc -= POISON_TICK; h.hp = Math.max(1, h.hp - 1); h.hurt = { text: '-1', ttl: 500 }; }
    }
  }
  g.fx = g.fx.filter(f => (f.age += dt) < f.ttl);
  g.enemies = g.enemies.filter(e => e.hp > 0);
  if (g.enemies.length) {
    const dist = distances(g);
    for (const e of [...g.enemies]) {
      const t = MONSTERS[e.type], d = dist[e.y][e.x];
      const edt = e.slowMs > 0 ? dt / 2 : dt;                    // slowed enemies act at half speed
      e.slowMs = Math.max(0, (e.slowMs || 0) - dt);
      e.flash = Math.max(0, e.flash - dt); e.strikeMs = Math.max(0, (e.strikeMs || 0) - dt); e.stepMs = Math.max(0, (e.stepMs || 0) - dt); e.atkCd -= edt; e.moveCd -= edt;
      while (t.summons && e.phase < t.summons.length && e.hp / e.hpMax <= t.summons[e.phase]) {
        e.phase++; spawnNear(g, 'bone_wretch', 2, 5, t.summonCount ?? 2);
        say(g, `${e.name} screams, and the dead claw up from the floor!`);
      }
      if (d === 1) {
        if (e.atkCd <= 0) { enemyAttack(g, e); e.atkCd = t.atkMs; }
      } else if (t.ranged && lineOfFire(g, e, t.ranged.range)) {
        if (e.atkCd <= 0) { enemyAttack(g, e, t.ranged); e.atkCd = t.atkMs; }   // holds still and shoots
      } else if (t.holdWhileWarded && isWarded(g, e)) {
        /* the Queen sits her throne while her lamps burn: she shoots, she does not stalk the room */
      } else if (d !== undefined && d <= t.aggro && e.moveCd <= 0) {
        for (let k = 0; k < 4; k++) {
          const nx = e.x + DX[k], ny = e.y + DY[k];
          if (t.leash && (nx < t.leash[0] || ny < t.leash[1] || nx > t.leash[2] || ny > t.leash[3])) continue;
          if (dist[ny]?.[nx] === d - 1 && !(nx === g.x && ny === g.y) && !enemyAt(g, nx, ny)) {
            e.x = nx; e.y = ny; e.moveCd = t.moveMs; e.stepMs = Math.min(700, t.moveMs);
            if (d - 1 === 1) e.atkCd = Math.max(e.atkCd, 400);   // brief wind-up on arrival
            break;
          }
        }
      }
    }
  }
  if (g.party.every(h => !alive(h)) && !g.defeated) { g.defeated = true; say(g, 'The party has fallen...'); }
}

// Until saving exists (milestone 7), defeat restarts the current floor with the party healed.
export function retry(g) {
  for (const h of g.party) { h.hp = h.hpMax; h.cd = 0; h.hurt = null; h.poisonMs = 0; h.webMs = 0; h.bulwarkMs = 0; h.veil = false; }
  g.x = g.map.start.x; g.y = g.map.start.y; g.dir = g.map.start.dir;
  g.fx = []; spawnEnemies(g); g.defeated = false;
  say(g, 'You wake at the floor entrance, wounded in spirit only.');
}
