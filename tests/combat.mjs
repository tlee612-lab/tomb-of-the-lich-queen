import assert from 'node:assert/strict';
import { loadMap } from '../js/map.js';
import { newGame, step } from '../js/world.js';
import { quickStartParty, formParty } from '../js/party.js';
import { MONSTERS } from '../js/data/monsters.js';
import { heroAttack, canAct, tick, retry, gainXp, enemyAhead, createMonster, alive, XP_LEVELS } from '../js/combat.js';

// scripted rng: takes values from a queue, then 0.5
const script = (...vals) => { const q = [...vals]; return () => (q.length ? q.shift() : 0.5); };
// d20 = floor(v*20)+1 ; die of s sides = floor(v*s)+1
const ROLL15 = 0.725, ROLL20 = 0.99, ROLL1 = 0.0;

function setup(monsters, rng) {
  const m = loadMap(); m.monsters = monsters;
  const g = newGame(m, rng);
  g.party = formParty(quickStartParty()).party;     // Brannoch, Sela (front) / Ioreth, Quillon (back)
  return g;
}
const at = (g, x, y, dir) => { g.x = x; g.y = y; g.dir = dir; };

// --- attacking needs a target in the cell ahead -------------------------------------------
let g = setup([{ type: 'tomb_rat', x: 1, y: 3 }], script());
at(g, 1, 1, 2);                                       // facing south, rat two cells away
assert.equal(enemyAhead(g), undefined);
assert.equal(heroAttack(g, 0).ok, false);
at(g, 1, 2, 2); assert.ok(enemyAhead(g));

// --- hit: d20=15, +1 level +3 might = 19 vs def 11; d8 roll 5 + 3 = 8 kills a 5hp rat ---------
g.rng = script(ROLL15, 0.5);
let r = heroAttack(g, 0);
assert.deepEqual([r.ok, r.hit, r.dmg], [true, true, 8]);
assert.equal(g.enemies.find(e => e.hp > 0), undefined);
assert.ok(g.party.filter(alive).every(h => h.xp === Math.ceil(MONSTERS.tomb_rat.xp / 4)), 'xp is split four ways');
assert.ok(g.msgs.some(m => /destroyed/.test(m)));

// --- cooldown ----------------------------------------------------------------------------------
g = setup([{ type: 'bone_wretch', x: 1, y: 3 }], script(ROLL15, 0.5, ROLL15, 0.5));
at(g, 1, 2, 2);
assert.equal(heroAttack(g, 0).ok, true);
const cd = g.party[0].cd; assert.ok(cd > 0);
assert.deepEqual(canAct(g, 0), { ok: false, why: 'not ready' });
tick(g, cd - 1); assert.equal(canAct(g, 0).ok, false);
tick(g, 1);      assert.equal(canAct(g, 0).ok, true);

// --- natural 1 always misses, natural 20 always hits for double --------------------------------
g = setup([{ type: 'bone_wretch', x: 1, y: 3 }], script(ROLL1));
at(g, 1, 2, 2);
assert.equal(heroAttack(g, 0).hit, false);
g.party[0].cd = 0; g.rng = script(ROLL20, 0.5);
r = heroAttack(g, 0); assert.equal(r.dmg, 16);        // (5 + 3) doubled

// --- back row: staff and sling reach, a mace does not ------------------------------------------
g.party.forEach(h => { h.cd = 0; });
assert.equal(canAct(g, 2).ok, true);                  // Ioreth, sling
assert.equal(canAct(g, 3).ok, true);                  // Quillon, staff
g.party[2].weapon = 'Mace';
assert.match(canAct(g, 2).why, /cannot reach/);

// --- fallen heroes cannot act and do not earn xp -----------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 3 }], script(ROLL15, 0.5));
at(g, 1, 2, 2); g.party[1].hp = 0;
assert.equal(canAct(g, 1).ok, false);
heroAttack(g, 0);
assert.equal(g.party[1].xp, 0); assert.equal(g.party[0].xp, Math.ceil(MONSTERS.tomb_rat.xp / 3));   // split among the three still standing

// --- levelling up --------------------------------------------------------------------------------
g = setup([], script());
const b = g.party[0], hp0 = b.hpMax;
gainXp(g, b, XP_LEVELS[1]);
assert.equal(b.level, 2); assert.ok(b.hpMax > hp0 && b.hp > hp0 - 1);
gainXp(g, b, 1000); assert.equal(b.level, 5, 'level cap is 5');

// --- enemies hunt, then attack the front row ---------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 3, y: 3 }], () => 0.9);   // d20=19, damage die 3
at(g, 1, 1, 2);
const hpBefore = g.party.map(h => h.hp);
for (let i = 0; i < 35; i++) tick(g, 100);          // 3.5s: it arrives, then bites a couple of times
const rat = g.enemies[0];
assert.equal(Math.abs(rat.x - 1) + Math.abs(rat.y - 1), 1, 'rat ends adjacent to the party');
assert.ok(g.party[0].hp < hpBefore[0] || g.party[1].hp < hpBefore[1], 'a front-row hero was hit');
assert.ok(g.party[0].hp > 0 && g.party[1].hp > 0, 'front row still standing');
assert.ok(g.party[2].hp === hpBefore[2] && g.party[3].hp === hpBefore[3], 'back row untouched');

// --- with the front row down, the back row takes hits ---------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 2 }], () => 0.9);
at(g, 1, 1, 2); g.party[0].hp = 0; g.party[1].hp = 0; g.enemies[0].atkCd = 0;
tick(g, 10);
assert.ok(g.party[2].hp < g.party[2].hpMax || g.party[3].hp < g.party[3].hpMax, 'back row hit once front is down');

// --- enemies do not path through walls or beyond aggro range ----------------------------------------
g = setup([{ type: 'tomb_rat', x: 13, y: 2 }], () => 0.5);
at(g, 1, 1, 2);
for (let i = 0; i < 50; i++) tick(g, 100);
assert.deepEqual([g.enemies[0].x, g.enemies[0].y], [13, 2], 'out of range rat stays put');

// --- movement is blocked by a monster ---------------------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 2 }], () => 0.5);
at(g, 1, 1, 2); step(g, 1, 0);
assert.deepEqual([g.x, g.y], [1, 1]); assert.match(g.msgs.at(-1), /blocks the way/);

// --- defeat and retry -----------------------------------------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 3, y: 3 }], () => 0.5);
g.party.forEach(h => { h.hp = 0; });
tick(g, 10); assert.equal(g.defeated, true);
retry(g);
assert.equal(g.defeated, false); assert.ok(g.party.every(h => h.hp === h.hpMax));
assert.deepEqual([g.x, g.y], [g.map.start.x, g.map.start.y]);

// --- pause freezes everything -------------------------------------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 3, y: 1 }], () => 0.5);
at(g, 1, 1, 1); g.paused = true; g.party[0].cd = 500;
tick(g, 10000);
assert.equal(g.party[0].cd, 500); assert.deepEqual([g.enemies[0].x, g.enemies[0].y], [3, 1]);

console.log('combat ok');
