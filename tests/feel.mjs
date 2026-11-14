import assert from 'node:assert/strict';
import { soundsFor, createAudio, MUTE_KEY } from '../js/audio.js';
import { startAnim, animView, classifyMove, STEP_MS } from '../js/anim.js';

// ---- messages -> sounds: every message the rules can produce lands on a sensible effect -----------------------------------
const cases = {
  'Brannoch hits the Tomb Rat for 6.': 'hit', 'Sela crits the Bone Wretch for 12.': 'crit', 'Quillon misses the Bone Wretch.': 'miss',
  'The Tomb Rat hits Brannoch for 2.': 'hurt', 'The Bone Wretch misses Sela.': 'miss', 'The Sepulchral Spider webs Ioreth for 3.': 'hurt',
  "The Veshara blasts Sela for 5.": 'hurt', 'Sela falls!': 'death', 'The party has fallen...': 'death',
  "Quillon's Cinder Dart burns the Bone Wretch for 11.": 'spell', "Quillon's Frostbind slows the Tomb Rat.": 'spell',
  'Sanctify burns the Bone Wretch for 1.': 'spell', 'The Mire Ooze splits in two!': 'spell', 'Ioreth heals Brannoch for 9.': 'heal', 'Sela drinks a healing potion (+12).': 'heal',
  'Brannoch reaches level 2! (+7 max HP)': 'levelup', 'You pick up the bronze key.': 'pickup', 'Ioreth takes the antidote.': 'pickup',
  'You find 2 rations. (6 total)': 'pickup', 'You discover a forgotten cache! (+40 XP each)': 'pickup',
  'The door creaks open.': 'door', 'The bronze key turns. The door opens.': 'door', 'You pull the switch. Stone grinds somewhere.': 'door',
  'Click. Somewhere, a gate grinds open.': 'click', 'You spin and lose your bearings!': 'whoosh', 'The world lurches. You are elsewhere.': 'whoosh',
  'You arrive at The Cinder Court.': 'stairs', 'The party rests. Wounds close and spells are memorized anew.': 'rest',
  'The party eats a ration. (3 left)': 'munch', 'Hunger gnaws at the party.': 'munch', 'Blocked.': 'bump', 'Locked. It needs a bronze key.': 'bump',
  'A Tomb Rat blocks the way.': 'bump', 'You cannot rest with enemies near.': 'bump', 'You read an inscription, "The First Hall". (Saved to your journal: J)': 'scroll',
  'The floor gives way! The party tumbles into a pit.': 'thud', "You have won! Elowen is free, and the Lich Queen's tomb is silent at last.": 'victory',
  "Brannoch's blow glances off Veshara. Her lamps still burn!": 'spell',
};
for (const [msg, want] of Object.entries(cases)) assert.equal(soundsFor(msg), want, `"${msg}" -> ${want}`);
assert.equal(soundsFor('You enter the Barrow Halls.'), null);
assert.equal(soundsFor(''), null);

// ---- audio engine against a recording fake ----------------------------------------------------------------------------------------
function makeFake() {
  const log = { osc: 0, noise: 0, ctxs: 0, resumed: 0, started: 0 };
  class P { constructor() { this.value = 0; } setValueAtTime() {} exponentialRampToValueAtTime() {} }
  class Node { connect(n) { return n; } }
  class Ctx {
    constructor() { log.ctxs++; this.state = 'suspended'; this.currentTime = 0; this.sampleRate = 8000; this.destination = new Node(); }
    resume() { log.resumed++; this.state = 'running'; }
    createGain() { const n = new Node(); n.gain = new P(); return n; }
    createOscillator() { log.osc++; const n = new Node(); n.frequency = new P(); n.start = () => log.started++; n.stop = () => {}; return n; }
    createBiquadFilter() { const n = new Node(); n.frequency = new P(); return n; }
    createBuffer(c, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { log.noise++; const n = new Node(); n.start = () => log.started++; return n; }
  }
  return { Ctx, log };
}
const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };

let { Ctx, log } = makeFake(), st = store();
let a = createAudio({ AudioContextClass: Ctx, storage: st });
assert.equal(log.ctxs, 0, 'no audio context until the first sound (browsers need a user gesture)');
assert.equal(a.play('hit'), true); assert.equal(log.ctxs, 1); assert.ok(log.osc >= 1 && log.noise >= 1);
a.unlock(); a.unlock(); assert.equal(log.ctxs, 1, 'one context, however often we unlock');
assert.equal(a.play('nonsense'), false);
for (const name of ['step', 'bump', 'hit', 'crit', 'miss', 'hurt', 'death', 'spell', 'heal', 'pickup', 'door', 'click', 'whoosh', 'thud', 'stairs', 'rest', 'munch', 'scroll', 'levelup', 'victory'])
  assert.doesNotThrow(() => a.play(name), name);
assert.equal(a.playForMessage('Brannoch hits the Tomb Rat for 6.'), false, 'the same effect twice in one instant is dropped');
assert.equal(a.playForMessage('You enter the Barrow Halls.'), false);

// mute: silences effects, stops the drone, and is remembered
a.startAmbient(); const oscs = log.osc;
assert.equal(a.toggle(), true); assert.equal(a.isMuted(), true); assert.equal(st.m.get(MUTE_KEY), '1');
const before = log.osc; assert.equal(a.play('hurt'), false); assert.equal(log.osc, before, 'muted: nothing is synthesized');
a.startAmbient(); assert.equal(log.osc, before, 'muted: no drone');
assert.equal(a.toggle(), false); assert.equal(st.m.get(MUTE_KEY), '0');
assert.equal(createAudio({ AudioContextClass: Ctx, storage: (() => { const s = store(); s.setItem(MUTE_KEY, '1'); return s; })() }).isMuted(), true, 'mute survives a reload');

// no Web Audio, or storage that throws: the game must still run
assert.equal(createAudio({ AudioContextClass: null }).play('hit'), false);
class Broken { constructor() { throw new Error('no audio device'); } }
assert.equal(createAudio({ AudioContextClass: Broken }).play('hit'), false);
const thrower = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
a = createAudio({ AudioContextClass: makeFake().Ctx, storage: thrower });
assert.equal(a.isMuted(), false); assert.doesNotThrow(() => a.setMuted(true)); assert.equal(a.isMuted(), true);

// ---- animation timing -------------------------------------------------------------------------------------------------------------------------
assert.deepEqual(animView(null, 0), { cz: 0, fade: 0, done: true });
let f = startAnim('fwd', 1000);
assert.equal(animView(f, 1000).cz, 1); assert.equal(animView(f, 1000 + STEP_MS).cz, 0); assert.equal(animView(f, 1000 + STEP_MS).done, true);
const mid = animView(f, 1000 + STEP_MS / 2).cz; assert.ok(mid > 0.4 && mid < 0.6, 'smooth midpoint');
let prev = 2; for (let t = 0; t <= STEP_MS; t += 10) { const c = animView(f, 1000 + t).cz; assert.ok(c <= prev + 1e-9, 'monotonic'); prev = c; }
assert.equal(animView(startAnim('back', 0), 0).cz, -1);
assert.equal(animView(startAnim('fade', 0), 0).fade > 0.8, true); assert.equal(animView(startAnim('fade', 0), 9999).fade, 0);
assert.equal(animView(f, 1000 - 50).cz, 1, 'clock skew is clamped');

// classifying moves: forward/back/sidestep/turn/teleport/stairs/blocked
const at = (x, y, dir, floor = 0) => ({ x, y, dir, floor });
assert.equal(classifyMove(at(5, 5, 0), at(5, 4, 0), 0, -1), 'fwd');
assert.equal(classifyMove(at(5, 5, 0), at(5, 6, 0), 0, -1), 'back');
assert.equal(classifyMove(at(5, 5, 0), at(6, 5, 0), 0, -1), 'fade', 'sidestep');
assert.equal(classifyMove(at(5, 5, 0), at(5, 5, 1), 0, -1), 'fade', 'turn');
assert.equal(classifyMove(at(5, 5, 0), at(5, 5, 0), 0, -1), null, 'blocked: nothing to animate');
assert.equal(classifyMove(at(5, 5, 0), at(2, 7, 1), 0, -1), 'fade', 'teleporter');
assert.equal(classifyMove(at(5, 5, 0), at(5, 4, 3), 0, -1), 'fade', 'spinner');
assert.equal(classifyMove(at(5, 5, 0, 0), at(1, 1, 1, 1), 0, -1), 'fade', 'stairs');

console.log('feel ok');
