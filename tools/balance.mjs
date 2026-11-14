// Balance simulator: plays the real game (real rules, monsters and clocks) with a seeded bot, many times over.
//   node tools/balance.mjs [runs] [--variant=name] [--json]
// The bot is a competent but not expert player: it fights what hunts it, heals, drinks potions, rests and prays.
// Results are a proxy for difficulty, not a promise about how any human will do.
import { pathToFileURL } from 'node:url';
import { setDifficulty } from '../js/difficulty.js';
import { loadCampaign } from '../js/data/floors.js';
import { DX, DY, tileAt, SOLID } from '../js/map.js';
import { MONSTERS } from '../js/data/monsters.js';
import { newGame, step, turn, interact } from '../js/world.js';
import { rosterHeroes, formParty } from '../js/party.js';
import { heroAttack, canAct, enemyAt, enemyAhead, distances, alive } from '../js/combat.js';
import { castSpell, useQuick, rest, advance, memorizedCount } from '../js/magic.js';

const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
// Pace: how long the bot takes per action. 'quick' is a sharp player; 'human' is nearer a first-time player
// (looking around, hesitating, slower reactions in a fight).
export const PACES = {
  quick: { STEP_MS: 350, TURN_MS: 250, USE_MS: 300, REACT_MS: 150, REST_MS: 1000, DWELL_MS: 0 },
  human: { STEP_MS: 900, TURN_MS: 600, USE_MS: 900, REACT_MS: 600, REST_MS: 2500, DWELL_MS: 0 },
  slow:  { STEP_MS: 900, TURN_MS: 600, USE_MS: 900, REACT_MS: 600, REST_MS: 2500, DWELL_MS: 14000 },   // a first-timer who looks around and thinks
};
const TIME_CAP_MS = 3600 * 1000;

export const PARTIES = {
  standard: ['Brannoch', 'Sela', 'Ioreth', 'Quillon'],
  'no-healer': ['Brannoch', 'Sela', 'Dagny', 'Quillon'],
  'no-cutpurse': ['Brannoch', 'Dagny', 'Ioreth', 'Quillon'],
  'no-mage': ['Brannoch', 'Sela', 'Ioreth', 'Dagny'],
};
export const VARIANTS = {
  careful:      { spells: true,  potions: true,  rest: true,  items: 'all',  party: 'standard', restHero: 0.5, restAvg: 0.7 },
  rush:         { spells: true,  potions: true,  rest: true,  items: 'visible', party: 'standard', restHero: 0.5, restAvg: 0.7 },
  average:      { spells: true,  potions: true,  rest: true,  items: 'visible', party: 'standard', restHero: 0.3, restAvg: 0.5 },
  careless:     { spells: false, potions: false, rest: false, items: 'none', party: 'standard' },
  'no-healer':  { spells: true,  potions: true,  rest: true,  items: 'all',  party: 'no-healer', restHero: 0.5, restAvg: 0.7 },
  'no-cutpurse':{ spells: true,  potions: true,  rest: true,  items: 'all',  party: 'no-cutpurse', restHero: 0.5, restAvg: 0.7 },
  'no-mage':    { spells: true,  potions: true,  rest: true,  items: 'all',  party: 'no-mage', restHero: 0.5, restAvg: 0.7 },
  // the difficulty setting (js/difficulty.js): the same players on Easy and Hard
  'average-easy': { spells: true, potions: true, rest: true, items: 'visible', party: 'standard', restHero: 0.3, restAvg: 0.5, difficulty: 'easy' },
  'careless-easy': { spells: false, potions: false, rest: false, items: 'none', party: 'standard', difficulty: 'easy' },
  'rush-easy':  { spells: true,  potions: true,  rest: true,  items: 'visible', party: 'standard', restHero: 0.5, restAvg: 0.7, difficulty: 'easy' },
  'careful-hard': { spells: true, potions: true, rest: true, items: 'all', party: 'standard', restHero: 0.5, restAvg: 0.7, difficulty: 'hard' },
  'rush-hard':  { spells: true,  potions: true,  rest: true,  items: 'visible', party: 'standard', restHero: 0.5, restAvg: 0.7, difficulty: 'hard' },
};

class Over extends Error { constructor(kind) { super(kind); this.kind = kind; } }

export function simulate(seed, opts, pace = 'quick') {
  const { STEP_MS, TURN_MS, USE_MS, REACT_MS, REST_MS, DWELL_MS } = PACES[pace];
  const rng = mulberry32(seed);
  const g = newGame(loadCampaign(), rng);
  setDifficulty(g, opts.difficulty || 'normal', { fresh: true });
  const all = rosterHeroes();
  g.party = formParty(PARTIES[opts.party].map(n => all.find(h => h.name === n))).party;
  let now = 0;
  const stat = { lampDamage: 0, lampSeconds: 0, damage: 0, floorDamage: [0, 0, 0, 0], minAvg: 1, queenSeconds: 0, potions: 0, rests: 0, restsInterrupted: 0, falls: 0, spells: 0, prayers: 0, kills: 0, floorTime: [], floorLevel: [], floorRations: [] };
  const seenMsg = m => {
    const dm = /^The .* (?:hits|webs|blasts) .* for (\d+)\./.exec(m);
    if (dm) { stat.damage += +dm[1]; stat.floorDamage[g.floor] += +dm[1]; if (g.floor === 3 && g.map.lamps.some(l => l.lit)) stat.lampDamage += +dm[1]; }
    if (/ falls!/.test(m)) stat.falls++;
    if (/drinks a healing potion|pours a draught|drinks an antidote/.test(m)) stat.potions++;
    if (/is destroyed/.test(m)) stat.kills++;
    if (/shrine blazes/.test(m)) stat.prayers++;
    if (/'s (Cinder Dart|Frostbind)|heals .* for/.test(m)) stat.spells++;
  };
  function wait(ms) {
    while (ms > 0) {
      const dt = Math.min(100, ms); advance(g, dt); now += dt; ms -= dt;
      for (const m of g.msgs.splice(0)) seenMsg(m);
      stat.minAvg = Math.min(stat.minAvg, avgHp()); if (g.floor === 3) { stat.queenSeconds += dt / 1000; if (g.map.lamps.some(l => l.lit)) stat.lampSeconds += dt / 1000; }
      if (g.won || g.queenDown) throw new Over('won');   // the Queen's death is the fight; freeing the princess afterward is a walk
      if (g.defeated) throw new Over('defeated');
      if (now > TIME_CAP_MS) throw new Over('timeout');
    }
  }
  const avgHp = () => g.party.reduce((t, h) => t + (alive(h) ? h.hp / h.hpMax : 0), 0) / g.party.length;
  const turnToward = d => {
    const n = (d - g.dir + 4) % 4;
    if (n === 1) { turn(g, 1); wait(TURN_MS); } else if (n === 3) { turn(g, -1); wait(TURN_MS); } else if (n === 2) { turn(g, 1); wait(TURN_MS); turn(g, 1); wait(TURN_MS); }
  };
  const dirOf = (x0, y0, x1, y1) => { for (let d = 0; d < 4; d++) if (x0 + DX[d] === x1 && y0 + DY[d] === y1) return d; return -1; };
  const hasKey = id => g.bag.includes(id);

  // ---- navigation --------------------------------------------------------------------------------------------
  const passable = (x, y) => {
    const t = tileAt(g.map, x, y);
    if (enemyAt(g, x, y)) return false;
    if (!SOLID.has(t)) return true;
    if (t === 'D') return true;
    if (t === 'L') return hasKey(g.map.locks[`${x},${y}`]);
    if (t === 'M') { const need = g.map.sockets[`${x},${y}`] || [], placed = g.map.placed?.[`${x},${y}`] || []; return need.every(id => hasKey(id) || placed.includes(id)); }
    return false;
  };
  const passableIgnoringEnemies = (x, y) => { const t = tileAt(g.map, x, y); if (!SOLID.has(t)) return true; if (t === 'D') return true; if (t === 'L') return hasKey(g.map.locks[`${x},${y}`]); if (t === 'M') return passable(x, y); return false; };
  function pathTo(tx, ty, toEnemy = false, ignoreEnemies = false) {   // toEnemy: the target cell may hold a monster; ignoreEnemies: plan straight through them
    const prev = new Map([[`${g.x},${g.y}`, null]]), q = [[g.x, g.y]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i]; if (x === tx && y === ty) break;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d], k = `${nx},${ny}`;
        if (prev.has(k) || !((toEnemy && nx === tx && ny === ty) || (ignoreEnemies ? passableIgnoringEnemies(nx, ny) : passable(nx, ny)))) continue;
        prev.set(k, [x, y, d]); q.push([nx, ny]);
      }
    }
    const k0 = `${tx},${ty}`; if (!prev.has(k0)) return null;
    const out = []; let k = k0;
    while (prev.get(k)) { const [px, py, d] = prev.get(k); out.unshift([d, +k.split(',')[0], +k.split(',')[1]]); k = `${px},${py}`; }
    return out;
  }
  function takeStep(d, nx, ny) {
    turnToward(d);
    const t = tileAt(g.map, nx, ny);
    if (t === 'L' || (t === 'X' && g.map.traps[`${nx},${ny}`]?.found)) { interact(g); wait(USE_MS); return; }
    step(g, 1, 0); wait(STEP_MS);
  }

  // ---- fighting and recovery -----------------------------------------------------------------------------------
  const threats = () => {
    if (!g.enemies.length) return [];
    const dist = distances(g);
    return g.enemies.filter(e => e.hp > 0 && dist[e.y][e.x] !== undefined && dist[e.y][e.x] <= MONSTERS[e.type].aggro).map(e => ({ e, d: dist[e.y][e.x] }));
  };
  const lampsLit = () => g.map.lamps.some(l => l.lit);

  function healAllies(thresh) {
    if (!opts.spells) return false;
    let worst = -1, ratio = thresh;
    g.party.forEach((h, i) => { if (alive(h) && h.hp / h.hpMax < ratio) { ratio = h.hp / h.hpMax; worst = i; } });
    if (worst < 0) return false;
    for (const spell of ["Mender's Touch", 'Field Dressing']) {          // the Votary first, then a Warden's field medicine
      const idx = g.party.findIndex(h => alive(h) && memorizedCount(h, spell) && !h.cd);
      if (idx >= 0 && castSpell(g, idx, spell, worst).ok) return true;
    }
    return false;
  }
  function usePotions() {
    if (!opts.potions) return false;
    let did = false;
    g.party.forEach((h, i) => {
      if (!alive(h) || h.cd > 0) return;
      const s = h.quickSlots.findIndex(q => q && q.id === 'heal');
      if (s >= 0 && h.hp / h.hpMax < 0.35 && useQuick(g, i, s).ok) did = true;
    });
    if (g.party.some(h => !alive(h))) g.party.forEach((h, i) => {
      if (!alive(h) || h.cd > 0 || did) return;
      const s = h.quickSlots.findIndex(q => q && q.id === 'return');
      if (s >= 0 && useQuick(g, i, s).ok) did = true;
    });
    g.party.forEach((h, i) => {
      if (!alive(h) || h.cd > 0 || !h.poisonMs) return;
      const s = h.quickSlots.findIndex(q => q && q.id === 'antidote');
      if (s >= 0 && h.poisonMs > 4000 && useQuick(g, i, s).ok) did = true;
    });
    return did;
  }
  function combatActions() {
    const e = enemyAhead(g); if (!e) return;
    if (!(g.map.lamps.length && lampsLit() && MONSTERS[e.type].wardedByLamps)) {          // no point hitting a warded Queen
      healAllies(0.55); usePotions();
      if (opts.spells) {
        const strong = ['guard', 'wraith', 'queen'].includes(MONSTERS[e.type].kind);
        g.party.forEach((h, i) => {
          if (!alive(h) || h.cd > 0 || h.class !== 'Magister') return;
          if (strong && !e.slowMs && memorizedCount(h, 'Frostbind') && castSpell(g, i, 'Frostbind').ok) return;
          if (e.hp > 5 && !MONSTERS[e.type].splits && memorizedCount(h, 'Cinder Dart')) castSpell(g, i, 'Cinder Dart');   // a sensible player does not burn an ooze
        });
      }
      // a competent player opens with the Cutpurse, so the backstab bonus on a fresh foe is not wasted on someone else's blow
      const order = g.party.map((h, i) => i).sort((a, b) => (g.party[b].class === 'Cutpurse') - (g.party[a].class === 'Cutpurse'));
      order.forEach(i => { if (canAct(g, i).ok && enemyAhead(g)) heroAttack(g, i); });
    }
    wait(REACT_MS);
  }
  let holdSince = null, ignoreUntil = 0;
  function fight() {                                            // returns true if it spent time on a fight
    const ts = threats();
    if (!ts.length || now < ignoreUntil) { holdSince = null; return false; }
    const adj = ts.filter(t => t.d === 1).sort((a, b) => a.e.hp - b.e.hp)[0];
    if (adj) {
      holdSince = null;
      const d = dirOf(g.x, g.y, adj.e.x, adj.e.y);
      if (d !== g.dir) { turnToward(d); return true; }
      combatActions(); return true;
    }
    const ranged = ts.filter(t => MONSTERS[t.e.type].ranged).sort((a, b) => a.d - b.d)[0];
    if (ranged) {                                               // close the distance on archers and the like
      const p = pathTo(ranged.e.x, ranged.e.y, true) || [];
      if (p.length > 1) { takeStep(...p[0]); return true; }
    }
    holdSince ??= now;
    if (now - holdSince > 8000) { ignoreUntil = now + 8000; holdSince = null; return false; }   // it is not coming; carry on
    const nearest = ts.sort((a, b) => a.d - b.d)[0];
    const toward = pathFromEnemy(nearest.e);                      // face the way it will arrive
    if (toward !== null && toward !== g.dir) turnToward(toward);
    wait(200); return true;
  }
  function pathFromEnemy(e) {                                   // direction (from us) of the first step on the way to the enemy
    const prev = new Map([[`${e.x},${e.y}`, null]]), q = [[e.x, e.y]];
    for (let i = 0; i < q.length; i++) {
      const [x, y] = q[i];
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d], k = `${nx},${ny}`;
        if (prev.has(k) || SOLID.has(tileAt(g.map, nx, ny))) continue;
        prev.set(k, [x, y]); q.push([nx, ny]);
      }
    }
    let k = `${g.x},${g.y}`; if (!prev.has(k)) return null;
    const [nx, ny] = prev.get(k) || []; return nx === undefined ? null : dirOf(g.x, g.y, nx, ny);
  }
  function recover() {
    if (threats().length) return;
    let did = usePotions();
    while (healAllies(0.8)) { wait(1600); did = true; }          // use leftover spells before spending a ration
    if (opts.rest && g.rations > 0) {
      const low = g.party.some(h => alive(h) && h.hp / h.hpMax < (opts.restHero ?? 0.5)), spent = g.party.filter(h => h.spellsKnown.length).every(h => memorizedCount(h, h.spellsKnown[0]) === 0);
      if (low || avgHp() < (opts.restAvg ?? 0.7) || (spent && avgHp() < 0.9 && g.rations > 3 && (opts.restAvg ?? 0.7) >= 0.7)) {
        const r = rest(g); wait(REST_MS); stat.rests++; if (r.interrupted) stat.restsInterrupted++; did = true;
      }
    }
    return did;
  }
  const needsShrine = () => g.party.some(h => !alive(h)) || avgHp() < (opts.restAvg ?? 0.7) - 0.05;

  // ---- going places ----------------------------------------------------------------------------------------------
  function dwell() {                                           // time spent looking around, only while nothing is hunting us
    for (let left = DWELL_MS; left > 0 && !threats().length; left -= 500) wait(500);
  }
  function goTo(tx, ty) {
    const floor = g.floor; let guard = 0, blocked = 0;
    dwell();
    while ((g.x !== tx || g.y !== ty) && g.floor === floor) {
      if (++guard > 2500) throw new Error(`stuck going to ${tx},${ty} on floor ${g.floor + 1}`);
      const warded = g.map.lamps.length && lampsLit();           // the Queen cannot be hurt yet: do not stand and fight her
      if (!warded && fight()) continue;
      if (!warded && recover()) continue;
      const p = pathTo(tx, ty);
      if (!p) {                                                  // a monster sits in the only way through: go and fight it
        const q = pathTo(tx, ty, false, true);
        if (q && q.length) {
          const [d, nx, ny] = q[0], e = enemyAt(g, nx, ny);
          if (e) { turnToward(d); combatActions(); } else takeStep(d, nx, ny);
          continue;
        }
      }
      if (!p) { if (++blocked > 40) { if (globalThis.__dbg) globalThis.__state = { at: [g.x, g.y, g.dir], bag: g.bag, enemies: g.enemies.map(e => `${e.type}@${e.x},${e.y} hp${e.hp}`), hp: g.party.map(h => h.hp), threats: threats().length, tile108: tileAt(g.map, 10, 8) }; throw new Error(`no path to ${tx},${ty} on floor ${g.floor + 1} from ${g.x},${g.y}`); } wait(300); continue; }
      blocked = 0;
      const before = [g.x, g.y]; takeStep(...p[0]);
      if (g.floor === floor && (g.x !== p[0][1] || g.y !== p[0][2]) && (g.x !== before[0] || g.y !== before[1])) return;   // teleported
    }
  }
  const act = (x, y, face) => { goTo(x, y); if (g.x === x && g.y === y) { turnToward(face); interact(g); wait(USE_MS); } };
  const pray = (x, y) => {
    if (!needsShrine()) return;
    const sh = g.map.shrines.find(s => s.x === x && s.y === y); if (!sh || sh.charges <= 0) return;
    goTo(x, y); if (g.x === x && g.y === y) { interact(g); wait(USE_MS); }
  };
  const take = pts => pts.forEach(([x, y]) => goTo(x, y));

  const T = opts.items === 'all', V = opts.items !== 'none';     // T: secret caches too; V: loose items in the open
  // A thieves' vault: only a living Cutpurse can pick the lock (a few tries), then the bot takes what is inside.
  function vault(x, y, face, pts) {
    if (!T || !g.party.some(h => alive(h) && h.class === 'Cutpurse')) return;
    goTo(x, y); if (g.x !== x || g.y !== y) return;
    const [dx, dy] = [x + DX[face], y + DY[face]];
    for (let n = 0; n < 12 && tileAt(g.map, dx, dy) === 'L'; n++) { turnToward(face); interact(g); wait(3000); }
    if (tileAt(g.map, dx, dy) !== 'L') take(pts);
  }
  const ROUTES = [
    () => {                                                      // 1. The Barrow Halls
      goTo(9, 8); act(9, 2, 1);
      goTo(12, 2); if (V) take([[14, 1], [14, 3]]);
      vault(14, 2, 1, [[16, 1], [16, 2]]);
      if (T) { act(5, 6, 3); take([[1, 8], [1, 9], [2, 9]]); }
      pray(11, 9); goTo(12, 12);
    },
    () => {                                                      // 2. The Drowned Ossuary
      if (V) take([[3, 1], [2, 3], [7, 3]]);
      goTo(10, 1); pray(10, 3); vault(10, 2, 1, [[12, 1], [13, 1]]); goTo(6, 6); goTo(2, 8); goTo(1, 6);
      goTo(13, 9); turnToward(2); step(g, 1, 0); wait(USE_MS);
      if (T) { act(13, 8, 1); take([[15, 9], [16, 9], [16, 10]]); }
      goTo(13, 12);
    },
    () => {                                                      // 3. The Cinder Court (dark, with pits)
      if (V) take([[2, 3]]);
      vault(2, 3, 2, [[1, 5], [3, 5]]);
      goTo(16, 1); if (T) { act(16, 2, 1); take([[13, 5], [12, 5]]); }
      goTo(13, 9); pray(11, 10);
      goTo(9, 8);                                                // through the ember door: the guards come for us
      if (V) take([[8, 10], [5, 7]]);
      goTo(7, 12);
    },
    () => {                                                      // 4. The Queen's Chamber
      pray(7, 7); if (V) take([[6, 9], [8, 9], [8, 10]]);
      act(3, 2, 3); act(11, 2, 1); act(7, 1, 0);
      goTo(7, 3);
      for (let n = 0; n < 4000; n++) { if (!fight()) { recover(); wait(200); } }
    },
  ];

  let result;
  try {
    for (let f = 0; f < 4; f++) {
      stat.floorTime.push(Math.round(now / 1000)); stat.floorLevel.push(g.party.map(h => h.level).join('/')); stat.floorRations.push(g.rations);
      ROUTES[f]();
    }
    result = { outcome: 'incomplete', floor: g.floor };
  } catch (e) {
    if (!(e instanceof Over)) throw e;
    result = { outcome: e.kind, floor: g.floor };
  }
  const levels = g.party.map(h => h.level);
  return { seed, ...result, seconds: Math.round(now / 1000), levels, rations: g.rations, ...stat, alive: g.party.filter(alive).length };
}

// ---- running many and reporting --------------------------------------------------------------------------------
const pct = (n, d) => `${Math.round((100 * n) / d)}%`;
const avg = a => (a.length ? a.reduce((t, v) => t + v, 0) / a.length : 0);
const fmtTime = s => `${Math.floor(s / 60)}m${String(Math.round(s % 60)).padStart(2, '0')}s`;

export function summarize(name, results) {
  const n = results.length, won = results.filter(r => r.outcome === 'won'), lost = results.filter(r => r.outcome !== 'won');
  const byFloor = [0, 1, 2, 3].map(f => lost.filter(r => r.floor === f).length);
  return { name, runs: n, winRate: won.length / n, deathsByFloor: byFloor, timeouts: results.filter(r => r.outcome === 'timeout').length,
    winSeconds: avg(won.map(r => r.seconds)), allSeconds: avg(results.map(r => r.seconds)),
    falls: avg(results.map(r => r.falls)), potions: avg(results.map(r => r.potions)), rests: avg(results.map(r => r.rests)),
    interrupted: avg(results.map(r => r.restsInterrupted)), prayers: avg(results.map(r => r.prayers)), spells: avg(results.map(r => r.spells)),
    damage: avg(results.map(r => r.damage)), floorDamage: [0, 1, 2, 3].map(f => avg(results.map(r => r.floorDamage[f]))),
    lampDamage: avg(results.filter(r => r.queenSeconds > 0).map(r => r.lampDamage)), lampSeconds: avg(results.filter(r => r.queenSeconds > 0).map(r => r.lampSeconds)),
    minAvg: avg(results.map(r => r.minAvg)), queenSeconds: avg(results.filter(r => r.queenSeconds > 0).map(r => r.queenSeconds)),
    rationsLeft: avg(won.map(r => r.rations)), finalLevel: avg(won.map(r => avg(r.levels))),
    floorLevel: [0, 1, 2, 3].map(f => avg(results.filter(r => r.floorLevel[f]).map(r => avg(r.floorLevel[f].split('/').map(Number))))),
    floorStart: [0, 1, 2, 3].map(f => avg(results.filter(r => r.floorTime[f] !== undefined).map(r => r.floorTime[f]))) };
}

export function report(summaries) {
  const lines = [];
  lines.push('| variant | runs | win rate | deaths on floor 1/2/3/4 | avg time (won) | hero falls | potions | rests | shrine prayers | rations left |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const s of summaries)
    lines.push(`| ${s.name} | ${s.runs} | ${pct(s.winRate * s.runs, s.runs)} | ${s.deathsByFloor.join(' / ')} | ${s.winRate ? fmtTime(s.winSeconds) : '-'} | ${s.falls.toFixed(1)} | ${s.potions.toFixed(1)} | ${s.rests.toFixed(1)} | ${s.prayers.toFixed(1)} | ${s.winRate ? s.rationsLeft.toFixed(1) : '-'} |`);
  lines.push('');
  lines.push('');
  lines.push('Damage the party took (per floor 1/2/3/4, total), lowest average party health reached, seconds spent on floor 4:');
  for (const s of summaries) lines.push(`- ${s.name}: ${s.floorDamage.map(d => d.toFixed(0)).join(' / ')} = ${s.damage.toFixed(0)}; lowest avg health ${(100 * s.minAvg).toFixed(0)}%; floor 4 ${s.queenSeconds.toFixed(0)}s (${s.lampSeconds.toFixed(0)}s of it with lamps lit, taking ${s.lampDamage.toFixed(0)} damage)`);
  lines.push('');
  lines.push('Average hero level on arriving at each floor, and game time at arrival:');
  for (const s of summaries) lines.push(`- ${s.name}: ` + s.floorLevel.map((l, i) => `F${i + 1} L${l.toFixed(1)} @${fmtTime(s.floorStart[i] || 0)}`).join(', ') + `; final level ${s.winRate ? s.finalLevel.toFixed(1) : '-'}`);
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runs = +(process.argv.find(a => /^\d+$/.test(a)) || 100);
  const only = (process.argv.find(a => a.startsWith('--variant=')) || '').split('=')[1];
  const pace = (process.argv.find(a => a.startsWith('--pace=')) || '--pace=quick').split('=')[1];
  const names = only ? [only] : Object.keys(VARIANTS);
  if (!PACES[pace]) throw new Error('pace must be quick, human or slow');
  const sums = names.map(name => {
    const res = []; for (let s = 1; s <= runs; s++) res.push(simulate(s, VARIANTS[name], pace));
    return summarize(name, res);
  });
  if (process.argv.includes('--json')) console.log(JSON.stringify(sums, null, 1)); else console.log(report(sums));
}
