// Level map: a winding path of levels you scroll through, with stars earned
// and a monster bouncing on the level you're up to.
import { getSprite, MONSTERS } from './sprites.js';
import { drawText, Button, icon, iconOutlined, fillCircle, panel, pattern } from './pixel.js';

const SPACING = 38;
const NODE_COLORS = MONSTERS.map((m) => [m.colors.b, m.colors.s, m.colors.o]);

export class LevelMap {
  constructor(app, focus = app.settings.level) {
    this.app = app;
    this.time = 0;
    this.focus = focus;
    this.vel = 0;
    this.drag = null;
    this.layout();
    // centre the focused level
    this.scroll = this.clampScroll(this.nodeY(focus, 0) - this.app.vh * 0.55);
  }

  get unlocked() {
    return this.app.settings.level;
  }

  get count() {
    return this.unlocked + 8;
  }

  layout() {
    const { vw, safeTop } = this.app;
    this.top = safeTop + 30;
    this.back = new Button({ icon: 'home', x: 4, y: safeTop + 5, w: 22, h: 18, color: '#a47bff', shade: '#6a44b8', onClick: () => this.app.toTitle() });
    this.amp = Math.min(60, vw * 0.28);
  }

  /** World y of a level node (grows downward; level 1 is at the bottom). */
  nodeY(n) {
    return (this.count - n) * SPACING + 40;
  }

  nodeX(n) {
    return Math.round(this.app.vw / 2 + Math.sin(n * 0.85) * this.amp);
  }

  clampScroll(s) {
    const max = this.nodeY(1) + 60 - this.app.vh;
    return Math.max(-this.top, Math.min(max, s));
  }

  update(dt) {
    this.time += dt;
    if (!this.drag) {
      this.scroll = this.clampScroll(this.scroll + this.vel * dt);
      this.vel *= Math.pow(0.04, dt);
      if (Math.abs(this.vel) < 2) this.vel = 0;
    }
  }

  render(ctx) {
    const { vw, vh } = this.app;
    const off = -Math.round(this.scroll);

    // dotted path between nodes
    for (let n = 1; n < this.count; n++) {
      const x0 = this.nodeX(n);
      const y0 = this.nodeY(n) + off;
      const x1 = this.nodeX(n + 1);
      const y1 = this.nodeY(n + 1) + off;
      if (Math.max(y0, y1) < -20 || Math.min(y0, y1) > vh + 20) continue;
      const steps = 6;
      for (let i = 1; i < steps; i++) {
        const k = i / steps;
        const x = Math.round(x0 + (x1 - x0) * k);
        const y = Math.round(y0 + (y1 - y0) * k);
        ctx.fillStyle = '#1a0b2e';
        ctx.fillRect(x - 2, y - 1, 4, 3);
        ctx.fillStyle = n < this.unlocked ? '#ffe9a8' : '#8a7aa8';
        ctx.fillRect(x - 1, y - 1, 2, 2);
      }
    }

    for (let n = this.count; n >= 1; n--) {
      const x = this.nodeX(n);
      const y = this.nodeY(n) + off;
      if (y < -30 || y > vh + 30) continue;
      this.drawNode(ctx, n, x, y);
    }

    // header
    panel(ctx, 0, 0, vw, this.app.safeTop + 28, 'rgba(26,11,46,0.85)', null, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, this.app.safeTop + 27, vw, 1);
    drawText(ctx, 'MONSTER MAP', Math.floor(vw / 2), this.app.safeTop + 8, { color: '#ffe04a', scale: 2, align: 'center', outline: '#140726' });
    const total = Object.values(this.app.settings.stars).reduce((a, b) => a + b, 0);
    const label = String(total);
    const lx = vw - 8 - label.length * 4;
    iconOutlined(ctx, 'star', lx - 8, this.app.safeTop + 11, '#ffe04a', '#140726');
    drawText(ctx, label, lx, this.app.safeTop + 11, { color: '#ffffff', outline: '#140726' });
    this.back.draw(ctx, this.time);
  }

  drawNode(ctx, n, x, y) {
    const unlocked = n <= this.unlocked;
    const current = n === this.unlocked;
    const [fill, shade, dark] = NODE_COLORS[(n - 1) % NODE_COLORS.length];
    const r = current ? 11 : 9;
    fillCircle(ctx, x, y + 2, r + 1, '#1a0b2e');
    fillCircle(ctx, x, y, r + 1, '#1a0b2e');
    if (unlocked) {
      fillCircle(ctx, x, y, r, shade);
      fillCircle(ctx, x, y - 1, r - 1, fill);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(x - r + 3, y - r + 3, 2, 1);
      drawText(ctx, String(n), x + 1, y - 3, { color: '#ffffff', align: 'center', outline: dark });
    } else {
      fillCircle(ctx, x, y, r, '#4a3a68');
      fillCircle(ctx, x, y - 1, r - 1, '#5e4d80');
      icon(ctx, 'lock', x - 2, y - 4, '#9a8abb');
    }
    if (n % 5 === 0 && !current) {
      // boss levels wear a crown
      pattern(ctx, ['#.#.#.#', '#######', '#######'], x - 3, y - r - 4, { '#': unlocked ? '#ffcf3a' : '#8a7aa8' });
    }
    const stars = this.app.settings.stars[n] || 0;
    if (unlocked && !current) {
      for (let i = 0; i < 3; i++) {
        iconOutlined(ctx, 'star', x - 9 + i * 6, y + r - 1 + (i === 1 ? 1 : 0), i < stars ? '#ffe04a' : '#6a5a88', '#1a0b2e');
      }
    }
    if (current) {
      // a monster bounces on the level you're up to
      const hop = Math.round(Math.min(0, Math.sin(this.time * 5)) * 7);
      const type = (n - 1) % 6;
      const expr = hop < -4 ? 'excited' : Math.floor(this.time * 0.7) % 4 === 0 ? 'blink' : 'idle';
      ctx.fillStyle = 'rgba(20,5,40,0.4)';
      ctx.fillRect(x - 5, y - r - 2, 10, 2);
      ctx.drawImage(getSprite(type, expr), x - 8, y - r - 17 + hop);
      if (Math.floor(this.time * 2) % 2) drawText(ctx, 'PLAY!', x, y + r + 3, { color: '#ffffff', align: 'center', outline: '#1a0b2e' });
    }
  }

  nodeAt(px, py) {
    const off = -this.scroll;
    for (let n = 1; n <= this.count; n++) {
      const dx = px - this.nodeX(n);
      const dy = py - (this.nodeY(n) + off);
      if (dx * dx + dy * dy < 15 * 15 || (n === this.unlocked && Math.abs(dx) < 10 && dy > -30 && dy < 0)) return n;
    }
    return null;
  }

  wheel(dy) {
    this.vel = 0;
    this.scroll = this.clampScroll(this.scroll + dy);
  }

  pointerDown(x, y) {
    if (this.back.hit(x, y)) {
      this.back.pressed = true;
      return;
    }
    this.drag = { x, y, scroll: this.scroll, lastY: y, lastT: performance.now(), moved: false };
    this.vel = 0;
  }

  pointerMove(x, y) {
    const d = this.drag;
    if (!d) return;
    if (Math.abs(y - d.y) > 4) d.moved = true;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT) / 1000;
    this.vel = -(y - d.lastY) / dt;
    d.lastY = y;
    d.lastT = now;
    this.scroll = this.clampScroll(d.scroll - (y - d.y));
  }

  pointerUp(x, y) {
    if (this.back.pressed) {
      this.back.pressed = false;
      if (this.back.hit(x, y)) {
        this.app.audio.click();
        this.back.onClick();
      }
      return;
    }
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    if (d.moved) return;
    this.vel = 0;
    const n = this.nodeAt(x, y);
    if (!n) return;
    if (n <= this.unlocked) {
      this.app.audio.click();
      this.app.audio.monster((n - 1) % 6, 'select');
      this.app.play(n);
    } else {
      this.app.audio.monster((n - 1) % 6, 'sad');
    }
  }
}
