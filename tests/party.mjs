import assert from 'node:assert/strict';
import { createHero, rosterHeroes, quickStartParty, formParty, validateHeroInput } from '../js/party.js';

// every roster hero is valid under the same rules as created heroes
const roster = rosterHeroes();
assert.equal(roster.length, 6);
for (const h of roster) assert.ok(h.hp === h.hpMax && h.hpMax > 0, h.name);

// quick start: 4 heroes, 2 front 2 back, unique
const { errs, party } = formParty(quickStartParty());
assert.deepEqual(errs, []);
assert.deepEqual(party.map(h => h.row), [0, 0, 1, 1]);

// casters start with memorized spells, fighters do not
const by = n => roster.find(h => h.name === n);
assert.equal(by('Quillon').spellsMemorized.length, 2);
assert.equal(by('Brannoch').spellsMemorized.length, 0);

// creation rules
const ok = { name: 'Test', class: 'Warden', attrs: { might: 12, agility: 12, wits: 11, spirit: 11 } };
assert.ok(createHero(ok).hpMax > 0);
assert.ok(validateHeroInput({ ...ok, name: ' ' }).length);                                   // empty name
assert.ok(validateHeroInput({ ...ok, class: 'Bard' }).length);                               // unknown class
assert.ok(validateHeroInput({ ...ok, attrs: { might: 16, agility: 16, wits: 16, spirit: 16 } }).length); // too many points
assert.ok(validateHeroInput({ ...ok, attrs: { might: 17, agility: 8, wits: 8, spirit: 8 } }).length);   // above max
assert.throws(() => createHero({ ...ok, name: '' }));

// party rules
assert.ok(formParty(quickStartParty().slice(0, 3)).errs.length);
const dup = quickStartParty(); dup[1] = dup[0];
assert.ok(formParty(dup).errs.length);

console.log('party ok');
