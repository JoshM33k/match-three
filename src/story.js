// A tiny three-panel opening story, shown before a player's first level.
import { getSprite } from './sprites.js';
import { drawText, Button, panel, wrapText } from './pixel.js';

const PAGES = [
  { text: 'IN THE TWILIGHT HILLS LIVED SIX LITTLE MONSTERS. THEY WERE VERY, VERY BORED.', mood: 'sleepy' },
  { text: 'ONE DAY BLOOP BUMPED INTO TWO FRIENDS... AND POP! IT WAS THE MOST FUN EVER.', mood: 'excited' },
  { text: 'NOW THEY WANT TO MATCH, POP AND PARTY ACROSS FIVE WORLDS. WILL YOU HELP?', mood: 'happy' },
];

export class Story {
  constructor(app, onDone) {
    this.app = app;
    this.onDone = onDone;
    this.page = 0;
    this.t = 0;
    this.time = 0;
    this.layout();
  }

  layout() {
    const { vw, vh, safeTop } = this.app;
    this.skip = new Button({ label: 'SKIP', x: vw - 40, y: safeTop + 5, w: 36, h: 16, color: '#7a6a90', shade: '#4a3a60', onClick: () => this.finish() });
    this.cx = Math.floor(vw / 2);
    this.cy = Math.floor(vh * 0.42);
  }

  finish() {
    this.app.settings.seen.story = true;
    this.app.persist();
    this.onDone();
  }

  update(dt) {
    this.time += dt;
    this.t += dt;
  }

  render(ctx) {
    const { vw } = this.app;
    const page = PAGES[this.page];
    const { cx, cy } = this;
    // stage
    panel(ctx, cx - 80, cy - 50, 160, 90, 'rgba(26,11,46,0.55)', '#140726', 6);
    for (let i = 0; i < 6; i++) {
      const x = cx - 75 + i * 25;
      let y = cy + 4;
      let expr = page.mood;
      if (this.page === 0) {
        if (Math.floor(this.time * 0.6 + i) % 4 === 0) expr = 'yawn';
        if (i % 2 === 0 && Math.floor(this.time * 1.2) % 2) drawText(ctx, 'z', x + 18, y - 6 - (Math.floor(this.time * 2 + i) % 3) * 3, { color: '#ffffff' });
      } else if (this.page === 1) {
        if (i === 0) {
          const k = Math.min(1, this.t / 0.8);
          expr = k < 1 ? 'excited' : 'happy';
        }
        if (this.t > 0.8 && i === 1 && Math.floor(this.time * 6) % 2) {
          drawText(ctx, 'POP!', x + 10, cy - 34, { color: '#ffe04a', scale: 2, outline: '#140726' });
        }
        y += Math.round(Math.min(0, Math.sin(this.time * 8 + i)) * 4);
      } else {
        y += Math.round(Math.min(0, Math.sin(this.time * 6 - i * 0.7)) * 8);
        if (i % 2) expr = 'laugh';
      }
      ctx.fillStyle = 'rgba(20,5,40,0.35)';
      ctx.fillRect(x + 5, cy + 26, 14, 2);
      ctx.drawImage(getSprite(i, expr), x, y, 24, 24);
    }
    if (this.page === 2 && Math.floor(this.time * 8) % 3 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 60 + ((this.time * 97) % 120), cy - 40 + ((this.time * 53) % 20), 1, 1);
    }
    // caption, typed out
    const chars = Math.floor(this.t * 40);
    const lines = wrapText(page.text, Math.min(vw - 24, 170));
    let used = 0;
    lines.forEach((line, i) => {
      const shown = line.slice(0, Math.max(0, chars - used));
      used += line.length;
      drawText(ctx, shown, cx, cy + 52 + i * 9, { color: '#ffffff', align: 'center', outline: '#140726' });
    });
    for (let i = 0; i < PAGES.length; i++) {
      ctx.fillStyle = i === this.page ? '#ffe04a' : '#6a5a88';
      ctx.fillRect(cx - 9 + i * 7, cy + 58 + lines.length * 9, 4, 4);
    }
    if (chars > page.text.length && Math.floor(this.time * 2) % 2) {
      drawText(ctx, this.page === PAGES.length - 1 ? "TAP TO PLAY!" : 'TAP', cx, cy + 70 + lines.length * 9, { color: '#ffe9f4', align: 'center', outline: '#2a1a5e' });
    }
    this.skip.draw(ctx, this.time);
  }

  pointerDown(x, y) {
    if (this.skip.hit(x, y)) {
      this.skip.pressed = true;
      return;
    }
    const page = PAGES[this.page];
    if (Math.floor(this.t * 40) < page.text.length) {
      this.t = page.text.length / 40 + 0.01; // finish typing first
      return;
    }
    this.app.audio.click();
    if (this.page < PAGES.length - 1) {
      this.page++;
      this.t = 0;
      if (this.page === 1) this.app.audio.monster(0, 'match');
      if (this.page === 2) this.app.audio.chorus();
    } else this.finish();
  }

  pointerMove() {}

  pointerUp(x, y) {
    if (this.skip.pressed) {
      this.skip.pressed = false;
      if (this.skip.hit(x, y)) this.skip.onClick();
    }
  }
}
