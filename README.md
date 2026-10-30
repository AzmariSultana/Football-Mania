# Football Mania

A 3D free kick game for the browser, built with Three.js. Bend the ball around the wall, beat the keeper and aim for the top corners.

**[Play now](https://azmarisultana.github.io/Football-Mania/)** · Installable on mobile and desktop · Works offline

![Lining up a free kick](docs/screenshots/aiming.jpg)

| | |
|:--:|:--:|
| ![Top-corner goal](docs/screenshots/goal.jpg) | ![Slow-motion replay](docs/screenshots/replay.jpg) |
| Top-corner goal on a streak | Slow-motion replay |
| ![Boss keeper](docs/screenshots/boss.jpg) | ![Night match](docs/screenshots/night.jpg) |
| Boss keeper | Night match under the floodlights |

## Features

- **Ball physics:** power, curve and topspin, with realistic bounces off the posts, keeper, wall and net.
- **Opposition:** a keeper that reads your shot and dives, a jumping wall, and four boss keepers with different weaknesses.
- **Four modes:** Daily Challenge (the same ten kicks for every player each day), Goalkeeper Power, Goalpost Reduction and Time Reduction.
- **Progression:**
  - Perfect Strike timing on the power bar.
  - Streak multipliers and earned power-ups.
  - Wind that gets stronger as you score.
  - 12 collectible stickers and 23 achievements.
- **Presentation:** a full stadium with a reacting crowd, day/night lighting, particle effects, slow-motion replays and synthesised sound.
- **Controls:** keyboard and mouse, touch, or gamepad.

## Scoring

Top corners score 9 points, bottom corners 5, and anywhere else 3. Goals in a row multiply your points: ×1.5 from the third and ×2 from the fifth. In every mode except the Daily Challenge, three misses end the game.

## Controls

| Action | Keyboard and mouse | Touch | Gamepad |
|:--|:--|:--|:--|
| Aim | Mouse or `W` `A` `S` `D` | Drag | Left stick |
| Charge and shoot | Hold click or `Space`, release | Hold and release | Hold `RT` / `A` |
| Curve | `Q` / `E` or mouse wheel | Curve buttons | `LB` / `RB` |
| Power-up | `F` | Tap the slot | `X` |
| Camera | Arrow keys, `C` to switch view | Camera button | Right stick, `Y` |
| Pause | `P` / `Esc` | Pause button | `Start` |

## Install

Open the [game](https://azmarisultana.github.io/Football-Mania/), then:
- **Android, desktop Chrome or Edge:** select **Install app** on the main menu.
- **iPhone or iPad:** in Safari, tap **Share**, then **Add to Home Screen**.

The installed app runs full screen in landscape and works offline.

## Run locally

Requires Node.js 18 or newer. There are no dependencies to install.

```bash
git clone https://github.com/AzmariSultana/Football-Mania.git
cd Football-Mania
npm start
```

Then open http://localhost:8080. Any static file server also works; opening `index.html` directly from disk does not, because browsers block ES modules on `file://`.

## Technology

- **Three.js r160 (WebGL 2):** rendering.
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
