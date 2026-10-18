import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRng,
  createGrid,
  findRuns,
  findMatchGroups,
  findValidMoves,
  isValidSwap,
  expandClears,
  applyGravity,
  shuffleGrid,
  swapEffects,
  key,
} from '../src/board.js';

// Build a grid from rows of characters: digits are monster types,
// R is a rainbow, and a suffix map can add specials.
function grid(rows, specials = {}) {
  return rows.map((row, r) =>
    row.split('').map((ch, c) => {
      if (ch === '.') return null;
      const t = ch === 'R' ? { type: -1, special: 'rainbow' } : { type: Number(ch), special: null };
      const s = specials[`${r},${c}`];
      if (s) t.special = s;
      return t;
    })
  );
}

test('createGrid has no matches and at least one move', () => {
  for (let seed = 1; seed < 40; seed++) {
    const g = createGrid(8, 8, 6, makeRng(seed), (type) => ({ type, special: null }));
    assert.equal(findRuns(g).length, 0);
    assert.ok(findValidMoves(g).length > 0);
  }
});

test('three in a row is a plain match', () => {
  const g = grid(['0001', '1234', '2345']);
  const groups = findMatchGroups(g);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].cells.length, 3);
  assert.equal(groups[0].special, null);
});

test('four in a row makes a line blaster at the swapped cell', () => {
  const g = grid(['00001', '12341', '23452']);
  const [group] = findMatchGroups(g, [[0, 1]]);
  assert.equal(group.special, 'lineV');
  assert.deepEqual(group.spawn, [0, 1]);
});

test('L shape makes a bomb at the corner', () => {
  const g = grid(['0001', '0234', '0345']);
  const [group] = findMatchGroups(g);
  assert.equal(group.special, 'bomb');
  assert.equal(group.cells.length, 5);
  assert.deepEqual(group.spawn, [0, 0]);
});

test('five in a row makes a rainbow', () => {
  const g = grid(['000001', '123412']);
  const [group] = findMatchGroups(g);
  assert.equal(group.special, 'rainbow');
});

test('swap validity', () => {
  const g = grid(['0121', '2353', '4544']);
  assert.equal(isValidSwap(g, [0, 0], [0, 1]), false);
  assert.equal(isValidSwap(g, [1, 0], [0, 0]), false);
  assert.equal(isValidSwap(g, [2, 1], [2, 0]), true); // 4 slides into 5's spot: 444
  assert.equal(isValidSwap(g, [1, 2], [0, 2]), false);
  assert.equal(isValidSwap(g, [0, 2], [1, 2]), false);
});

test('rainbow swap is always valid and clears that colour', () => {
  const g = grid(['R1', '21', '12']);
  assert.ok(isValidSwap(g, [0, 0], [0, 1]));
  const effects = swapEffects(g, [0, 0], [0, 1]);
  const { cleared } = expandClears(g, [[0, 0]], effects, { consumed: [key(0, 0)] });
  const types = [...cleared.values()].map(({ r, c }) => g[r][c].type);
  assert.deepEqual(types.sort(), [-1, 1, 1, 1]);
});

test('line specials chain into each other', () => {
  const g = grid(['0120', '3456', '1234'], { '0,0': 'lineH', '0,3': 'lineV' });
  const { cleared, effects } = expandClears(g, [[0, 0]]);
  assert.equal(effects.length, 2);
  // whole top row plus the right column
  assert.equal(cleared.size, 4 + 2);
  assert.ok(cleared.get(key(2, 3)).delay > cleared.get(key(0, 3)).delay);
});

test('protected cells survive', () => {
  const g = grid(['000'], { '0,2': 'bomb' });
  const { cleared } = expandClears(g, [[0, 0], [0, 1]], [{ kind: 'line', dir: 'h', r: 0, c: 0 }], {
    protect: new Set([key(0, 2)]),
  });
  assert.equal(cleared.has(key(0, 2)), false);
});

test('gravity drops tiles and spawns new ones above', () => {
  const g = grid(['01', '.2', '3.']);
  let n = 0;
  const moves = applyGravity(g, () => ({ type: 9, special: null, n: n++ }));
  assert.deepEqual(g.map((row) => row.map((t) => t.type)), [[9, 9], [0, 1], [3, 2]]);
  const spawned = moves.filter((m) => m.spawned);
  assert.equal(spawned.length, 2);
  assert.ok(spawned.every((m) => m.fromR < 0));
});

test('shuffle produces a playable board', () => {
  const g = createGrid(8, 8, 5, makeRng(3), (type) => ({ type, special: null }));
  assert.ok(shuffleGrid(g, makeRng(9)));
  assert.equal(findRuns(g).length, 0);
  assert.ok(findValidMoves(g).length > 0);
});
