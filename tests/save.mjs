import assert from 'node:assert/strict';
import { loadCampaign } from '../js/data/floors.js';
import { tileAt } from '../js/map.js';
import { newGame, changeFloor, step, interact, look } from '../js/world.js';
import { quickStartParty, formParty } from '../js/party.js';
import { tick, createMonster } from '../js/combat.js';
import { advance, rest } from '../js/magic.js';
import { serialize, restore, saveGame, loadGame, readSave, describeSave, listSaves, SAVE_VERSION } from '../js/save.js';

class FakeStorage { constructor() { this.m = new Map(); } getItem(k) { return this.m.has(k) ? this.m.get(k) : null; } setItem(k, v) { this.m.set(k, String(v)); } }
const fresh = () => { const g = newGame(loadCampaign(), () => 0.5); g.party = formParty(quickStartParty()).party; return g; };

// ---- a played-in game: lots of changed state --------------------------------------------------------------------
const g = fresh();
g.map.grid[2][4] = 'd';                                          // floor 1: a door opened
g.bag.push('bronze'); g.rations = 7; g.lightMs = 4000; g.starving = true;
g.party[0].hp = 11; g.party[0].xp = 25; g.party[3].spellsMemorized = ["Cinder Dart"]; g.party[1].quickSlots[0] = { id: 'heal', name: 'healing potion' };
g.party[2].poisonMs = 3000;
g.enemies.splice(0, 2);                                          // two floor-1 monsters dead
g.map.plates[0].pressed = true; g.map.shrines[0].charges = 1; g.map.items.splice(0, 1);
g.map.switches[0].found = true; g.map.switches[0].on = true;
g.journal.push({ floor: 0, title: 'T', text: 'some text that is long enough' });
g.map.inscriptions[0].seen = true;
changeFloor(g, { floor: 2, x: 1, y: 1, dir: 1 });                 // go to the dark floor and mess with it
g.map.traps['9,2'].found = true; g.map.grid[2][11] = '.';
g.enemies[0].hp = 3; g.enemies[0].x = 14; g.enemies[0].slowMs = 500;
const onFloor3Alive = g.enemies.length;
g.x = 5; g.y = 2; g.dir = 3;

// ---- round trip through real JSON text ----------------------------------------------------------------------------
const text = JSON.stringify(serialize(g));
const r = restore(JSON.parse(text), () => 0.5);
assert.ok(r, 'a valid save restores');
assert.equal(r.floor, 2); assert.deepEqual([r.x, r.y, r.dir], [5, 2, 3]);
assert.equal(r.map.name, 'The Cinder Court'); assert.equal(r.map.dark, true);
assert.deepEqual(r.bag, ['bronze']); assert.equal(r.rations, 7); assert.equal(r.lightMs, 4000); assert.equal(r.starving, true);
assert.equal(r.party[0].hp, 11); assert.equal(r.party[0].xp, 25); assert.deepEqual(r.party[3].spellsMemorized, ['Cinder Dart']);
assert.deepEqual(r.party[1].quickSlots[0], { id: 'heal', name: 'healing potion' }); assert.equal(r.party[2].poisonMs, 3000);
assert.equal(r.journal.length, 1); assert.equal(r.journal[0].title, 'T');
// floor 1 (not the current floor) kept its changes
const f1 = r.floors[0];
assert.equal(tileAt(f1, 4, 2), 'd', 'opened door stays open');
assert.equal(f1.plates[0].pressed, true); assert.equal(f1.shrines[0].charges, 1); assert.equal(f1.items.length, g.floors[0].items.length);
assert.equal(f1.switches[0].on, true); assert.equal(f1.inscriptions[0].seen, true);
assert.equal(f1.enemies.length, g.floors[0].monsters.length - 2, 'monsters killed on a floor we left stay dead');
// floor 3 (current)
assert.equal(r.map.traps['9,2'].found, true); assert.equal(tileAt(r.map, 11, 2), '.', 'disarmed pit stays disarmed');
assert.equal(r.enemies.length, onFloor3Alive); assert.equal(r.enemies[0].hp, 3); assert.equal(r.enemies[0].x, 14); assert.equal(r.enemies[0].slowMs, 500);
assert.equal(r.enemies, r.map.enemies, 'the live enemy list is the floor\'s list');
// untouched floors are untouched
assert.equal(r.floors[1].enemies.length, g.floors[1].monsters.length); assert.equal(tileAt(r.floors[1], 13, 10), 'M');
assert.equal(r.floors[3].lamps.every(l => l.lit), true);
// static data is rebuilt from the floor definitions, not trusted from the file
assert.equal(r.map.stairs.length, 2); assert.deepEqual(Object.keys(r.floors[0].locks), ['10,2', '15,2']);

// ---- the restored game keeps playing -----------------------------------------------------------------------------------
r.enemies.length = 0;
const before = r.x; step(r, 1, 0); assert.equal(r.x, before - 1, 'dir W: stepping west works after restore');
advance(r, 100); assert.equal(r.lightMs, 3900);
look(r); r.party[0].cd = 0;
// saving again from the restored game gives an equivalent save
const again = JSON.parse(JSON.stringify(serialize(restore(JSON.parse(text), () => 0.5))));
const orig = JSON.parse(text); delete orig.savedAt; delete again.savedAt;
assert.deepEqual(again, orig, 'save -> load -> save is stable');
// no aliasing between the save data and the live game
const data = serialize(g); const live = restore(data, () => 0.5); live.party[0].hp = 1; live.map.grid[1][1] = '#';
assert.equal(data.party[0].hp, 11); assert.notEqual(data.floors[2].grid[1][1], '#');

// ---- storage: slots, autosave, errors --------------------------------------------------------------------------------------------
const st = new FakeStorage();
assert.deepEqual(listSaves(st).map(s => s.info), [null, null, null, null]);
assert.equal(saveGame(g, 2, st).ok, true); assert.equal(saveGame(fresh(), 'auto', st).ok, true);
const info = describeSave(2, st);
assert.equal(info.floorName, 'The Cinder Court'); assert.match(info.party, /Brannoch L1/); assert.equal(info.alive, 4);
assert.equal(describeSave('auto', st).floorName, 'The Barrow Halls');
assert.equal(describeSave(1, st), null);
let l = loadGame(2, st); assert.equal(l.ok, true); assert.equal(l.game.floor, 2);
l = loadGame('auto', st); assert.equal(l.game.floor, 0);
assert.deepEqual(loadGame(3, st), { ok: false, why: 'That slot is empty.' });
const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } };
assert.equal(saveGame(g, 1, throwing).ok, false); assert.match(saveGame(g, 1, throwing).why, /storage/);
assert.equal(loadGame(1, throwing).ok, false); assert.deepEqual(listSaves(throwing).map(s => s.info), [null, null, null, null]);

// ---- damaged and foreign saves are refused, never crash ---------------------------------------------------------------------------------
st.setItem('totlq.save.1', '{not json'); assert.match(loadGame(1, st).why, /damaged/);
assert.deepEqual(describeSave(1, st), { slot: 1, damaged: true }, 'unparseable text is damaged, not empty');
st.setItem('totlq.save.1', JSON.stringify({ ...data, v: SAVE_VERSION + 1 })); assert.match(loadGame(1, st).why, /damaged|version/);
assert.deepEqual(describeSave(1, st), { slot: 1, damaged: true });
for (const bad of [null, {}, { ...data, floors: [] }, { ...data, floor: 9 }, { ...data, dir: 7 }, { ...data, party: data.party.slice(1) }, { ...data, x: 'a' }, { ...data, rations: null }]) {
  assert.equal(restore(bad), null, 'rejects ' + JSON.stringify(bad).slice(0, 40));
}
const wrong = serialize(g); wrong.floors[0].grid[0] = 'xx';
st.setItem('totlq.save.1', JSON.stringify(wrong)); assert.match(loadGame(1, st).why, /damaged/, 'a grid of the wrong size is refused');

// ---- a mid-fight save keeps the fight --------------------------------------------------------------------------------------------------------
const f = fresh(); f.enemies.length = 0; f.enemies.push(createMonster('tomb_rat', 1, 2)); f.x = 1; f.y = 1; f.dir = 2; f.party[0].cd = 800;
const rf = restore(JSON.parse(JSON.stringify(serialize(f))), () => 0.9);
assert.equal(rf.enemies.length, 1); assert.equal(rf.party[0].cd, 800);
rf.enemies[0].atkCd = 0; tick(rf, 10); assert.ok(rf.party.some(h => h.hp < h.hpMax), 'restored monsters still attack');

// ---- a freed prisoner survives a save ---------------------------------------------------------------------------------
{
  const p = fresh(); changeFloor(p, { floor: 1, x: 3, y: 10, dir: 3 }); p.floors[1].grid[10][3] = 'd'; interact(p);
  assert.equal(p.party.length, 5);
  const back = restore(JSON.parse(JSON.stringify(serialize(p))));
  assert.ok(back, 'a five-hero save is valid');
  assert.equal(back.party.length, 5); assert.equal(back.party[4].name, 'Tavin'); assert.equal(back.party[4].npc, true);
  assert.equal(back.floors[1].npcs[0].freed, true, 'the cell stays empty after loading');
  assert.equal(back.floors[1].npcs[1].freed, false);
}

console.log('save ok');
