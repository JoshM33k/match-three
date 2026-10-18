# Monster Pop

A cute, colorful pixel-art match-three game for phones and tablets (portrait). Swap the little monsters to line up three or more of a kind.

The monsters are alive: they blink, follow your finger with their eyes, lean when you drag them, cheer (or swoon) when their neighbors match, squish when they land, sulk after a bad swap, giggle when tickled, yawn and fall asleep if you leave them alone, and each species has its own synthesized voice and idle quirk.

**Play it:** <https://joshm33k.github.io/match-three/> (also works offline once opened, and "Add to Home Screen" runs it fullscreen).

## Run locally

The game is plain static files (HTML, ES modules and canvas) with no build step and no dependencies.

```sh
npm start            # serves the folder on http://localhost:8080
# or: python3 -m http.server 8080
```

Every push to `main` is tested and deployed to GitHub Pages by `.github/workflows/pages.yml`. If a fresh fork's first deploy fails at "configure-pages", open **Settings → Pages**, set **Source** to **GitHub Actions**, and re-run the workflow.

## The monsters

| Monster | Look | Voice | Idle quirk |
| --- | --- | --- | --- |
| Bloop | pink slime drop | bloopy squishes | wobbly tip |
| Grumble | purple, horns and fangs | rumbly growls | huffs steam |
| Ogle | green cyclops | gurgly blibbles | antenna sways |
| Fuzz | orange furball | tiny "rawr!" | ear twitch |
| Boo | blue ghost | wobbly "wooo" | floats and fades |
| Zap | yellow star (from level 4) | "pip pip pip!" | waves |

Expressions: idle, blink, wink, happy, excited, surprised, squish, sad, sleepy, yawn, dizzy, love and laugh.

## How to play

- **Match 3** or more in a line. **Match 4** for a **blaster** (clears a row or column), **L/T** for a **bomb**, **5 in a row** for a **rainbow** (swap it with any monster to pop all of that kind), and a **2x2 square** for a **monster pal** (it flies off to help with your goals).
- **Swap two specials** for combos: cross blasts, giant bombs, rainbow conversions, pal pairs, or rainbow + rainbow to clear the board.
- Levels have a score goal and a move limit, and may also ask you to pop a number of a species, **hatch eggs** (eggs crack from nearby matches and hatch into babies) or **clean up goo**.
- Some boards are **shapes** (heart, diamond, donut, plus, hourglass).
- **Every fifth level is a boss battle**: each popped monster damages a giant king, who fights back by laying eggs, sliming monsters, scrambling the board or stealing moves.
- Win with moves to spare and they turn into blasters for a **Monster Party**. Run out and you get one **+5 moves** snack per attempt.

## Modes and extras

- **Level map** across five worlds (Twilight Hills, Mint Meadow, Starry Sea, Candy Clouds, Ember Peaks), each with its own sky, scenery and take on the music.
- **Zen mode**: endless, no moves or goals.
- **Daily challenge**: the same seeded board for everyone each day, with a streak.
- **Monster Book**: monster bios and pop counts, 15 collectible **stickers**, and unlockable **hats** that every monster wears.
- **Settings**: music, sound, vibration, screen shake, and progress reset.
- A short opening story, first-time tips, and a swipe tutorial.

## Code layout

| File | Purpose |
| --- | --- |
| `src/board.js` | Pure match-three rules: matching, squares, specials and chains, gravity (with board holes), shuffle |
| `src/levels.js` | Level generation: goals, eggs, goo, shapes, bosses, Zen and daily levels |
| `src/game.js` | Gameplay state machine, monster animation and reactions, effects, bosses, HUD and overlays |
| `src/sprites.js` | Procedural pixel-art monsters: masks, auto outline and shading, expression and quirk tables |
| `src/audio.js` | WebAudio synth: monster voices, effects and the music |
| `src/pixel.js` | Bitmap font, panels, buttons, icons |
| `src/background.js` | Dithered skies and hills for each world |
| `src/title.js`, `map.js`, `book.js`, `settings.js`, `story.js` | The other screens |
| `src/stickers.js`, `src/hats.js`, `src/storage.js` | Achievements, cosmetics and saved progress |
| `src/main.js` | Bootstrap, input, integer-scaled pixel canvas, screen wipes, toasts |
| `sw.js` | Network-first offline cache |

## Development

```sh
npm test         # board rules and level-winnability tests (node --test)
npm run lint     # ESLint
npm run simulate # plays thousands of headless games to check level difficulty
npm run playtest # browser play-test of levels and special combos (needs Playwright and `npm start`)
npm run sprites  # writes sprite-sheet.png with every monster and expression
npm run icons    # regenerates the app icons from the sprites
```

Add `?speed=4` (up to 8) to the URL to run the game faster when testing. CI runs the tests and lint on every pull request.
