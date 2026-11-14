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
| **Votary** | Healer / support | Healing, wards. Sanctify aura damages undead near the party automatically, no cast needed. |
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
- Combat can be paused with the space bar to read and plan. Pause does not stop the
  cooldown display from being readable.

## 6. Magic

- Spells are **memorized**: each caster has slots by level. Memorizing happens when
  resting. Casting spends the slot.
- **Quick casting:** open the caster's spell list, click a spell, then click the
  target (enemy, ally, or just fire ahead). A spell is two clicks at most. This avoids
  the clunky casting of older games. Spells have a cooldown on the caster as well.
- **Resting** anywhere restores memorized spells and some HP, costs one ration per
  hero, and can be interrupted by wandering monsters.

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

- **Clue journal.** Any inscription, wall text or hint is recorded automatically the
  first time it is seen, so a clue is never missable.
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

1. **Engine scaffold** (this repo's next commit): grid movement, perspective renderer,
   test map, party panel stub.
2. Doors, keys, switches, plates, teleporters, spinners.
3. Party data, hero creation, roster.
4. Combat, cooldowns, monsters.
5. Spells and resting, food.
6. Floor 1 content, then floors 2 and 3, then the finale.
7. Save and load, journal, audio, polish.

## 13. Research status

**Confirmed from sources:** real-time combat with a weapon cooldown; memorized spells
restored by resting; food drain with Create Food easing it; THAC0 and descending armor
class and their equivalence to ascending systems; Basic Fantasy moving to CC BY-SA from
its 4th edition (version 3.0 vs 4.0 not confirmed).

**Unverified:** the original's 12 floors and puzzle list, most of its commonly cited
complaints, and tabletop saving throws. Two source sites could not be reached from the
build environment. None of the original game's content is used here, so this does not
block development. It only limits how closely the design claims to track the original.
