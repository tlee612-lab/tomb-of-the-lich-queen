# Tomb of the Lich Queen — Design Document

A retro first-person dungeon crawler for the browser, in the spirit of 80s and early-90s
tabletop-RPG computer games (chiefly *Eye of the Beholder*, 1991). All names, monsters,
spells and rules are original. No third-party tabletop rules text is used.

> Status: v0.1. Items marked **(unverified)** came from background knowledge, not
> confirmed sources. Research gaps are listed at the end.

## 1. Pillars

1. **Feel of the era.** Grid corridors, 90-degree turns, one square per step, sidestep,
   chunky pixel art, a framed viewport with a party panel.
2. **Short and finishable.** One small dungeon, about 20 minutes for a first run.
3. **Readable real-time combat.** Cooldown-driven, click to attack, damage always shown.
4. **No busywork.** Quick-use slots, an automatic clue journal, rest anywhere, save anywhere.

## 2. Decisions (settled)

| Topic | Decision |
|---|---|
| Rendering | Plain HTML, CSS, JavaScript on a canvas. No build step. |
| Ruleset | Fully original. No open ruleset dependency. |
| Party | Quick-start premade party, a roster of premade heroes, and custom hero creation, all on one hero data format. |
| Death | Soft. Fallen heroes are revived at a shrine or with a potion. |
| Saving | Save anywhere, 3 manual slots plus one autosave. |
| Hunger | Light food clock. Food drains slowly, resting costs a ration, the dungeon holds enough. |

## 3. Movement and view

- Grid map, four facings (N, E, S, W). Turn left/right in place, move forward/back,
  sidestep left/right. Each move is a short animation (about 150 ms) and blocks input
  only while it plays.
- Keys: W/S forward/back, A/D sidestep, Q/E turn. Arrow keys mirror these. On-screen
  buttons for mouse and touch.
- The view shows the current cell and up to 3 cells ahead, plus the cells beside the
  corridor, drawn back to front.
- Tile types: floor, wall, door (open/closed/locked), pressure plate, teleporter,
  spinner, pit, stairs up/down, switch (on a wall face), gem-socket door, shrine.

## 4. Party and rules (original)

### 4.1 Party layout
Four heroes in a 2x2 formation. Front row: slots 1 and 2. Back row: slots 3 and 4.
Only the front row fights in melee. The back row casts, throws, shoots and uses
reach weapons.

### 4.2 Attributes
Four attributes, each 3 to 18: **Might**, **Agility**, **Wits**, **Spirit**.
Modifier = (attribute − 10) / 2, rounded down.

### 4.3 Classes (four, each with a distinct job)
| Class | Role | Notes |
|---|---|---|
| **Warden** | Front-line fighter | Highest HP, heavy armor, best melee. |
| **Cutpurse** | Skirmisher / utility | Light armor. Backstab bonus on a flanked or newly-engaged enemy, finds hidden switches, opens locks, disarms traps. Not redundant: the only source of lockpicking and trap detection. |
| **Votary** | Healer / support | Healing, wards. Fights with a sling from the back row. Sanctify aura damages undead near the party automatically, no cast needed. |
| **Magister** | Ranged damage | Fragile. Strongest spells. |

### 4.4 Levels
Experience from kills and from solving puzzles. Levels are gained mid-dungeon, and
the level-up shows immediately. Level cap for this game: 5.

### 4.5 Hero data format (one format for every way of forming a party)
```
{ id, name, class, portrait, level, xp,
  attrs: { might, agility, wits, spirit },
  hpMax, hp, status: [], row: 0|1,
  weapon, armor, inventory[], quickSlots[],
  spellsKnown[], spellsMemorized[] }
```
Quick-start party, roster heroes and created heroes are all this object. Creation only
builds one from scratch.

### 4.6 Hero creation
Pick class, portrait and name, then distribute attribute points. About one screen,
under a minute. Roster heroes are premade examples of the same thing.

## 5. Combat

Real-time, cooldown-driven.

- Each hero has a weapon with a **cooldown** (about 0.6 s for daggers up to about 2 s
  for great weapons). The weapon icon greys out while cooling down.
- Click a hero's weapon icon, then the enemy, or click an enemy directly to use the
  hero whose cooldown is ready. Enemies attack on their own timers.
- **Attack roll:** d20 + attack bonus ≥ target Defense. Higher Defense is better
  (ascending, unlike old descending armor class).
- **Damage:** weapon dice + modifier, minus armor reduction. Floating numbers show
  damage dealt and taken, and the character sheet shows each weapon's damage range.
- **Sidestepping** can dodge slow enemies, but enemies move and hit in real time, and
  some are fast or ranged, so it is a tactic and not a free win. Narrow corridors limit
  it.
- **Death:** a hero at 0 HP falls and can be revived. If all four fall, the game
  returns to the last save.
- Combat can be paused with **P** to read and plan.
- **Implemented (milestone 4):** cooldowns, click a monster or press 1-4 to attack, only the
  front row uses melee weapons (the Staff has reach and the Sling is ranged, so the back row
  is not idle), monsters hunt the party along open corridors and attack the front row first
  (the back row if the front is down, or if the monster is behind you), XP and levelling to 5.
- Until saving exists (milestone 7), defeat restarts the floor with the party healed.
  Revival at shrines and potions arrives with milestone 5.

## 6. Magic

- Spells are **memorized**: each caster has slots by level. Memorizing happens when
  resting. Casting spends the slot.
- **Quick casting:** open the caster's spell list, click a spell, then click the
  target (enemy, ally, or just fire ahead). A spell is two clicks at most. This avoids
  the clunky casting of older games. Spells have a cooldown on the caster as well.
- **Resting** anywhere restores memorized spells and half of max HP, and costs one ration
  (rations are shared by the party). It is refused while enemies are near. A wandering
  monster interrupts a rest 25% of the time: only half the HP is restored and spells are not.
  Resting does not revive the fallen.
- **Food:** the party eats one ration every 2.5 minutes. With none left it starves: each
  hero loses 1 HP every 20 seconds but never drops below 1, so hunger weakens and never kills.
- **Revival:** a shrine (stand on it, press F) revives the fallen at half HP and mends
  everyone, with limited charges. A draught of return, kept in a quick slot, revives one hero.
- **Implemented spells (milestone 5):** Mender's Touch, Lantern Ward, Cinder Dart, Frostbind,
  plus passive Sanctify (a living Votary burns adjacent undead). The rest of the list is for later.

### Spell list (original, 12 total across two casters)
| Spell | Class | Effect |
|---|---|---|
| Mender's Touch | Votary | Heal one hero. |
| Lantern Ward | Votary | Light radius and reveals nearby hidden switches. |
| Bulwark | Votary | Raises a hero's Defense for a short time. |
| Unbind | Votary | Cures poison and paralysis. |
| Cinder Dart | Magister | Fire damage to one enemy. |
| Frostbind | Magister | Slows an enemy. |
| Gale Burst | Magister | Pushes and damages enemies in a line. |
| Mirror Veil | Magister | Absorbs the next hit on a hero. |
| Arc of Sparks | Magister | Lightning that hits two nearby enemies. |
| Dread Sight | Magister | Shows enemy HP and weaknesses. |
| Sanctify (passive) | Votary | Automatically damages and repels undead near the party. |
| Revive (shrine/potion) | none | Raises a fallen hero. |

## 7. Items and quick-use

- Each hero has 2 **quick slots** for potions and scrolls, used with one click.
- Weapons show damage range. Armor shows Defense and damage reduction.
- Keys, gems and quest items go in a shared bag.
- Food is a shared ration count.

## 8. The dungeon: Tomb of the Lich Queen

Three floors, each about 14x14 with a theme, plus the Queen's chamber. Target about
7 minutes per floor.

| Floor | Theme | Key mechanics introduced |
|---|---|---|
| 1. The Barrow Halls | Crypt entry | Doors, keys, pressure plates, hidden switch, first fights. |
| 2. The Drowned Ossuary | Flooded vaults | Teleporters, spinners, gem-socket door, poison. |
| 3. The Cinder Court | Throne approach | Pits, darkness, ranged enemies, combined puzzles. |
| Finale | The Queen's chamber | Boss fight with a puzzle element. |

Each floor has one **optional bonus quest** (a hidden room with a rare item and extra XP).

### Story
The Lich Queen Veshara has sealed the old kingdom's dead under her hill and woken them.
The party enters the barrow to end her rule before the next new moon.

### Monsters (original)
| Monster | Floor | Notes |
|---|---|---|
| Tomb Rat | 1 | Fast, weak, comes in groups. |
| Bone Wretch | 1-2 | Slow undead melee. Vulnerable to Sanctify. |
| Mire Ooze | 2 | Poison. Splits when hit by fire. |
| Gravebound Guard | 2-3 | Armored, slow, hits hard. |
| Sepulchral Spider | 3 | Ranged web slows a hero. |
| Cinder Wraith | 3 | Passes through the front row and hits the back row. |
| **Veshara, the Lich Queen** | Finale | Phases: summons guards, casts at range, vulnerable only while her phylactery lamps are dark. |

### Puzzle toolkit
Keys and locks, pressure plates (weight on a plate opens a gate or fires a trap), hidden
wall switches, teleporter tiles, spinner tiles (turn the party in place), gem-socket
doors, one-way doors, and secret rooms.

## 9. Anti-frustration features (from research and the genre's known pain points)

- **Clue journal.** Any inscription is recorded automatically the first time you stand in front
  of it or face it from up to two cells away, so a clue is never missable. Press J to read them.
- **Quick-use slots** for potions (see section 7).
- **Visible damage** (see section 5).
- **Multiple saves** (see section 2).
- **Quick casting** in two clicks (see section 6).
- **Cutpurse is not redundant** (see section 4.3).

## 10. Interface layout

```
+----------------------------------------------+
|  First-person viewport     |  Hero 1  Hero 2 |
|  (framed, ~ 448x300)       |  Hero 3  Hero 4 |
|                            |  HP / cooldown  |
+----------------------------------------------+
|  Compass | Move buttons | Message log        |
+----------------------------------------------+
```
Hero panels show portrait, HP bar, weapon icon with cooldown, 2 quick slots and a
spell button. Click a portrait to open the character sheet.

## 11. Technology

- `index.html`, `style.css` and plain ES modules in `js/`. No bundler, no framework.
- Internal canvas resolution about 448x300, scaled with `image-rendering: pixelated`.
- **Renderer:** layered perspective drawing of cells, painter's order back to front,
  rather than raycasting. Walls are textured quads drawn per visible cell, as the
  original did with pre-drawn graphics.
- Art is drawn procedurally at first (flat colors, brick lines, shading by distance),
  with a path to swap in sprite sheets later.
- **State:** one serializable `game` object. Saves go to `localStorage` as JSON.
- **Audio:** small WebAudio blips and noise, no asset files at first.

## 12. Milestones

1. **Engine scaffold:** grid movement, perspective renderer, test map, party panel. DONE
   (milestones 1-5 are done: engine, puzzles, party and hero creation, combat, magic and food.)
2. Doors, keys, switches, plates, teleporters, spinners.
3. Party data, hero creation, roster.
4. Combat, cooldowns, monsters.
5. Spells and resting, food.
6. Floor 1 content, then floors 2 and 3, then the finale.
7. Save and load, journal, audio, polish. DONE (see section 15).

## 13. Research status

**Confirmed from sources:** real-time combat with a weapon cooldown; memorized spells
restored by resting; food drain with Create Food easing it; THAC0 and descending armor
class and their equivalence to ascending systems; Basic Fantasy moving to CC BY-SA from
its 4th edition (version 3.0 vs 4.0 not confirmed).

**Unverified:** the original's 12 floors and puzzle list, most of its commonly cited
complaints, and tabletop saving throws. Two source sites could not be reached from the
build environment. None of the original game's content is used here, so this does not
block development. It only limits how closely the design claims to track the original.

## 14. The campaign as built (milestone 6)

Four floors, defined in `js/data/floors.js` from rectangles of floor plus special tiles.

| Floor | Name | What it adds |
|---|---|---|
| 1 | The Barrow Halls | Doors, a bronze key, a plate that opens a gate, a hidden switch to a cache, a shrine. Tomb Rats and Bone Wretches. |
| 2 | The Drowned Ossuary | Teleporters (a sealed pocket holds a gem), spinners, a gem-socket door that needs a ruby and a sapphire, a hidden bonus cache, poison from Mire Oozes, the first Gravebound Guard. |
| 3 | The Cinder Court | Dark (needs the Lantern Ward), hidden pit traps (a Cutpurse spots and disarms them; a Votary's Lantern Ward reveals them; otherwise you fall and are hurt, never killed), Sepulchral Spiders that web from range, Cinder Wraiths that strike the back row, an ember key, a plate-gated stairway. |
| 4 | The Queen's Chamber | Veshara. She cannot be harmed while any of three phylactery lamps burns, so snuff each lamp (stand in front and press F). While any lamp burns she sits her throne and shoots bolts from range; once all three are dark she rises, hunts within her chamber, and calls up three Bone Wretches at 66% and 33% health. Killing her ends the game. |

Each of floors 1 to 3 has one optional hidden cache with bonus XP. Stairs are paired, and each
floor remembers its own surviving monsters. Defeat restarts the current floor.

Not built from the original design: Mire Oozes do not split when burned, and there is no
one-way door yet.

`tests/campaign.mjs` solves the whole dungeon from a fresh start (keys, gems, plates, switches,
teleporters, stairs) and fails if any item, monster, shrine, staircase, lamp or the Queen is
unreachable. `tests/dungeon.mjs` covers stairs, pits, sockets, webs, poison, wraiths and the
boss. A scripted run through the real browser UI also completed the game.

## 15. Saving, journal, sound and animation (milestone 7)

- **Saving:** three numbered slots plus an autosave, in the browser's local storage (`js/save.js`).
  A save holds only what changes in play (floor state, monsters left alive on every floor, items,
  doors, plates, switches, traps, lamps, party, bag, rations, timers, journal); everything fixed is
  rebuilt from `js/data/floors.js`. Damaged or foreign saves are refused and shown as damaged, and a
  browser with storage blocked falls back to saves that last until the tab closes. The autosave runs
  every 30 seconds, on every floor change and after resting. Defeat offers to load it, or to restart
  the floor. Starting a new game does not touch the old autosave for its first 30 seconds.
- **Journal (J):** inscriptions on the walls (ten across the four floors) are recorded the first time
  they are seen, grouped by floor, and saved with the game. They carry the real clues: the bronze key,
  the hidden switch, the two gems, the pits, and the Queen's lamps.
- **Sound (M toggles, remembered):** synthesized with the Web Audio API, no asset files: steps, hits,
  crits, misses, spells, healing, pickups, doors, plates, spinners, stairs, resting, level-ups, a
  low drone, and a fanfare. Effects follow the game's own messages (`soundsFor` in `js/audio.js`), so
  new messages only need a rule. Sound starts after your first click or key press, as browsers require.
- **Animation:** forward and back steps slide the camera for 140 ms; turns, sidesteps, teleports,
  spinners and stairs dissolve from the previous frame. It is cosmetic: the rules never wait for it.
- **Menu (Esc):** save slots, journal, controls and sound. It pauses the game.

Tests: `tests/save.mjs` (round trips, corrupt data, storage failures), `tests/feel.mjs` (message to sound
mapping, the audio engine against a fake, animation timing), the inscription rules in `tests/dungeon.mjs`,
and an optional real-browser run, `tests/browser/playthrough.cjs`, that plays the whole game.

Not done: I could not listen to the sound, so its mix and volume are untuned. There is no touch-specific
layout beyond the on-screen movement pad.

## 16. Balance

Difficulty was tuned with a simulator that plays the real game thousands of times. See `docs/BALANCE.md` for the method, what it found, what changed, and what is still open (the Cutpurse and the mage are replaceable, the healer is not, and nobody has played it yet).
