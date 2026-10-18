// Renders every monster in every expression to a PNG for reviewing the art.
// Usage: node tools/sprite-sheet.mjs [out.png]
import { writeFileSync } from 'node:fs';
import { MONSTERS, RAINBOW, EXPRESSIONS, SIZE, buildPixels } from '../src/sprites.js';
import { Raster } from './png.mjs';

const S = 6;
const PAD = 4;
const rows = [...MONSTERS.map((m) => [m, 'n']), [MONSTERS[0], 'lh'], [MONSTERS[2], 'lv'], [MONSTERS[1], 'b0'], [RAINBOW, 'rb']];
const cols = EXPRESSIONS.length + 4;
const cell = SIZE * S + PAD;
const r = new Raster(cols * cell + PAD, rows.length * cell + PAD);
r.fill(0, 0, r.w, r.h, '#3b2a7a');

rows.forEach(([def, variant], y) => {
  EXPRESSIONS.forEach((expr, x) => {
    r.blit(buildPixels(def, expr, 0, 0, variant, y), SIZE, PAD + x * cell, PAD + y * cell, S);
  });
  // look directions
  [[-1, 0], [1, 0], [0, -1], [1, 1]].forEach(([lx, ly], i) => {
    r.blit(buildPixels(def, 'idle', lx, ly, variant, y), SIZE, PAD + (EXPRESSIONS.length + i) * cell, PAD + y * cell, S);
  });
});

const out = process.argv[2] || 'sprite-sheet.png';
writeFileSync(out, r.png());
console.log('wrote', out);
