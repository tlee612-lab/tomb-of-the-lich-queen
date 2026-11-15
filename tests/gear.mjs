import assert from 'node:assert/strict';
import { loadCampaign } from '../js/data/floors.js';
import { GEAR, START_GEAR, canUse } from '../js/data/gear.js';
import { WEAPONS } from '../js/data/weapons.js';
import { CLASSES } from '../js/data/classes.js';
import { newGame, step, changeFloor } from '../js/world.js';
import { quickStartParty, formParty } from '../js/party.js';
import { heroDefense, heroAttack, enemyAhead, createMonster } from '../js/combat.js';
import { equip } from '../js/gear.js';
import { castSpell } from '../js/magic.js';
import { MONSTERS } from '../js/data/monsters.js';
import { serialize, restore } from '../js/save.js';

const script = (...v) => { const q = [...v]; return () => (q.length ? q.shift() : 0.5); };
const fresh = rng => { const g = newGame(loadCampaign(), rng || script()); g.party = formParty(quickStartParty()).party; return g; };
const [B, S, I, Q] = [0, 1, 2, 3];

// ---- data is consistent ------------------------------------------------------------------------------------------
for (const [id, gear] of Object.entries(GEAR)) {
  assert.ok(gear.classes.length && gear.classes.every(c => CLASSES[c]), `${id}: real classes`);
  if (gear.slot === 'weapon') assert.ok(WEAPONS[id], `${id}: a weapon entry exists`);
  else if (gear.slot === 'armor') assert.ok(Number.isInteger(gear.armor), `${id}: armor has a value`);
  else assert.ok(gear.hp || gear.def || gear.dmg || gear.spell, `${id}: an accessory does something`);
}
for (const [cls, s] of Object.entries(START_GEAR)) {
  assert.equal(s.weapon, CLASSES[cls].weapon, `${cls} starts with its class weapon`);
  assert.equal(GEAR[s.armor].armor, CLASSES[cls].armor, `${cls} starts with its class armor`);
  assert.ok(canUse({ class: cls }, s.weapon) && canUse({ class: cls }, s.armor));
}
// every gear item placed in the dungeon is real, and every class has something to find
const placed = loadCampaign().flatMap(f => f.items).filter(i => i.kind === 'gear');
assert.ok(placed.length >= 8);
for (const i of placed) assert.ok(GEAR[i.id], `${i.id} is defined`);
for (const cls of Object.keys(CLASSES)) assert.ok(placed.some(i => canUse({ class: cls }, i.id) && GEAR[i.id].slot === 'weapon' || canUse({ class: cls }, i.id)), `${cls} has gear to find`);

// ---- picking up and equipping -------------------------------------------------------------------------------------
let g = fresh();
assert.equal(g.party[B].armorName, 'Scale Hauberk'); assert.deepEqual(g.stash, []);
g.floors[0].items.push({ x: 2, y: 1, kind: 'gear', id: 'Plate Harness', name: 'Plate Harness' });
g.x = 1; g.y = 1; g.dir = 1; step(g, 1, 0);
assert.deepEqual(g.stash, ['Plate Harness']); assert.match(g.msgs.at(-1), /Plate Harness.*Warden/);
const d0 = heroDefense(g.party[B]);
assert.match(equip(g, S, 'Plate Harness').why, /cannot use/); assert.deepEqual(g.stash, ['Plate Harness'], 'a refused swap changes nothing');
assert.equal(equip(g, B, 'Plate Harness').ok, true);
assert.equal(g.party[B].armor, 5); assert.equal(heroDefense(g.party[B]), d0 + 2);
assert.deepEqual(g.stash, ['Scale Hauberk'], 'the old armor goes back to the stash');
assert.match(equip(g, B, 'Plate Harness').why, /not carrying/);
assert.equal(equip(g, B, 'Scale Hauberk').ok, true); assert.equal(g.party[B].armor, 3, 'and can be put back on');

// weapons change the real attack
g = fresh(script(0.99, 0.99));                                        // a high roll to hit, top damage die
g.stash.push('Tombguard Sword');
equip(g, B, 'Tombguard Sword'); assert.equal(g.party[B].weapon, 'Tombguard Sword'); assert.ok(g.stash.includes('Broadsword'));
g.enemies.length = 0; g.enemies.push(createMonster('tomb_rat', 1, 2)); g.x = 1; g.y = 1; g.dir = 2;
g.party[B].cd = 0; g.enemies[0].hp = 99; g.enemies[0].hpMax = 99;
heroAttack(g, B); assert.equal(g.enemies[0].hp, 99 - (8 + 1 + 3) * 2, '(1d8+1 top roll + Might 16 bonus of 3) = 12, doubled by the natural 20');
// the Rune Staff uses Wits
g = fresh(); g.stash.push('Rune Staff'); equip(g, Q, 'Rune Staff');
assert.equal(WEAPONS[g.party[Q].weapon].stat, 'wits'); assert.equal(g.party[Q].weapon, 'Rune Staff');

// ---- accessories: the third slot -------------------------------------------------------------------------------------
g = fresh(); g.stash.push('Ring of Vigor', 'Charm of Warding', 'Ring of Keen Edge', 'Sage Pendant');
const hp0 = g.party[B].hpMax, def1 = heroDefense(g.party[B]);
assert.equal(equip(g, B, 'Ring of Vigor').ok, true);
assert.equal(g.party[B].hpMax, hp0 + 6); assert.equal(g.party[B].hp, hp0 + 6, 'a ring of vigor adds health at once');
assert.equal(equip(g, B, 'Charm of Warding').ok, true);                           // swaps the ring out
assert.equal(g.party[B].hpMax, hp0, 'its health bonus is taken back'); assert.ok(g.stash.includes('Ring of Vigor'));
assert.equal(heroDefense(g.party[B]), def1 + 1);
assert.match(equip(g, I, 'Ring of Keen Edge').why, /cannot use/); assert.match(equip(g, B, 'Sage Pendant').why, /cannot use/);
g.party[B].hp = 3; equip(g, B, 'Ring of Vigor'); equip(g, B, 'Charm of Warding'); assert.ok(g.party[B].hp >= 1 && g.party[B].hp <= g.party[B].hpMax, 'taking a ring off never kills');
// Keen Edge adds a point to every blow
g = fresh(script(0.99, 0.5)); g.stash.push('Ring of Keen Edge'); equip(g, B, 'Ring of Keen Edge');
g.enemies.length = 0; g.enemies.push(createMonster('tomb_rat', 1, 2)); g.x = 1; g.y = 1; g.dir = 2; g.party[B].cd = 0;
g.enemies[0].hp = 99; g.enemies[0].hpMax = 99; heroAttack(g, B);
assert.equal(g.enemies[0].hp, 99 - (5 + 3 + 1) * 2, 'd8 = 5, Might +3, ring +1 = 9, doubled by the crit');
// the Sage Pendant adds to spells (Cinder Dart 1d6+2 normally; rng .5 -> d6=4, +3 Wits, +1 pendant)
g = fresh(); g.stash.push('Sage Pendant'); equip(g, Q, 'Sage Pendant');
g.enemies.length = 0; g.enemies.push(createMonster('bone_wretch', 1, 2)); g.x = 1; g.y = 1; g.dir = 2;
castSpell(g, Q, 'Cinder Dart'); assert.equal(g.enemies[0].hp, MONSTERS.bone_wretch.hp - 10, '4 on the die + 2 + Wits 3 = 9, plus 1 from the pendant');

// ---- saves keep the stash and the equipment ---------------------------------------------------------------------------
g = fresh(); g.stash.push('Chain Mail', 'Stiletto'); equip(g, I, 'Chain Mail'); equip(g, S, 'Stiletto');
const back = restore(JSON.parse(JSON.stringify(serialize(g))));
assert.deepEqual(back.stash, g.stash); assert.equal(back.party[I].armorName, 'Chain Mail'); assert.equal(back.party[I].armor, 4);
assert.equal(back.party[S].weapon, 'Stiletto');

console.log('gear ok');
