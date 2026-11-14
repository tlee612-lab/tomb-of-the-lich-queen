// Plays the prison guardroom fight (floor 2) with the real rules, many times, at chosen party levels.
//   node tools/prison.mjs [runs] [--levels=2,3] [--difficulty=normal]
// The party opens the door and holds the doorway, which is how a sensible player takes it: the guards come one at a time.
// The bot heals under 55%, drinks no potions (it arrives with whatever the floors gave it, so this is the cautious reading),
// slows guards with Frostbind and burns the rest. Reports win rate, how hurt the survivors are, and how long it takes.
import { pathToFileURL } from 'node:url';
import { setDifficulty } from '../js/difficulty.js';
import { loadCampaign } from '../js/data/floors.js';
import { DX, DY } from '../js/map.js';
import { MONSTERS } from '../js/data/monsters.js';
import { newGame, changeFloor } from '../js/world.js';
import { rosterHeroes, formParty } from '../js/party.js';
import { heroAttack, canAct, enemyAhead, alive, gainXp, XP_LEVELS, createMonster } from '../js/combat.js';
import { castSpell, advance, memorizedCount } from '../js/magic.js';

const mulberry32 = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const PRISON = { x1: 6, y1: 10, x2: 10, y2: 12 };
const inPrison = e => e.x >= PRISON.x1 && e.x <= PRISON.x2 && e.y >= PRISON.y1 && e.y <= PRISON.y2;

export function fightGuardroom(seed, level, difficulty = 'normal', names = ['Brannoch', 'Sela', 'Ioreth', 'Quillon'], mons = null, charge = false) {
  const g = newGame(loadCampaign(), mulberry32(seed));
  setDifficulty(g, difficulty, { fresh: true });
  const all = rosterHeroes();
  g.party = formParty(names.map(n => all.find(h => h.name === n))).party;
  for (const h of g.party) { g.msgs.length = 0; gainXp(g, h, XP_LEVELS[level - 1] || 0); h.hp = h.hpMax; h.spellsMemorized = h.spellsMemorized.slice(); }
  changeFloor(g, { floor: 1, x: 8, y: charge ? 10 : 8, dir: 2 });   // charge: step inside and be surrounded
  g.floors[1].grid[9][8] = 'd';                                   // the jail door is open
  g.enemies = g.enemies.filter(inPrison); g.map.enemies = g.enemies;
  if (mons) { g.enemies.length = 0; for (const [type, x, y] of mons) g.enemies.push(createMonster(type, x, y)); }   // try another garrison
  const total = g.enemies.length, startHp = g.party.map(h => h.hpMax);
  let t = 0, falls = 0;
  while (t < 300000) {
    if (charge && !enemyAhead(g)) {                                 // turn to the weakest neighbour (a real player loses a moment doing this)
      const near = g.enemies.filter(x => x.hp > 0 && Math.abs(x.x - g.x) + Math.abs(x.y - g.y) === 1).sort((a, b) => a.hp - b.hp)[0];
      if (near) { g.dir = [0, 1, 2, 3].find(d => g.x + DX[d] === near.x && g.y + DY[d] === near.y); for (const h of g.party) h.cd = Math.max(h.cd || 0, 300); }
    }
    const e = enemyAhead(g);
    if (e) {
      const low = g.party.findIndex(h => alive(h) && h.hp / h.hpMax < 0.55);
      if (low >= 0) for (const sp of ["Mender's Touch", 'Field Dressing']) {
        const i = g.party.findIndex(h => alive(h) && memorizedCount(h, sp) && !h.cd);
        if (i >= 0 && castSpell(g, i, sp, low).ok) break;
      }
      g.party.forEach((h, i) => {
        if (!alive(h) || h.cd > 0 || h.class !== 'Magister') return;
        if (['guard'].includes(MONSTERS[e.type].kind) && !e.slowMs && memorizedCount(h, 'Frostbind') && castSpell(g, i, 'Frostbind').ok) return;
        if (e.hp > 5 && memorizedCount(h, 'Cinder Dart')) castSpell(g, i, 'Cinder Dart');
      });
      const order = g.party.map((h, i) => i).sort((a, b) => (g.party[b].class === 'Cutpurse') - (g.party[a].class === 'Cutpurse'));
      for (const i of order) if (canAct(g, i).ok && enemyAhead(g)) heroAttack(g, i);
    }
    advance(g, 100); t += 100; g.msgs.length = 0;
    if (g.defeated) return { win: false, t, hp: 0, falls: g.party.filter(h => !alive(h)).length };
    if (!g.enemies.some(x => x.hp > 0)) break;
  }
  const win = !g.enemies.some(x => x.hp > 0);
  const hp = g.party.reduce((s, h, i) => s + (alive(h) ? h.hp : 0), 0) / startHp.reduce((a, b) => a + b, 0);
  return { win, t, hp, falls: g.party.filter(h => !alive(h)).length, total };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const runs = +process.argv.find(a => /^\d+$/.test(a)) || 200;
  const levels = (process.argv.find(a => a.startsWith('--levels=')) || '--levels=2,3').slice(9).split(',').map(Number);
  const difficulty = (process.argv.find(a => a.startsWith('--difficulty=')) || '--difficulty=normal').slice(13);
  for (const level of levels) {
    const rs = Array.from({ length: runs }, (_, i) => fightGuardroom(i + 1, level, difficulty));
    const wins = rs.filter(r => r.win), avg = f => (wins.length ? wins.reduce((s, r) => s + f(r), 0) / wins.length : 0);
    console.log(`level ${level} (${difficulty}): win ${Math.round(100 * wins.length / runs)}%` +
      `; winners end with ${Math.round(100 * avg(r => r.hp))}% of party HP, ${avg(r => r.falls).toFixed(2)} fallen, ${Math.round(avg(r => r.t) / 1000)}s`);
  }
}
