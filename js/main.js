import { loadMap, isWall, DX, DY, DIR_NAMES } from './map.js';
import { render } from './render.js';
import { QUICK_START_PARTY } from './party.js';

const map = loadMap();
const state = { ...map.start, party: QUICK_START_PARTY, busy: false };
const ctx = document.getElementById('view').getContext('2d');
ctx.imageSmoothingEnabled = false;

function log(msg) {
  const el = document.getElementById('log');
  el.textContent = msg + '\n' + el.textContent.split('\n').slice(0, 5).join('\n');
}

function move(f, r) {
  const rx = -DY[state.dir], ry = DX[state.dir];
  const nx = state.x + DX[state.dir] * f + rx * r;
  const ny = state.y + DY[state.dir] * f + ry * r;
  if (isWall(map, nx, ny)) { log('Blocked.'); return; }
  state.x = nx; state.y = ny;
}

const ACTIONS = {
  fwd: () => move(1, 0), back: () => move(-1, 0),
  strL: () => move(0, -1), strR: () => move(0, 1),
  turnL: () => { state.dir = (state.dir + 3) % 4; },
  turnR: () => { state.dir = (state.dir + 1) % 4; },
};
const KEYS = {
  w: 'fwd', ArrowUp: 'fwd', s: 'back', ArrowDown: 'back',
  a: 'strL', d: 'strR', q: 'turnL', ArrowLeft: 'turnL', e: 'turnR', ArrowRight: 'turnR',
};

function act(name) { ACTIONS[name](); draw(); }

addEventListener('keydown', e => {
  const a = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (a) { e.preventDefault(); act(a); }
});
document.querySelectorAll('#pad button').forEach(b =>
  b.addEventListener('click', () => act(b.dataset.act)));

function drawParty() {
  document.getElementById('party').innerHTML = state.party.map(h => `
    <div class="hero">
      <div class="nm">${h.name}</div>
      <div class="cl">${h.class} L${h.level} · ${h.row ? 'back' : 'front'}</div>
      <div class="bar"><i style="width:${(100 * h.hp) / h.hpMax}%"></i></div>
    </div>`).join('');
}

function draw() {
  render(ctx, map, state);
  document.getElementById('compass').textContent = DIR_NAMES[state.dir];
}

drawParty();
draw();
log('You enter the Barrow Halls. (W/S move, A/D sidestep, Q/E turn)');
window.__game = { state, map, act };
