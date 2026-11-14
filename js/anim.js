// Presentation-only animation timing. The game rules never wait for it: moves happen instantly and the view
// catches up. cz is a camera offset along the corridor in cells (1 = one cell behind where we now are).
export const STEP_MS = 140, FADE_MS = 140;

export const startAnim = (kind, now) => ({ kind, t0: now });

export function animView(anim, now) {
  if (!anim) return { cz: 0, fade: 0, done: true };
  const dur = anim.kind === 'fade' ? FADE_MS : STEP_MS;
  const t = Math.min(1, Math.max(0, (now - anim.t0) / dur)), left = 1 - t;
  const eased = left * left * (3 - 2 * left);              // smoothstep on the remaining distance
  if (anim.kind === 'fwd') return { cz: eased, fade: 0, done: t >= 1 };
  if (anim.kind === 'back') return { cz: -eased, fade: 0, done: t >= 1 };
  return { cz: 0, fade: eased * 0.9, done: t >= 1 };
}

// Which animation, if any, does a change in position call for? `before`/`after` are { floor, x, y, dir }.
// `facing` is the delta of the direction we face when the move started.
export function classifyMove(before, after, dx, dy) {
  if (before.floor !== after.floor) return 'fade';
  const moved = before.x !== after.x || before.y !== after.y;
  if (!moved) return before.dir !== after.dir ? 'fade' : null;
  if (before.dir !== after.dir) return 'fade';              // moved and turned: spinner
  const sx = after.x - before.x, sy = after.y - before.y;
  if (Math.abs(sx) + Math.abs(sy) !== 1) return 'fade';     // a jump: teleporter
  if (sx === dx && sy === dy) return 'fwd';
  if (sx === -dx && sy === -dy) return 'back';
  return 'fade';                                            // sidestep
}
