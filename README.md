# Tomb of the Lich Queen

A retro first-person dungeon crawler for the browser. See [docs/DESIGN.md](docs/DESIGN.md).

## Run
No build step. Serve the folder and open it:

    python3 -m http.server 8000

then visit http://localhost:8000.

Controls: W/S move, A/D sidestep, Q/E turn, F / Space / click the view to use what is in front.
Click a monster in front of you, or press 1-4, to attack with that hero. P pauses. Esc opens the menu (save, load,
journal, help), J the journal, M toggles sound.
Spells: click a spell on a caster's card (enemy spells fire at the monster in front; ally spells then ask you to click a hero). R or the Rest button rests. F on a shrine prays.

Difficulty: pick Easy, Normal or Hard on the new-game screen. You can change it later from the Esc menu, at any time, even after a defeat. The numbers are in `js/difficulty.js`.

## Test

    npm test

Runs the rules tests: the map walkthrough (`js/world.js`), party and hero creation, combat
(`js/combat.js`), spells, resting, food, potions and shrines (`js/magic.js`), the solvability of the whole campaign
(`tests/campaign.mjs`), the dungeon rules, boss fight and journal (`tests/dungeon.mjs`), saving (`tests/save.mjs`), and sound and animation
(`tests/feel.mjs`).

Optional: `tests/browser/playthrough.cjs` plays the whole game in a real browser (needs Playwright; see its header).

## Using your own data and graphics

- Classes: `js/data/classes.js`. Premade heroes: `js/data/roster.js` (same shape as a created hero).
- Portraits: 89 painted portraits (160px) live in `assets/portraits/`, listed in `js/data/portraits.js`. Each roster hero has a default in `js/data/roster.js`. On the new-game screen, click a hero's portrait to pick another from a filterable grid; the choice is remembered in the browser. Created heroes start with a portrait that suits their class.
  Without one, a letter tile is shown.
- Monsters: `js/data/monsters.js`; weapons: `js/data/weapons.js`. Set `sprite: 'assets/monsters/x.png'` on a
  monster to replace the drawn placeholder.
- Spells: `js/data/spells.js`. Spell slots by class and level: `js/spellbook.js`.
- Floors: `js/data/floors.js` (rectangles of floor plus special tiles; the campaign test checks every floor can be finished).

## Balance

`npm run balance` plays the real game with a seeded bot and prints win rates and resource use for several player styles and parties. The method, results and open problems are in [docs/BALANCE.md](docs/BALANCE.md).
