// Pixel drawing helpers: a 3x5 bitmap font, chunky panels, buttons and icons.
// Everything draws at integer coordinates on the low-res canvas.

const GLYPHS = {
  A: '.#.#.#####.##.#',
  B: '##.#.###.#.###.',
  C: '.###..#..#...##',
  D: '##.#.##.##.###.',
  E: '####..##.#..###',
  F: '####..##.#..#..',
  G: '.###..#.##.#.##',
  H: '#.##.#####.##.#',
  I: '###.#..#..#.###',
  J: '..#..#..##.#.#.',
  K: '#.##.###.#.##.#',
  L: '#..#..#..#..###',
  M: '#.########.##.#',
  N: '##.#.##.##.##.#',
  O: '.#.#.##.##.#.#.',
  P: '##.#.###.#..#..',
  Q: '.#.#.##.###..##',
  R: '##.#.###.#.##.#',
  S: '.###...#...###.',
  T: '###.#..#..#..#.',
  U: '#.##.##.##.####',
  V: '#.##.##.##.#.#.',
  W: '#.##.########.#',
  X: '#.##.#.#.#.##.#',
  Y: '#.##.#.#..#..#.',
  Z: '###..#.#.#..###',
  0: '####.##.##.####',
  1: '.#.##..#..#.###',
  2: '##...#.#.#..###',
  3: '##...#.#...###.',
  4: '#.##.####..#..#',
  5: '####..##...###.',
  6: '.###..####.####',
  7: '###..#.#..#..#.',
  8: '####.#####.####',
  9: '####.####..###.',
  '!': '.#..#..#.....#.',
  '?': '##...#.#.....#.',
  '.': '.............#.',
  ',': '..........#.#..',
  ':': '....#.....#....',
  '-': '......###......',
  '+': '....#.###.#....',
  '/': '..#..#.#.#..#..',
  "'": '.#..#..........',
  '%': '#.#..#.#.#..#.#',
  '*': '...#.#.#.#.#...',
  '<': '..#.#.#...#...#',
  '>': '#...#...#.#.#..',
  ' ': '...............',
};

// Some letters read much better a little wider.
const WIDE = {
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.'],
  Q: ['.##.', '#..#', '#..#', '#.#.', '.#.#'],
  P: ['###', '#.#', '###', '#..', '#..'],
};

const ROWS = {};
for (const [ch, g] of Object.entries(GLYPHS)) ROWS[ch] = [0, 1, 2, 3, 4].map((r) => g.slice(r * 3, r * 3 + 3));
Object.assign(ROWS, WIDE);

export const GLYPH_H = 5;

const glyph = (ch) => ROWS[ch] || ROWS['?'];

export function textWidth(text, scale = 1) {
  let w = 0;
  for (const ch of String(text).toUpperCase()) w += glyph(ch)[0].length + 1;
  return Math.max(0, w - 1) * scale;
}

const textCache = new Map();

function renderText(text, color, scale, outline) {
  const pad = outline ? 1 : 0;
  const w = textWidth(text, scale) + pad * 2;
  const h = GLYPH_H * scale + pad * 2 + (outline ? 1 : 0);
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = h;
  const g = c.getContext('2d');
  const draw = (ox, oy, col) => {
    g.fillStyle = col;
    let x = ox;
    for (const ch of text) {
      const rows = glyph(ch);
      for (let r = 0; r < GLYPH_H; r++) {
        for (let i = 0; i < rows[r].length; i++) {
          if (rows[r][i] === '#') g.fillRect(x + i * scale, oy + r * scale, scale, scale);
        }
      }
      x += (rows[0].length + 1) * scale;
    }
  };
  if (outline) {
    // drop shadow then a 1px outline all round
    draw(pad, pad + 2, outline);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      draw(pad + dx, pad + dy, outline);
    }
  }
  draw(pad, pad, color);
  return c;
}

/**
 * Draw text. align: 'left' | 'center' | 'right'. Returns drawn width.
 * With an outline the text grows by 1px on each side plus a shadow.
 */
export function drawText(ctx, text, x, y, { color = '#ffffff', scale = 1, align = 'left', outline = null } = {}) {
  text = String(text).toUpperCase();
  const k = `${text}|${color}|${scale}|${outline}`;
  let c = textCache.get(k);
  if (!c) {
    if (textCache.size > 400) textCache.clear();
    c = renderText(text, color, scale, outline);
    textCache.set(k, c);
  }
  const pad = outline ? 1 : 0;
  let dx = x - pad;
  if (align === 'center') dx = x - Math.floor(c.width / 2);
  else if (align === 'right') dx = x - c.width + pad;
  ctx.drawImage(c, Math.round(dx), Math.round(y - pad));
  return c.width;
}

/** Rounded pixel rectangle with an optional 1px border. */
export function panel(ctx, x, y, w, h, fill, border = null, r = 2) {
  x = Math.round(x);
  y = Math.round(y);
  if (border) {
    roundRect(ctx, x, y, w, h, r, border);
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, Math.max(0, r - 1), fill);
  } else {
    roundRect(ctx, x, y, w, h, r, fill);
  }
}

export function roundRect(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  if (r <= 0) {
    ctx.fillRect(x, y, w, h);
    return;
  }
  ctx.fillRect(x + r, y, w - r * 2, h);
  ctx.fillRect(x, y + r, w, h - r * 2);
  for (let i = 1; i < r; i++) {
    ctx.fillRect(x + r - i, y + i, w - (r - i) * 2, h - i * 2);
  }
}

const ICONS = {
  star: ['..#..', '..#..', '#####', '.###.', '##.##'],
  bigstar: [
    '....#....',
    '...###...',
    '...###...',
    '#########',
    '.#######.',
    '..#####..',
    '..##.##..',
    '.##...##.',
    '.#.....#.',
  ],
  heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
  pause: ['##.##', '##.##', '##.##', '##.##', '##.##'],
  sound: ['...#.', '..##.', '####.', '####.', '..##.', '...#.'],
  music: ['..###', '..#.#', '..#.#', '###.#', '##.##', '...##'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  play: ['#...', '##..', '###.', '##..', '#...'],
  retry: ['.###.', '#...#', '#.###', '#..#.', '.##..'],
  home: ['..#..', '.###.', '#####', '.#.#.', '.###.'],
  arrowR: ['#..', '##.', '###', '##.', '#..'],
  arrowL: ['..#', '.##', '###', '.##', '..#'],
  arrowU: ['..#..', '.###.', '#####'],
  arrowD: ['#####', '.###.', '..#..'],
};

export function icon(ctx, name, x, y, color, scale = 1) {
  const rows = ICONS[name];
  ctx.fillStyle = color;
  x = Math.round(x);
  y = Math.round(y);
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === '#') ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
    }
  }
}

export function iconSize(name, scale = 1) {
  const rows = ICONS[name];
  return { w: rows[0].length * scale, h: rows.length * scale };
}

/** Icon with a dark outline (draws the shape offset in 8 directions first). */
export function iconOutlined(ctx, name, x, y, color, outline, scale = 1) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1], [0, 2]]) {
    icon(ctx, name, x + dx, y + dy, outline, scale);
  }
  icon(ctx, name, x, y, color, scale);
}

/** Bresenham line of square pixels. */
export function pixelLine(ctx, x0, y0, x1, y1, color, size = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  ctx.fillStyle = color;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    ctx.fillRect(x0 - (size >> 1), y0 - (size >> 1), size, size);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Pixel circle outline (midpoint algorithm). */
export function pixelCircle(ctx, cx, cy, r, color, size = 1) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.round(r);
  ctx.fillStyle = color;
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    for (const [px, py] of [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]]) {
      ctx.fillRect(cx + px, cy + py, size, size);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
}

export class Button {
  constructor({ label = '', icon: ic = null, x = 0, y = 0, w = 40, h = 16, color = '#ff7eb6', shade = '#c2407e', onClick }) {
    Object.assign(this, { label, icon: ic, x, y, w, h, color, shade, onClick });
    this.pressed = false;
  }

  hit(px, py) {
    return px >= this.x && py >= this.y && px < this.x + this.w && py < this.y + this.h;
  }

  draw(ctx, time = 0) {
    const off = this.pressed ? 1 : 0;
    const { x, y, w, h } = this;
    panel(ctx, x, y + 1, w, h, '#1a0b2e', null, 3);
    panel(ctx, x, y + off, w, h - 1, '#1a0b2e', null, 3);
    roundRect(ctx, x + 1, y + 1 + off, w - 2, h - 3, 2, this.shade);
    roundRect(ctx, x + 1, y + 1 + off, w - 2, h - 5, 2, this.color);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x + 3, y + 2 + off, w - 6, 1);
    const cy = y + off + Math.floor((h - 3) / 2) - 2;
    if (this.icon && this.label) {
      const iw = iconSize(this.icon).w;
      const tw = textWidth(this.label);
      const sx = x + Math.floor((w - iw - 3 - tw) / 2);
      icon(ctx, this.icon, sx, cy, '#ffffff');
      drawText(ctx, this.label, sx + iw + 3, cy, { color: '#ffffff' });
    } else if (this.icon) {
      const s = iconSize(this.icon);
      icon(ctx, this.icon, x + Math.floor((w - s.w) / 2), y + off + Math.floor((h - 3 - s.h) / 2) + 1, '#ffffff');
    } else {
      drawText(ctx, this.label, x + Math.floor(w / 2), cy, { color: '#ffffff', align: 'center' });
    }
    void time;
  }
}
