// Generates the app icons from the monster sprites.
// Usage: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { MONSTERS, SIZE, buildPixels } from '../src/sprites.js';
import { Raster } from './png.mjs';

mkdirSync('icons', { recursive: true });

function makeIcon(px, file, { round = true } = {}) {
  // 24x24 pixel-art canvas: background tile + Bloop front and centre.
  const grid = 24;
  const s = Math.floor(px / grid);
  const r = new Raster(px, px);
  const off = Math.floor((px - grid * s) / 2);
  r.fill(0, 0, px, px, '#3d2a7f');
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const stripe = (x + y) % 6 < 3;
      r.fill(off + x * s, off + y * s, s, s, stripe ? '#4a3290' : '#3d2a7f');
    }
  }
  if (round) {
    // soft rounded corners filled with the page colour
    const rr = 3;
    for (let y = 0; y < rr; y++) {
      for (let x = 0; x < rr - y; x++) {
        for (const [cx, cy] of [[x, y], [grid - 1 - x, y], [x, grid - 1 - y], [grid - 1 - x, grid - 1 - y]]) {
          r.fill(off + cx * s, off + cy * s, s, s, '#2a1a5e');
        }
      }
    }
  }
  const b = 4;
  r.blit(buildPixels(MONSTERS[0], 'happy'), SIZE, off + b * s, off + (b + 1) * s, s);
  writeFileSync(file, r.png());
}

makeIcon(32, 'icons/icon-32.png');
makeIcon(192, 'icons/icon-192.png');
makeIcon(512, 'icons/icon-512.png');
makeIcon(180, 'icons/apple-touch-icon.png', { round: false });
makeIcon(512, 'icons/icon-maskable-512.png', { round: false });
console.log('icons written');
