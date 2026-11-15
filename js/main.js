import { DIR_NAMES, DX, DY } from './map.js';
import { loadCampaign } from './data/floors.js';
import { newGame, step, turn, interact, look } from './world.js';
import { render } from './render.js';
import { drawMap } from './automap.js';
import { runSetup, portraitHTML } from './setup.js';
import { heroAttack, canAct, enemyAhead, retry, alive, heroDefense } from './combat.js';
import { WEAPONS } from './data/weapons.js';
import { GEAR, canUse } from './data/gear.js';
import { equip } from './gear.js';
import { castSpell, useQuick, rest, advance, memorizedCount, HUNGER_MS } from './magic.js';
import { SPELLS } from './data/spells.js';
import { slotsFor, loadoutFor } from './spellbook.js';
import { saveGame, loadGame, listSaves, describeSave } from './save.js';
import { createAudio } from './audio.js';
import { startAnim, animView, classifyMove } from './anim.js';
import { DIFFICULTIES, DIFFICULTY_IDS, setDifficulty, diff } from './difficulty.js';

// ---- storage: localStorage if the browser allows it, otherwise memory for this visit only ---------------------
function pickStorage() {
  try { localStorage.setItem('totlq.t', '1'); localStorage.removeItem('totlq.t'); return { store: localStorage, durable: true }; }
  catch { const m = new Map(); return { store: { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }, durable: false }; }
}
const { store: storage, durable } = pickStorage();
const audio = createAudio({ storage });

let game = newGame(loadCampaign());
const $ = id => document.getElementById(id);
const canvas = $('view'), ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const snapCanvas = document.createElement('canvas'); snapCanvas.width = canvas.width; snapCanvas.height = canvas.height;
const snapCtx = snapCanvas.getContext('2d');

// ---- messages, and the sounds that go with them ---------------------------------------------------------------
const logLines = [];
let wantAutosave = false;
function flushMessages() {
  if (!game.msgs.length) return;
  while (game.msgs.length) {
    const m = game.msgs.shift();
    logLines.unshift(m); audio.playForMessage(m);
    if (/party rests|shrine blazes/.test(m)) wantAutosave = true;
  }
  logLines.length = Math.min(logLines.length, 60);               // the log scrolls, so it keeps a good stretch of history
  $('log').textContent = logLines.join('\n');
}

let started = false, modalOpen = false;
const locked = () => !started || modalOpen || game.paused || game.defeated || game.won;

function attack(i) {
  if (locked()) return;
  const r = heroAttack(game, i);
  if (!r.ok && r.why !== 'not ready' && r.why !== 'fallen') game.msgs.push(r.why);
}

const ACTIONS = {
  fwd: () => step(game, 1, 0), back: () => step(game, -1, 0),
  strL: () => step(game, 0, -1), strR: () => step(game, 0, 1),
  turnL: () => turn(game, -1), turnR: () => turn(game, 1),
  use: () => { if (!interact(game)) game.msgs.push('Nothing to use here.'); },
};
const KEYS = {
  w: 'fwd', ArrowUp: 'fwd', s: 'back', ArrowDown: 'back',
  a: 'strL', d: 'strR', q: 'turnL', ArrowLeft: 'turnL', e: 'turnR', ArrowRight: 'turnR',
  f: 'use', ' ': 'use', Enter: 'use',
};

// ---- movement animation: presentation only, the move itself is already done -------------------------------------
let anim = null, animSnapshot = null;
const where = () => ({ floor: game.floor, x: game.x, y: game.y, dir: game.dir });
function act(name) {
  if (locked()) return;
  const before = where();
  snapCtx.drawImage(canvas, 0, 0);                              // the frame we are leaving, for dissolves
  ACTIONS[name]();
  flushMessages();
  const kind = classifyMove(before, where(), DX[before.dir], DY[before.dir]);
  if (kind) {
    anim = startAnim(kind, performance.now()); animSnapshot = kind === 'fade' ? snapCanvas : null;
    if (kind === 'fwd' || kind === 'back') audio.play('step');
  }
}

let pending = null;                       // an ally spell waiting for its target: { i, name }
function cancelTarget() { pending = null; $('party').classList.remove('targeting'); }
function doRest() { if (locked()) return; cancelTarget(); rest(game); flushMessages(); }
$('restBtn').addEventListener('click', doRest);
$('useBtn').addEventListener('click', () => act('use'));

function cast(i, name) {
  if (locked()) return;
  const sp = SPELLS[name];
  if (sp.target === 'ally') {
    if (!canAct(game, i).ok && canAct(game, i).why === 'fallen') return;
    pending = { i, name }; $('party').classList.add('targeting');
    game.msgs.push(`${name}: choose an ally (Esc cancels).`); return;
  }
  const r = castSpell(game, i, name);
  if (!r.ok && r.why !== 'not ready' && r.why !== 'fallen') game.msgs.push(r.why);
}
function quick(i, s) {
  if (locked()) return;
  const r = useQuick(game, i, s);
  if (!r.ok && !['not ready', 'fallen', 'empty'].includes(r.why)) game.msgs.push(r.why);
}
function togglePause() { if (started && !modalOpen && !game.defeated && !game.won) game.paused = !game.paused; }

// ---- sound ---------------------------------------------------------------------------------------------------------
function updateSoundButton() { $('soundBtn').innerHTML = `Sound ${audio.isMuted() ? 'off' : 'on'} <span class="k">(M)</span>`; }
function toggleSound() { audio.unlock(); audio.toggle(); updateSoundButton(); if (modalOpen) renderModal(); }
const firstGesture = () => { audio.unlock(); audio.startAmbient(); removeEventListener('pointerdown', firstGesture); removeEventListener('keydown', firstGesture); };
addEventListener('pointerdown', firstGesture); addEventListener('keydown', firstGesture);
$('soundBtn').addEventListener('click', toggleSound);

// ---- saving and loading ---------------------------------------------------------------------------------------------
let autoExists = !!describeSave('auto', storage), autoMs = 0, lastFloor = game.floor, armedSlot = null;
function autosave() {
  if (!started || game.defeated || game.won) return;
  autoExists = saveGame(game, 'auto', storage).ok || autoExists; autoMs = 0; wantAutosave = false;
}

function replaceGame(g, note) {
  game = g; game.paused = false; modalOpen = false; $('modal').hidden = true;
  cancelTarget(); anim = null; animSnapshot = null; lastFloor = game.floor; autoMs = 0; armedSlot = null;
  logLines.length = 0; $('log').textContent = '';
  started = true; $('game').hidden = false;
  buildParty(); look(game); game.msgs.push(note); flushMessages();
  ensureLoop();
}
function loadSlot(slot) {
  const r = loadGame(slot, storage);
  if (!r.ok) return r;
  replaceGame(r.game, `Loaded ${slot === 'auto' ? 'the autosave' : 'slot ' + slot}: ${r.game.map.name}.`);
  return r;
}
function saveSlot(slot) {
  const r = saveGame(game, slot, storage);
  game.msgs.push(r.ok ? `Game saved to slot ${slot}.` : r.why); flushMessages();
  armedSlot = null; renderModal();
}

// ---- the menu: save slots, journal, help --------------------------------------------------------------------------------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let modalTab = 'menu', prePause = false;
function openModal(tab) {
  if (!started) return;
  if (!modalOpen) { prePause = game.paused; game.paused = true; }
  modalOpen = true; modalTab = tab; cancelTarget(); armedSlot = null;
  $('modal').hidden = false; renderModal();
}
function closeModal() { if (!modalOpen) return; modalOpen = false; $('modal').hidden = true; game.paused = prePause; armedSlot = null; }
function renderModal() {
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === modalTab));
  const body = $('tabBody');
  if (modalTab === 'menu') {
    const rows = listSaves(storage).map(({ slot, info }) => {
      const label = slot === 'auto' ? 'Autosave' : `Slot ${slot}`;
      const what = !info ? '<small>empty</small>' : info.damaged ? '<small>damaged or from another version</small>'
        : `<small>${esc(info.floorName)} · ${esc(info.party)} · ${new Date(info.savedAt).toLocaleString()}</small>`;
      const save = slot === 'auto' ? '' : `<button type="button" data-save="${slot}">${armedSlot === slot ? 'Overwrite?' : 'Save'}</button>`;
      const load = info && !info.damaged ? `<button type="button" data-load="${slot}">Load</button>` : '';
      return `<div class="saverow"><div class="what"><b>${label}</b>${what}</div>${save}${load}</div>`;
    }).join('');
    body.innerHTML = `<h3>Save and load</h3>${rows}
      <p class="note">${durable ? 'Saves are kept in this browser. The game also saves itself every 30 seconds, when you change floors, and after resting.' : 'This browser blocks storage, so saves last only until you close this tab.'}</p>
      <h3>Sound</h3><button type="button" data-sound>Sound is ${audio.isMuted() ? 'off. Turn on' : 'on. Turn off'}</button>
      ${document.fullscreenEnabled ? `<h3>Screen</h3><button type="button" data-full>${document.fullscreenElement ? 'Leave full screen' : 'Full screen (hides the browser bar)'}</button>` : ''}
      <h3>Difficulty</h3><div class="diffrow">${DIFFICULTY_IDS.map(id => `<button type="button" data-diff="${id}"${diff(game) === DIFFICULTIES[id] ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"'}>${DIFFICULTIES[id].name}</button>`).join(' ')}</div>
      <p class="note">${esc(diff(game).text)} You can change this at any time, including after a defeat.</p>`;
  } else if (modalTab === 'inventory') {
    const mod = v => Math.floor((v - 10) / 2);
    const ITEM_NAMES = { bronze: 'bronze key', ember: 'ember key', jail: "jailer's key", cell: 'cell key', redgem: 'ruby', bluegem: 'sapphire' };
    const bag = game.bag.length ? game.bag.map(id => esc(ITEM_NAMES[id] || id)).join(', ') : 'nothing';
    const nextMeal = Math.max(0, Math.ceil((HUNGER_MS - game.hungerMs) / 1000)), mm = Math.floor(nextMeal / 60), ss = String(nextMeal % 60).padStart(2, '0');
    body.innerHTML = `<h3>Party</h3>
      <p class="note"><b>Bag:</b> ${bag}<br><b>Rations:</b> ${game.rations}${game.starving ? ' (starving!)' : ` (the party eats in ${mm}:${ss})`}<br>
      <b>Light:</b> ${game.lightMs > 0 ? Math.ceil(game.lightMs / 1000) + ' s of Lantern Ward left' : 'none cast'}<br>
      <b>Spare gear:</b> ${game.stash.length ? game.stash.map(id => esc(id)).join(', ') : 'none (look for weapons and armor in the tomb)'}</p>` +
      game.party.map(h => {
        const w = WEAPONS[h.weapon], [n, s, b] = w.dice, m = mod(h.attrs[w.stat]);
        const lo = Math.max(1, n + b + m), hi = Math.max(1, n * s + b + m), secs = (Math.max(300, Math.round(w.ms * (1 - 0.03 * mod(h.attrs.agility)))) / 1000).toFixed(1);
        const quick = h.quickSlots.map(q => (q ? esc(q.name) : 'empty')).join(', ');
        return `<div class="entry"><b>${esc(h.name)}${h.npc ? ' (joined)' : ''}</b>${h.class} level ${h.level} · HP ${h.hp}/${h.hpMax} · ${h.row ? 'back' : 'front'} row${alive(h) ? '' : ' · FALLEN'}<br>
          Weapon: ${h.weapon}, ${lo}-${hi} damage (${w.stat} ${m >= 0 ? '+' : ''}${m}), every ${secs} s${w.reach ? ', reaches from the back row' : w.ranged ? ', ranged' : ''}<br>
          Armor: ${esc(h.armorName || 'none')} (${h.armor || 0}) · Defense ${heroDefense(h)}${h.bulwarkMs > 0 ? ' (Bulwark)' : ''}${h.veil ? ' · Mirror Veil up' : ''}<br>
          Accessory: ${h.accessory ? `${esc(h.accessory)} (${esc(GEAR[h.accessory].text)})` : 'none'}<br>
          Quick slots: ${quick}${h.poisonMs > 0 ? '<br>Poisoned' : ''}${h.webMs > 0 ? '<br>Webbed' : ''}
          ${[...new Set(game.stash)].filter(id => canUse(h, id)).map(id => `<br><button type="button" data-equip="${game.party.indexOf(h)}|${esc(id)}">Equip ${esc(id)}${GEAR[id].slot === 'armor' ? ` (armor ${GEAR[id].armor})` : GEAR[id].slot === 'accessory' ? ` (${esc(GEAR[id].text)})` : ''}</button>`).join('')}</div>`;
      }).join('');
  } else if (modalTab === 'spells') {
    const casters = game.party.map((h, i) => ({ h, i })).filter(({ h }) => slotsFor(h) > 0);
    body.innerHTML = '<h3>Memorize spells</h3><p class="note">Choose what each slot holds. Your choices take effect the next time the party rests.</p>' +
      casters.map(({ h, i }) => {
        const plan = loadoutFor(h);
        return `<div class="saverow"><div class="what"><b>${esc(h.name)}</b><small>${h.class} L${h.level}</small></div>` +
          plan.map((cur, s) => `<select data-plan="${i}:${s}" aria-label="${esc(h.name)} slot ${s + 1}">${h.spellsKnown.map(n => `<option value="${esc(n)}"${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`).join('') + '</div>' +
          `<p class="note">${h.spellsKnown.map(n => `<b>${esc(n)}</b>: ${esc(SPELLS[n].text)}`).join('<br>')}</p>`;
      }).join('');
  } else if (modalTab === 'map') {
    body.innerHTML = `<h3>${esc(game.map.name)}</h3><canvas id="fullmap" width="560" height="560"></canvas>` +
      '<p class="note">Only places the party has seen are shown. ▲ ▼ stairs, + shrine, * teleporter or spinner. Brown doors, red locked, purple gem door, grey gate.</p>';
    drawMap($('fullmap'), game);
  } else if (modalTab === 'journal') {
    if (!game.journal.length) body.innerHTML = '<p>Nothing recorded yet. Inscriptions you read are saved here automatically, so a clue is never lost.</p>';
    else {
      let html = '';
      game.floors.forEach((f, fi) => {
        const es = game.journal.filter(j => j.floor === fi);
        if (es.length) html += `<h3>${esc(f.name)}</h3>` + es.map(j => `<div class="entry"><b>${esc(j.title)}</b>${esc(j.text)}</div>`).join('');
      });
      body.innerHTML = html;
    }
  } else {
    body.innerHTML = `<h3>Controls</h3><table>
      <tr><td><kbd>W</kbd> <kbd>S</kbd></td><td>Step forward and back</td></tr>
      <tr><td><kbd>A</kbd> <kbd>D</kbd></td><td>Sidestep left and right</td></tr>
      <tr><td><kbd>Q</kbd> <kbd>E</kbd></td><td>Turn left and right</td></tr>
      <tr><td><kbd>F</kbd> / <kbd>Space</kbd> / click the view</td><td>Use what is in front: doors, switches, lamps, shrines (stand on one), pits. Click a monster to attack it.</td></tr>
      <tr><td><kbd>1</kbd>-<kbd>5</kbd></td><td>Attack with that hero (front row for melee; staffs and slings reach from the back)</td></tr>
      <tr><td>Spell buttons</td><td>Enemy spells fire at the monster ahead. Ally spells ask you to click a hero. <kbd>Esc</kbd> cancels.</td></tr>
      <tr><td><kbd>R</kbd></td><td>Rest (costs a ration, not with enemies near)</td></tr>
      <tr><td><kbd>P</kbd></td><td>Pause</td></tr>
      <tr><td><kbd>I</kbd></td><td>Inventory: the bag, rations and each hero's gear</td></tr>
      <tr><td><kbd>J</kbd></td><td>Journal</td></tr>
      <tr><td><kbd>M</kbd></td><td>Sound on or off</td></tr>
      <tr><td><kbd>Esc</kbd></td><td>This menu</td></tr></table>
      <h3>Hints</h3><p class="note">Inscriptions on the walls are recorded in the journal. A Cutpurse spots pits ahead and can disarm them with F, notices hidden switches up to three cells away, picks locked doors with F (it may take a few tries, and is the only way into a thieves' vault, a lock no key fits), and backstabs monsters that have not yet fought or are slowed. A Warden's Field Dressing mends an ally. Fire splits a Mire Ooze in two, so fight oozes with blades. Prisoners in the tomb can be freed with F once their cell is open; one of them can join as a fifth party member. A heavy iron-banded door with no handle opens only from its other side, and then stays open: a shortcut back. Lantern Ward lights dark floors and reveals hidden things. Shrines raise the fallen but have only two charges.</p>`;
  }
}
$('modal').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.tab) { modalTab = t.dataset.tab; armedSlot = null; renderModal(); }
  else if (t.id === 'closeModal') closeModal();
  else if (t.dataset.equip) {
    const [i, id] = t.dataset.equip.split('|'), r = equip(game, +i, id);
    if (!r.ok) game.msgs.push(r.why);
    flushMessages(); renderModal();
  }
  else if (t.dataset.full !== undefined) {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    Promise.resolve(p).catch(() => {}).finally(() => renderModal());
  }
  else if (t.dataset.sound !== undefined) toggleSound();
  else if (t.dataset.diff) {
    if (setDifficulty(game, t.dataset.diff)) { game.msgs.push(`Difficulty is now ${DIFFICULTIES[t.dataset.diff].name}.`); flushMessages(); renderModal(); }
  }
  else if (t.dataset.load) { const r = loadSlot(t.dataset.load === 'auto' ? 'auto' : +t.dataset.load); if (!r.ok) { game.msgs.push(r.why); flushMessages(); } }
  else if (t.dataset.save) {
    const slot = +t.dataset.save;
    if (describeSave(slot, storage) && armedSlot !== slot) { armedSlot = slot; renderModal(); } else saveSlot(slot);
  }
});
$('modal').addEventListener('change', e => {
  const sel = e.target.closest('select[data-plan]'); if (!sel) return;
  const [i, s] = sel.dataset.plan.split(':').map(Number), h = game.party[i];
  h.plan = loadoutFor(h); h.plan[s] = sel.value;
  game.msgs.push(`${h.name} will memorize ${sel.value} in slot ${s + 1} at the next rest.`); flushMessages();
});
$('menuBtn').addEventListener('click', () => openModal('menu'));
$('journalBtn').addEventListener('click', () => openModal('journal'));
$('minimap').addEventListener('click', () => openModal('map'));

addEventListener('keydown', e => {
  if (!started || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;            // typing in a form
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'Escape') { e.preventDefault(); if (pending) cancelTarget(); else if (modalOpen) closeModal(); else openModal('menu'); return; }
  if (k === 'i') { e.preventDefault(); if (modalOpen && modalTab === 'inventory') closeModal(); else openModal('inventory'); return; }
  if (k === 'j') { e.preventDefault(); if (modalOpen && modalTab === 'journal') closeModal(); else openModal('journal'); return; }
  if (k === 'n') { e.preventDefault(); if (modalOpen && modalTab === 'map') closeModal(); else openModal('map'); return; }
  if (k === 'm') { e.preventDefault(); toggleSound(); return; }
  if (modalOpen) return;
  if (k === 'p') { e.preventDefault(); togglePause(); return; }
  if (k === 'r') { e.preventDefault(); doRest(); return; }
  if (/^[1-5]$/.test(k)) { e.preventDefault(); attack(+k - 1); return; }
  if (e.target.tagName === 'BUTTON' && (k === ' ' || k === 'Enter')) return;   // let focused buttons click
  const a = KEYS[k];
  if (a) { e.preventDefault(); act(a); }
});
document.querySelectorAll('#pad button').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
// The on-screen controls over the view (phones): they act the instant a finger lands, and a hide switch clears them away.
document.querySelectorAll('#tl button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); act(b.dataset.act); }));
$('touchHide').addEventListener('click', () => $('touch').classList.toggle('off'));
// On phones the Rest / Menu / Journal / Sound buttons live in a narrow column left of the view; elsewhere they stay in the controls row.
const phoneMQ = matchMedia('(max-width:700px), (orientation:landscape) and (max-height:520px)');
const placeSys = () => { if (phoneMQ.matches) $('stage').insertBefore($('sys'), $('viewframe')); else $('nav').appendChild($('sys')); };
placeSys(); phoneMQ.addEventListener('change', placeSys);
// The minimap can be tucked away; the choice is remembered.
const setMapHidden = hide => { $('viewframe').classList.toggle('nomap', hide); try { localStorage.setItem('totlq.nomap', hide ? '1' : ''); } catch { /* not remembered */ } };
try { if (localStorage.getItem('totlq.nomap')) $('viewframe').classList.add('nomap'); } catch { /* storage unavailable */ }
$('mapHide').addEventListener('click', () => setMapHidden(!$('viewframe').classList.contains('nomap')));
canvas.addEventListener('click', () => {
  if (locked()) return;
  if (enemyAhead(game)) {                                    // click a monster: the first ready hero strikes
    const i = game.party.findIndex((_, i) => canAct(game, i).ok);
    if (i >= 0) attack(i);
  } else act('use');
});
$('retryBtn').addEventListener('click', () => { if (game.won) location.reload(); else { retry(game); flushMessages(); } });
$('loadBtn').addEventListener('click', () => { const r = loadSlot('auto'); if (!r.ok) { game.msgs.push(r.why); flushMessages(); } });

// ---- party panel: built once, then updated in place so buttons stay clickable -------------------
let cards = [];
function buildParty() {
  $('party').innerHTML = game.party.map((h, i) => `
    <div class="hero" data-i="${i}">
      ${portraitHTML(h)}
      <div class="nm">${esc(h.name)}</div>
      <div class="cl">${h.class} L<span class="lv"></span> · ${h.row ? 'back' : 'front'}<b class="st"></b></div>
      <div class="bar"><i class="hp"></i></div><div class="hpt"></div>
      <button type="button" class="atk" data-i="${i}"><span class="cdfill"></span><span class="wl">${h.weapon}</span><kbd>${i + 1}</kbd></button>
      ${h.spellsKnown.length ? `<div class="spells">${h.spellsKnown.map(s => `<button type="button" class="spell" data-s="${s}" title="${SPELLS[s].text}"><span class="sn">${s}</span><span class="sc"></span></button>`).join('')}</div>` : ''}
      <div class="quick"><button type="button" class="qs" data-q="0"></button><button type="button" class="qs" data-q="1"></button></div>
      <span class="dmg"></span>
    </div>`).join('') + '<div class="hero" style="grid-column:1/-1"><div class="cl bag"></div></div>';
  cards = [...document.querySelectorAll('.hero[data-i]')];
  cards.forEach(c => {
    const i = +c.dataset.i;
    c.querySelector('.atk').addEventListener('click', () => attack(i));
    c.querySelectorAll('.spell').forEach(b => b.addEventListener('click', () => cast(i, b.dataset.s)));
    c.querySelectorAll('.qs').forEach(b => b.addEventListener('click', () => quick(i, +b.dataset.q)));
    c.addEventListener('click', e => {                     // second click of a two-click ally spell
      if (!pending || e.target.closest('button')) return;
      const r = castSpell(game, pending.i, pending.name, i);
      if (!r.ok && r.why !== 'not ready') game.msgs.push(r.why);
      cancelTarget();
    });
  });
}

function updateParty() {
  if (cards.length !== game.party.length) buildParty();                  // a prisoner joined the fifth slot
  game.party.forEach((h, i) => {
    const c = cards[i], btn = c.querySelector('.atk'), can = canAct(game, i);
    c.classList.toggle('fallen', !alive(h));
    c.querySelector('.lv').textContent = h.level;
    c.querySelector('.st').textContent = `${h.poisonMs > 0 ? ' PSN' : ''}${h.webMs > 0 ? ' WEB' : ''}`;
    c.querySelector('.hp').style.width = `${(100 * h.hp) / h.hpMax}%`;
    c.querySelector('.hpt').textContent = alive(h) ? `${h.hp}/${h.hpMax}` : 'Fallen';
    const dm = c.querySelector('.dmg'); dm.textContent = h.hurt ? h.hurt.text : ''; dm.classList.toggle('good', !!h.hurt?.good);
    c.querySelectorAll('.spell').forEach(b => {
      const n = memorizedCount(h, b.dataset.s);
      b.querySelector('.sc').textContent = `x${n}`;
      b.disabled = !alive(h) || n === 0;
      b.classList.toggle('armed', !!pending && pending.i === i && pending.name === b.dataset.s);
    });
    c.querySelectorAll('.qs').forEach(b => {
      const it = h.quickSlots[+b.dataset.q];
      b.textContent = it ? it.name : '-'; b.disabled = !alive(h) || !it;
    });
    c.querySelector('.cdfill').style.width = h.cdMax && h.cd > 0 ? `${(100 * h.cd) / h.cdMax}%` : '0';
    btn.disabled = !alive(h) || (!can.ok && /cannot reach/.test(can.why));
    btn.classList.toggle('ready', can.ok && !!enemyAhead(game));
  });
  const mins = Math.floor(game.lightMs / 60000), secs = String(Math.floor(game.lightMs / 1000) % 60).padStart(2, '0');
  document.querySelector('.bag').textContent = `Bag: ${game.bag.join(', ') || 'empty'} | Rations: ${game.rations}${game.starving ? ' STARVING' : ''}${game.lightMs > 0 ? ` | Light ${mins}:${secs}` : ''}`;
}

function updateOverlay() {
  const show = (game.paused && !modalOpen) || game.defeated || game.won;
  $('overlay').hidden = !show;
  $('overlayText').textContent = game.won ? 'VICTORY!\nThe Lich Queen is destroyed and the princess is free.' : game.defeated ? 'THE PARTY HAS FALLEN' : 'PAUSED (P to resume)';
  $('retryBtn').hidden = !(game.defeated || game.won);
  $('retryBtn').textContent = game.won ? 'Play again' : 'Restart floor';
  $('loadBtn').hidden = !(game.defeated && autoExists);
}

// ---- the loop ---------------------------------------------------------------------------------------------------------------
let last = 0, looping = false;
function loop(t) {
  const dt = Math.min(100, t - last); last = t;
  advance(game, dt);
  flushMessages();
  if (!locked()) { autoMs += dt; if (game.floor !== lastFloor) { lastFloor = game.floor; autosave(); } else if (autoMs >= 30000 || wantAutosave) autosave(); }
  let view = {};
  if (anim) { view = animView(anim, t); if (view.done) { anim = null; animSnapshot = null; } else view.snapshot = animSnapshot; }
  render(ctx, game.map, game, t, view);
  drawMap($('minimap'), game, 5);
  $('compass').textContent = $('viewDir').textContent = DIR_NAMES[game.dir];
  $('floorName').textContent = `Floor ${game.floor + 1} of ${game.floors.length}: ${game.map.name}`;
  updateParty(); updateOverlay();
  requestAnimationFrame(loop);
}
function ensureLoop() { if (!looping) { looping = true; last = performance.now(); requestAnimationFrame(loop); } }

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});   // lets Chrome offer a real "Install app"
const MISSION ='The Lich Queen Veshara has taken a princess, Elowen, and keeps her alive in the deepest chamber of this tomb. Descend four floors. Solve what bars the way, rest when you must, and watch your food. In the Queen\'s chamber you will find three phylactery lamps; while any burns she cannot be harmed, so snuff them all, destroy her, and free the princess. Prisoners elsewhere in the tomb may be worth freeing too.';
function begin(party, difficulty = 'normal') {
  game.party = party;
  setDifficulty(game, difficulty, { fresh: true });
  started = true;
  $('game').hidden = false;
  buildParty();
  game.journal.push({ floor: 0, title: 'Your Mission', text: MISSION });
  look(game);
  game.msgs.push('The Lich Queen Veshara has taken a princess and keeps her in the deepest chamber of this tomb. Go down, destroy the Queen, and bring her out. (Your mission is in the journal: J)');
  game.msgs.push('You enter the Barrow Halls. W/S move, A/D sidestep, Q/E turn, F use. Click a monster or press 1-4 to attack, R rests, Esc opens the menu.');
  flushMessages();
  ensureLoop();                                     // no instant autosave: it would overwrite a previous run
}

updateSoundButton();
window.__game = { get game() { return game; }, get map() { return game.map; }, act, attack, storage };
runSetup(begin, { saves: listSaves(storage), onLoad: slot => loadSlot(slot) });
