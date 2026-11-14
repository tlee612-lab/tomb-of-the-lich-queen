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

## Re-tuning

Edit the numbers in `js/data/monsters.js`, `js/data/floors.js` (monster counts, items), `js/combat.js` (`XP_LEVELS`) or `js/magic.js` (hunger, resting), then:

```
node tools/balance.mjs 100 --pace=slow          # all variants
node tools/balance.mjs 100 --variant=careful --pace=human
npm test                                         # includes guard-rail checks on the difficulty
```
