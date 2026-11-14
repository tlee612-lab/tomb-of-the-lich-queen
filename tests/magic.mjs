import assert from 'node:assert/strict';
import { loadMap } from '../js/map.js';
import { newGame, step, interact } from '../js/world.js';
import { quickStartParty, formParty } from '../js/party.js';
import { gainXp, alive, XP_LEVELS } from '../js/combat.js';
import { castSpell, useQuick, rest, advance, memorizedCount, HUNGER_MS } from '../js/magic.js';
import { slotsFor } from '../js/spellbook.js';
import { MONSTERS } from '../js/data/monsters.js';

const script = (...v) => { const q = [...v]; return () => (q.length ? q.shift() : 0.5); };
function setup(monsters = [], rng = script()) {
  const m = loadMap(); m.monsters = monsters;
  const g = newGame(m, rng);
  g.party = formParty(quickStartParty()).party;     // 0 Brannoch, 1 Sela, 2 Ioreth (Votary), 3 Quillon (Magister)
  return g;
}
const at = (g, x, y, dir) => { g.x = x; g.y = y; g.dir = dir; };
const H = { brannoch: 0, sela: 1, ioreth: 2, quillon: 3 };

// --- slots ------------------------------------------------------------------------------------------
let g = setup();
assert.deepEqual(g.party[H.quillon].spellsMemorized, ['Cinder Dart', 'Frostbind']);
assert.deepEqual(g.party[H.brannoch].spellsMemorized, []);
gainXp(g, g.party[H.quillon], XP_LEVELS[2]);              // level 3: a third slot arrives
assert.equal(g.party[H.quillon].level, 3); assert.equal(slotsFor(g.party[H.quillon]), 3);
assert.equal(g.party[H.quillon].spellsMemorized.length, 3);

// --- Cinder Dart: needs a target, spends a slot, never misses -------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 3 }]);
at(g, 1, 1, 2);
let r = castSpell(g, H.quillon, 'Cinder Dart');
assert.equal(r.ok, false); assert.match(r.why, /no enemy/);
assert.equal(memorizedCount(g.party[H.quillon], 'Cinder Dart'), 1, 'failed cast spends nothing');
at(g, 1, 2, 2);
r = castSpell(g, H.quillon, 'Cinder Dart');              // rng .5 -> d6=4, +2, +3 wits = 9 vs 5hp rat
assert.equal(r.ok, true);
assert.equal(g.enemies.filter(e => e.hp > 0).length, 0);
assert.equal(memorizedCount(g.party[H.quillon], 'Cinder Dart'), 0);
assert.equal(castSpell(g, H.quillon, 'Cinder Dart').why, 'not ready');
advance(g, 2000);
assert.match(castSpell(g, H.quillon, 'Cinder Dart').why, /no Cinder Dart memorized/);
assert.match(castSpell(g, H.brannoch, 'Cinder Dart').why, /does not know/);

// --- Frostbind slows an enemy ----------------------------------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 3 }, { type: 'tomb_rat', x: 3, y: 3 }]);
at(g, 1, 1, 1);                                          // facing east, nothing adjacent ahead
g.enemies.forEach(e => { e.moveCd = 500; e.atkCd = 1e9; });
g.enemies[0].slowMs = 6000;
advance(g, 600);
assert.deepEqual([g.enemies[0].x, g.enemies[0].y], [1, 3], 'slowed rat has not moved yet');
assert.notDeepEqual([g.enemies[1].x, g.enemies[1].y], [3, 3], 'normal rat has moved');

// --- Mender's Touch --------------------------------------------------------------------------------------
g = setup();
g.party[H.brannoch].hp = 10;
assert.match(castSpell(g, H.ioreth, "Mender's Touch", H.sela).why, /unhurt/);
assert.equal(memorizedCount(g.party[H.ioreth], "Mender's Touch"), 1, 'no slot spent on an unhurt ally');
r = castSpell(g, H.ioreth, "Mender's Touch", H.brannoch);   // d8=5, +3 spirit -> 8
assert.equal(r.ok, true); assert.equal(g.party[H.brannoch].hp, 18);
g.party[H.sela].hp = 0; g.party[H.ioreth].cd = 0; g.party[H.ioreth].spellsMemorized = ["Mender's Touch"];
assert.match(castSpell(g, H.ioreth, "Mender's Touch", H.sela).why, /living ally/);
assert.equal(memorizedCount(g.party[H.ioreth], "Mender's Touch"), 1, 'no slot spent on a fallen ally');

// --- Lantern Ward reveals hidden switches nearby ----------------------------------------------------------------
g = setup(); at(g, 3, 6, 3);
const sw = g.map.switches[0]; assert.equal(sw.found, false);
r = castSpell(g, H.ioreth, 'Lantern Ward');
assert.equal(r.ok, true); assert.equal(sw.found, true); assert.ok(g.lightMs > 0);
advance(g, g.lightMs + 1); assert.equal(g.lightMs, 0);

// --- potions and quick slots -------------------------------------------------------------------------------------
g = setup(); at(g, 14, 3, 0);
g.map.items = [{ x: 14, y: 3, kind: 'potion', id: 'heal', name: 'healing potion' }];
step(g, 0, 0);                                           // no-op; pickups happen on entering, so step onto it
at(g, 14, 2, 2); step(g, 1, 0);
assert.deepEqual(g.party[H.brannoch].quickSlots[0], { id: 'heal', name: 'healing potion' });
assert.equal(g.map.items.length, 0);
g.party.forEach(h => { h.quickSlots = [{ id: 'x' }, { id: 'x' }]; });          // all full: potion stays on the floor
g.map.items = [{ x: 14, y: 2, kind: 'potion', id: 'heal', name: 'healing potion' }];
at(g, 14, 1, 2); step(g, 1, 0);
assert.equal(g.map.items.length, 1); assert.match(g.msgs.at(-1), /quick slot is full|every quick slot/);
g.party[H.brannoch].quickSlots = [{ id: 'heal', name: 'healing potion' }, null];
assert.match(useQuick(g, H.brannoch, 0).why, /unhurt/);
assert.deepEqual(g.party[H.brannoch].quickSlots[0], { id: 'heal', name: 'healing potion' }, 'not spent when unhurt');
g.party[H.brannoch].hp = 20; g.party[H.brannoch].cd = 0;
assert.equal(useQuick(g, H.brannoch, 0).ok, true);
assert.equal(g.party[H.brannoch].hp, 32); assert.equal(g.party[H.brannoch].quickSlots[0], null);
g.party[H.sela].hp = 0; g.party[H.ioreth].cd = 0; g.party[H.ioreth].quickSlots = [{ id: 'return', name: 'draught of return' }, null];
assert.equal(useQuick(g, H.ioreth, 0).ok, true);
assert.equal(g.party[H.sela].hp, Math.ceil(g.party[H.sela].hpMax / 2));
assert.match(useQuick(g, H.ioreth, 1).why, /empty/);

// --- rations ----------------------------------------------------------------------------------------------------------
g = setup(); at(g, 12, 1, 1); g.map.items = [{ x: 13, y: 1, kind: 'ration', name: 'rations', amount: 2 }];
const r0 = g.rations; step(g, 1, 0); assert.equal(g.rations, r0 + 2);

// --- resting --------------------------------------------------------------------------------------------------------------
g = setup([], script(0.9));                              // 0.9 >= 0.25: no interruption
const start = g.rations;
at(g, 1, 1, 2);
g.party[H.brannoch].hp = 10; g.party[H.quillon].spellsMemorized = []; g.party[H.sela].hp = 0;
r = rest(g);
assert.deepEqual([r.ok, r.interrupted], [true, false]);
assert.equal(g.rations, start - 1);
assert.equal(g.party[H.brannoch].hp, 10 + Math.ceil(g.party[H.brannoch].hpMax * 0.5));
assert.equal(g.party[H.quillon].spellsMemorized.length, 2, 'spells restored');
assert.equal(g.party[H.sela].hp, 0, 'rest does not revive the fallen');

g = setup([{ type: 'tomb_rat', x: 3, y: 3 }]); at(g, 1, 1, 2); const setupRations = g.rations;
assert.equal(rest(g).ok, false); assert.equal(g.rations, setupRations, 'refused with enemies near; no ration spent');
g = setup(); g.rations = 0; assert.equal(rest(g).ok, false);

g = setup([], script(0.1, 0.0));                         // 0.1 < 0.25: a wanderer interrupts; picks the first candidate cell
at(g, 1, 1, 2); g.party[H.quillon].spellsMemorized = []; g.party[H.brannoch].hp = 1;
r = rest(g);
assert.equal(r.interrupted, true); assert.equal(g.enemies.length, 1);
assert.equal(g.party[H.quillon].spellsMemorized.length, 0, 'interrupted rest does not restore spells');
assert.equal(g.party[H.brannoch].hp, 1 + Math.ceil(g.party[H.brannoch].hpMax * 0.25), 'half benefit');
const d = Math.abs(g.enemies[0].x - 1) + Math.abs(g.enemies[0].y - 1); assert.ok(d >= 2 && d <= 5);

// --- hunger: eat on a clock, then starve without ever dying ------------------------------------------------------------------
g = setup(); g.rations = 1;
advance(g, HUNGER_MS); assert.equal(g.rations, 0); assert.equal(g.starving, false);
advance(g, HUNGER_MS); assert.equal(g.starving, true);
const hp0 = g.party.map(h => h.hp);
advance(g, 20000); assert.deepEqual(g.party.map(h => h.hp), hp0.map(v => v - 1));
for (let i = 0; i < 100; i++) advance(g, 20000);
assert.ok(g.party.every(h => h.hp === 1), 'starvation stops at 1 HP');
g.rations = 2; advance(g, 100); assert.equal(g.starving, false);
g.paused = true; const before = g.hungerMs; advance(g, 99999); assert.equal(g.hungerMs, before, 'no hunger while paused');

// --- Sanctify ---------------------------------------------------------------------------------------------------------------
g = setup([{ type: 'bone_wretch', x: 1, y: 2 }, { type: 'tomb_rat', x: 2, y: 1 }]);
at(g, 1, 1, 2); g.enemies.forEach(e => { e.atkCd = 1e9; e.moveCd = 1e9; });
advance(g, 2000);
assert.equal(g.enemies.find(e => e.type === 'bone_wretch').hp, MONSTERS.bone_wretch.hp - 1, 'adjacent undead burned for the Votary level');
assert.equal(g.enemies.find(e => e.type === 'tomb_rat').hp, MONSTERS.tomb_rat.hp, 'living monsters unaffected');
g.party[H.ioreth].hp = 0; g.sanctMs = 0; advance(g, 4000);
assert.equal(g.enemies.find(e => e.type === 'bone_wretch').hp, MONSTERS.bone_wretch.hp - 1, 'no Sanctify without a living Votary');

// --- shrine -------------------------------------------------------------------------------------------------------------------------
g = setup(); at(g, 13, 5, 0);
assert.match((interact(g), g.msgs.at(-1)), /need nothing/);
g.party[H.sela].hp = 0; g.party[H.brannoch].hp = 5;
assert.equal(interact(g), true);
assert.equal(g.party[H.sela].hp, Math.ceil(g.party[H.sela].hpMax / 2)); assert.equal(g.party[H.brannoch].hp, 15);
assert.equal(g.map.shrines[0].charges, 1);
g.party[H.sela].hp = 0; interact(g); assert.equal(g.map.shrines[0].charges, 0);
g.party[H.sela].hp = 0; interact(g);
assert.equal(g.party[H.sela].hp, 0, 'a spent shrine does nothing'); assert.match(g.msgs.at(-1), /spent/);

console.log('magic ok');
