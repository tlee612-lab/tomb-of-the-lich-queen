// The campaign: four floors. Each floor is built from rectangles of floor (`carve`) with special
// tiles in `set`. Stair `to` = where you arrive on the other floor: { floor, x, y, dir }.
// Replace or extend this file to change the dungeon.
import { buildMap } from '../map.js';

const FLOORS = [
  { // ---- 1. The Barrow Halls: doors, a key, a plate, a hidden switch, first fights ----
    name: 'The Barrow Halls', w: 18, h: 14, start: { x: 1, y: 1, dir: 2 },
    carve: [[1, 1, 3, 3], [4, 2, 4, 2], [5, 1, 9, 3], [10, 2, 10, 2], [11, 1, 14, 3],
            [7, 4, 7, 5], [5, 6, 9, 8], [13, 4, 13, 6], [11, 7, 14, 10], [12, 11, 12, 12], [1, 8, 3, 9], [4, 8, 4, 8]],
    set: { '4,2': 'D', '10,2': 'L', '13,4': 'G', '4,8': 'G', '12,2': 'P', '11,9': 'H', '12,12': '>' },
    locks: { '10,2': 'bronze' },
    plates: [{ x: 12, y: 2, targets: [[13, 4]] }],
    switches: [{ x: 4, y: 6, face: 1, hidden: true, targets: [[4, 8]] }],
    shrines: [{ x: 11, y: 9, charges: 2 }],
    stairs: [{ x: 12, y: 12, to: { floor: 1, x: 1, y: 1, dir: 1 } }],
    items: [
      { x: 9, y: 8, kind: 'key', id: 'bronze', name: 'bronze key' },
      { x: 3, y: 3, kind: 'ration', name: 'rations', amount: 2 },
      { x: 14, y: 1, kind: 'ration', name: 'rations', amount: 2 },
      { x: 14, y: 3, kind: 'potion', id: 'heal', name: 'healing potion' },
      { x: 1, y: 8, kind: 'xp', amount: 40, name: 'forgotten cache' },
      { x: 1, y: 9, kind: 'potion', id: 'return', name: 'draught of return' },
      { x: 2, y: 9, kind: 'ration', name: 'rations', amount: 2 },
    ],
    monsters: [
      { type: 'tomb_rat', x: 6, y: 2 }, { type: 'tomb_rat', x: 9, y: 1 }, { type: 'tomb_rat', x: 6, y: 7 },
      { type: 'tomb_rat', x: 8, y: 8 }, { type: 'bone_wretch', x: 13, y: 2 },
      { type: 'bone_wretch', x: 12, y: 8 }, { type: 'tomb_rat', x: 14, y: 8 },
    ],
  },
  { // ---- 2. The Drowned Ossuary: teleporter, spinners, gem-socket door, poison ----
    name: 'The Drowned Ossuary', w: 18, h: 14, start: { x: 1, y: 1, dir: 1 },
    carve: [[1, 1, 4, 3], [5, 2, 5, 2], [6, 1, 10, 3], [8, 4, 8, 5], [5, 6, 11, 8], [12, 7, 13, 7], [13, 8, 13, 9],
            [13, 10, 13, 10], [12, 11, 14, 12], [1, 6, 3, 8], [14, 9, 14, 9], [15, 9, 16, 10]],
    set: { '1,1': '<', '5,2': 'D', '13,10': 'M', '13,12': '>', '6,6': 'T', '1,6': 'T', '7,7': 'O', '9,7': 'O',
           '10,3': 'H', '14,9': 'G' },
    teleports: [{ x: 6, y: 6, to: { x: 3, y: 7, dir: 1 } }, { x: 1, y: 6, to: { x: 6, y: 7, dir: 1 } }],
    sockets: { '13,10': ['redgem', 'bluegem'] },
    switches: [{ x: 14, y: 8, face: 3, hidden: true, targets: [[14, 9]] }],
    shrines: [{ x: 10, y: 3, charges: 2 }],
    stairs: [{ x: 1, y: 1, to: { floor: 0, x: 12, y: 12, dir: 0 } }, { x: 13, y: 12, to: { floor: 2, x: 1, y: 1, dir: 1 } }],
    items: [
      { x: 10, y: 1, kind: 'gem', id: 'redgem', name: 'ruby' },
      { x: 2, y: 8, kind: 'gem', id: 'bluegem', name: 'sapphire' },
      { x: 2, y: 3, kind: 'ration', name: 'rations', amount: 2 },
      { x: 3, y: 1, kind: 'potion', id: 'antidote', name: 'antidote' },
      { x: 7, y: 3, kind: 'potion', id: 'heal', name: 'healing potion' },
      { x: 5, y: 8, kind: 'ration', name: 'rations', amount: 2 },
      { x: 15, y: 9, kind: 'xp', amount: 50, name: 'drowned reliquary' },
      { x: 16, y: 9, kind: 'potion', id: 'return', name: 'draught of return' },
      { x: 16, y: 10, kind: 'potion', id: 'heal', name: 'healing potion' },
    ],
    monsters: [
      { type: 'mire_ooze', x: 7, y: 2 }, { type: 'mire_ooze', x: 9, y: 3 }, { type: 'bone_wretch', x: 6, y: 1 },
      { type: 'bone_wretch', x: 8, y: 6 }, { type: 'mire_ooze', x: 11, y: 6 }, { type: 'gravebound_guard', x: 10, y: 8 },
    ],
  },
  { // ---- 3. The Cinder Court: darkness, hidden pits, spiders, wraiths, a second key ----
    name: 'The Cinder Court', dark: true, w: 18, h: 14, start: { x: 1, y: 1, dir: 1 },
    carve: [[1, 1, 4, 3], [5, 2, 5, 2], [6, 2, 12, 2], [13, 1, 16, 3], [15, 4, 15, 6], [11, 7, 16, 10], [10, 8, 10, 8],
            [5, 7, 9, 10], [7, 11, 7, 12], [13, 4, 13, 4], [12, 5, 13, 5]],
    set: { '1,1': '<', '5,2': 'D', '9,2': 'X', '11,2': 'X', '10,8': 'L', '7,11': 'G', '7,12': '>', '13,9': 'P',
           '11,10': 'H', '13,4': 'G' },
    locks: { '10,8': 'ember' },
    plates: [{ x: 13, y: 9, targets: [[7, 11]] }],
    switches: [{ x: 17, y: 2, face: 3, hidden: true, targets: [[13, 4]] }],
    shrines: [{ x: 11, y: 10, charges: 2 }],
    stairs: [{ x: 1, y: 1, to: { floor: 1, x: 13, y: 12, dir: 0 } }, { x: 7, y: 12, to: { floor: 3, x: 7, y: 10, dir: 0 } }],
    items: [
      { x: 16, y: 1, kind: 'key', id: 'ember', name: 'ember key' },
      { x: 3, y: 3, kind: 'ration', name: 'rations', amount: 2 },
      { x: 2, y: 3, kind: 'potion', id: 'heal', name: 'healing potion' },
      { x: 8, y: 10, kind: 'ration', name: 'rations', amount: 2 },
      { x: 12, y: 5, kind: 'xp', amount: 60, name: 'sealed hoard' },
      { x: 13, y: 5, kind: 'potion', id: 'heal', name: 'healing potion' },
      { x: 5, y: 7, kind: 'potion', id: 'antidote', name: 'antidote' },
    ],
    monsters: [
      { type: 'sepulchral_spider', x: 14, y: 2 }, { type: 'sepulchral_spider', x: 16, y: 3 },
      { type: 'cinder_wraith', x: 12, y: 8 }, { type: 'cinder_wraith', x: 15, y: 9 },
      { type: 'gravebound_guard', x: 6, y: 8 }, { type: 'gravebound_guard', x: 8, y: 10 },
      { type: 'bone_wretch', x: 7, y: 7 },
    ],
  },
  { // ---- 4. The Queen's Chamber: the finale ----
    name: "The Queen's Chamber", w: 15, h: 13, start: { x: 7, y: 10, dir: 0 },
    carve: [[3, 1, 11, 4], [7, 5, 7, 8], [6, 9, 8, 10]],
    set: { '7,10': '<', '7,7': 'H' },
    shrines: [{ x: 7, y: 7, charges: 2 }],
    lamps: [{ x: 2, y: 2, face: 1 }, { x: 12, y: 2, face: 3 }, { x: 7, y: 0, face: 2 }],
    stairs: [{ x: 7, y: 10, to: { floor: 2, x: 7, y: 12, dir: 0 } }],
    items: [
      { x: 6, y: 9, kind: 'potion', id: 'heal', name: 'healing potion' },
      { x: 8, y: 9, kind: 'potion', id: 'return', name: 'draught of return' },
      { x: 8, y: 10, kind: 'ration', name: 'rations', amount: 2 },
    ],
    monsters: [{ type: 'veshara', x: 7, y: 2 }],
  },
];

export const loadCampaign = () => FLOORS.map(buildMap);
