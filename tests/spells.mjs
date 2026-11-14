import assert from 'node:assert/strict';
import { loadMap } from '../js/map.js';
import { newGame } from '../js/world.js';
import { quickStartParty, formParty } from '../js/party.js';
import { gainXp, XP_LEVELS, heroDefense, tick } from '../js/combat.js';
import { castSpell, rest, memorizedCount } from '../js/magic.js';
import { loadoutFor, slotsFor } from '../js/spellbook.js';
import { SPELLS } from '../js/data/spells.js';
import { CLASSES } from '../js/data/classes.js';

function setup(monsters = []) {
  const m = loadMap(); m.monsters = monsters;
  const g = newGame(m, () => 0.5);
  g.party = formParty(quickStartParty()).party;     // 0 Brannoch, 1 Sela, 2 Ioreth (Votary), 3 Quillon (Magister)
  return g;
}
const at = (g, x, y, dir) => { g.x = x; g.y = y; g.dir = dir; };
const [B, S, I, Q] = [0, 1, 2, 3];
const ready = (g, i, ...spells) => { const h = g.party[i]; h.cd = 0; h.spellsMemorized = [...spells]; };

// every spell in the design exists, and every learnable one is in the data
for (const c of Object.values(CLASSES)) for (const s of [...c.spells, ...Object.values(c.learn || {}).flat()]) assert.ok(SPELLS[s], s);
assert.equal(Object.keys(SPELLS).length, 11, 'the 10 castable designed spells plus Field Dressing');

// --- learning by level, memorizing by plan -------------------------------------------------------------
let g = setup();
const quillon = g.party[Q], ioreth = g.party[I];
gainXp(g, quillon, XP_LEVELS[1]); gainXp(g, ioreth, XP_LEVELS[1]);
assert.equal(quillon.level, 2); assert.ok(quillon.spellsKnown.includes('Arc of Sparks'));
assert.ok(ioreth.spellsKnown.includes('Unbind'));
assert.equal(slotsFor(quillon), 2, 'a new spell does not by itself add a slot');
assert.ok(g.msgs.some(m => /learns Arc of Sparks/.test(m)));
quillon.plan = ['Arc of Sparks', 'Arc of Sparks'];
assert.deepEqual(loadoutFor(quillon), ['Arc of Sparks', 'Arc of Sparks']);
quillon.spellsMemorized = [];
assert.equal(rest(g).ok, true);
assert.deepEqual(quillon.spellsMemorized, ['Arc of Sparks', 'Arc of Sparks'], 'rest memorizes the plan');
quillon.plan = ['Nonsense'];
assert.deepEqual(loadoutFor(quillon), ['Cinder Dart', 'Frostbind'], 'a bad plan falls back to the default');
g = setup(); gainXp(g, g.party[Q], XP_LEVELS[4]);
assert.deepEqual(g.party[Q].spellsKnown, ['Cinder Dart', 'Frostbind', 'Arc of Sparks', 'Mirror Veil', 'Gale Burst', 'Dread Sight']);
gainXp(g, g.party[I], XP_LEVELS[2]);
assert.deepEqual(g.party[I].spellsKnown, ["Mender's Touch", 'Lantern Ward', 'Unbind', 'Bulwark']);

// --- Unbind -----------------------------------------------------------------------------------------------------
g = setup(); ready(g, I, 'Unbind', 'Unbind'); g.party[I].spellsKnown.push('Unbind');
assert.match(castSpell(g, I, 'Unbind', B).why, /not poisoned/);
assert.equal(memorizedCount(g.party[I], 'Unbind'), 2, 'a refused cast spends nothing');
g.party[B].poisonMs = 5000; g.party[S].webMs = 3000;
assert.equal(castSpell(g, I, 'Unbind', B).ok, true); assert.equal(g.party[B].poisonMs, 0);
g.party[I].cd = 0;
assert.equal(castSpell(g, I, 'Unbind', S).ok, true); assert.equal(g.party[S].webMs, 0);

// --- Bulwark ----------------------------------------------------------------------------------------------------
g = setup(); ready(g, I, 'Bulwark', 'Bulwark'); g.party[I].spellsKnown.push('Bulwark');
const def0 = heroDefense(g.party[B]);
assert.equal(castSpell(g, I, 'Bulwark', B).ok, true);
assert.equal(heroDefense(g.party[B]), def0 + 3);
g.party[I].cd = 0; assert.match(castSpell(g, I, 'Bulwark', B).why, /already shielded/);
tick(g, 21000); assert.equal(heroDefense(g.party[B]), def0, 'it wears off after twenty seconds');

// --- Mirror Veil ------------------------------------------------------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 2 }]); at(g, 1, 1, 2);
ready(g, Q, 'Mirror Veil'); g.party[Q].spellsKnown.push('Mirror Veil');
assert.equal(castSpell(g, Q, 'Mirror Veil', B).ok, true); assert.equal(g.party[B].veil, true);
g.party[S].hp = 0; g.party[I].hp = 0; g.party[Q].hp = 0;       // only Brannoch can be targeted
g.enemies[0].atkCd = 0; const hp = g.party[B].hp;
let tries = 0; while (g.party[B].veil && tries++ < 40) { g.rng = () => 0.99; tick(g, 900); }
assert.equal(g.party[B].veil, false, 'the veil is used up by the first hit');
assert.equal(g.party[B].hp, hp, 'and that hit did no damage');
assert.ok(g.msgs.some(m => /Mirror Veil shatters/.test(m)));

// --- Arc of Sparks ----------------------------------------------------------------------------------------------
g = setup([{ type: 'tomb_rat', x: 1, y: 2 }, { type: 'tomb_rat', x: 2, y: 2 }, { type: 'bone_wretch', x: 3, y: 3 }]);
at(g, 1, 1, 2); ready(g, Q, 'Arc of Sparks'); g.party[Q].spellsKnown.push('Arc of Sparks');
assert.equal(castSpell(g, Q, 'Arc of Sparks').ok, true);      // d6=4 + 3 wits = 7: both 6 HP rats fall
assert.equal(g.enemies.filter(e => e.hp > 0).length, 1, 'the spark leapt to the second rat');
assert.equal(g.enemies.find(e => e.hp > 0).type, 'bone_wretch', 'but only to one other enemy');

// --- Gale Burst -------------------------------------------------------------------------------------------------
g = setup([{ type: 'bone_wretch', x: 2, y: 2 }]); at(g, 1, 2, 1);
ready(g, Q, 'Gale Burst'); g.party[Q].spellsKnown.push('Gale Burst');
const w = g.enemies[0]; w.atkCd = 0; w.moveCd = 0;
assert.equal(castSpell(g, Q, 'Gale Burst').ok, true);
assert.ok(w.hp < MONSTER_HP(w)); assert.deepEqual([w.x, w.y], [3, 2], 'shoved back a step');
assert.ok(w.atkCd >= 1500 && w.moveCd >= 1500, 'and staggered');
function MONSTER_HP(e) { return e.hpMax; }
// blocked by a wall: it still hurts and staggers but cannot move
g = setup([{ type: 'bone_wretch', x: 3, y: 2 }]); at(g, 2, 2, 1);
ready(g, Q, 'Gale Burst'); g.party[Q].spellsKnown.push('Gale Burst');
assert.equal(castSpell(g, Q, 'Gale Burst').ok, true);
assert.deepEqual([g.enemies[0].x, g.enemies[0].y], [3, 2], 'a closed door stops the push');

// --- Dread Sight ------------------------------------------------------------------------------------------------
g = setup([{ type: 'bone_wretch', x: 1, y: 2 }, { type: 'tomb_rat', x: 3, y: 3 }]); at(g, 1, 1, 2);
ready(g, Q, 'Dread Sight'); g.party[Q].spellsKnown.push('Dread Sight');
assert.equal(castSpell(g, Q, 'Dread Sight').ok, true);
assert.ok(g.enemies.every(e => e.seen), 'nearby enemies are marked');
assert.match(g.msgs.at(-1), /18\/18 HP, defense 12; undead/);

console.log('spells ok');
