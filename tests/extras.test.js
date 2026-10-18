import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDailyLevel, getLevel, SHAPES, voidsOf } from '../src/levels.js';
import { checkStickers, STICKERS } from '../src/stickers.js';
import { HATS, hatUnlocked } from '../src/hats.js';
import { createGrid, findMatchGroups, makeRng } from '../src/board.js';

test('daily challenge is the same all day and changes between days', () => {
  const a = getDailyLevel('2026-10-18');
  assert.deepEqual(a, getDailyLevel('2026-10-18'));
  const seeds = new Set(['2026-10-18', '2026-10-19', '2026-10-20', '2026-10-21'].map((d) => getDailyLevel(d).seed));
  assert.equal(seeds.size, 4);
});

test('shapes are 8x8 and every level with one can be filled', () => {
  for (const [name, rows] of Object.entries(SHAPES)) {
    assert.equal(rows.length, 8, name);
    for (const row of rows) assert.equal(row.length, 8, name);
  }
  for (let n = 1; n <= 40; n++) {
    const lv = getLevel(n);
    if (!lv.shape) continue;
    const voids = voidsOf(lv.shape);
    const g = createGrid(8, 8, lv.species, makeRng(n), (type) => ({ type, special: null }), voids);
    assert.equal(findMatchGroups(g).length, 0);
    for (const [r, c] of lv.goo || []) assert.ok(!voids.has(r * 64 + c), 'goo never sits in a hole');
  }
});

test('stickers are awarded once', () => {
  const s = { level: 1, stars: {}, stats: { popped: { 0: 3 }, hatched: 0, bosses: 0, bestCombo: 3, made: { rainbow: 1 } } };
  const first = checkStickers(s).map((x) => x.id);
  assert.deepEqual(first.sort(), ['combo3', 'first', 'rainbow']);
  assert.equal(checkStickers(s).length, 0);
  assert.equal(new Set(STICKERS.map((x) => x.id)).size, STICKERS.length, 'ids are unique');
});

test('hats unlock with progress', () => {
  const fresh = { level: 1, stars: {}, stats: { bosses: 0 } };
  assert.deepEqual(HATS.filter((h) => hatUnlocked(h, fresh)).map((h) => h.id), ['none']);
  const veteran = { level: 30, stars: Object.fromEntries([...Array(20)].map((_, i) => [i + 1, 3])), stats: { bosses: 2 } };
  assert.equal(HATS.filter((h) => hatUnlocked(h, veteran)).length, HATS.length);
});

test('Shroomy joins from the third world, keeping six species', () => {
  assert.ok(!getLevel(20).species.includes(6));
  for (const n of [21, 31, 45, 70]) {
    const sp = getLevel(n).species;
    assert.equal(sp.length, 6);
    assert.ok(sp.includes(6));
    for (const g of getLevel(n).collect) if (g.type >= 0) assert.ok(sp.includes(g.type), `goal ${g.type} on level ${n}`);
  }
});
