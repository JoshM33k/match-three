// Plays levels headlessly with the real board rules and a greedy bot to
// calibrate score targets. Usage: node tools/simulate.mjs [games=200]
import {
  makeRng, createGrid, findMatchGroups, findValidMoves, isSpecialSwap, swapCells,
  swapEffects, expandClears, applyGravity, key,
} from '../src/board.js';
import { getLevel, ROWS, COLS } from '../src/levels.js';

const SPECIAL_BONUS = { lineH: 60, lineV: 60, bomb: 100, rainbow: 200, pal: 80 };

function resolve(grid, rng, types, first, tally, goo) {
  let score = 0;
  let combo = 1;
  let pending = first;
  for (;;) {
    let groups = [];
    let res;
    if (pending) {
      res = pending;
      pending = null;
    } else {
      groups = findMatchGroups(grid);
      if (!groups.length) break;
      const protect = new Set(groups.filter((g) => g.special).map((g) => key(...g.spawn)));
      res = { ...expandClears(grid, groups.flatMap((g) => g.cells), [], { protect }), groups };
    }
    score += res.cleared.size * 20 * combo;
    for (const { r, c } of res.cleared.values()) {
      const t = grid[r][c];
      if (t && t.type >= 0) tally[t.type] = (tally[t.type] || 0) + 1;
      goo.delete(key(r, c));
      grid[r][c] = null;
    }
    for (const g of res.groups || []) {
      if (!g.special) continue;
      score += SPECIAL_BONUS[g.special];
      const t = grid[g.spawn[0]][g.spawn[1]];
      if (t) {
        t.special = g.special;
        if (g.special === 'rainbow') t.type = -1;
      }
    }
    applyGravity(grid, () => ({ type: Math.floor(rng() * types), special: null }));
    combo++;
  }
  return score;
}

function firstClear(grid, a, b) {
  const ta = grid[a[0]][a[1]];
  const tb = grid[b[0]][b[1]];
  if (isSpecialSwap(ta, tb)) {
    const rainbow = ta.special === 'rainbow' || tb.special === 'rainbow';
    const consumed = [a, b].filter(([r, c]) => !rainbow || grid[r][c].special === 'rainbow').map(([r, c]) => key(r, c));
    return { ...expandClears(grid, [a, b], swapEffects(grid, a, b), { consumed }), groups: [] };
  }
  const groups = findMatchGroups(grid, [a, b]);
  const protect = new Set(groups.filter((g) => g.special).map((g) => key(...g.spawn)));
  return { ...expandClears(grid, groups.flatMap((g) => g.cells), [], { protect }), groups };
}

/** Value of a move = tiles cleared now + a nudge for making specials. */
function evaluate(grid, m, goo) {
  swapCells(grid, m.a, m.b);
  const res = firstClear(grid, m.a, m.b);
  swapCells(grid, m.a, m.b);
  let gooHit = 0;
  for (const k of res.cleared.keys()) if (goo.has(k)) gooHit++;
  return res.cleared.size + gooHit * 2 + res.groups.reduce((s, g) => s + (g.special ? 4 : 0), 0);
}

export function play(n, seed, skill = 0.75) {
  const lv = getLevel(n);
  const rng = makeRng(seed);
  const grid = createGrid(ROWS, COLS, lv.types, rng, (type) => ({ type, special: null }));
  let score = 0;
  const tally = {};
  const goo = new Set((lv.goo || []).map(([r, c]) => key(r, c)));
  for (let mv = 0; mv < lv.moves; mv++) {
    let moves = findValidMoves(grid);
    if (!moves.length) break;
    let m;
    if (rng() < skill) {
      let best = -1;
      for (const cand of moves) {
        const v = evaluate(grid, cand, goo) + rng() * 0.5;
        if (v > best) {
          best = v;
          m = cand;
        }
      }
    } else m = moves[Math.floor(rng() * moves.length)];
    swapCells(grid, m.a, m.b);
    score += resolve(grid, rng, lv.types, firstClear(grid, m.a, m.b), tally, goo);
  }
  const cleared = Object.values(tally).reduce((a, b) => a + b, 0);
  const collected = (!lv.boss || cleared >= lv.boss.hp) && goo.size === 0 && lv.collect.filter((g) => g.type >= 0).every((g) => (tally[g.type] || 0) >= g.count);
  return { score, collected, cleared, target: lv.target, stars: lv.stars };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = Number(process.argv[2]) || 200;
  for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 15, 18, 20, 22, 30]) {
    const scores = [];
    let wins = 0;
    for (let i = 0; i < games; i++) {
      const g = play(n, i * 31 + n);
      scores.push(g.score);
      if (g.collected && g.score >= g.target) wins++;
    }
    scores.sort((a, b) => a - b);
    const { target, stars } = getLevel(n);
    const pct = (p) => scores[Math.floor(p * (scores.length - 1))];
    const win = wins / games;
    const three = scores.filter((s) => s >= stars[2]).length / games;
    console.log(`L${String(n).padStart(2)} target ${String(target).padStart(5)}  p25 ${pct(0.25)}  median ${pct(0.5)}  p75 ${pct(0.75)}  win ${(win * 100).toFixed(0)}%  3* ${(three * 100).toFixed(0)}%`);
  }
}
