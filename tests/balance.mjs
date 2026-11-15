// Guard rails for the balance simulator (tools/balance.mjs) and for the difficulty it measures.
// These use few runs so they stay fast; run `npm run balance` for the real numbers (see docs/BALANCE.md).
import assert from 'node:assert/strict';
import { simulate, summarize, report, VARIANTS, PARTIES, PACES } from '../tools/balance.mjs';

// the simulator is deterministic: same seed, same game
const a = simulate(5, VARIANTS.careful, 'quick'), b = simulate(5, VARIANTS.careful, 'quick');
assert.deepEqual(a, b);
assert.notDeepEqual(simulate(6, VARIANTS.careless, 'quick'), simulate(7, VARIANTS.careless, 'quick'), 'different seeds play differently');

// every variant, party and pace completes without the bot getting stuck
for (const [name, v] of Object.entries(VARIANTS)) {
  assert.ok(PARTIES[v.party], `${name} has a party`);
  const r = simulate(1, v, 'quick');
  assert.ok(['won', 'defeated'].includes(r.outcome), `${name} finished: ${r.outcome}`);
  assert.ok(r.seconds > 30 && r.seconds < 3600, `${name} took a plausible time`);
}
for (const pace of Object.keys(PACES)) assert.ok(['won', 'defeated'].includes(simulate(2, VARIANTS.careful, pace).outcome));

// the difficulty the game is tuned to (docs/BALANCE.md). Small samples, so the bounds are loose.
const runs = (variant, pace, n = 10) => Array.from({ length: n }, (_, i) => simulate(i + 1, VARIANTS[variant], pace));
const careful = summarize('careful', runs('careful', 'human')), careless = summarize('careless', runs('careless', 'human'));
assert.ok(careful.winRate >= 0.7, `a careful player usually wins (got ${careful.winRate})`);
assert.ok(careless.winRate <= 0.3, `ignoring spells, potions and rest does not work (got ${careless.winRate})`);
assert.ok(careful.winRate - careless.winRate >= 0.4, 'playing well matters');
// floor 2 includes the optional prison fight for a player who takes everything, so it can outweigh floor 3
assert.ok(careful.floorDamage[0] < careful.floorDamage[1] && careful.floorDamage[0] < careful.floorDamage[2] && careful.floorDamage[2] < careful.floorDamage[3], 'damage climbs with depth');
assert.ok(careful.floorDamage[3] > careful.floorDamage[0] * 3, 'the finale is far harder than the first floor');
assert.ok(careful.rests >= 1.5, 'resting is part of a normal run');
assert.ok(careful.potions >= 0.5, 'potions get used');
assert.ok(careful.queenSeconds >= 30, 'the Queen fight is not over in a blink');
assert.ok(report([careful, careless]).includes('| careful |'), 'the report renders');

console.log('balance ok:', `careful ${Math.round(careful.winRate * 100)}% vs careless ${Math.round(careless.winRate * 100)}% at human pace`);
