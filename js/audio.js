// Procedural sound with the Web Audio API: no asset files. soundsFor() maps a log message to an effect name.
export const MUTE_KEY = 'totlq.muted';

// First matching rule wins. Monster attacks start with "The ", party actions with a hero name.
const RULES = [
  [/You have won/, 'victory'],
  [/falls!|party has fallen/, 'death'],
  [/reaches level/, 'levelup'],
  [/^The .* (hits|webs|blasts) /, 'hurt'],
  [/^The .* (misses|shoots wide)/, 'miss'],
  [/ crits /, 'crit'],
  [/Sanctify burns|Cinder Dart|slows the|casts |glances off|fizzles/, 'spell'],
  [/ hits the | burns the /, 'hit'],
  [/ misses the /, 'miss'],
  [/ heals |drinks a healing|pours a draught|rises!|shrine blazes/, 'heal'],
  [/drinks an antidote/, 'heal'],
  [/pick up|takes the|You find|discover/, 'pickup'],
  [/^Click/, 'click'],
  [/into the door|blaze and the door|door creaks|key turns|grinds open|disarms|snuff|pull the switch|ward is broken/, 'door'],
  [/spin and lose|world lurches/, 'whoosh'],
  [/pit\.|tumbles/, 'thud'],
  [/You arrive at/, 'stairs'],
  [/party rests|Your rest is cut short/, 'rest'],
  [/eats a ration|gnaws|starving/, 'munch'],
  [/read an inscription|notice a hidden|spots a pit|shimmer/, 'scroll'],
  [/^Blocked|blocks the way|^Locked|will not budge|cannot reach|cannot rest|no food|has no .* memorized/, 'bump'],
];
export const soundsFor = msg => { for (const [re, name] of RULES) if (re.test(msg)) return name; return null; };

export function createAudio({ AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext, storage = null } = {}) {
  let ctx = null, master = null, drone = null, muted = false;
  const last = {};
  try { muted = storage?.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked: default to sound on */ }

  const ready = () => ctx && ctx.state !== 'closed';
  function unlock() {                                    // browsers only allow audio after a user gesture
    if (!AudioContextClass) return false;
    if (!ctx) {
      try { ctx = new AudioContextClass(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination); }
      catch { ctx = null; return false; }
    }
    if (ctx.state === 'suspended') ctx.resume?.();
    return true;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.2, to = null, at = 0 } = {}) {
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, { vol = 0.15, freq = 800, kind = 'lowpass', at = 0 } = {}) {
    const t = ctx.currentTime + at, n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = kind; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t);
  }
  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(n, step * 1.6, { ...opts, at: i * step }));

  const SOUNDS = {
    step:    () => noise(0.07, { vol: 0.1, freq: 300 }),
    bump:    () => tone(90, 0.1, { type: 'square', vol: 0.12 }),
    hit:     () => { noise(0.12, { vol: 0.2, freq: 900, kind: 'bandpass' }); tone(180, 0.12, { to: 70, type: 'triangle', vol: 0.2 }); },
    crit:    () => { noise(0.14, { vol: 0.25, freq: 1200, kind: 'bandpass' }); tone(220, 0.14, { to: 60, type: 'sawtooth', vol: 0.2 }); tone(660, 0.1, { vol: 0.15, at: 0.05 }); },
    miss:    () => noise(0.1, { vol: 0.08, freq: 2500, kind: 'highpass' }),
    hurt:    () => tone(150, 0.2, { to: 55, type: 'sawtooth', vol: 0.2 }),
    death:   () => tone(220, 0.7, { to: 40, type: 'sawtooth', vol: 0.25 }),
    spell:   () => { tone(500, 0.28, { to: 1000, vol: 0.15 }); tone(750, 0.28, { to: 1500, type: 'triangle', vol: 0.08 }); },
    heal:    () => arp([523, 659, 784], 0.08, { vol: 0.14 }),
    pickup:  () => tone(700, 0.12, { to: 1100, vol: 0.14 }),
    door:    () => { noise(0.28, { vol: 0.18, freq: 500 }); tone(70, 0.25, { type: 'triangle', vol: 0.18 }); },
    click:   () => tone(1300, 0.03, { type: 'square', vol: 0.1 }),
    whoosh:  () => noise(0.32, { vol: 0.16, freq: 1400, kind: 'bandpass' }),
    thud:    () => { tone(60, 0.22, { type: 'triangle', vol: 0.3 }); noise(0.15, { vol: 0.15, freq: 200 }); },
    stairs:  () => { tone(330, 0.3, { to: 220, type: 'triangle', vol: 0.16 }); noise(0.2, { vol: 0.06, freq: 400 }); },
    rest:    () => arp([262, 330, 392, 523], 0.18, { vol: 0.1, type: 'triangle' }),
    munch:   () => { noise(0.05, { vol: 0.12, freq: 1500 }); noise(0.05, { vol: 0.12, freq: 1500, at: 0.12 }); },
    scroll:  () => noise(0.16, { vol: 0.08, freq: 3000, kind: 'highpass' }),
    levelup: () => arp([523, 659, 784, 1047], 0.1, { vol: 0.16 }),
    victory: () => arp([392, 523, 659, 784, 1047, 784, 1047], 0.16, { vol: 0.18, type: 'triangle' }),
  };

  function play(name) {
    if (muted || !SOUNDS[name] || !unlock() || !ready()) return false;
    const now = ctx.currentTime;
    if (last[name] !== undefined && now - last[name] < 0.04) return false;     // never machine-gun one effect
    last[name] = now;
    try { SOUNDS[name](); return true; } catch { return false; }
  }

  function startAmbient() {                                // a faint, slowly swelling drone
    if (muted || drone || !unlock() || !ready()) return;
    try {
      const g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      g.gain.value = 0.035; lfo.frequency.value = 0.08; lg.gain.value = 0.015; lfo.connect(lg); lg.connect(g.gain);
      const a = ctx.createOscillator(), b = ctx.createOscillator();
      a.type = 'sine'; a.frequency.value = 55; b.type = 'triangle'; b.frequency.value = 82.6;
      a.connect(g); b.connect(g); g.connect(master); a.start(); b.start(); lfo.start();
      drone = { nodes: [a, b, lfo], gain: g };
    } catch { drone = null; }
  }
  function stopAmbient() { if (drone) { drone.nodes.forEach(n => { try { n.stop(); } catch { /* already stopped */ } }); drone = null; } }

  function setMuted(m) {
    muted = !!m;
    try { storage?.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* not persisted */ }
    if (muted) stopAmbient(); else startAmbient();
  }
  return { unlock, play, startAmbient, stopAmbient, setMuted, toggle: () => { setMuted(!muted); return muted; },
    isMuted: () => muted, playForMessage: msg => { const s = soundsFor(msg); return s ? play(s) : false; } };
}
