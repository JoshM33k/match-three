import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getLevel } from '../src/levels.js';
import { play } from '../tools/simulate.mjs';

test('levels stay winnable for a decent player', () => {
  for (const n of [1, 5, 6, 7, 10, 13, 14, 16, 20, 22, 40]) {
    let wins = 0;
    const games = 40;
    for (let i = 0; i < games; i++) {
      const g = play(n, 1000 + i);
      if (g.collected && g.score >= g.target) wins++;
    }
    const rate = wins / games;
    assert.ok(rate >= 0.3, `level ${n} win rate ${rate}`);
    if (n <= 5) assert.ok(rate >= 0.85, `early level ${n} should be easy, got ${rate}`);
  }
});

test('level goals are well formed', () => {
  for (let n = 1; n <= 60; n++) {
    const lv = getLevel(n);
    assert.ok(lv.moves >= 18 && lv.moves <= 22);
    assert.ok(lv.stars[0] === lv.target && lv.stars[1] > lv.stars[0] && lv.stars[2] > lv.stars[1]);
    assert.ok(lv.collect.length <= 2, 'HUD fits at most two goals');
    for (const g of lv.collect) assert.ok(g.count > 0 && g.count <= 24);
  }
});
