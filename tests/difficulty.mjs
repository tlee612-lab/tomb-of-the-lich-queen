// The difficulty setting: what each level changes, that Normal is exactly the original rules, and that it saves.
import assert from 'node:assert/strict';
import { loadMap } from '../js/map.js';
import { newGame } from '../js/world.js';
import { quickStartParty, formParty } from '../js/party.js';
import { DIFFICULTIES, DEFAULT_DIFFICULTY, DIFFICULTY_IDS, diff, setDifficulty } from '../js/difficulty.js';
import { tick } from '../js/combat.js';
import { loadCampaign } from '../js/data/floors.js';
import { rest } from '../js/magic.js';
import { serialize, restore, saveGame, loadGame } from '../js/save.js';

const script = (...v) => { const q = [...v]; return () => (q.length ? q.shift() : 0.5); };
function setup(rng = script(), monsters = []) {
  const m = loadMap(); m.monsters = monsters;
  const g = newGame(m, rng);
  g.party = formParty(quickStartParty()).party;
  return g;
}

// ---- the table -------------------------------------------------------------------------------------------------
assert.deepEqual(DIFFICULTY_IDS, ['easy', 'normal', 'hard']);
assert.equal(DEFAULT_DIFFICULTY, 'normal');
assert.ok(DIFFICULTIES.easy.enemyDmg < 1 && DIFFICULTIES.normal.enemyDmg === 1 && DIFFICULTIES.hard.enemyDmg > 1);
assert.ok(DIFFICULTIES.easy.restHeal > DIFFICULTIES.normal.restHeal && DIFFICULTIES.normal.restHeal > DIFFICULTIES.hard.restHeal);
assert.ok(DIFFICULTIES.easy.wanderer < DIFFICULTIES.normal.wanderer && DIFFICULTIES.normal.wanderer < DIFFICULTIES.hard.wanderer);
for (const d of Object.values(DIFFICULTIES)) assert.ok(d.name && d.text.length > 20 && d.rations >= 3, 'every level is described');

// ---- a game starts on Normal; unknown ids are refused, and a missing id behaves as Normal ----------------------------------
let g = setup();
assert.equal(g.difficulty, 'normal'); assert.equal(g.rations, 3);
assert.equal(setDifficulty(g, 'nightmare'), false); assert.equal(g.difficulty, 'normal');
delete g.difficulty; assert.equal(diff(g), DIFFICULTIES.normal, 'no id means Normal');
g = setup(); assert.equal(setDifficulty(g, 'easy', { fresh: true }), true);
assert.equal(g.rations, 4, 'a new Easy game starts with an extra ration');
assert.equal(setDifficulty(g, 'hard'), true); assert.equal(g.rations, 4, 'changing mid-game does not hand out or take rations');

// ---- monster damage: a rat bites for d4 (rng .5 -> 3), a natural 20 doubles it ---------------------------------------------------
const bite = level => {
  const g = setup(() => 0.99, [{ type: 'tomb_rat', x: 1, y: 2 }]);       // d20 = 20 (a crit), d4 = 4 -> 8 before the multiplier
  setDifficulty(g, level); g.x = 1; g.y = 1; g.dir = 2;
  g.enemies[0].atkCd = 0; tick(g, 10);
  return g.party[0].hpMax - g.party[0].hp + g.party[1].hpMax - g.party[1].hp;     // whoever it hit in the front row
};
assert.equal(bite('normal'), 8, 'Normal: unchanged');
assert.equal(bite('easy'), 5, 'Easy: 8 * 0.6 = 4.8, rounds to 5');
assert.equal(bite('hard'), 10, 'Hard: 8 * 1.3 = 10.4, rounds to 10');
const minimum = level => {
  const g = setup(script(0.0, 0.7, 0.5) /* target Brannoch, d20 = 15 (a hit), d4 = 3 */, [{ type: 'tomb_rat', x: 1, y: 2 }]);
  setDifficulty(g, level); g.x = 1; g.y = 1; g.dir = 2; g.enemies[0].atkCd = 0; tick(g, 10);
  return g.party[0].hpMax - g.party[0].hp + g.party[1].hpMax - g.party[1].hp;
};
assert.equal(minimum('normal'), 3); assert.equal(minimum('easy'), 2, '3 * 0.6 = 1.8, rounds to 2'); assert.equal(minimum('hard'), 4, '3 * 1.3 = 3.9, rounds to 4');

// ---- resting heals more on Easy and less on Hard; wanderers come less/more often ---------------------------------------------------
const rested = (level, roll) => {
  const g = setup(script(roll)); setDifficulty(g, level);
  g.party[0].hp = 1; const max = g.party[0].hpMax;
  rest(g); return { healed: g.party[0].hp - 1, max, interrupted: g.enemies.length > 0 };
};
let r = rested('normal', 0.9); assert.equal(r.healed, Math.ceil(r.max * 0.5)); assert.equal(r.interrupted, false);
r = rested('easy', 0.9);       assert.equal(r.healed, Math.ceil(r.max * 0.75), 'Easy heals three quarters');
r = rested('hard', 0.9);       assert.equal(r.healed, Math.ceil(r.max * 0.4), 'Hard heals two fifths');
assert.equal(rested('normal', 0.2).interrupted, true, 'a roll of .2 is a wanderer on Normal (chance .25)');
assert.equal(rested('easy', 0.2).interrupted, false, '... but not on Easy (chance .1)');
assert.equal(rested('easy', 0.05).interrupted, true);
assert.equal(rested('hard', 0.3).interrupted, true, '... and Hard interrupts at .3 (chance .35)');

// ---- it is saved with the game, and old or damaged values fall back to Normal ----------------------------------------------------------
g = setup(); setDifficulty(g, 'hard');
assert.equal(serialize(g).difficulty, 'hard');
const mem = new Map(), storage = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
g = newGame(loadCampaign(), script()); g.party = formParty(quickStartParty()).party; setDifficulty(g, 'easy');
assert.equal(saveGame(g, 1, storage).ok, true);
const back = loadGame(1, storage); assert.equal(back.ok, true); assert.equal(back.game.difficulty, 'easy');
const data = serialize(g); delete data.difficulty; assert.equal(restore(data).difficulty, 'normal', 'a save with no difficulty loads as Normal');
data.difficulty = 'bogus'; assert.equal(restore(data).difficulty, 'normal', 'an unknown difficulty loads as Normal');

console.log('difficulty ok');
