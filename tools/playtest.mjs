// Automated browser play-test: plays whole levels with random moves at 8x
// speed, then fires every special combination, and reports page errors or
// stuck states. Needs Playwright and a running server (npm start).
// Usage: node tools/playtest.mjs [levels=1,4,5,6,8] [url=http://localhost:8080/]
import { chromium, devices } from 'playwright';

const levels = (process.argv[2] || '1,4,5,6,8').split(',').map(Number);
const url = (process.argv[3] || 'http://localhost:8080/') + '?speed=8';
const browser = await chromium.launch();
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message + '\n' + e.stack));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(url);
await page.waitForTimeout(300);

// Step the game until it needs input; dismiss intros and tip cards.
const settle = () =>
  page.evaluate(async () => {
    const g = window.__monsterPop.game;
    for (let i = 0; i < 400; i++) {
      if (g.overlay && (g.overlay.kind === 'intro' || g.overlay.kind === 'tip')) g.overlay = null;
      if (g.state === 'idle' || g.state === 'done') return g.state;
      await new Promise((r) => setTimeout(r, 25));
    }
    return 'STUCK:' + g.state;
  });

for (const n of levels) {
  await page.evaluate((n) => window.__monsterPop.play(n), n);
  let moves = 0;
  for (;;) {
    const st = await settle();
    if (st.startsWith('STUCK')) {
      errors.push(`level ${n}: ${st}`);
      break;
    }
    if (st === 'done') break;
    await page.evaluate(async () => {
      const { findValidMoves } = await import('/src/board.js');
      const g = window.__monsterPop.game;
      const ms = findValidMoves(g.grid);
      const m = ms[Math.floor(Math.random() * ms.length)];
      g.trySwap(m.a, m.b);
    });
    moves++;
  }
  const res = await page.evaluate(() => window.__monsterPop.game.overlay?.kind);
  console.log(`level ${n}: ${res} after ${moves} moves`);
}

const combos = [['rainbow', 'rainbow'], ['rainbow', 'bomb'], ['rainbow', 'lineH'], ['bomb', 'bomb'], ['lineH', 'lineV'], ['bomb', 'lineV'], ['rainbow', null], ['pal', 'pal'], ['pal', 'bomb'], ['rainbow', 'pal'], ['pal', null]];
for (const [a, b] of combos) {
  await page.evaluate((l) => window.__monsterPop.play(l), levels[levels.length - 1]);
  await settle();
  await page.evaluate(([s1, s2]) => {
    const g = window.__monsterPop.game;
    for (const [t, sp] of [[g.grid[4][3], s1], [g.grid[4][4], s2]]) {
      if (t.type < 0) t.type = 0;
      t.special = sp;
      if (sp === 'rainbow') t.type = -1;
    }
    g.trySwap([4, 3], [4, 4]);
  }, [a, b]);
  const st = await settle();
  const holes = await page.evaluate(() => window.__monsterPop.game.grid.flat().filter((t) => !t).length);
  if (st.startsWith('STUCK') || holes) errors.push(`combo ${a}+${b}: ${st}, ${holes} holes`);
}
console.log(`special combos: ${combos.length} tried`);
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
