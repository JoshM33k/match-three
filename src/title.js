// Title screen: bouncy logo and a parade of monsters you can poke.
import { getSprite, MONSTERS } from './sprites.js';
import { drawText, textWidth, Button, iconOutlined } from './pixel.js';

const LOGO_COLORS = ['#ff80b8', '#a47bff', '#74e06b', '#ffa040', '#6cc4ff', '#ffe04a'];

export class Title {
  constructor(app) {
    this.app = app;
    this.time = 0;
    this.monsters = MONSTERS.map((_, i) => ({ type: i, hop: 0, hopV: 0, expr: null, exprT: 0, blinkT: Math.random() * 4 }));
    this.layout();
  }

  layout() {
    const { vw, vh, safeTop } = this.app;
    const cx = Math.floor(vw / 2);
    this.logoY = Math.max(safeTop + 14, Math.floor(vh * 0.16));
    this.paradeY = this.logoY + 92;
    const by = Math.max(this.paradeY + 50, Math.floor(vh * 0.62));
    const s = this.app.settings;
    this.buttons = [
      new Button({ label: 'PLAY', icon: 'play', x: cx - 45, y: by, w: 90, h: 22, color: '#74e06b', shade: '#3f9e4f', onClick: () => this.app.play(s.level) }),
      new Button({
        icon: 'music',
        x: cx - 24,
        y: by + 32,
        w: 22,
        h: 18,
        color: s.music ? '#6cc4ff' : '#7a6a90',
        shade: s.music ? '#3f80c0' : '#4a3a60',
        onClick: () => {
          this.app.toggleMusic();
          this.layout();
        },
      }),
      new Button({
        icon: 'sound',
        x: cx + 2,
        y: by + 32,
        w: 22,
        h: 18,
        color: s.sfx ? '#74e06b' : '#7a6a90',
        shade: s.sfx ? '#3f9e4f' : '#4a3a60',
        onClick: () => {
          this.app.toggleSfx();
          this.layout();
        },
      }),
    ];
    if (s.level > 1) {
      this.buttons.push(
        new Button({ label: 'NEW GAME', x: cx - 34, y: by + 58, w: 68, h: 16, color: '#a47bff', shade: '#6a44b8', onClick: () => this.app.play(1) })
      );
    }
  }

  monsterRect(i) {
    const n = this.monsters.length;
    const size = 32;
    const gap = 2;
    const total = n * size + (n - 1) * gap;
    const x0 = Math.floor((this.app.vw - Math.min(total, this.app.vw - 4)) / 2);
    const step = Math.min(size + gap, Math.floor((this.app.vw - 4) / n));
    return { x: x0 + i * step, y: this.paradeY, size: Math.min(size, step) };
  }

  update(dt) {
    this.time += dt;
    this.monsters.forEach((m, i) => {
      if (m.exprT > 0) m.exprT -= dt;
      m.blinkT -= dt;
      if (m.blinkT < -0.12) m.blinkT = 2 + Math.random() * 4;
      // a wave of hops runs along the parade
      const phase = (this.time * 1.2 - i * 0.18) % 3;
      if (phase > 0 && phase < dt * 1.2 && m.hop === 0) m.hopV = -110;
      if (m.hopV !== 0 || m.hop < 0) {
        m.hopV += 600 * dt;
        m.hop += m.hopV * dt;
        if (m.hop >= 0) {
          m.hop = 0;
          m.hopV = 0;
        }
      }
    });
  }

  render(ctx) {
    const cx = Math.floor(this.app.vw / 2);
    const word = (text, y, scale) => {
      let x = cx - Math.floor(textWidth(text, scale) / 2);
      [...text].forEach((ch, i) => {
        const bob = Math.round(Math.sin(this.time * 3 + i * 0.6) * 2);
        drawText(ctx, ch, x, y + bob, { color: LOGO_COLORS[i % LOGO_COLORS.length], scale, outline: '#1a0b2e' });
        x += textWidth(ch, scale) + scale;
      });
    };
    const big = this.app.vw >= 190 ? 4 : 3;
    word('MONSTER', this.logoY, big);
    word('POP!', this.logoY + 6 * big + 4, big + 4);

    this.monsters.forEach((m, i) => {
      const r = this.monsterRect(i);
      const expr = m.exprT > 0 ? m.expr : m.blinkT < 0 ? 'blink' : m.hop < -8 ? 'excited' : 'idle';
      const p = this.app.pointer;
      let lx = 0;
      if (p.active && (expr === 'idle' || expr === 'excited')) lx = p.x > r.x + r.size ? 1 : p.x < r.x ? -1 : 0;
      ctx.fillStyle = 'rgba(20,5,40,0.35)';
      ctx.fillRect(r.x + 8, r.y + r.size - 2, r.size - 16, 3);
      ctx.drawImage(getSprite(m.type, expr, lx, 0), r.x, r.y + Math.round(m.hop), r.size, r.size);
    });

    for (const b of this.buttons) b.draw(ctx, this.time);
    const s = this.app.settings;
    const playBtn = this.buttons[0];
    if (s.level > 1) {
      drawText(ctx, 'LEVEL ' + s.level, cx, playBtn.y - 10, { color: '#ffffff', align: 'center', outline: '#2a1a5e' });
      const total = Object.values(s.stars).reduce((a, b) => a + b, 0);
      if (total) {
        const label = String(total);
        iconOutlined(ctx, 'star', cx + 24, playBtn.y - 10, '#ffe04a', '#2a1a5e');
        drawText(ctx, label, cx + 31, playBtn.y - 10, { color: '#ffe04a', outline: '#2a1a5e' });
      }
    }
    if (Math.floor(this.time * 1.5) % 2 === 0) {
      drawText(ctx, 'POKE A MONSTER!', cx, this.paradeY + 40, { color: '#ffe9f4', align: 'center', outline: '#2a1a5e' });
    }
  }

  pointerDown(x, y) {
    for (const b of this.buttons) {
      if (b.hit(x, y)) {
        b.pressed = true;
        return;
      }
    }
    this.monsters.forEach((m, i) => {
      const r = this.monsterRect(i);
      if (x >= r.x && x < r.x + r.size && y >= r.y - 10 && y < r.y + r.size) {
        const moods = ['happy', 'surprised', 'excited', 'dizzy', 'squish'];
        m.expr = moods[Math.floor(Math.random() * moods.length)];
        m.exprT = 0.7;
        m.hopV = -150;
        this.app.audio.monster(m.type, Math.random() < 0.8 ? 'match' : 'sad');
      }
    });
  }

  pointerMove() {}

  pointerUp(x, y) {
    for (const b of this.buttons) {
      if (b.pressed) {
        b.pressed = false;
        if (b.hit(x, y)) {
          this.app.audio.click();
          b.onClick();
        }
      }
    }
  }
}
