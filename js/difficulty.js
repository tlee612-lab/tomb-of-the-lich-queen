// Difficulty settings. No DOM here. A game carries `g.difficulty` (an id from this table); a missing or unknown id
// means Normal, so older data and tests keep working. The numbers were checked with the balance simulator
// (docs/BALANCE.md, "Difficulty setting").
//   enemyDmg: multiplier on damage monsters deal (a hit always does at least 1)
//   restHeal: fraction of max HP a full rest restores (Normal is the original 0.5)
//   wanderer: chance a rest is interrupted by a wandering monster
//   rations:  rations the party starts a new game with
export const DIFFICULTIES = {
  easy:   { name: 'Easy',   enemyDmg: 0.6, restHeal: 0.75, wanderer: 0.1,  rations: 4,
            text: 'Monsters hit about 40% softer, rests heal more and are rarely interrupted, and you start with an extra ration. For learning the tomb, or a way past the Queen.' },
  normal: { name: 'Normal', enemyDmg: 1,   restHeal: 0.5,  wanderer: 0.25, rations: 3,
            text: 'The game as designed. Careful play wins; careless play does not.' },
  hard:   { name: 'Hard',   enemyDmg: 1.3, restHeal: 0.4,  wanderer: 0.35, rations: 3,
            text: 'Monsters hit about 30% harder, rests heal less and are interrupted more often. For players who found Normal easy.' },
};
export const DEFAULT_DIFFICULTY = 'normal';
export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);

export const diff = g => DIFFICULTIES[g.difficulty] || DIFFICULTIES[DEFAULT_DIFFICULTY];

// Sets the difficulty. `fresh: true` is for a new game: it also sets the starting rations. Returns false for an unknown id.
export function setDifficulty(g, id, { fresh = false } = {}) {
  if (!DIFFICULTIES[id]) return false;
  g.difficulty = id;
  if (fresh) g.rations = DIFFICULTIES[id].rations;
  return true;
}
