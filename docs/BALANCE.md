# Balance report

How hard is Tomb of the Lich Queen, and was it tuned on evidence? This documents the simulator in
`tools/balance.mjs`, what it found when it first ran, what changed because of it, and what is still open.

Run it yourself: `npm run balance` (200 runs is slow; `node tools/balance.mjs 100 --pace=slow` takes about a minute).
Guard-rail tests for the difficulty are in `tests/balance.mjs` and run with `npm test`.

## What the simulator is

A bot that plays the **real game**: the real rules, monsters, floors, clocks and a seeded random generator, so
every run is repeatable. It walks the whole dungeon from the title screen to the Queen, solving every puzzle with
the same actions a player has (stepping, bumping doors, using switches, stairs, spells, potions, resting, praying
at shrines). It is a proxy for a player, not a player. It navigates perfectly, never gets lost or confused, and
reads every situation correctly, so treat the win rates as a sense of difficulty, not a prediction.

**Paces** (how long the bot takes to act):

| pace | meaning | careful run takes |
|---|---|---|
| quick | a sharp, practiced player | about 4 min |
| human | slower steps, 0.6 s reactions in a fight | about 7 min |
| slow | human, plus 14 s of looking around at every stop | about 14 min |

`slow` is the closest to a first-time player and is the pace the numbers below are tuned for. A real first run
will probably take longer still (reading the journal, mapping, fumbling), so the hunger clock bites a little harder
in practice than here.

**Variants** (what kind of player and party):

| variant | plays like |
|---|---|
| careful | takes every item including the three secret caches; casts spells, drinks potions; rests when any hero is under 50% or the party under 70%; prays at shrines |
| rush | takes loose items but skips the secret caches; otherwise careful |
| average | like rush, but rests only when a hero is under 30% or the party under 50% |
| careless | skips all optional items; never casts, drinks, rests or prays |
| no-healer / no-cutpurse / no-mage | careful play with that class swapped for a second Warden (or Magister swapped for one) |

## What it found at the start

The first version of the game, before any tuning:

- **Floors 1 to 3 were trivial.** Across all three floors a careful party took about 7, 13 and 24 damage in total,
  out of 90 to 150 hit points. Even the careless bot (no spells, no potions, no resting) won every run at the quick pace.
- **The Queen was an impossible wall at human pace.** Every variant, including the careful one, lost 100% of runs on floor 4.
  The whole 98 seconds on that floor was spent with her lamps still lit: the party never got to hurt her.
- **Why:** the Queen hunted the party around the chamber, and she is invulnerable while a lamp burns. She stood on the
  one cell you must occupy to reach a lamp, and you can neither push nor hurt her, so the bot waited, being shot, until it died.
  This was a design flaw, not just a numbers problem.
- **Food never mattered.** A careful run finished with 15 to 17 rations left over.
- **The healer, Cutpurse and mage hardly mattered**: removing any one left the win rate at 100%.

The difficulty was a flat line followed by a cliff, and which side of the cliff you were on depended almost entirely on how
fast you pressed keys.

## What changed

| change | why |
|---|---|
| Tougher regular monsters: rats 6 HP / 1d4, wretches 18 HP / 1d8, oozes 16 HP / 1d6, guards 30 HP / 1d10, spiders 12 HP / 1d6, wraiths 20 HP / 1d8, quicker attacks | floors 1 to 3 did almost no damage |
| More monsters: floor 1 from 7 to 14, floor 2 from 6 to 11, floor 3 from 7 to 11 | same; groups, and monsters in corridors that must be cleared |
| XP thresholds 30/80/160/300 changed to 50/130/260/420, monster XP rebalanced | more monsters would otherwise level the party too fast |
| **The Queen sits her throne while any lamp burns** (`holdWhileWarded`): she shoots but does not stalk the room | she could body-block the lamps while invulnerable; this turned the lamp phase into a ranged gauntlet and the fight after it into a real fight |
| The Queen: 70 to 130 HP, melee 1d8 to 1d10, bolts 1d6+1 to 1d8+1, faster attacks, three summons per phase instead of two | the fight after the lamps lasted about 13 seconds and cost about 30 damage: no climax |
| Starting rations 4 to 3, and four ration pickups removed (24 in total supply down to 13) | food never limited anything; resting could be spammed |
| Pits deal 1d6+2 to every hero instead of 1d6 | a Cutpurse or Lantern Ward should be worth having |

## Where it ended up

Each cell below is 200 full playthroughs of the finished game (4,200 in total). With 200 runs, a win rate near 50% is
good to about plus or minus 7 points, and one near 0 or 100% to about 2.

### Slow pace: the first-timer the game is tuned for

| variant | runs | win rate | deaths on floor 1/2/3/4 | avg time (won) | hero falls | potions | rests | shrine prayers | rations left |
|---|---|---|---|---|---|---|---|---|---|
| careful | 200 | 99% | 0 / 0 / 0 / 3 | 13m36s | 1.0 | 3.6 | 3.2 | 0.0 | 4.8 |
| rush | 200 | 71% | 0 / 0 / 1 / 58 | 9m58s | 2.7 | 4.9 | 3.7 | 0.2 | 4.1 |
| average | 200 | 39% | 0 / 0 / 23 / 100 | 9m58s | 3.8 | 4.8 | 1.7 | 0.4 | 5.7 |
| careless | 200 | 0% | 0 / 34 / 149 / 17 | - | 4.4 | 0.0 | 0.0 | 0.6 | - |
| no-healer | 200 | 48% | 0 / 0 / 0 / 105 | 14m02s | 3.8 | 6.4 | 4.8 | 0.0 | 3.3 |
| no-cutpurse | 200 | 100% | 0 / 0 / 0 / 0 | 13m40s | 0.5 | 3.1 | 3.4 | 0.0 | 4.6 |
| no-mage | 200 | 100% | 0 / 0 / 0 / 1 | 13m51s | 1.3 | 3.9 | 3.8 | 0.0 | 4.2 |

Damage the party took, per floor 1 / 2 / 3 / 4 and in total, and the lowest average party health it reached:

- careful: 17 / 32 / 48 / 116 = 213; lowest avg health 49%; floor 4 67s (43s of it with lamps lit, taking 43 damage)
- rush: 18 / 33 / 60 / 138 = 249; lowest avg health 29%; floor 4 72s (43s of it with lamps lit, taking 44 damage)
- average: 18 / 35 / 66 / 114 = 233; lowest avg health 13%; floor 4 69s (44s of it with lamps lit, taking 45 damage)
- careless: 18 / 48 / 44 / 9 = 119; lowest avg health 0%; floor 4 52s (34s of it with lamps lit, taking 44 damage)
- no-healer: 20 / 38 / 56 / 195 = 310; lowest avg health 20%; floor 4 92s (43s of it with lamps lit, taking 44 damage)
- no-cutpurse: 16 / 35 / 46 / 114 = 211; lowest avg health 49%; floor 4 67s (43s of it with lamps lit, taking 43 damage)
- no-mage: 19 / 43 / 62 / 127 = 251; lowest avg health 49%; floor 4 69s (43s of it with lamps lit, taking 44 damage)

Average hero level on arriving at each floor:

- careful: F1 L1.0 @0m00s, F2 L2.0 @4m01s, F3 L3.0 @8m29s, F4 L4.0 @12m30s; final level 4.1
- rush: F1 L1.0 @0m00s, F2 L1.0 @2m20s, F3 L2.0 @5m37s, F4 L3.0 @8m48s; final level 3.6
- average: F1 L1.0 @0m00s, F2 L1.0 @2m18s, F3 L2.0 @5m34s, F4 L2.9 @8m49s; final level 3.5
- careless: F1 L1.0 @0m00s, F2 L1.0 @1m44s, F3 L1.9 @4m16s, F4 L2.9 @6m41s; final level -
- no-healer: F1 L1.0 @0m00s, F2 L2.0 @4m04s, F3 L3.0 @8m37s, F4 L4.0 @12m43s; final level 4.2
- no-cutpurse: F1 L1.0 @0m00s, F2 L2.0 @4m02s, F3 L3.0 @8m32s, F4 L4.0 @12m34s; final level 4.0
- no-mage: F1 L1.0 @0m00s, F2 L2.0 @4m03s, F3 L3.0 @8m36s, F4 L4.0 @12m43s; final level 4.2

### Human pace

| variant | runs | win rate | deaths on floor 1/2/3/4 | avg time (won) | hero falls | potions | rests | shrine prayers | rations left |
|---|---|---|---|---|---|---|---|---|---|
| careful | 200 | 100% | 0 / 0 / 0 / 1 | 7m04s | 1.0 | 3.6 | 3.4 | 0.0 | 7.6 |
| rush | 200 | 86% | 0 / 0 / 1 / 28 | 5m59s | 2.2 | 4.8 | 4.1 | 0.2 | 4.8 |
| average | 200 | 42% | 0 / 0 / 22 / 94 | 5m54s | 3.8 | 4.8 | 1.8 | 0.4 | 7.0 |
| careless | 200 | 0% | 0 / 34 / 149 / 17 | - | 4.4 | 0.0 | 0.0 | 0.6 | - |
| no-healer | 200 | 50% | 0 / 0 / 0 / 101 | 7m31s | 3.6 | 6.1 | 5.6 | 0.0 | 5.0 |
| no-cutpurse | 200 | 100% | 0 / 0 / 0 / 0 | 7m09s | 0.5 | 3.1 | 3.6 | 0.0 | 7.4 |
| no-mage | 200 | 99% | 0 / 0 / 0 / 2 | 7m20s | 1.2 | 3.7 | 4.2 | 0.0 | 6.7 |

### Quick pace: a sharp, practiced player

| variant | runs | win rate | deaths on floor 1/2/3/4 | avg time (won) | hero falls | potions | rests | shrine prayers | rations left |
|---|---|---|---|---|---|---|---|---|---|
| careful | 200 | 100% | 0 / 0 / 0 / 0 | 3m48s | 0.2 | 1.8 | 2.3 | 0.0 | 9.7 |
| rush | 200 | 100% | 0 / 0 / 0 / 1 | 3m24s | 0.4 | 2.9 | 3.2 | 0.1 | 6.9 |
| average | 200 | 82% | 0 / 0 / 1 / 36 | 3m23s | 1.7 | 4.5 | 1.0 | 0.3 | 8.9 |
| careless | 200 | 4% | 0 / 5 / 115 / 73 | 3m13s | 4.4 | 0.0 | 0.0 | 0.8 | 4.0 |
| no-healer | 200 | 99% | 0 / 0 / 0 / 3 | 4m00s | 0.6 | 2.9 | 4.4 | 0.0 | 7.6 |
| no-cutpurse | 200 | 100% | 0 / 0 / 0 / 0 | 3m58s | 0.1 | 1.8 | 2.8 | 0.0 | 9.2 |
| no-mage | 200 | 100% | 0 / 0 / 0 / 0 | 3m58s | 0.3 | 2.3 | 2.9 | 0.0 | 9.1 |

## What the targets were, and how it landed

| target (slow pace) | result |
|---|---|
| a careful player usually wins, but not every time | 99%. A touch easy: only 3 of 200 careful runs lost, all to the Queen |
| skipping only the secret caches is survivable but riskier | 71% (rush) |
| resting late and skimping on resources loses about half the time or more | 39% (average) |
| ignoring spells, potions, resting and shrines does not work | 0% (careless) |
| damage climbs floor by floor | careful: 17, 32, 48, then 116 |
| the Queen is a real fight | 67 s on floor 4, about 24 s of it after the lamps die, about 70 damage |
| resting and potions are part of a normal run | careful rests 3.2 times and drinks 3.6 potions |
| food matters | careful finishes with 4.8 rations at 14 minutes; the hunger clock would take about 3 more over a 20-minute run |

## What the numbers say

- **The secret caches matter a lot.** A player who takes them reaches the Queen at level 4 with extra potions; one who skips them arrives at level 3 with fewer.
  The win rate falls from 99% to 71%. The simulator cannot say how much is the lost level and how much the lost potions. The caches are described as
  optional, but the game is balanced as if you find most of them, so the inscriptions that hint at them are doing real work. (At first only two of the three caches
  had a hint; the floor 2 cache had none. The Reliquary inscription now covers it.)
- **Resting and healing are the other lever.** Same loot, but resting only when badly hurt, and the win rate falls from 71% to 39%.
- **The healer is essential.** Swapping the Votary for a second Warden drops the win rate from 99% to 48%, with a Queen fight that costs
  nearly twice the damage (195 against 116). This is a strong class effect, arguably too strong.
- **Skilled players find it easy.** At the quick pace the careful and rush bots win almost every time (the rush bot lost one run in 200). Pace matters mostly in the finale, where the
  lamp phase is a race against her bolts.
- **The first two floors are gentle on purpose.** Almost nothing dies there except the careless bot, which loses 34 of 200 runs on floor 2.
  Floor 3 is where lax play starts to get punished (23 average-bot deaths), and floor 4 is where most losses happen.
- **Hunger is a mild pressure, as designed.** A careful 14-minute run finishes with about 5 rations; nobody in these runs starved long enough to matter.

## What is still wrong or unknown

- **The Cutpurse has no irreplaceable job.** A party with a second Warden in her place wins 100% of runs, as often as the real thing. Spotting and disarming pits
  is not worth enough (a Lantern Ward does the same), hidden switches are found by anyone standing in front of them, and keys do not need lockpicking.
  It needs a real power (a backstab bonus, trapped chests, a pick-lock shortcut) before it earns a place in the party. Not fixed.
- **The Magister is not essential either**: replacing the mage with a Warden changes the win rate from 99% to 100%. Cinder Dart and Frostbind are nice, not needed.
- **The healer is the opposite problem**: so strong that a party without one loses half the time. Worth a second source of healing (a Warden ability, more potions)
  so a party is not forced to bring one.
- **The careful bot is slightly too safe at 99%.** I stopped tuning rather than make the Queen steeper, because the middle of the range (rush 71%, average 39%) is where
  most real players sit.
- **The caches are effectively required.** If that is not intended, move some of their XP and potions onto the main path.
- **There is no easy mode.** A player who simply cannot keep up with the Queen's lamp phase has no setting to turn down. Worth adding if the game is shared.

## How far to trust this

- The bot never gets lost, never misreads a room, never makes a mistake, and juggles all four heroes' cooldowns instantly. Real players will do worse than any variant
  here at the same intentions, especially in a real-time fight.
- The three paces are guesses at how long people take, not measurements of anyone. Nobody has played the finished game yet.
- It tests one party composition in depth and a few swaps. Custom heroes, other spell loadouts and the roster's other heroes (Dagny, Osric) are barely covered.
- The "damage" figures count monster hits only. Pit damage is not in them.
- Treat every number here as a way to compare changes against each other. The only real test is people playing it, and the cheapest next step is to put the
  game in front of a few and watch where they die.

## After the class changes (2026-11-14)

Changes: the Warden learned **Field Dressing** (heal 1d6 + Might, one slot, more with levels). The Cutpurse got a real kit: **backstab** (+2d6 on a monster that has not fought yet, or is slowed), hidden switches noticed from 3 cells, **lock picking**, plus the pit work it already had. The bot now heals with Field Dressing too, and opens each fight with the Cutpurse (a player would, since any earlier blow uses up the fresh-foe bonus). 200 runs per cell, slow pace:

| variant | before | after |
|---|---|---|
| careful | 99% | 99% |
| rush | 71% | 87% |
| average | 39% | 60% |
| careless | 0% | 0% |
| no-healer (second Warden instead of the Votary) | 48% | 63% |
| no-cutpurse (second Warden instead of the Cutpurse) | 100% | 100% |
| no-mage (second Warden instead of the Magister) | 100% | 100% |

What it shows:
- **Healing is no longer mandatory.** Without the Votary the win rate rose from 48% to 63%. The Votary is still the best healer (two slots, two spells, Sanctify), which is intended.
- **The game got easier in the middle.** Rush and average rose by 16 and 21 points because every party now has some healing and a backstab. Careful was already at the ceiling. The tuning targets in this report (rush about 71%, average about 39%) no longer hold. Decide whether to re-tighten monsters or accept the easier middle.
- **The Cutpurse is still replaceable in the simulator.** A second Warden still wins every run, with fewer hero falls. The bot cannot show the Cutpurse's non-combat value: it already knows where every switch is and carries every key, so lock picking and long-range switch sight are invisible to it. The backstab alone does not outweigh a second Warden's HP, armor and heal. This is not solved, only improved. The fix has to be a design decision: give the Cutpurse something a Warden cannot do and the dungeon asks for (for example a locked or trapped route that only picking opens, or a bonus cache reachable only that way), or weaken what the second Warden brings.
- **Update: thieves' vaults added.** One per floor on floors 1 to 3, behind a lock no key fits, so only a Cutpurse opens them (XP 30/40/50 and a potion each). The bot picks them when it has a Cutpurse. Same 200 runs, slow pace:

| variant | before vaults | with vaults |
|---|---|---|
| careful (Cutpurse) | 99% | 100%, 178 damage taken, final level 5.0 |
| no-cutpurse (second Warden) | 100% | 100%, 223 damage taken, final level 4.1 |
| no-healer (Cutpurse, two Wardens, no Votary) | 63% | 94% |
| rush / average (no caches or vaults) | 87% / 60% | 87% / 60% |

  The Cutpurse now clearly matters: the party that has one takes about 20% less damage and finishes a level higher, and a party with no Votary goes from 63% to 94% with a Cutpurse's loot. But the win rate cannot show it, because the best parties already win about 100%. The game is now too easy at the top, so the "Cutpurse is replaceable" finding is hidden behind a ceiling, not fixed by one. A careful run now rests about once (it was 3.4 times at human pace), so the guard rail in `tests/balance.mjs` was lowered from 1.5 to 1. That was fixed by the retune below, and the guard rail is back at 1.5.
- Not measured: how lock picking feels (each try is a 2.5 s d20 roll; a natural 1 always fails), and whether a human notices the backstab message.

## Retune after the class changes (2026-11-14)

The tables above ("Where it ended up") describe the game before the class changes; this section is current.

What changed, and why:

| change | why |
|---|---|
| Ooze 16 to 20 HP, +1 damage, +1 to hit, faster; guard 30 to 36 HP, +1 damage, +1 to hit; spider 12 to 14 HP, +1; wraith 20 to 24 HP, +1, faster | Field Dressing, backstab and the vaults had made floors 2 and 3 too soft (a careful run rested about once) |
| Monster XP up about 30% (rat 5, wretch 21, ooze 16, guard 39, spider 26, wraith 42) | players who skip the optional loot were a full level behind at the Queen; more XP on the main path narrows that |
| Cache XP halved (20/25/30) and vault XP set to 15/20/25 | the optional loot decided too much of the game |
| Queen 130 to 120 HP, everything else unchanged | the harder floors already take their toll; a 150 HP Queen made rush 28% and average 11% |

Result, 200 runs per row, slow pace (human pace in brackets where it differs a lot):

| variant | win rate | deaths on floor 1/2/3/4 | hero falls | rests | damage taken | final level |
|---|---|---|---|---|---|---|
| careful | 99% | 0 / 0 / 1 / 1 | 1.0 | 2.1 | 232 | 5.0 |
| rush | 74% (85%) | 0 / 0 / 12 / 40 | 2.1 | 3.1 | 260 | 3.9 |
| average | 23% | 0 / 1 / 33 / 121 | 3.9 | 1.1 | 239 | 3.9 |
| careless | 0% | 0 / 65 / 135 / 0 | 4.2 | 0.0 | 114 | - |
| no-healer (Cutpurse, two Wardens, Mage) | 70% (78%) | 0 / 0 / 0 / 60 | 2.9 | 2.4 | 319 | 4.9 |
| no-cutpurse (two Wardens, Votary, Mage) | 100% | 0 / 0 / 0 / 0 | 0.4 | 3.1 | 269 | 4.0 |
| no-mage (Cutpurse, Votary, two Wardens) | 97% | 0 / 0 / 1 / 5 | 1.4 | 1.9 | 277 | 4.9 |

Against the targets:
- Careful wins nearly always but not every time (99%), skipping the loot is survivable but risky (74%), resting late is mostly a loss (23%, below the old 39% aim), ignoring spells, potions and rest never works (0%). The careful run rests about twice at slow and human pace, so the guard rail in `tests/balance.mjs` is back at 1.5.
- **Healing matters but is not mandatory:** a party with no Votary wins 70% (it was 48% before Field Dressing, 100% for a party that also has a Votary).
- **The Cutpurse shows up in survivability, not win rate.** The party with a Cutpurse takes less damage (232 against 269, careful against no-cutpurse) and ends a level higher (5.0 against 4.0), because it collects the vaults. Both still win almost every time, so the Cutpurse remains replaceable by a strong party of Wardens, a Votary and a Mage. The vaults make her worth bringing, not worth requiring.
- **The Mage is still replaceable** (97% with a Warden instead).
- **Average is on the harsh side.** The bot that rests only when badly hurt loses three runs in four, mostly to the Queen after arriving at about 8% health.
- **Lamp phase softened (same day):** the Queen's bolt went from 1d8+1 to 1d6+1, cutting the damage taken while her lamps burn from about 44 to about 39. Over 200 slow-pace runs this lifted rush from 74% to 82% and average from 23% to 25%, and left careful at 99%, no-healer at 73% and no-cutpurse at 100%. It barely helps average because that bot's trouble starts earlier: 33 of its 150 losses are on floor 3 and it reaches the Queen with almost no health left (lowest average health 9%), so the cure is resting before the stairs, not a gentler Queen. Not changed further.

## Difficulty setting

The levels (`js/difficulty.js`):

| level | monster damage | rest heals | rest interrupted | starting rations |
|---|---|---|---|---|
| Easy | x0.6 | 75% of max HP | 10% | 4 |
| Normal | x1 | 50% | 25% | 3 |
| Hard | x1.3 | 40% | 35% | 3 |

Monster damage is rounded and never below 1. Normal is exactly the rules that the tables above measure. Same bots, 200 runs each, slow pace:

| player | Easy | Normal | Hard |
|---|---|---|---|
| careful | not run | 99% | 79% |
| rush (skips the loot) | 100% | 82% | 29% |
| average (rests late) | 93% | 25% | not run |
| careless (no spells, potions or rest) | 6% | 0% | not run |

What it says:
- **Easy does its job.** A player who rests late and skips the loot goes from losing three runs in four to winning 93%, and a rush player never loses. Even ignoring every tool mostly still fails (6%), so Easy is easy and not a walkover for a player who does nothing.
- **Easy may be generous.** Rush at 100% means a player who takes the main path and heals is barely tested. If that is too soft, move monster damage from 0.6 to about 0.7.
- **Hard bites.** A careful player drops to 79% (the Queen kills 40 of 200), and a player who skips the loot wins 29%.
- Not measured: whether a human can tell the levels apart in the first minutes, and the Hard numbers for the average and careless bots.

## Splitting oozes

Cinder Dart now splits a Mire Ooze (see `docs/DESIGN.md` section 14). The bot never burns oozes (a player who has seen one split would not), so the simulator's numbers did not move: careful 100%, rush 82%, average 24% over 200 slow-pace runs. The cost of burning an ooze, more bodies in the corridor and no extra XP, is therefore not measured. Reading the rules, a Magister who burns oozes pays for it and gains nothing.

## Re-tuning

Edit the numbers in `js/data/monsters.js`, `js/data/floors.js` (monster counts, items), `js/combat.js` (`XP_LEVELS`) or `js/magic.js` (hunger, resting), then:

```
node tools/balance.mjs 100 --pace=slow          # all variants
node tools/balance.mjs 100 --variant=careful --pace=human
npm test                                         # includes guard-rail checks on the difficulty
```

## The prison guardroom (tools/prison.mjs)

The optional prison wing on floor 2 is guarded by three Gravebound Guards, a Bone Wretch and a Cinder Wraith (XP about 45 each for a
party that clears it). `node tools/prison.mjs [runs] --levels=2,3 [--difficulty=hard]` plays that one fight with the real rules.
The party holds the doorway, heals under 55%, slows guards with Frostbind, and uses no potions. A second case (`charge`, used from
the scratch script, not the CLI) steps inside and fights surrounded.

Findings: single file through the door, every hero can hit the one monster ahead, so even four guards are easy. The first garrison
(two guards and a wretch) cost the party 10% of its HP. The chosen garrison costs about 20% at levels 2 and 3 holding the doorway,
about 30% charging in, and loses a hero in roughly 1 run in 20 at level 2 on Normal (1 in 5 on Hard). Win rate is about 100% at every
setting. That fits optional content: worth doing carefully, never a wall. A fourth guard made the bot stall (nothing came through the
door), so it was left out. If the wing should be harder, add a ranged monster that shoots down the corridor rather than more melee.

## Gear (weapons, armor and accessories)

The balance bot now picks up gear and equips it sensibly (better weapon by damage per second, higher armor, a free accessory), and
a player who takes everything (`careful`) also clears the optional prison wing on floor 2 and frees Tavin. `*-nogear` variants play the
same routes without equipping anything, so the difference is the effect of gear. 100 runs each, slow pace, Normal unless noted:

| player | without gear | with gear |
|---|---|---|
| careful | 100% | 100% |
| rush (takes what lies in the open) | 73% | 94% |
| average (rests late) | 26% | 64% |
| careful, Hard | 79% | 100% |
| rush, Hard | 29% | 57% |

Gear is much stronger than its numbers suggest. Two points of armor change how often enemies hit, a ring adds health to every fight, and several
pieces lie in the open on the main route, so an ordinary player collects them. Normal is easier than the previous retune, and Hard no longer
challenges a careful player. Two honest ways to restore the old feel: lower the gear (for example drop Plate Harness to armor 4 and Ring of
Vigor to +4), or raise the monsters' damage (Hard `enemyDmg` from 1.3 to about 1.5). Neither has been done. The test `tests/balance.mjs`
now expects damage to climb with depth rather than floor by floor, because floor 2 includes the prison fight for a player who takes everything.

### Hard retuned after gear

Hard monster damage went from 1.3 to 1.5. With gear, careful on Hard wins 98% (it was 100% at 1.3) and rush on Hard 32% (57% at 1.3,
29% before gear), so rush is back to its pre-gear level. A careful player who takes all the gear and the prison NPC stays strong on Hard,
which is a fair reward for finding things. At 1.65 rush fell to 22%, which felt too punishing. Normal and Easy are unchanged by this and
are easier than before gear (see the table above).
