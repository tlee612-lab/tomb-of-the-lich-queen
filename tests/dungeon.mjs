import assert from 'node:assert/strict';
import { loadCampaign } from '../js/data/floors.js';
import { tileAt } from '../js/map.js';
import { newGame, step, turn, interact, look, changeFloor } from '../js/world.js';
import { rosterHeroes, formParty, quickStartParty } from '../js/party.js';
import { heroAttack, tick, retry, createMonster, alive, kill } from '../js/combat.js';
import { advance, rest, useQuick, castSpell } from '../js/magic.js';

const script = (...v) => { const q = [...v]; return () => (q.length ? q.shift() : 0.5); };
const ROLL15 = 0.725;
const [N, E, S, W] = [0, 1, 2, 3];
function game(rng = script(), heroNames) {
  const g = newGame(loadCampaign(), rng);
  const all = rosterHeroes();
  g.party = formParty(heroNames ? heroNames.map(n => all.find(h => h.name === n)) : quickStartParty()).party;
  return g;
}
const goto = (g, floor, x, y, dir, keep = false) => {
  if (g.floor !== floor) changeFloor(g, { floor, x, y, dir });
  g.x = x; g.y = y; g.dir = dir;
  if (!keep) g.enemies.length = 0;               // by default start with an empty floor
};
const H = { brannoch: 0, sela: 1, ioreth: 2, quillon: 3 };

// --- stairs, and each floor remembers its monsters --------------------------------------------------------
let g = game();
assert.equal(g.map.name, 'The Barrow Halls');
const ratsBefore = g.enemies.length; assert.equal(ratsBefore, 7);
g.enemies[0].hp = 0; tick(g, 1);                                  // one monster dies
assert.equal(g.enemies.length, 6);
g.x = 12; g.y = 11; g.dir = S; g.enemies = g.enemies.filter(e => e.x !== 12);   // clear the way to the stairs
step(g, 1, 0);
assert.equal(g.floor, 1); assert.deepEqual([g.x, g.y, g.dir], [1, 1, E]); assert.match(g.msgs.at(-1), /Drowned Ossuary/);
assert.equal(g.enemies.length, 6, 'floor 2 has its own monsters');
const f2count = g.enemies.length;
step(g, 1, 0); step(g, -1, 0);                                    // off the stairs and back on
assert.equal(g.floor, 0); assert.deepEqual([g.x, g.y, g.dir], [12, 12, N]);
assert.ok(g.enemies.length <= 5, 'killed monsters stay dead on the floor you left');
assert.equal(g.floors[1].enemies.length, f2count);

// --- gem-socket door ------------------------------------------------------------------------------------------
g = game(); goto(g, 1, 13, 9, S);
assert.equal(tileAt(g.map, 13, 10), 'M');
interact(g); assert.match(g.msgs.at(-1), /sockets/); assert.equal(tileAt(g.map, 13, 10), 'M');
g.bag.push('redgem'); interact(g);
assert.deepEqual(g.bag, []); assert.match(g.msgs.at(-1), /sapphire/); assert.equal(tileAt(g.map, 13, 10), 'M');
g.bag.push('bluegem'); step(g, 1, 0);                             // bumping the door also sets gems
assert.equal(tileAt(g.map, 13, 10), 'd'); assert.match(g.msgs.join('|'), /blaze/);

// --- hidden pit traps: Cutpurse spots and disarms them -----------------------------------------------------
g = game(script(0.5)); goto(g, 2, 6, 2, E);
assert.equal(g.map.dark, true);
look(g); assert.equal(g.map.traps['9,2'].found, false, 'the Cutpurse only spots the very next cell');
g = game(script(0.5), ['Brannoch', 'Sela', 'Ioreth', 'Quillon']); goto(g, 2, 7, 2, E);
step(g, 1, 0);                                                   // to (8,2); the pit at (9,2) is now the next cell
assert.equal(g.map.traps['9,2'].found, true); assert.match(g.msgs.join('|'), /spots a pit/);
interact(g); assert.equal(tileAt(g.map, 9, 2), '.'); assert.match(g.msgs.at(-1), /disarms/);
const hpBefore = g.party.map(h => h.hp); step(g, 1, 0); step(g, 1, 0);
assert.deepEqual(g.party.map(h => h.hp), hpBefore, 'a disarmed pit does no harm');

g = game(script(0.5), ['Brannoch', 'Dagny', 'Ioreth', 'Quillon']); goto(g, 2, 8, 2, E);   // no Cutpurse
look(g); assert.equal(g.map.traps['9,2'].found, false);
g.party.forEach(h => { h.hp = h.hpMax; });
step(g, 1, 0);                                                   // falls into the pit: d6 with rng .5 = 4
assert.equal(g.x, 9); assert.deepEqual(g.party.map(h => h.hp), g.party.map(h => h.hpMax - 4));
assert.equal(g.map.traps['9,2'].found, true); assert.equal(tileAt(g.map, 9, 2), 'X');
g.party.forEach(h => { h.hp = 2; }); g.x = 8; g.dir = E; step(g, 1, 0);
assert.ok(g.party.every(h => h.hp === 1), 'a pit hurts but never kills');
g.x = 8; g.dir = E; interact(g); assert.match(g.msgs.at(-1), /Nobody here knows/);
// Lantern Ward reveals pits for a party with no Cutpurse
g = game(script(0.5), ['Brannoch', 'Dagny', 'Ioreth', 'Quillon']); goto(g, 2, 7, 2, E);
castSpell(g, H.ioreth, 'Lantern Ward'); assert.equal(g.map.traps['9,2'].found, true);

// --- ranged spiders web the party ------------------------------------------------------------------------------
g = game(() => 0.9); goto(g, 2, 13, 2, E);
g.enemies.push(createMonster('sepulchral_spider', 16, 2)); g.enemies[0].atkCd = 0;
tick(g, 10);
assert.deepEqual([g.enemies[0].x, g.enemies[0].y], [16, 2], 'the spider holds position and shoots');
const webbed = g.party.find(h => h.webMs > 0); assert.ok(webbed, 'someone is caught in a web');
webbed.cd = 1000; tick(g, 400); assert.equal(webbed.cd, 800, 'webbed heroes act at half speed');
assert.ok(g.party.filter(h => h.row === 0).some(h => h.hp < h.hpMax), 'the front row took the hit');
// out of line of fire: it closes in instead
g = game(() => 0.9); goto(g, 2, 13, 3, E);
g.enemies.push(createMonster('sepulchral_spider', 16, 1)); g.enemies[0].moveCd = 0;
tick(g, 10); assert.notDeepEqual([g.enemies[0].x, g.enemies[0].y], [16, 1], 'with no clear line it advances');

// --- poison: ticks, never kills, cured by rest, antidote, shrine ----------------------------------------------------------
g = game(() => 0.9); goto(g, 1, 7, 2, E);
g.enemies.push(createMonster('mire_ooze', 8, 2)); g.enemies[0].atkCd = 0;
tick(g, 10);
const poisoned = g.party.find(h => h.poisonMs > 0); assert.ok(poisoned);
g.enemies.length = 0; poisoned.hp = 3;
advance(g, 4000); assert.equal(poisoned.hp, 1, 'two ticks of poison');
advance(g, 4000); assert.equal(poisoned.hp, 1, 'poison cannot kill');
advance(g, 4000); assert.equal(poisoned.poisonMs, 0, 'it wears off');
poisoned.poisonMs = 5000; poisoned.quickSlots[0] = { id: 'antidote', name: 'antidote' }; poisoned.cd = 0;
assert.equal(useQuick(g, g.party.indexOf(poisoned), 0).ok, true); assert.equal(poisoned.poisonMs, 0);
poisoned.quickSlots[0] = { id: 'antidote', name: 'antidote' }; poisoned.cd = 0;
assert.match(useQuick(g, g.party.indexOf(poisoned), 0).why, /not poisoned/);
poisoned.poisonMs = 5000; g.rng = () => 0.9; rest(g); assert.equal(poisoned.poisonMs, 0, 'rest cures poison');

// --- wraiths strike the back row ------------------------------------------------------------------------------------------
g = game(() => 0.9); goto(g, 2, 14, 7, S);
g.enemies.push(createMonster('cinder_wraith', 14, 8)); g.enemies[0].atkCd = 0;
tick(g, 10);
assert.ok(g.party[H.ioreth].hp < g.party[H.ioreth].hpMax || g.party[H.quillon].hp < g.party[H.quillon].hpMax, 'a back-row hero was hit');
assert.ok(g.party[H.brannoch].hp === g.party[H.brannoch].hpMax && g.party[H.sela].hp === g.party[H.sela].hpMax);

// --- items: gems, bonus xp ------------------------------------------------------------------------------------------------------
g = game(); goto(g, 1, 9, 1, E); step(g, 1, 0);
assert.deepEqual(g.bag, ['redgem']); assert.match(g.msgs.at(-1), /ruby/);
g = game(); goto(g, 1, 14, 9, E); g.map.grid[9][14] = 'g'; step(g, 1, 0);
assert.ok(g.party.every(h => h.xp === 50), 'bonus xp goes to every living hero'); assert.match(g.msgs.join('|'), /drowned reliquary/);

// --- the Lich Queen -------------------------------------------------------------------------------------------------------------
g = game(); goto(g, 3, 7, 4, N, true);
g.enemies = g.map.enemies; const queen = g.enemies[0]; queen.x = 7; queen.y = 3;
assert.equal(queen.type, 'veshara');
g.rng = script(ROLL15, 0.5);
let r = heroAttack(g, H.brannoch);
assert.equal(r.warded, true); assert.equal(queen.hp, 70, 'lamps burning: no damage'); assert.match(g.msgs.at(-1), /lamps still burn/);
castSpell(g, H.quillon, 'Cinder Dart'); assert.equal(queen.hp, 70); assert.match(g.msgs.at(-1), /ward/);
// snuff the lamps one by one: the ward only breaks when all are dark
const snuff = (x, y, d) => { g.x = x; g.y = y; g.dir = d; return interact(g); };
snuff(3, 2, W); snuff(11, 2, E); assert.equal(g.map.lamps.filter(l => l.lit).length, 1);
g.x = 7; g.y = 4; g.dir = N; g.party.forEach(h => { h.cd = 0; }); g.rng = script(ROLL15, 0.5);
assert.equal(heroAttack(g, H.brannoch).warded, true, 'one lamp still burns');
snuff(7, 1, N); assert.ok(g.map.lamps.every(l => !l.lit)); assert.match(g.msgs.at(-1), /ward is broken/);
assert.equal(snuff(7, 1, N), true); assert.match(g.msgs.at(-1), /already dark/);
g.x = 7; g.y = 4; g.dir = N; g.party.forEach(h => { h.cd = 0; }); g.rng = script(ROLL15, 0.5);
r = heroAttack(g, H.brannoch); assert.equal(r.hit, true); assert.equal(queen.hp, 62);
// summons at 66% and 33%, once each
g.rng = script(0.3, 0.7, 0.4, 0.6, 0.2, 0.8, 0.5, 0.5);
queen.atkCd = 1e9; queen.hp = Math.floor(70 * 0.65); tick(g, 10);
assert.equal(g.enemies.filter(e => e.type === 'bone_wretch').length, 2); assert.match(g.msgs.join('|'), /dead claw up/);
tick(g, 10); assert.equal(g.enemies.filter(e => e.type === 'bone_wretch').length, 2, 'only once per phase');
queen.hp = Math.floor(70 * 0.3); tick(g, 10);
assert.equal(g.enemies.filter(e => e.type === 'bone_wretch').length, 4);
// she stays in her chamber and shoots from range
g = game(() => 0.9); goto(g, 3, 7, 6, N, true);
g.enemies = g.map.enemies; const q2 = g.enemies[0]; q2.atkCd = 0;
const hp0 = g.party.reduce((t, h) => t + h.hp, 0);
for (let i = 0; i < 300; i++) tick(g, 100);
assert.ok(q2.y <= 3 && q2.x >= 3 && q2.x <= 11, 'the Queen never leaves her chamber');
assert.ok(g.party.reduce((t, h) => t + h.hp, 0) < hp0, 'she hits the party from range');
// victory: the Queen falls, her summoned dead fall with her, floating text clears, the world freezes
g = game(); goto(g, 3, 7, 4, N, true); g.map.lamps.forEach(l => { l.lit = false; });
g.enemies = g.map.enemies; g.enemies[0].x = 7; g.enemies[0].y = 3; g.enemies[0].hp = 3;
g.enemies.push(createMonster('bone_wretch', 7, 1));
g.fx.push({ cell: { x: 7, y: 3 }, text: 'x', color: '#fff', ttl: 900, age: 0 });
assert.equal(g.won, false, 'not won while the Queen lives');
g.rng = script(ROLL15, 0.9); heroAttack(g, H.brannoch);
assert.equal(g.won, true); assert.match(g.msgs.join('|'), /You have won/);
assert.equal(g.enemies.length, 0, 'her summoned dead fall with her'); assert.equal(g.fx.length, 0, 'floating text is cleared');
const t0 = g.party[0].cd; tick(g, 5000); advance(g, 5000); assert.equal(g.party[0].cd, t0, 'the world freezes after victory');

// --- inscriptions and the journal ---------------------------------------------------------------------------------------------
g = game(); assert.equal(g.journal.length, 0);
goto(g, 0, 7, 3, S); g.x = 7; g.y = 3; g.dir = E;                    // beside the plaque at (7,0)? not yet: two cells south of it
look(g); assert.equal(g.journal.length, 0, 'not in front of it, not facing it');
g.x = 7; g.y = 2; g.dir = N; look(g);                                // facing north, wall two cells ahead
assert.equal(g.journal.length, 1); assert.equal(g.journal[0].title, 'The First Hall'); assert.equal(g.journal[0].floor, 0);
assert.match(g.msgs.at(-1), /journal/);
look(g); step(g, 1, 0); assert.equal(g.journal.length, 1, 'each inscription is recorded once');
g.x = 9; g.y = 6; g.dir = E; look(g);                                // standing in front of the plaque at (9,5) without facing it
assert.equal(g.journal.length, 2); assert.equal(g.journal[1].title, 'A Patient Hand');
g.x = 11; g.y = 8; g.dir = N; look(g);                               // the shrine plaque at (10,9) faces east, onto (11,9): not read from (11,8)
assert.equal(g.journal.length, 2);
g.x = 11; g.y = 9; g.dir = N; look(g); assert.equal(g.journal.length, 3, 'standing on the cell it faces counts');
goto(g, 3, 7, 10, N); look(g); assert.equal(g.journal.at(-1).floor, 3, 'arriving on the stairs reads the Queen\'s warning');
g.x = 6; g.y = 4; g.dir = N; look(g);
assert.equal(new Set(g.journal.map(j => j.title)).size, g.journal.length, 'no duplicates');
// a plaque behind a closed door is not read through it
g = game(); goto(g, 0, 7, 3, N); g.map.grid[1][7] = 'D'; g.x = 7; g.y = 3; look(g);
assert.equal(g.journal.length, 0, 'a solid cell in the way hides the wall behind it');

// --- retry stays on the current floor ---------------------------------------------------------------------------------------
g = game(); goto(g, 2, 14, 2, E);
g.party.forEach(h => { h.hp = 0; }); tick(g, 10); assert.equal(g.defeated, true);
retry(g);
assert.equal(g.floor, 2); assert.deepEqual([g.x, g.y], [1, 1]); assert.equal(g.enemies.length, 7, 'the floor is repopulated');
assert.ok(g.party.every(h => h.hp === h.hpMax && !h.poisonMs && !h.webMs));

console.log('dungeon ok');
