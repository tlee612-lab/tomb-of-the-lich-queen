// Equipping gear from the party's shared stash. No DOM here, so it can be tested from Node.
import { GEAR, canUse } from './data/gear.js';

const say = (g, m) => g.msgs.push(m);

// Swap what hero `i` carries in the slot of `id` for the stash item `id`. The old piece goes back into the stash.
export function equip(g, i, id) {
  const h = g.party[i], at = g.stash.indexOf(id);
  if (!h) return { ok: false, why: 'No such hero.' };
  if (at < 0) return { ok: false, why: `The party is not carrying ${id}.` };
  if (!canUse(h, id)) return { ok: false, why: `${h.name}, a ${h.class}, cannot use the ${id}.` };
  const slot = GEAR[id].slot;
  g.stash.splice(at, 1);
  if (slot === 'weapon') { g.stash.push(h.weapon); h.weapon = id; }
  else if (slot === 'armor') { g.stash.push(h.armorName); h.armorName = id; h.armor = GEAR[id].armor; }
  else {                                                                       // accessory: its health bonus is added or taken back
    const old = h.accessory ? GEAR[h.accessory] : null;
    if (old) { g.stash.push(h.accessory); h.hpMax -= old.hp || 0; h.hp = Math.max(1, Math.min(h.hp, h.hpMax)); }
    h.accessory = id; h.hpMax += GEAR[id].hp || 0; h.hp += GEAR[id].hp || 0;
  }
  say(g, `${h.name} equips the ${id}.`);
  return { ok: true };
}
