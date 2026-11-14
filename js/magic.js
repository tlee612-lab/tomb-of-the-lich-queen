// Spells, resting, food, potions, shrines and the passive Sanctify aura. No DOM.
import { DX, DY, isSolid } from './map.js';
import { MONSTERS } from './data/monsters.js';
import { SPELLS } from './data/spells.js';
import { alive, enemyAhead, enemyAt, distances, createMonster, kill, dice, addFx, tick } from './combat.js';
import { loadoutFor } from './spellbook.js';

const mod = v => Math.floor((v - 10) / 2);
const say = (g, m) => g.msgs.push(m);
const hurtText = (h, text) => { h.hurt = { text, ttl: 800, good: text.startsWith('+') }; };

export const HUNGER_MS = 150000;      // the party eats one ration this often
export const STARVE_MS = 20000;       // while starving, each hero loses 1 HP this often (never below 1)
export const SANCTIFY_MS = 2000;
export const REST_HEAL = 0.5;         // fraction of max HP restored by a full rest
export const WANDERER_CHANCE = 0.25;

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
    if (target.hp >= target.hpMax) return { ok: false, why: `${target.name} is unhurt.` };
  }

  h.spellsMemorized.splice(h.spellsMemorized.indexOf(name), 1);          // spend the slot
  h.cdMax = h.cd = sp.cd;

  if (sp.dmg) {
    const dmg = Math.max(1, dice(g, sp.dmg) + mod(h.attrs[sp.stat]));
    target.hp -= dmg; target.flash = 150;
    say(g, `${h.name}'s ${name} burns the ${target.name} for ${dmg}.`);
    addFx(g, target, String(dmg), '#ff9a3c');
    if (target.hp <= 0) kill(g, target);
  } else if (sp.slowMs) {
    target.slowMs = sp.slowMs;
    say(g, `${h.name}'s ${name} slows the ${target.name}.`);
    addFx(g, target, 'slowed', '#7fd0ff');
  } else if (sp.heal) {
    const n = Math.max(1, dice(g, sp.heal) + mod(h.attrs[sp.stat])), gain = Math.min(n, target.hpMax - target.hp);
    target.hp += gain; hurtText(target, `+${gain}`);
    say(g, `${h.name} heals ${target.name} for ${gain}.`);
  } else if (sp.lightMs) {
    g.lightMs = sp.lightMs;
    let found = 0;
    for (const s of g.map.switches) {
      if (!s.found && Math.abs(s.x - g.x) + Math.abs(s.y - g.y) <= sp.reveal) { s.found = true; found++; }
    }
    say(g, found ? `${h.name} casts ${name}. A hidden switch shimmers into view!` : `${h.name} casts ${name}. The way brightens.`);
  }
  return { ok: true };
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
  if (!fallen.length && g.party.every(h => h.hp >= h.hpMax)) { say(g, 'The shrine hums, but you need nothing from it.'); return true; }
  s.charges--;
  for (const h of g.party) {
    if (!alive(h)) h.hp = Math.ceil(h.hpMax / 2); else h.hp = Math.min(h.hpMax, h.hp + 10);
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
  if (g.rng() < WANDERER_CHANCE) {
    const cells = [];
    for (let y = 0; y < g.map.h; y++) for (let x = 0; x < g.map.w; x++) {
      if (dist[y][x] >= 2 && dist[y][x] <= 3 && !enemyAt(g, x, y)) cells.push([x, y]);
    }
    if (cells.length) spawn = cells[Math.floor(g.rng() * cells.length)];
  }
  const factor = spawn ? 0.5 : 1;
  for (const h of g.party.filter(alive)) h.hp = Math.min(h.hpMax, h.hp + Math.ceil(h.hpMax * REST_HEAL * factor));
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
  if (g.paused || g.defeated) return;
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
        e.hp -= votary.level; e.flash = 150;
        say(g, `Sanctify burns the ${e.name} for ${votary.level}.`);
        addFx(g, e, String(votary.level), '#ffe27a');
        if (e.hp <= 0) kill(g, e);
      }
    }
  }
}
