import { loadMap, DIR_NAMES } from './map.js';
import { newGame, step, turn, interact, look } from './world.js';
import { render } from './render.js';
import { runSetup, portraitHTML } from './setup.js';

const map = loadMap();
const game = newGame(map);
const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const logLines = [];
function flushMessages() {
  while (game.msgs.length) logLines.unshift(game.msgs.shift());
  logLines.length = Math.min(logLines.length, 6);
  document.getElementById('log').textContent = logLines.join('\n');
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

function act(name) { ACTIONS[name](); flushMessages(); drawParty(); draw(); }

let started = false;
addEventListener('keydown', e => {
  if (!started || e.ctrlKey || e.metaKey || e.altKey) return;
  if (/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) return;   // typing or using a form control
  const a = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (a) { e.preventDefault(); act(a); }
});
document.querySelectorAll('#pad button').forEach(b =>
  b.addEventListener('click', () => act(b.dataset.act)));
canvas.addEventListener('click', () => act('use'));   // click the view to use what is in front

function drawParty() {
  document.getElementById('party').innerHTML = game.party.map(h => `
    <div class="hero">
      ${portraitHTML(h)}
      <div class="nm">${h.name}</div>
      <div class="cl">${h.class} L${h.level} · ${h.row ? 'back' : 'front'}</div>
      <div class="bar"><i style="width:${(100 * h.hp) / h.hpMax}%"></i></div>
    </div>`).join('') +
    `<div class="hero" style="grid-column:1/-1"><div class="cl">Bag: ${game.bag.join(', ') || 'empty'}</div></div>`;
}

function draw(t = performance.now()) {
  render(ctx, map, game, t);
  document.getElementById('compass').textContent = DIR_NAMES[game.dir];
}

function loop(t) { draw(t); requestAnimationFrame(loop); }   // animates teleporter pulse

function begin(party) {
  game.party = party;
  started = true;
  document.getElementById('game').hidden = false;
  look(game);
  drawParty();
  game.msgs.push('You enter the Barrow Halls. W/S move, A/D sidestep, Q/E turn, F or click to use.');
  flushMessages();
  requestAnimationFrame(loop);
}

window.__game = { game, map, act };
runSetup(begin);
