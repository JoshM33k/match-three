# Monster Pop

A cute, colorful pixel-art match-three game for phones and tablets (portrait). Swap the little monsters to line up three or more of a kind. They blink, look at your finger, cheer when their neighbors get matched, squish when they land, sulk when a swap doesn't work, and fall asleep if you leave them alone too long. Each species has its own synthesized voice.

## Play

The game is plain static files (HTML, ES modules and canvas) with no build step and no dependencies.

```sh
npm start            # serves the folder on http://localhost:8080
# or: python3 -m http.server 8080
```

Open the URL on your phone (same network) or in a browser's device emulator. Every push to `main` is tested and deployed to GitHub Pages by `.github/workflows/pages.yml`. The game is then at `https://<owner>.github.io/match-three/`. If the first deploy fails at "configure-pages", open **Settings → Pages**, set **Source** to **GitHub Actions**, and re-run the workflow. On a phone, "Add to Home Screen" runs it fullscreen in portrait, and a small service worker (`sw.js`) lets it start offline once it has been opened.

## The monsters

| Monster | Look | Voice |
| --- | --- | --- |
| Bloop | pink slime drop | bloopy squishes |
| Grumble | purple, horns and fangs | rumbly growls |
| Ogle | green cyclops with an antenna | gurgly blibbles |
| Fuzz | orange furball with ears | tiny "rawr!" |
| Boo | blue ghost | wobbly "wooo" |
| Zap | yellow star (from level 4) | "pip pip pip!" |

Expressions include idle, blink, happy, excited (selected), surprised (falling), squish (landing), sad (bad swap), sleepy and dizzy (explosions). Pupils follow the pointer.

## Rules

- **Match 4** in a line to make a **blaster**, which clears a row or column.
- **Match an L or T** to make a **bomb**, which clears a 3x3 area.
- **Match 5** to make a **rainbow** monster. Swap it with any monster to clear every monster of that kind.
- **Swap two specials** for bigger combos: a cross blast, a giant bomb, or rainbow + rainbow to clear the whole board.
- Each level has a score goal and a move limit. Some levels also ask you to pop a certain number of a species.
- When you win, the moves you have left become blasters in a **Monster Party**.
- Your progress, stars and sound settings are saved in the browser.

## Code layout

| File | Purpose |
| --- | --- |
| `src/board.js` | Pure match-three rules: matching, specials, chains, gravity, shuffle (unit tested) |
| `src/sprites.js` | Procedural pixel-art monsters: masks, auto outline and shading, expression table |
| `src/game.js` | Gameplay state machine, monster animation, effects, HUD and overlays |
| `src/audio.js` | WebAudio synth: monster voices, sound effects and a chiptune loop |
| `src/pixel.js` | Bitmap font, panels, buttons, icons |
| `src/background.js` | Dithered sky, clouds, stars, and hills with blinking eyes |
| `src/title.js`, `src/main.js` | Title screen, bootstrap, input, integer-scaled pixel canvas |
| `src/levels.js`, `src/storage.js` | Level generation and saved progress |

```sh
npm test         # board rule tests (node --test)
npm run sprites  # writes sprite-sheet.png with every monster and expression
npm run icons    # regenerates the app icons from the sprites
```
