# Football Mania

A 3D free kick game for the browser, built with Three.js. Bend the ball around the wall, beat the keeper and aim for the top corners.

**[Play now](https://azmarisultana.github.io/Football-Mania/)** · Installable on mobile and desktop · Works offline

## Features

- **Ball physics:** power, curve and topspin, with realistic bounces off the posts, keeper, wall and net.
- **Opposition:** a keeper that reads your shot and dives, a jumping wall, and four boss keepers with different weaknesses.
- **Modes:**
  - **Daily Challenge:** the same ten kicks, conditions and bosses for every player each day.
  - **Goalkeeper Power:** the keeper grows with every goal.
  - **Goalpost Reduction:** the goal gets narrower with every goal.
  - **Time Reduction:** a shot clock that shrinks with every goal.
  - **Practice:** unlimited kicks with no pressure.
- **Matchday conditions:** each match is played in day, golden hour, night (under floodlights) or rain.
- **Progression:**
  - Perfect Strike timing on the power bar.
  - Streak multipliers and earned power-ups.
  - Wind that gets stronger as you score.
  - Player levels and XP, with a graded results screen (S to D) after every match.
  - 23 achievements in four rarities, and 12 collectible stickers.
- **Locker:** kits, balls, shot trails and a preferred matchday condition, unlocked by levelling up, achievements, Daily streaks and stickers.
- **Presentation:** a full stadium with a reacting crowd, floodlights, flags, LED boards, particle effects, slow-motion replays and synthesised sound.
- **Controls:** keyboard and mouse, touch, or gamepad.

## Scoring

Top corners score 9 points, bottom corners 5, and anywhere else 3. Goals in a row multiply your points: ×1.5 from the third and ×2 from the fifth. Three misses end the game, except in the Daily Challenge (ten kicks) and Practice (unlimited).

## Menus

- **Play:** choose a mode.
- **Player Card:** your level, stats, mode records and the Locker.
- **Daily Challenge** and **Practice:** start straight from the main menu.
- **Achievements:** the trophy cabinet and sticker album.
- **Settings:** sound, graphics quality, starting camera, camera motion and Battery saver.

## Controls

| Action | Keyboard and mouse | Touch | Gamepad |
|:--|:--|:--|:--|
| Aim | Mouse or `W` `A` `S` `D` | Drag | Left stick |
| Charge and shoot | Hold click or `Space`, release | Hold and release | Hold `RT` / `A` |
| Curve | `Q` / `E` or mouse wheel | Curve buttons | `LB` / `RB` |
| Power-up | `F` | Tap the slot | `X` |
| Camera | Arrow keys, `C` to switch view | Camera button | Right stick, `Y` |
| Pause | `P` / `Esc` | Pause button | `Start` |
| How to play | `H` | Settings → How to play | |

In the menus, `Enter` plays, the arrow keys browse modes, and `Esc` goes back.

## Install

Open the [game](https://azmarisultana.github.io/Football-Mania/), then:
- **Android, desktop Chrome or Edge:** select **Install app** on the main menu.
- **iPhone or iPad:** in Safari, tap **Share**, then **Add to Home Screen**.

The installed app runs full screen in landscape and works offline.

## Performance

- Rendering stops and the match pauses when the tab is hidden or the app goes to the background. Sound pauses too.
- Menus and paused screens run at a lower frame rate; gameplay runs at full speed.
- **Battery saver** (Auto, On or Off in Settings) lowers the frame rate, resolution and effects. On Auto it switches on when the battery is low and not charging.

## Run locally

Requires Node.js 18 or newer. There are no dependencies to install.

```bash
git clone https://github.com/AzmariSultana/Football-Mania.git
cd Football-Mania
npm start
```

Then open http://localhost:8080. Any static file server also works; opening `index.html` directly from disk does not, because browsers block ES modules on `file://`.

## Technology

- **Three.js r160 (WebGL 2):** rendering, with bloom, ambient occlusion and depth of field.
- **JavaScript modules:** the game code, with no framework and no build step.
- **Web Audio API:** all sound effects, synthesised in code.
- **Service worker and web app manifest:** installing and offline play.
- **GitHub Actions:** deploys to GitHub Pages on every push to `main`.

All models, textures and sounds are generated in code.

## Project structure

```
index.html        page, HUD and menus
css/              styles
src/              game code (entry point: main.js)
sw.js             service worker
manifest.json     app manifest
icons/            app icons
server.js         local static server
```

The game began as a Python/OpenGL project; the original is kept in [`football_mania.py`](football_mania.py).
