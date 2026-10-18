// Level configuration. Levels are generated from their number so the game
// goes on forever, getting gently harder.
import { makeRng } from './board.js';

export const ROWS = 8;
export const COLS = 8;

export function getLevel(n) {
  const rng = makeRng(n * 7919);
  const types = n <= 3 ? 5 : 6;
  const moves = Math.max(18, 22 - Math.floor(n / 4));
  // Targets come from simulated play (tools/simulate.mjs): a typical score
  // per move on a six-monster board, times a difficulty factor that ramps
  // from very forgiving to "you'll need a plan". (Five-monster boards score
  // about twice as much, so the first levels are a gentle warm-up.)
  const perMove = 215;
  const difficulty = Math.min(0.82, 0.4 + n * 0.032);
  const target = Math.round((perMove * moves * difficulty) / 50) * 50;
  const collect = [];
  // every fourth level from 4 has monster eggs to hatch
  const eggs = n >= 4 && n % 4 === 0 ? Math.min(12, 3 + Math.floor(n / 4)) : 0;
  if (eggs) collect.push({ type: -2, count: eggs });
  if (n >= 2 && n % 3 !== 1 && collect.length < 2) {
    const kinds = n % 3 === 0 && n >= 3 && !eggs ? 2 : 1;
    const pool = [...Array(types).keys()];
    for (let i = 0; i < kinds; i++) {
      const type = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      collect.push({ type, count: Math.min(24, 8 + Math.round(n * 0.7)) - (kinds - 1) * 3 });
    }
  }
  return {
    n,
    types,
    moves,
    target,
    stars: [target, Math.round(target * 1.35), Math.round(target * 1.75)],
    collect,
    eggs,
    seed: n * 104729 + Date.now(),
  };
}
