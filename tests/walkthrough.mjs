// Plays the test map start to finish through js/world.js and checks each mechanic.
import assert from 'node:assert/strict';
import { loadMap, tileAt } from '../js/map.js';
import { newGame, step, turn, interact } from '../js/world.js';

const g = newGame(loadMap(), () => 0.6); // rng 0.6 -> spinner sets dir 2 (S)
const N = 0, E = 1, S = 2, W = 3;
const face = d => { g.dir = d; };
const walk = (d, n = 1) => { for (let i = 0; i < n; i++) { face(d); step(g, 1, 0); } };
const at = (x, y) => assert.deepEqual([g.x, g.y], [x, y], `expected (${x},${y}) got (${g.x},${g.y})`);
const last = () => g.msgs[g.msgs.length - 1];

// start room, plain door
walk(S); walk(E, 2); at(3, 2);
assert.equal(tileAt(g.map, 4, 2), 'D');
walk(E);                         // bump opens the door
assert.equal(tileAt(g.map, 4, 2), 'd'); at(3, 2);
walk(E, 3); at(6, 2);            // key room
assert.deepEqual(g.bag, ['bronze']); assert.match(g.msgs.join('|'), /bronze key/);

// locked door: refuses without the key, opens with it
const noKey = newGame(loadMap()); noKey.x = 7; noKey.y = 2; noKey.dir = E;
interact(noKey); assert.equal(tileAt(noKey.map, 8, 2), 'L'); assert.match(noKey.msgs.at(-1), /Locked/);
walk(E); at(7, 2);
face(E); interact(g); assert.equal(tileAt(g.map, 8, 2), 'd');

// pressure plate opens the gate south of the room
assert.equal(tileAt(g.map, 9, 4), 'G');
walk(E, 4); at(11, 2); assert.equal(tileAt(g.map, 9, 4), 'g');
walk(W, 2); walk(S, 4); at(9, 6);

// teleporter into the sealed west room
walk(E, 3); at(2, 6);
assert.equal(g.dir, N);

// hidden switch is only revealed when standing in front of it
const sw = g.map.switches[0]; assert.equal(sw.found, false);
walk(W); at(1, 6); assert.equal(sw.found, true);
assert.equal(tileAt(g.map, 7, 8), 'G');
face(W); interact(g); assert.equal(tileAt(g.map, 7, 8), 'g');

// spinner changes facing
walk(E, 3); at(4, 6); assert.equal(g.dir, S, 'spinner should have turned the party');
walk(E, 3); at(7, 6);
walk(S, 3); at(7, 9);
console.log('walkthrough ok:', g.msgs.length, 'messages, final', g.x + ',' + g.y);
