// Level configuration. Levels are generated from their number so the game
// goes on forever, getting gently harder.
import { makeRng } from './board.js';

export const ROWS = 8;
export const COLS = 8;

export function getLevel(n) {
  const rng = makeRng(n * 7919);
  const types = n <= 3 ? 5 : 6;
  const moves = Math.max(16, 22 - Math.floor(n / 3));
  const target = Math.round((900 + n * 450 + Math.max(0, n - 5) * 150) / 50) * 50;
  const collect = [];
  if (n >= 2 && n % 3 !== 1) {
    const kinds = n % 3 === 0 && n >= 3 ? 2 : 1;
    const pool = [...Array(types).keys()];
    for (let i = 0; i < kinds; i++) {
      const type = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      collect.push({ type, count: Math.min(45, 10 + n * 2 - kinds * 3) });
    }
  }
  return {
    n,
    types,
    moves,
    target,
    stars: [target, Math.round(target * 1.5), Math.round(target * 2.1)],
    collect,
    seed: n * 104729 + Date.now(),
  };
}
