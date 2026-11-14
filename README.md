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

## Test

    npm test

Runs the rules tests: the map walkthrough (`js/world.js`), party and hero creation, combat
(`js/combat.js`), spells, resting, food, potions and shrines (`js/magic.js`), the solvability of the whole campaign
(`tests/campaign.mjs`), the dungeon rules, boss fight and journal (`tests/dungeon.mjs`), saving (`tests/save.mjs`), and sound and animation
(`tests/feel.mjs`).

Optional: `tests/browser/playthrough.cjs` plays the whole game in a real browser (needs Playwright; see its header).

## Using your own data and graphics

- Classes: `js/data/classes.js`. Premade heroes: `js/data/roster.js` (same shape as a created hero).
- Portraits: put images in `assets/portraits/` and set `portrait: 'assets/portraits/name.png'` on a roster entry.
  Without one, a letter tile is shown.
- Monsters: `js/data/monsters.js`; weapons: `js/data/weapons.js`. Set `sprite: 'assets/monsters/x.png'` on a
  monster to replace the drawn placeholder.
- Spells: `js/data/spells.js`. Spell slots by class and level: `js/spellbook.js`.
- Floors: `js/data/floors.js` (rectangles of floor plus special tiles; the campaign test checks every floor can be finished).
