// Solves the whole campaign statically (no monsters, no luck) and checks the dungeon rules.
import assert from 'node:assert/strict';
import { loadCampaign } from '../js/data/floors.js';
import { DX, DY, tileAt } from '../js/map.js';
import { MONSTERS } from '../js/data/monsters.js';
import { SPELLS } from '../js/data/spells.js';
import { VAULT_LOCK } from '../js/world.js';
import { createHero } from '../js/party.js';
import { CLASSES } from '../js/data/classes.js';

const floors = loadCampaign();
const key = (x, y) => `${x},${y}`;
const WALK = new Set(['.', 'P', 'T', 'O', 'H', 'X', '<', '>', 'd', 'g', 'D']);   // D: bump to open

// ---- structural checks ------------------------------------------------------------------------------------
floors.forEach((f, fi) => {
  const here = `floor ${fi + 1} (${f.name})`;
  const ok = (x, y) => tileAt(f, x, y) !== '#' && tileAt(f, x, y) !== undefined;
  const walkable = (x, y) => WALK.has(tileAt(f, x, y));
  assert.ok(walkable(f.start.x, f.start.y), `${here}: start is walkable`);
  for (const i of f.items) assert.ok(walkable(i.x, i.y), `${here}: item ${i.name} at ${i.x},${i.y} is on a walkable cell`);
  for (const m of f.monsters) {
    assert.ok(MONSTERS[m.type], `${here}: unknown monster ${m.type}`);
    assert.ok(walkable(m.x, m.y) && !'<>X'.includes(tileAt(f, m.x, m.y)), `${here}: monster ${m.type} at ${m.x},${m.y} stands on open floor`);
  }
  for (const p of f.plates) { assert.equal(tileAt(f, p.x, p.y), 'P'); p.targets.forEach(([x, y]) => assert.equal(tileAt(f, x, y), 'G', `${here}: plate target is a gate`)); }
  for (const s of f.switches) {
    assert.equal(tileAt(f, s.x, s.y), '#', `${here}: switch is on a wall`);
    assert.ok(walkable(s.x + DX[s.face], s.y + DY[s.face]), `${here}: switch face opens onto walkable floor`);
    s.targets.forEach(([x, y]) => assert.equal(tileAt(f, x, y), 'G'));
  }
  for (const l of f.lamps) {
    assert.equal(tileAt(f, l.x, l.y), '#'); assert.ok(walkable(l.x + DX[l.face], l.y + DY[l.face]), `${here}: lamp is reachable`);
  }
  for (const t of f.teleports) { assert.equal(tileAt(f, t.x, t.y), 'T'); assert.ok(walkable(t.to.x, t.to.y)); }
  for (const [k, id] of Object.entries(f.locks)) {
    const [x, y] = k.split(',').map(Number); assert.equal(tileAt(f, x, y), 'L');
    if (id === VAULT_LOCK) {                                      // no key exists: only a Cutpurse opens it, and it guards a vault
      assert.ok(f.items.some(i => i.vault), `${here}: the lock at ${k} guards a vault`);
      continue;
    }
    assert.ok(floors.slice(0, fi + 1).some(g => g.items.some(i => i.id === id)), `${here}: key ${id} exists on this or an earlier floor`);
  }
  for (const n of f.npcs) {
    assert.ok(walkable(n.x, n.y), `${here}: prisoner ${n.name} stands on floor`);
    assert.ok(n.thanks && n.portrait && CLASSES[n.class], `${here}: prisoner ${n.name} is fully described`);
    assert.doesNotThrow(() => createHero({ id: n.id, name: n.name, class: n.class, attrs: n.attrs }), `${n.name} is a valid hero`);
    assert.ok(!f.monsters.some(m => m.x === n.x && m.y === n.y), `${here}: no monster stands on a prisoner`);
  }
  for (const [k, dir] of Object.entries(f.oneway)) {
    const [x, y] = k.split(',').map(Number); assert.equal(tileAt(f, x, y), 'W', `${here}: one-way door sits on a W tile`);
    assert.ok(walkable(x - DX[dir], y - DY[dir]) && walkable(x + DX[dir], y + DY[dir]), `${here}: both sides of the one-way door at ${k} are open floor`);
  }
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (tileAt(f, x, y) === 'W') assert.ok(f.oneway[key(x, y)] !== undefined, `${here}: W at ${x},${y} has a direction`);
  for (const [k, ids] of Object.entries(f.sockets)) {
    const [x, y] = k.split(',').map(Number); assert.equal(tileAt(f, x, y), 'M');
    ids.forEach(id => assert.ok(f.items.some(i => i.id === id), `${here}: gem ${id} exists`));
  }
  for (const s of f.stairs) {
    assert.ok('<>'.includes(tileAt(f, s.x, s.y)), `${here}: stairs sit on a stair tile`);
    const dest = floors[s.to.floor]; assert.ok(dest, `${here}: stairs lead to a real floor`);
    assert.ok('<>'.includes(tileAt(dest, s.to.x, s.to.y)), `${here}: you arrive on a stair tile`);
    const back = dest.stairs.find(b => b.x === s.to.x && b.y === s.to.y);
    assert.deepEqual([back.to.floor, back.to.x, back.to.y], [fi, s.x, s.y], `${here}: stairs are paired`);
  }
  for (const sh of f.shrines) assert.equal(tileAt(f, sh.x, sh.y), 'H');
  const seenAt = new Set();
  for (const i of f.inscriptions) {
    assert.equal(tileAt(f, i.x, i.y), '#', `${here}: inscription "${i.title}" is on a wall`);
    assert.ok(walkable(i.x + DX[i.face], i.y + DY[i.face]), `${here}: inscription "${i.title}" can be read from open floor`);
    assert.ok(i.title && i.text.length > 20, `${here}: inscription has a title and text`);
    assert.ok(!seenAt.has(`${i.x},${i.y},${i.face}`), `${here}: no two inscriptions on one wall face`); seenAt.add(`${i.x},${i.y},${i.face}`);
    assert.equal(i.seen, false);
  }
  for (const [, tr] of Object.entries(f.traps)) assert.equal(tr.found, false, 'traps start hidden');
});

// ---- the solver ----------------------------------------------------------------------------------------------
function solve(thief = true) {                           // thief: the party has a Cutpurse, who can pick vault locks
  const fresh = loadCampaign();
  const keys = new Set(), gems = new Set();
  const opened = fresh.map(() => new Set());           // gates opened, per floor
  const seeds = fresh.map(() => []);                   // cells we may start walking from, per floor
  const entered = fresh.map(() => false);
  const reach = fresh.map(() => new Set());
  entered[0] = true; seeds[0].push([fresh[0].start.x, fresh[0].start.y]);
  let changed = true;
  while (changed) {
    changed = false;
    fresh.forEach((f, fi) => {
      if (!entered[fi]) return;
      const R = reach[fi], q = [...seeds[fi]];
      const passable = (x, y) => {
        const t = tileAt(f, x, y);
        if (WALK.has(t)) return true;
        if (t === 'L') return f.locks[key(x, y)] === VAULT_LOCK ? thief : keys.has(f.locks[key(x, y)]);
        if (t === 'M') return f.sockets[key(x, y)].every(id => gems.has(id));
        if (t === 'G') return opened[fi].has(key(x, y));
        return false;
      };
      const seen = new Set(q.map(([x, y]) => key(x, y)));
      for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i]; R.add(key(x, y));
        const tp = f.teleports.find(t => t.x === x && t.y === y);
        if (tp && !seen.has(key(tp.to.x, tp.to.y))) { seen.add(key(tp.to.x, tp.to.y)); q.push([tp.to.x, tp.to.y]); }
        for (let d = 0; d < 4; d++) {
          const nx = x + DX[d], ny = y + DY[d];
          if (!seen.has(key(nx, ny)) && passable(nx, ny)) { seen.add(key(nx, ny)); q.push([nx, ny]); }
        }
      }
      for (const i of f.items) if (R.has(key(i.x, i.y))) {
        if (i.kind === 'key' && !keys.has(i.id)) { keys.add(i.id); changed = true; }
        if (i.kind === 'gem' && !gems.has(i.id)) { gems.add(i.id); changed = true; }
      }
      if (f.rescue && f.monsters.some(m => m.type === 'veshara' && R.has(key(m.x, m.y))) && !opened[fi].has(key(...f.rescue))) { opened[fi].add(key(...f.rescue)); changed = true; }   // the Queen's fall opens the princess's gate
      for (const p of f.plates) if (R.has(key(p.x, p.y))) for (const [x, y] of p.targets) if (!opened[fi].has(key(x, y))) { opened[fi].add(key(x, y)); changed = true; }
      for (const s of f.switches) if (R.has(key(s.x + DX[s.face], s.y + DY[s.face]))) for (const [x, y] of s.targets) if (!opened[fi].has(key(x, y))) { opened[fi].add(key(x, y)); changed = true; }
      for (const st of f.stairs) if (R.has(key(st.x, st.y))) {
        const to = st.to;
        if (!entered[to.floor]) { entered[to.floor] = true; changed = true; }
        if (!seeds[to.floor].some(([x, y]) => x === to.x && y === to.y)) { seeds[to.floor].push([to.x, to.y]); changed = true; }
      }
    });
  }
  return { fresh, reach, entered };
}

const { fresh, reach, entered } = solve();
fresh.forEach((f, fi) => {
  const here = `floor ${fi + 1} (${f.name})`, R = reach[fi];
  assert.ok(entered[fi], `${here} can be reached from the start`);
  for (const i of f.items) assert.ok(R.has(key(i.x, i.y)), `${here}: ${i.name} at ${i.x},${i.y} is obtainable`);
  for (const m of f.monsters) assert.ok(R.has(key(m.x, m.y)), `${here}: ${m.type} at ${m.x},${m.y} can be fought`);
  for (const s of f.shrines) assert.ok(R.has(key(s.x, s.y)), `${here}: shrine reachable`);
  for (const s of f.stairs) assert.ok(R.has(key(s.x, s.y)), `${here}: stairs at ${s.x},${s.y} reachable`);
  for (const s of f.switches) assert.ok(R.has(key(s.x + DX[s.face], s.y + DY[s.face])), `${here}: switch at ${s.x},${s.y} reachable`);
  for (const l of f.lamps) assert.ok(R.has(key(l.x + DX[l.face], l.y + DY[l.face])), `${here}: lamp at ${l.x},${l.y} reachable`);
  for (const i of f.inscriptions) assert.ok(R.has(key(i.x + DX[i.face], i.y + DY[i.face])), `${here}: inscription "${i.title}" can be read`);
  for (const p of f.plates) assert.ok(R.has(key(p.x, p.y)), `${here}: plate reachable`);
  for (const k of Object.keys(f.locks)) { const [x, y] = k.split(',').map(Number); assert.ok(R.has(key(x, y)), `${here}: locked door ${k} can be opened`); }
  for (const n of f.npcs) assert.ok(R.has(key(n.x, n.y)), `${here}: prisoner ${n.name} can be reached and freed`);
});
const boss = floors[3].monsters.find(m => m.type === 'veshara');
assert.ok(reach[3].has(key(boss.x, boss.y)), 'the Lich Queen can be reached');

// ---- without a Cutpurse: the dungeon is still finishable, and only the thieves' vaults are lost -------------------------------
const noThief = solve(false);
noThief.fresh.forEach((f, fi) => {
  const here = `floor ${fi + 1} (${f.name}) without a Cutpurse`, R = noThief.reach[fi];
  assert.ok(noThief.entered[fi], `${here}: still reachable`);
  for (const i of f.items) assert.equal(R.has(key(i.x, i.y)), !i.vault, `${here}: ${i.name} at ${i.x},${i.y} ${i.vault ? 'is locked away' : 'is obtainable'}`);
  for (const m of f.monsters) assert.ok(R.has(key(m.x, m.y)), `${here}: ${m.type} can be fought`);
  for (const s of f.stairs) assert.ok(R.has(key(s.x, s.y)), `${here}: stairs reachable`);
});
assert.ok(noThief.reach[3].has(key(boss.x, boss.y)), 'the Queen can be reached without a Cutpurse');
assert.equal(floors.flatMap(f => f.items).filter(i => i.vault).length, 6, 'three vaults, two things in each');

// ---- campaign shape ---------------------------------------------------------------------------------------------------
assert.equal(floors.length, 4);
assert.deepEqual(floors.map(f => f.dark), [false, false, true, false], 'only the Cinder Court is dark');
for (const sp of Object.values(SPELLS)) assert.ok(sp.target);
const xpTotal = floors.flatMap(f => f.monsters).reduce((t, m) => t + MONSTERS[m.type].xp, 0)
  + floors.flatMap(f => f.items).filter(i => i.kind === 'xp').reduce((t, i) => t + i.amount * 4, 0);
assert.ok(xpTotal / 4 >= 300, `a party that clears the dungeon reaches the level cap (${Math.round(xpTotal / 4)} XP each)`);

console.log('campaign ok:', floors.map((f, i) => `${f.name} (${f.monsters.length} monsters, ${f.items.length} items)`).join('; '));
