// Monster Book: meet the cast, see how many you've popped, poke them.
import { getSprite, MONSTERS } from './sprites.js';
import { drawText, Button, panel, roundRect, wrapText, icon } from './pixel.js';
import { STICKERS } from './stickers.js';

const BIOS = [
  'A SQUISHY SLIME DROP. LOVES PUDDLES AND HUGS, AND GOES BLOOP WHEN HAPPY.',
  'LOOKS GRUMPY, IS SECRETLY A BIG SOFTIE. HUFFS STEAM WHEN THINKING HARD.',
  'SEES EVERYTHING WITH ONE BIG EYE. ITS ANTENNA PICKS UP CARTOON SIGNALS.',
  'A FLUFFBALL WHO NEVER BRUSHES. ITS TINY RAWR IS TERRIFYING (TO ANTS).',
  'A SHY LITTLE GHOST. FADES AWAY WHEN EMBARRASSED, WHICH IS OFTEN.',
  'FELL FROM THE SKY ONE NIGHT AND DECIDED TO STAY. WAVES AT EVERYONE.',
];
const POKES = ['happy', 'surprised', 'excited', 'dizzy', 'squish', 'sad', 'love', 'laugh', 'wink'];

export class Book {
  constructor(app) {
    this.app = app;
    this.time = 0;
    this.selected = 0;
    this.tab = 'monsters';
    this.sticker = 0;
    this.cards = MONSTERS.map((_, i) => ({ type: i, hop: 0, hopV: 0, expr: null, exprT: 0 }));
    this.layout();
  }

  layout() {
    const { vw, vh, safeTop } = this.app;
    this.back = new Button({ icon: 'home', x: 4, y: safeTop + 5, w: 22, h: 18, color: '#a47bff', shade: '#6a44b8', onClick: () => this.app.toTitle() });
    const tabY = safeTop + 32;
    const mk = (label, tab, x) =>
      new Button({
        label,
        x,
        y: tabY,
        w: 70,
        h: 16,
        color: this.tab === tab ? '#ffa040' : '#5e4d80',
        shade: this.tab === tab ? '#c06a20' : '#3a2a58',
        onClick: () => {
          this.tab = tab;
          this.layout();
        },
      });
    this.tabs = [mk('MONSTERS', 'monsters', Math.floor(vw / 2) - 72), mk('STICKERS', 'stickers', Math.floor(vw / 2) + 2)];
    this.w = Math.min(vw - 8, 230);
    this.x0 = Math.floor((vw - this.w) / 2);
    this.cardW = Math.floor((this.w - 4) / 3);
    this.cardH = 52;
    const content = this.cardH * 2 + 4 + 6 + 56 + 6 + 40;
    this.y0 = Math.max(safeTop + 54, Math.floor((vh - content) / 2));
  }

  cardRect(i) {
    return {
      x: this.x0 + (i % 3) * (this.cardW + 2),
      y: this.y0 + Math.floor(i / 3) * (this.cardH + 4),
      w: this.cardW,
      h: this.cardH,
    };
  }

  update(dt) {
    this.time += dt;
    for (const c of this.cards) {
      if (c.exprT > 0) c.exprT -= dt;
      if (c.hopV !== 0 || c.hop < 0) {
        c.hopV += 600 * dt;
        c.hop += c.hopV * dt;
        if (c.hop >= 0) {
          c.hop = 0;
          c.hopV = 0;
        }
      }
    }
  }

  render(ctx) {
    const { vw, safeTop } = this.app;
    const stats = this.app.settings.stats || { popped: {}, hatched: 0, bosses: 0, bestCombo: 0 };
    panel(ctx, 0, 0, vw, safeTop + 28, 'rgba(26,11,46,0.85)', null, 0);
    drawText(ctx, 'MONSTER BOOK', Math.floor(vw / 2), safeTop + 8, { color: '#ffe04a', scale: 2, align: 'center', outline: '#140726' });
    this.back.draw(ctx, this.time);
    for (const t of this.tabs) t.draw(ctx, this.time);
    if (this.tab === 'stickers') {
      this.renderStickers(ctx);
      return;
    }

    this.cards.forEach((c, i) => {
      const r = this.cardRect(i);
      const m = MONSTERS[c.type];
      const sel = i === this.selected;
      panel(ctx, r.x, r.y, r.w, r.h, sel ? m.colors.s : '#2d1856', sel ? '#ffffff' : '#140726', 3);
      roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, 34, 2, sel ? m.colors.l : '#3d2a7f');
      const blink = Math.floor(this.time * 0.9 + i * 0.37) % 5 === 0 && (this.time * 0.9 + i * 0.37) % 1 < 0.15;
      const expr = c.exprT > 0 ? c.expr : blink ? 'blink' : 'idle';
      const quirk = m.quirks && Math.floor(this.time * 0.5 + i) % 4 === 0 ? (Math.floor(this.time * 8) % 2 ? 'q1' : 'q2') : 'n';
      ctx.drawImage(getSprite(c.type, expr, 0, 0, quirk), r.x + Math.floor(r.w / 2) - 16, r.y + 3 + Math.round(c.hop), 32, 32);
      drawText(ctx, m.name, r.x + Math.floor(r.w / 2), r.y + 38, { color: '#ffffff', align: 'center', outline: '#140726' });
      const n = stats.popped[c.type] || 0;
      drawText(ctx, String(n), r.x + Math.floor(r.w / 2), r.y + 45, { color: n ? '#ffe04a' : '#8a7aa8', align: 'center' });
    });

    // bio of the selected monster
    const by = this.y0 + this.cardH * 2 + 10;
    const m = MONSTERS[this.selected];
    panel(ctx, this.x0, by, this.w, 40, '#2d1856', '#140726', 3);
    drawText(ctx, m.name, this.x0 + 6, by + 5, { color: m.colors.b, scale: 2, outline: '#140726' });
    drawText(ctx, 'POPPED ' + (stats.popped[this.selected] || 0), this.x0 + this.w - 6, by + 8, { color: '#ffe04a', align: 'right' });
    wrapText(BIOS[this.selected], this.w - 12).forEach((line, i) => drawText(ctx, line, this.x0 + 6, by + 20 + i * 8, { color: '#ffffff' }));

    // lifetime stats
    const sy = by + 46;
    panel(ctx, this.x0, sy, this.w, 34, '#2d1856', '#140726', 3);
    const total = Object.values(stats.popped).reduce((a, b) => a + b, 0);
    const levels = Math.max(0, this.app.settings.level - 1);
    const rows = [
      ['POPPED', total],
      ['HATCHED', stats.hatched],
      ['BOSSES', stats.bosses],
      ['BEST COMBO', stats.bestCombo ? 'X' + stats.bestCombo : '-'],
      ['LEVELS', levels],
      ['STARS', Object.values(this.app.settings.stars).reduce((a, b) => a + b, 0)],
    ];
    const colW = Math.floor((this.w - 8) / 3);
    rows.forEach(([label, value], i) => {
      const x = this.x0 + 4 + (i % 3) * colW;
      const y = sy + 5 + Math.floor(i / 3) * 14;
      drawText(ctx, label, x + Math.floor(colW / 2), y, { color: '#c9b6ff', align: 'center' });
      drawText(ctx, String(value), x + Math.floor(colW / 2), y + 7, { color: '#ffffff', align: 'center' });
    });
    if (Math.floor(this.time * 1.5) % 2 === 0) {
      drawText(ctx, 'TAP A MONSTER!', Math.floor(vw / 2), sy + 40, { color: '#ffe9f4', align: 'center', outline: '#2a1a5e' });
    }
  }

  stickerRect(i) {
    const cols = 4;
    const size = Math.floor((this.w - (cols - 1) * 3) / cols);
    return { x: this.x0 + (i % cols) * (size + 3), y: this.y0 + Math.floor(i / cols) * 34, w: size, h: 31 };
  }

  renderStickers(ctx) {
    const got = this.app.settings.stickers || {};
    STICKERS.forEach((st, i) => {
      const r = this.stickerRect(i);
      const has = !!got[st.id];
      const sel = i === this.sticker;
      panel(ctx, r.x, r.y, r.w, r.h, has ? '#3d2a7f' : '#241542', sel ? '#ffe04a' : '#140726', 3);
      const [type, expr, variant] = st.icon;
      const frame = type === -1 ? Math.floor(this.time * 12) % 6 : 0;
      const bob = has ? Math.round(Math.min(0, Math.sin(this.time * 3 + i)) * 2) : 0;
      if (has) ctx.drawImage(getSprite(type, expr, 0, 0, variant || 'n', frame), r.x + Math.floor(r.w / 2) - 12, r.y + 3 + bob, 24, 24);
      else {
        ctx.globalAlpha = 0.18;
        ctx.drawImage(getSprite(type, 'idle', 0, 0, variant || 'n'), r.x + Math.floor(r.w / 2) - 12, r.y + 3, 24, 24);
        ctx.globalAlpha = 1;
        icon(ctx, 'lock', r.x + Math.floor(r.w / 2) - 1, r.y + 12, '#9a8abb');
      }
    });
    const rows = Math.ceil(STICKERS.length / 4);
    const by = this.y0 + rows * 34 + 4;
    const st = STICKERS[this.sticker];
    const has = !!got[st.id];
    panel(ctx, this.x0, by, this.w, 38, '#2d1856', '#140726', 3);
    drawText(ctx, has ? st.name : '???', this.x0 + 6, by + 5, { color: has ? '#ffe04a' : '#8a7aa8', outline: '#140726' });
    const count = Object.keys(got).length;
    drawText(ctx, count + '/' + STICKERS.length, this.x0 + this.w - 6, by + 5, { color: '#ffffff', align: 'right' });
    wrapText(st.desc, this.w - 12).forEach((line, i) => drawText(ctx, line, this.x0 + 6, by + 16 + i * 8, { color: has ? '#ffffff' : '#c9b6ff' }));
  }

  pointerDown(x, y) {
    if (this.back.hit(x, y)) {
      this.back.pressed = true;
      return;
    }
    for (const t of this.tabs) {
      if (t.hit(x, y)) {
        t.pressed = true;
        return;
      }
    }
    if (this.tab === 'stickers') {
      STICKERS.forEach((st, i) => {
        const r = this.stickerRect(i);
        if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) {
          this.sticker = i;
          this.app.audio.click();
        }
      });
      return;
    }
    this.cards.forEach((c, i) => {
      const r = this.cardRect(i);
      if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) {
        this.selected = i;
        c.expr = POKES[Math.floor(Math.random() * POKES.length)];
        c.exprT = 0.8;
        c.hopV = -140;
        this.app.audio.monster(c.type, c.expr === 'sad' ? 'sad' : Math.random() < 0.3 ? 'select' : 'match');
      }
    });
  }

  pointerMove() {}

  pointerUp(x, y) {
    for (const t of this.tabs) {
      if (t.pressed) {
        t.pressed = false;
        if (t.hit(x, y)) {
          this.app.audio.click();
          t.onClick();
        }
        return;
      }
    }
    if (this.back.pressed) {
      this.back.pressed = false;
      if (this.back.hit(x, y)) {
        this.app.audio.click();
        this.back.onClick();
      }
    }
  }
}
