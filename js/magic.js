// Spells, resting, food, potions, shrines and the passive Sanctify aura. No DOM.
import { DX, DY, isSolid } from './map.js';
import { MONSTERS } from './data/monsters.js';
import { SPELLS } from './data/spells.js';
import { alive, enemyAhead, enemyAt, distances, createMonster, kill, dice, addFx, tick, strike, splitOoze } from './combat.js';
import { loadoutFor } from './spellbook.js';
import { diff } from './difficulty.js';
import { accessoryOf } from './data/gear.js';

const mod = v => Math.floor((v - 10) / 2);
const say = (g, m) => g.msgs.push(m);
const hurtText = (h, text) => { h.hurt = { text, ttl: 800, good: text.startsWith('+') }; };

export const HUNGER_MS = 150000;      // the party eats one ration this often
export const STARVE_MS = 20000;       // while starving, each hero loses 1 HP this often (never below 1)
export const SANCTIFY_MS = 2000;
export const REST_HEAL = 0.5;         // Normal: fraction of max HP restored by a full rest (js/difficulty.js has the others)
export const WANDERER_CHANCE = 0.25;  // Normal: chance a rest is interrupted

// ---- spells ----------------------------------------------------------------------------------

export function memorizedCount(h, name) { return h.spellsMemorized.filter(s => s === name).length; }

export function castSpell(g, i, name, targetIdx) {
  const h = g.party[i], sp = SPELLS[name];
  if (!h || !alive(h)) return { ok: false, why: 'fallen' };
  if (!sp || !h.spellsKnown.includes(name)) return { ok: false, why: `${h.name} does not know that spell.` };
  if ((h.cd || 0) > 0) return { ok: false, why: 'not ready' };
  if (!memorizedCount(h, name)) return { ok: false, why: `${h.name} has no ${name} memorized. Rest to restore spells.` };

  let target = null;
  if (sp.target === 'enemy') {
    target = enemyAhead(g);
    if (!target) return { ok: false, why: 'There is no enemy ahead.' };
  } else if (sp.target === 'ally') {
    target = g.party[targetIdx];
    if (!target || !alive(target)) return { ok: false, why: 'Choose a living ally.' };
    if (sp.heal && target.hp >= target.hpMax) return { ok: false, why: `${target.name} is unhurt.` };
    if (sp.cure && !target.poisonMs && !target.webMs) return { ok: false, why: `${target.name} is not poisoned or webbed.` };
    if (sp.defMs && target.bulwarkMs > 0) return { ok: false, why: `${target.name} is already shielded.` };
    if (sp.veil && target.veil) return { ok: false, why: `${target.name} is already veiled.` };
  }

  h.spellsMemorized.splice(h.spellsMemorized.indexOf(name), 1);          // spend the slot
  h.cdMax = h.cd = sp.cd;

  if (sp.push) {
    gale(g, h, name, sp);
  } else if (sp.chain) {
    zap(g, h, name, sp, target);
    const dist = e => Math.abs(e.x - target.x) + Math.abs(e.y - target.y);
    const next = g.enemies.filter(e => e.hp > 0 && e !== target && dist(e) <= 2).sort((a, b) => dist(a) - dist(b))[0];
    if (next) zap(g, h, name, sp, next);
  } else if (sp.dmg) {
    zap(g, h, name, sp, target);
  } else if (sp.sight) {
    dreadSight(g, h, name, target);
  } else if (sp.cure) {
    target.poisonMs = 0; target.webMs = 0; hurtText(target, '+');
    say(g, `${h.name}'s ${name} frees ${target.name} of poison and web.`);
  } else if (sp.defMs) {
    target.bulwarkMs = sp.defMs; hurtText(target, '+DEF');
    say(g, `${h.name}'s ${name} hardens ${target.name}'s guard.`);
  } else if (sp.veil) {
    target.veil = true; hurtText(target, 'veil');
    say(g, `${h.name} wraps ${target.name} in a Mirror Veil.`);
  } else if (sp.slowMs) {
    target.slowMs = sp.slowMs;
    say(g, `${h.name}'s ${name} slows the ${target.name}.`);
    addFx(g, target, 'slowed', '#7fd0ff');
  } else if (sp.heal) {
    const n = Math.max(1, dice(g, sp.heal) + mod(h.attrs[sp.stat]) + (accessoryOf(h).spell || 0)), gain = Math.min(n, target.hpMax - target.hp);
    target.hp += gain; hurtText(target, `+${gain}`);
    say(g, `${h.name} heals ${target.name} for ${gain}.`);
  } else if (sp.lightMs) {
    g.lightMs = sp.lightMs;
    let found = 0;
    for (const s of g.map.switches) {
      if (!s.found && Math.abs(s.x - g.x) + Math.abs(s.y - g.y) <= sp.reveal) { s.found = true; found++; }
    }
    for (const [k, trap] of Object.entries(g.map.traps)) {
      const [tx, ty] = k.split(',').map(Number);
      if (!trap.found && g.map.grid[ty][tx] === 'X' && Math.abs(tx - g.x) + Math.abs(ty - g.y) <= sp.reveal) { trap.found = true; found++; }
    }
    say(g, found ? `${h.name} casts ${name}. Hidden things shimmer into view!` : `${h.name} casts ${name}. The way brightens.`);
  }
  return { ok: true };
}

// One spell hit on one enemy. Returns true if it landed.
function zap(g, h, name, sp, e) {
  const dmg = Math.max(1, dice(g, sp.dmg) + mod(h.attrs[sp.stat]) + (accessoryOf(h).spell || 0));
  if (!strike(g, e, dmg)) { say(g, `${h.name}'s ${name} fizzles against the Queen's ward!`); return false; }
  say(g, `${h.name}'s ${name} ${sp.chain ? 'shocks' : sp.fire ? 'burns' : 'batters'} the ${e.name} for ${dmg}.`);
  addFx(g, e, String(dmg), sp.chain ? '#bfe6ff' : '#ff9a3c');
  if (e.hp <= 0) kill(g, e); else if (sp.fire) splitOoze(g, e);
  return true;
}

// Gale Burst: every enemy in the line ahead (three cells) is hit, then shoved back a step and staggered.
function gale(g, h, name, sp) {
  const line = [];
  for (let k = 1; k <= 3; k++) {
    const x = g.x + DX[g.dir] * k, y = g.y + DY[g.dir] * k;
    if (isSolid(g.map, x, y)) break;
    const e = enemyAt(g, x, y); if (e) line.push(e);
  }
  for (const e of line.reverse()) {                                  // farthest first so the rest have room
    if (!zap(g, h, name, sp, e) || e.hp <= 0) continue;
    const x = e.x + DX[g.dir], y = e.y + DY[g.dir];
    if (!isSolid(g.map, x, y) && !enemyAt(g, x, y) && !'<>X'.includes(g.map.grid[y]?.[x])) { e.x = x; e.y = y; }
    e.moveCd += 1500; e.atkCd += 1500;
  }
}

// Dread Sight: nearby enemies show a health bar until they fall; the target's weaknesses are written out.
function dreadSight(g, h, name, target) {
  for (const e of g.enemies) if (e.hp > 0 && Math.abs(e.x - g.x) + Math.abs(e.y - g.y) <= 6) e.seen = true;
  const t = MONSTERS[target.type], weak = [];
  if (t.undead) weak.push('undead, so Sanctify burns it');
  if (t.splits) weak.push('splits when burned');
  if (t.poison) weak.push('poisons');
  if (t.ranged) weak.push('shoots from range');
  if (t.wardedByLamps) weak.push(g.map.lamps.some(l => l.lit) ? 'warded while any lamp burns' : 'her ward is down');
  say(g, `${h.name}'s ${name}: the ${target.name} has ${target.hp}/${target.hpMax} HP, defense ${t.def}${weak.length ? '; ' + weak.join('; ') : ''}.`);
}

// ---- potions and quick slots --------------------------------------------------------------------

export function useQuick(g, i, slot) {
  const h = g.party[i], item = h?.quickSlots[slot];
  if (!h || !alive(h)) return { ok: false, why: 'fallen' };
  if (!item) return { ok: false, why: 'empty' };
  if ((h.cd || 0) > 0) return { ok: false, why: 'not ready' };
  if (item.id === 'heal') {
    if (h.hp >= h.hpMax) return { ok: false, why: `${h.name} is unhurt.` };
    const gain = Math.min(12, h.hpMax - h.hp);
    h.hp += gain; hurtText(h, `+${gain}`); say(g, `${h.name} drinks a healing potion (+${gain}).`);
  } else if (item.id === 'antidote') {
    if (!h.poisonMs) return { ok: false, why: `${h.name} is not poisoned.` };
    h.poisonMs = 0; say(g, `${h.name} drinks an antidote. The poison fades.`);
  } else if (item.id === 'return') {
    const fallen = g.party.find(x => !alive(x));
    if (!fallen) return { ok: false, why: 'Nobody has fallen.' };
    fallen.hp = Math.ceil(fallen.hpMax / 2); hurtText(fallen, `+${fallen.hp}`);
    say(g, `${h.name} pours a draught of return over ${fallen.name}, who rises!`);
  } else return { ok: false, why: 'Nothing happens.' };
  h.quickSlots[slot] = null; h.cdMax = h.cd = 800;
  return { ok: true };
}

// ---- shrines ----------------------------------------------------------------------------------------

export function useShrine(g) {
  const s = g.map.shrines.find(s => s.x === g.x && s.y === g.y);
  if (!s) return false;
  if (s.charges <= 0) { say(g, 'The shrine is spent. Its light has gone out.'); return true; }
  const fallen = g.party.filter(h => !alive(h));
  if (!fallen.length && g.party.every(h => h.hp >= h.hpMax && !h.poisonMs)) { say(g, 'The shrine hums, but you need nothing from it.'); return true; }
  s.charges--;
  for (const h of g.party) {
    if (!alive(h)) h.hp = Math.ceil(h.hpMax / 2); else h.hp = Math.min(h.hpMax, h.hp + 10);
    h.poisonMs = 0; h.webMs = 0;
    hurtText(h, '+');
  }
  say(g, `The shrine blazes. ${fallen.length ? fallen.map(h => h.name).join(', ') + ' rise' + (fallen.length === 1 ? 's' : '') + '! ' : ''}The party is mended.${s.charges ? '' : ' The light fades.'}`);
  return true;
}

// ---- resting and food -------------------------------------------------------------------------------

export function rest(g) {
  if (g.paused || g.defeated) return { ok: false, why: 'You cannot rest now.' };
  if (g.rations <= 0) { say(g, 'You have no food to rest on.'); return { ok: false, why: 'no food' }; }
  const dist = distances(g);
  if (g.enemies.some(e => e.hp > 0 && (dist[e.y][e.x] ?? 99) <= MONSTERS[e.type].aggro)) {
    say(g, 'You cannot rest with enemies near.'); return { ok: false, why: 'enemies near' };
  }
  g.rations--;
  // a wanderer may interrupt: it appears two or three steps away and the rest only half works
  let spawn = null;
  if (g.rng() < diff(g).wanderer) {
    const cells = [];
    for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++) {
      if (dist[y][x] >= 2 && dist[y][x] <= 3 && !enemyAt(g, x, y)) cells.push([x, y]);
    }
    if (cells.length) spawn = cells[Math.floor(g.rng() * cells.length)];
  }
  const factor = spawn ? 0.5 : 1;
  for (const h of g.party.filter(alive)) { h.hp = Math.min(h.hpMax, h.hp + Math.ceil(h.hpMax * diff(g).restHeal * factor)); if (!spawn) h.poisonMs = 0; }
  if (spawn) {
    g.enemies.push(createMonster('tomb_rat', spawn[0], spawn[1]));
    say(g, 'Something scrabbles in the dark. Your rest is cut short!');
  } else {
    for (const h of g.party) if (alive(h) && h.spellsKnown.length) h.spellsMemorized = loadoutFor(h);
    say(g, 'The party rests. Wounds close and spells are memorized anew.');
  }
  return { ok: true, interrupted: !!spawn };
}

// ---- time-based effects (hunger, light, Sanctify) --------------------------------------------------

export function advance(g, dt) {
  tick(g, dt);
  if (g.paused || g.defeated || g.won) return;
  if (g.lightMs > 0) g.lightMs = Math.max(0, g.lightMs - dt);

  g.hungerMs += dt;
  if (g.hungerMs >= HUNGER_MS) {
    g.hungerMs -= HUNGER_MS;
    if (g.rations > 0) { g.rations--; g.starving = false; say(g, `The party eats a ration. (${g.rations} left)`); }
    else if (!g.starving) { g.starving = true; say(g, 'The party is starving! Find food.'); }
  }
  if (g.starving && g.rations > 0) g.starving = false;                     // found food: hunger eases
  if (g.starving) {
    g.starveMs += dt;
    if (g.starveMs >= STARVE_MS) {
      g.starveMs -= STARVE_MS;
      for (const h of g.party.filter(alive)) h.hp = Math.max(1, h.hp - 1);   // hunger weakens but never kills
      say(g, 'Hunger gnaws at the party.');
    }
  }

  // Sanctify: a living Votary automatically burns adjacent undead
  const votary = g.party.find(h => alive(h) && h.class === 'Votary');
  if (votary) {
    g.sanctMs += dt;
    if (g.sanctMs >= SANCTIFY_MS) {
      g.sanctMs -= SANCTIFY_MS;
      for (const e of g.enemies) {
        if (e.hp <= 0 || !MONSTERS[e.type].undead || Math.abs(e.x - g.x) + Math.abs(e.y - g.y) !== 1) continue;
        if (!strike(g, e, votary.level)) continue;
        say(g, `Sanctify burns the ${e.name} for ${votary.level}.`);
        addFx(g, e, String(votary.level), '#ffe27a');
        if (e.hp <= 0) kill(g, e);
      }
    }
  }
}
