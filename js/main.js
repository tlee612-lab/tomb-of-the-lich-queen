import { loadMap, DIR_NAMES } from './map.js';
import { newGame, step, turn, interact, look } from './world.js';
import { render } from './render.js';
import { runSetup, portraitHTML } from './setup.js';
import { heroAttack, canAct, enemyAhead, tick, retry, alive } from './combat.js';

const map = loadMap();
const game = newGame(map);
const $ = id => document.getElementById(id);
const canvas = $('view'), ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const logLines = [];
function flushMessages() {
  if (!game.msgs.length) return;
  while (game.msgs.length) logLines.unshift(game.msgs.shift());
  logLines.length = Math.min(logLines.length, 7);
  $('log').textContent = logLines.join('\n');
}

let started = false;
const locked = () => !started || game.paused || game.defeated;

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

function act(name) { if (locked()) return; ACTIONS[name](); flushMessages(); }

function togglePause() { if (started && !game.defeated) game.paused = !game.paused; }

addEventListener('keydown', e => {
  if (!started || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;            // typing in a form
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'p') { e.preventDefault(); togglePause(); return; }
  if (/^[1-4]$/.test(k)) { e.preventDefault(); attack(+k - 1); return; }
  if (e.target.tagName === 'BUTTON' && (k === ' ' || k === 'Enter')) return;   // let focused buttons click
  const a = KEYS[k];
  if (a) { e.preventDefault(); act(a); }
});
document.querySelectorAll('#pad button').forEach(b => b.addEventListener('click', () => act(b.dataset.act)));
canvas.addEventListener('click', () => {
  if (locked()) return;
  if (enemyAhead(game)) {                                    // click a monster: the first ready hero strikes
    const i = game.party.findIndex((_, i) => canAct(game, i).ok);
    if (i >= 0) attack(i);
  } else act('use');
});
$('retryBtn').addEventListener('click', () => { retry(game); flushMessages(); });

// ---- party panel: built once, then updated in place so buttons stay clickable -------------------
let cards = [];
function buildParty() {
  $('party').innerHTML = game.party.map((h, i) => `
    <div class="hero" data-i="${i}">
      ${portraitHTML(h)}
      <div class="nm">${h.name}</div>
      <div class="cl">${h.class} L<span class="lv"></span> · ${h.row ? 'back' : 'front'}</div>
      <div class="bar"><i class="hp"></i></div><div class="hpt"></div>
      <button type="button" class="atk" data-i="${i}"><span class="cdfill"></span><span class="wl">${h.weapon}</span><kbd>${i + 1}</kbd></button>
      <span class="dmg"></span>
    </div>`).join('') + '<div class="hero" style="grid-column:1/-1"><div class="cl bag"></div></div>';
  cards = [...document.querySelectorAll('.hero[data-i]')];
  cards.forEach(c => c.querySelector('.atk').addEventListener('click', () => attack(+c.dataset.i)));
}

function updateParty() {
  game.party.forEach((h, i) => {
    const c = cards[i], btn = c.querySelector('.atk'), can = canAct(game, i);
    c.classList.toggle('fallen', !alive(h));
    c.querySelector('.lv').textContent = h.level;
    c.querySelector('.hp').style.width = `${(100 * h.hp) / h.hpMax}%`;
    c.querySelector('.hpt').textContent = alive(h) ? `${h.hp}/${h.hpMax}` : 'Fallen';
    c.querySelector('.dmg').textContent = h.hurt ? h.hurt.text : '';
    c.querySelector('.cdfill').style.width = h.cdMax && h.cd > 0 ? `${(100 * h.cd) / h.cdMax}%` : '0';
    btn.disabled = !alive(h) || (!can.ok && /cannot reach/.test(can.why));
    btn.classList.toggle('ready', can.ok && !!enemyAhead(game));
  });
  document.querySelector('.bag').textContent = `Bag: ${game.bag.join(', ') || 'empty'}`;
}

function updateOverlay() {
  const show = game.paused || game.defeated;
  $('overlay').hidden = !show;
  $('overlayText').textContent = game.defeated ? 'THE PARTY HAS FALLEN' : 'PAUSED (P to resume)';
  $('retryBtn').hidden = !game.defeated;
}

let last = 0;
function loop(t) {
  tick(game, Math.min(100, t - last)); last = t;
  flushMessages();
  render(ctx, map, game, t);
  $('compass').textContent = DIR_NAMES[game.dir];
  updateParty(); updateOverlay();
  requestAnimationFrame(loop);
}

function begin(party) {
  game.party = party;
  started = true;
  $('game').hidden = false;
  buildParty();
  look(game);
  game.msgs.push('You enter the Barrow Halls. W/S move, A/D sidestep, Q/E turn, F use. Click a monster or press 1-4 to attack, P pauses.');
  last = performance.now();
  requestAnimationFrame(loop);
}

window.__game = { game, map, act, attack };
runSetup(begin);
