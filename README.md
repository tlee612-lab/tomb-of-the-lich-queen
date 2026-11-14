# Tomb of the Lich Queen

A retro first-person dungeon crawler for the browser. See [docs/DESIGN.md](docs/DESIGN.md).

## Run
No build step. Serve the folder and open it:

    python3 -m http.server 8000

then visit http://localhost:8000.

Controls: W/S move, A/D sidestep, Q/E turn, F / Space / click the view to use what is in front.

## Test

    npm test

Plays the test map through the rules in `js/world.js` (doors, keys, plates, switches,
teleporter, spinner).

## Using your own data and graphics

- Classes: `js/data/classes.js`. Premade heroes: `js/data/roster.js` (same shape as a created hero).
- Portraits: put images in `assets/portraits/` and set `portrait: 'assets/portraits/name.png'` on a roster entry.
  Without one, a letter tile is shown.
