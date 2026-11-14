// Real-time combat rules. No DOM here, so it can be tested from Node.
import { DX, DY, isSolid } from './map.js';
import { MONSTERS } from './data/monsters.js';
import { WEAPONS } from './data/weapons.js';

const mod = v => Math.floor((v - 10) / 2);
export const XP_LEVELS = [0, 30, 80, 160, 300];   // XP_LEVELS[n] = XP needed to leave level n
export const MAX_LEVEL = 5;

const d20 = g => Math.floor(g.rng() * 20) + 1;
const dice = (g, [n, s, b]) => { let t = b; for (let i = 0; i < n; i++) t += Math.floor(g.rng() * s) + 1; return t; };
const say = (g, m) => g.msgs.push(m);
const fx = (g, cell, text, color) => g.fx.push({ cell: { x: cell.x, y: cell.y }, text, color, ttl: 900, age: 0 });

export const alive = h => h.hp > 0;
export const heroDefense = h => 10 + mod(h.attrs.agility) + (h.armor || 0);
export const enemyAt = (g, x, y) => g.enemies.find(e => e.hp > 0 && e.x === x && e.y === y);
export const enemyAhead = g => enemyAt(g, g.x + DX[g.dir], g.y + DY[g.dir]);

export function createMonster(type, x, y) {
  const t = MONSTERS[type];
  return { type, name: t.name, x, y, hp: t.hp, hpMax: t.hp, atkCd: t.atkMs, moveCd: t.moveMs, flash: 0 };
}
export function spawnEnemies(g) { g.enemies = g.map.monsters.map(s => createMonster(s.type, s.x, s.y)); }

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
  }
}

function kill(g, e) {
  const t = MONSTERS[e.type];
  say(g, `${e.name} is destroyed.`);
  const living = g.party.filter(alive);
  for (const h of living) gainXp(g, h, Math.ceil(t.xp / living.length));
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
    say(g, `${h.name} misses the ${e.name}.`); fx(g, e, 'miss', '#bbb');
    return { ok: true, hit: false };
  }
  let dmg = Math.max(1, dice(g, w.dice) + mod(stat));
  if (roll === 20) dmg *= 2;
  e.hp -= dmg; e.flash = 150;
  say(g, `${h.name} ${roll === 20 ? 'crits' : 'hits'} the ${e.name} for ${dmg}.`);
  fx(g, e, String(dmg), roll === 20 ? '#ffd24a' : '#fff');
  if (e.hp <= 0) kill(g, e);
  return { ok: true, hit: true, dmg };
}

// ---- enemies -------------------------------------------------------------------------

function distances(g) {
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

function enemyAttack(g, e) {
  const t = MONSTERS[e.type];
  const behind = e.x === g.x - DX[g.dir] && e.y === g.y - DY[g.dir];
  const front = g.party.filter(h => alive(h) && h.row === 0), back = g.party.filter(h => alive(h) && h.row === 1);
  const pool = behind ? (back.length ? back : front) : (front.length ? front : back);
  if (!pool.length) return;
  const h = pool[Math.floor(g.rng() * pool.length)];
  const roll = d20(g);
  if (roll === 1 || (roll !== 20 && roll + t.atk < heroDefense(h))) {
    h.hurt = { text: 'miss', ttl: 800 }; say(g, `The ${e.name} misses ${h.name}.`); return;
  }
  const dmg = Math.max(1, dice(g, t.dmg) * (roll === 20 ? 2 : 1));
  h.hp = Math.max(0, h.hp - dmg); h.hurt = { text: `-${dmg}`, ttl: 800 };
  say(g, `The ${e.name} hits ${h.name} for ${dmg}.`);
  if (h.hp === 0) say(g, `${h.name} falls!`);
}

export function tick(g, dt) {
  if (g.paused || g.defeated) return;
  for (const h of g.party) {
    if (h.cd > 0) h.cd = Math.max(0, h.cd - dt);
    if (h.hurt && (h.hurt.ttl -= dt) <= 0) h.hurt = null;
  }
  g.fx = g.fx.filter(f => (f.age += dt) < f.ttl);
  const liveEnemies = g.enemies.filter(e => e.hp > 0);
  g.enemies = liveEnemies;
  if (liveEnemies.length) {
    const dist = distances(g);
    for (const e of liveEnemies) {
      const t = MONSTERS[e.type], d = dist[e.y][e.x];
      e.flash = Math.max(0, e.flash - dt); e.atkCd -= dt; e.moveCd -= dt;
      if (d === 1) {
        if (e.atkCd <= 0) { enemyAttack(g, e); e.atkCd = t.atkMs; }
      } else if (d !== undefined && d <= t.aggro && e.moveCd <= 0) {
        for (let k = 0; k < 4; k++) {
          const nx = e.x + DX[k], ny = e.y + DY[k];
          if (dist[ny]?.[nx] === d - 1 && !(nx === g.x && ny === g.y) && !enemyAt(g, nx, ny)) {
            e.x = nx; e.y = ny; e.moveCd = t.moveMs;
            if (d - 1 === 1) e.atkCd = Math.max(e.atkCd, 400);   // brief wind-up on arrival
            break;
          }
        }
      }
    }
  }
  if (g.party.every(h => !alive(h)) && !g.defeated) { g.defeated = true; say(g, 'The party has fallen...'); }
}

// Until saving exists (milestone 7), defeat restarts the floor with the party healed.
export function retry(g) {
  for (const h of g.party) { h.hp = h.hpMax; h.cd = 0; h.hurt = null; }
  g.x = g.map.start.x; g.y = g.map.start.y; g.dir = g.map.start.dir;
  g.fx = []; spawnEnemies(g); g.defeated = false;
  say(g, 'You wake at the tomb entrance, wounded in spirit only.');
}
