// Party selection and hero creation screen. Calls onStart(party) when the player confirms.
import { CLASSES, ATTRS, ATTR_BASE, ATTR_MAX, ATTR_POINTS } from './data/classes.js';
import { createHero, formParty, rosterHeroes, quickStartParty, validateHeroInput } from './party.js';

const $ = id => document.getElementById(id);
const STORE = 'totlq.customHeroes';

function loadCustom() {
  try { return (JSON.parse(localStorage.getItem(STORE)) || []).map(createHero); } catch { return []; }
}
function saveCustom(list) {
  try { localStorage.setItem(STORE, JSON.stringify(list)); } catch { /* storage unavailable: heroes last this visit only */ }
}

export function portraitHTML(h) {
  // Portrait hook: if a hero has a portrait path, show that image; otherwise a letter tile.
  return h.portrait
    ? `<div class="portrait"><img src="${h.portrait}" alt=""></div>`
    : `<div class="portrait">${h.name[0].toUpperCase()}</div>`;
}

export function runSetup(onStart, { saves = [], onLoad = null } = {}) {
  const custom = loadCustom();
  const heroes = () => [...rosterHeroes(), ...custom];
  let choice = quickStartParty().map(h => h.id);
  $('setup').hidden = false;

  const usable = saves.filter(s => s.info && !s.info.damaged);
  if (onLoad && usable.length) {                                // Continue: load a save instead of picking a party
    $('continue').hidden = false;
    $('continueList').innerHTML = usable.map(s => `<button type="button" data-slot="${s.slot}">${s.slot === 'auto' ? 'Autosave' : 'Slot ' + s.slot}: ${s.info.floorName} · ${s.info.party}</button>`).join('');
    $('continueList').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const slot = b.dataset.slot === 'auto' ? 'auto' : +b.dataset.slot, r = onLoad(slot);
      if (r.ok) $('setup').hidden = true; else $('continueErr').textContent = r.why;
    }));
  }

  function drawSlots() {
    const all = heroes();
    $('slots').innerHTML = choice.map((id, i) => {
      const h = all.find(x => x.id === id);
      const opts = all.map(o => `<option value="${o.id}"${o.id === id ? ' selected' : ''}>${o.name} (${o.class})</option>`).join('');
      return `<div class="slot">${portraitHTML(h)}
        <div class="row">${i < 2 ? 'Front row' : 'Back row'}</div>
        <select data-i="${i}" aria-label="Hero for slot ${i + 1}">${opts}</select>
        <div class="stats">${h.class} · HP ${h.hpMax}<br>MIG ${h.attrs.might} AGI ${h.attrs.agility} WIT ${h.attrs.wits} SPI ${h.attrs.spirit}</div></div>`;
    }).join('');
    $('slots').querySelectorAll('select').forEach(s => s.addEventListener('change', e => {
      choice[+e.target.dataset.i] = e.target.value; $('setupErr').textContent = ''; drawSlots();
    }));
  }

  // creator
  const form = { attrs: Object.fromEntries(ATTRS.map(a => [a, ATTR_BASE])) };
  $('cClass').innerHTML = Object.keys(CLASSES).map(c => `<option>${c}</option>`).join('');
  const spent = () => ATTRS.reduce((t, a) => t + form.attrs[a] - ATTR_BASE, 0);
  function drawCreator() {
    $('cBlurb').textContent = CLASSES[$('cClass').value].blurb;
    $('cAttrs').innerHTML = ATTRS.map(a => `<div class="attr"><span class="n">${a}</span>
      <button type="button" data-a="${a}" data-d="-1" aria-label="less ${a}">-</button>
      <b>${form.attrs[a]}</b>
      <button type="button" data-a="${a}" data-d="1" aria-label="more ${a}">+</button></div>`).join('');
    $('cPoints').textContent = `Points left: ${ATTR_POINTS - spent()}`;
    $('cAttrs').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.a, v = form.attrs[a] + +b.dataset.d;
      if (v < ATTR_BASE || v > ATTR_MAX || spent() + +b.dataset.d > ATTR_POINTS) return;
      form.attrs[a] = v; drawCreator();
    }));
  }
  $('cClass').addEventListener('change', drawCreator);
  $('createForm').addEventListener('submit', e => {
    e.preventDefault();
    const input = { name: $('cName').value, class: $('cClass').value, attrs: { ...form.attrs } };
    const errs = validateHeroInput(input);
    if (errs.length) { $('cErr').textContent = errs.join(' '); return; }
    const h = createHero(input);
    custom.push(h); saveCustom(custom);
    $('cErr').textContent = `${h.name} added. Pick them in a slot above.`; $('cName').value = '';
    drawSlots();
  });

  $('startBtn').addEventListener('click', () => {
    const { errs, party } = formParty(choice.map(id => heroes().find(h => h.id === id)));
    if (errs.length) { $('setupErr').textContent = errs.join(' '); return; }
    $('setup').hidden = true; onStart(party);
  });

  drawSlots(); drawCreator();
}
