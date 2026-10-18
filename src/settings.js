// Settings screen: audio, feel and a (double-checked) progress reset.
import { drawText, Button, panel } from './pixel.js';

export class Settings {
  constructor(app) {
    this.app = app;
    this.time = 0;
    this.confirmT = 0;
    this.layout();
  }

  layout() {
    const { vw, vh, safeTop } = this.app;
    const s = this.app.settings;
    const cx = Math.floor(vw / 2);
    const w = 120;
    const y0 = Math.max(safeTop + 44, Math.floor(vh / 2) - 70);
    const on = (v) => (v !== false ? 'ON' : 'OFF');
    const toggle = (label, icon, key, y, fn) =>
      new Button({
        label: `${label}: ${on(s[key])}`,
        icon,
        x: cx - w / 2,
        y,
        w,
        h: 18,
        color: s[key] !== false ? '#6cc4ff' : '#7a6a90',
        shade: s[key] !== false ? '#3f80c0' : '#4a3a60',
        onClick: () => {
          if (fn) fn();
          else {
            s[key] = s[key] === false;
            this.app.persist();
          }
          if (key === 'haptics') this.app.buzz(30);
          this.layout();
        },
      });
    this.y0 = y0;
    this.buttons = [
      new Button({ icon: 'home', x: 4, y: safeTop + 5, w: 22, h: 18, color: '#a47bff', shade: '#6a44b8', onClick: () => this.app.toTitle() }),
      toggle('MUSIC', 'music', 'music', y0, () => this.app.toggleMusic()),
      toggle('SOUND', 'sound', 'sfx', y0 + 22, () => this.app.toggleSfx()),
      toggle('VIBRATION', null, 'haptics', y0 + 44),
      toggle('SCREEN SHAKE', null, 'shake', y0 + 66),
      new Button({
        label: this.confirmT > 0 ? 'TAP AGAIN TO RESET' : 'RESET PROGRESS',
        x: cx - w / 2,
        y: y0 + 102,
        w,
        h: 18,
        color: '#ff5a7a',
        shade: '#b02a4a',
        onClick: () => {
          if (this.confirmT > 0) {
            this.app.resetProgress();
            this.confirmT = 0;
            this.done = 1.5;
          } else this.confirmT = 3;
          this.layout();
        },
      }),
    ];
  }

  update(dt) {
    this.time += dt;
    if (this.confirmT > 0) {
      this.confirmT -= dt;
      if (this.confirmT <= 0) this.layout();
    }
    if (this.done > 0) this.done -= dt;
  }

  render(ctx) {
    const { vw, safeTop } = this.app;
    panel(ctx, 0, 0, vw, safeTop + 28, 'rgba(26,11,46,0.85)', null, 0);
    drawText(ctx, 'SETTINGS', Math.floor(vw / 2), safeTop + 8, { color: '#ffe04a', scale: 2, align: 'center', outline: '#140726' });
    panel(ctx, Math.floor(vw / 2) - 68, this.y0 - 8, 136, 136, 'rgba(26,11,46,0.7)', '#140726', 4);
    for (const b of this.buttons) b.draw(ctx, this.time);
    if (this.done > 0) drawText(ctx, 'PROGRESS RESET', Math.floor(vw / 2), this.y0 + 124, { color: '#ffe04a', align: 'center', outline: '#140726' });
    drawText(ctx, 'MONSTER POP', Math.floor(vw / 2), this.y0 + 140, { color: '#ffe9f4', align: 'center', outline: '#2a1a5e' });
  }

  pointerDown(x, y) {
    for (const b of this.buttons) if (b.hit(x, y)) b.pressed = true;
  }

  pointerMove() {}

  pointerUp(x, y) {
    for (const b of this.buttons) {
      if (!b.pressed) continue;
      b.pressed = false;
      if (b.hit(x, y)) {
        this.app.audio.click();
        b.onClick();
        return;
      }
    }
  }
}
