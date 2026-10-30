# Football Mania

A 3D free kick game that runs in the browser. Bend the ball around the wall, beat the keeper and pick out the top corners.

Built with [Three.js](https://threejs.org/) and plain JavaScript modules: no build step and no dependencies to install. It started as a Python/OpenGL project; the original version is still in this repository (see [Original Python version](#original-python-version)).

## Quick start

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/AzmariSultana/Football-Mania.git
cd Football-Mania
npm start
```

Then open http://localhost:8080 in a modern desktop browser (Chrome, Edge, Firefox or Safari).

Opening `index.html` directly from disk will not work, because browsers block ES modules on `file://`. Any static file server works instead of `npm start`, for example `npx serve` or `python -m http.server 8080`.

Three.js and the fonts load from CDNs, so you need an internet connection on first load. Use `PORT=3000 npm start` to change the port.

## How to play

1. Pick a mode.
2. Aim the red marker at the goal.
3. Hold the shoot button to charge power and release to shoot.

Score as many points as you can before you run out of misses.

| Zone | Points |
|---|---|
| Top corners | 9 |
| Bottom corners | 5 |
| Anywhere else | 3 |

### Shooting

- **Power** decides the shot's shape. Low power lobs over the wall but gives the keeper time to read it. High power is flat and hard to save. Above the red line on the power bar you start losing accuracy.
- **Perfect Strike:** release inside the striped green band on the power bar (it moves every kick). The shot goes exactly where you aimed, with no scatter, and the keeper reacts later.
- **Curve** bends the ball around the wall and still lands it on your marker.
- **Wind** appears from your third goal and gets stronger. It pushes the ball while it's in the air. The arrow in the top right shows its direction relative to your view.
- The dotted line shows the start of the ball's path, with curve and wind included.

### Game modes

| Mode | Rules |
|---|---|
| **Daily Challenge** | Ten fixed kicks generated from today's date, so everyone gets the same spots, wind and bosses. No miss limit. Tracks your daily best and day streak. |
| **Goalkeeper Power** | The keeper grows 8% bigger after every goal. Three misses and the game ends. |
| **Goalpost Reduction** | The goal gets 40 units narrower after every goal (down to a minimum width). Three misses and the game ends. |
| **Time Reduction** | 30 seconds per kick, 3 seconds less after every goal (minimum 5). Running out of time counts as a miss. Three misses and the game ends. |

### Streaks, bosses and rewards

- **Streak multiplier:** your third goal in a row and onwards scores ×1.5, and from the fifth it's ×2. While a multiplier is live the ball catches fire and the crowd starts chanting.
- **Boss keepers** step in every 5 goals (and twice in the Daily Challenge), for one kick each. Beating one is worth +10 points and a power-up.
  - **The Octopus:** enormous reach, but slow to react.
  - **The Gambler:** always dives early to a corner.
  - **The Fortress:** a six-man wall in front of a sharp keeper.
  - **The Mirror:** dives towards the spots you've been aiming at.
- **Power-ups** are earned at 3, 6, 9 and 12 goals in a row, and by beating a boss. You hold one at a time and use it while aiming.
  - **Laser Aim:** shows the full flight path.
  - **Ice Keeper:** the keeper reacts late and guesses blind.
  - **Mini Wall:** the wall shrinks for one kick.
  - **Golden Ball:** double points if it goes in.
- **Golden stickers:** a star sometimes floats inside the goal. Put the ball through it for +5 points and a new sticker. There are 12 to collect.
- **Achievements:** 23 to unlock, one of them secret. They're shown in the Trophy Room together with the sticker album.
- **Replays:** special goals are replayed in slow motion from behind the net. That covers top corners, perfect strikes, bosses, deflections, big curves and streaks.

Best scores, achievements, stickers and the daily streak are saved in your browser.

## Controls

| Action | Keyboard and mouse | Gamepad |
|---|---|---|
| Aim | Mouse, or `W` `A` `S` `D` | Left stick |
| Charge and shoot | Hold left click or `Space`, release to shoot | Hold `RT` or `A` |
| Curve left / right | `Q` / `E`, or mouse wheel | `LB` / `RB` |
| Use power-up | `F`, or click the power-up slot | `X` |
| Rotate camera | Arrow keys | Right stick |
| Switch first / third person | Right click, or `C` | `Y` |
| Skip replay | Click, or `Space` | `A` |
| Pause / resume | `P` or `Esc` | `Start` |
| Mute | `M` | |
| Help | `H` | |

On touch screens, press and drag to aim while charging, then lift your finger to shoot.

## Technologies

- **[Three.js](https://threejs.org/) r160:** rendering with WebGL 2, soft shadows, ACES tone mapping, instanced crowds and GPU particles.
- **JavaScript (ES modules):** no framework and no bundler. Three.js is loaded through an import map.
- **Web Audio API:** every sound effect and the crowd ambience are synthesised in code, so there are no audio files.
- **HTML and CSS:** the HUD and menus are a DOM layer over the canvas, with a responsive layout and support for reduced motion.
- **Gamepad API**, and **localStorage** for saved progress.
- **Node.js:** a tiny dependency-free static server for local play.

All 3D models, textures (grass, ad boards, ball, net) and sounds are generated in code; the repository contains no binary assets.

Under the hood:
- Ball physics runs at a fixed 240 Hz, with sphere-vs-capsule collisions against the posts, keeper and wall, plus a soft net.
- Shots solve for a launch velocity that lands on the marker after curve and topspin.
- The keeper predicts where the ball will cross his own position and dives with an exact reach calculation.
- The Daily Challenge uses a seeded random generator so every player gets the same kicks.
- Resolution drops automatically if the frame rate falls.

## Project structure

```
index.html              page shell, HUD and menus
css/
  style.css             base UI styling
  features.css          streaks, bosses, power-ups, replays, trophy room
server.js               static server used by `npm start`
package.json
src/
  main.js               renderer setup and main loop
  game.js               game state machine, shooting, scoring, modes and rewards
  config.js             gameplay constants
  physics.js            shot trajectory and collisions
  camera.js             third-person, first-person, replay and menu cameras
  input.js              keyboard, pointer and gamepad
  ui.js                 HUD, menus, toasts and trophy room
  audio.js              synthesised sound effects
  rng.js                seedable random numbers for the Daily Challenge
  progress.js           saved bests, achievements, stickers and daily streak
  features/             boss keepers, power-ups, replay recorder
  fx/particles.js       pooled GPU particles
  world/                stadium, goal and net, collectibles
  entities/             ball, keeper, kicker, wall, shared player model
football_mania.py       original Python/OpenGL version
```

## Original Python version

The game began as a PyOpenGL/GLUT project. [`football_mania.py`](football_mania.py) is the original game; `Hello_openGL.py` and `Lets_draw_sth.py` are OpenGL practice scripts. To run them:

```bash
pip install PyOpenGL PyOpenGL_accelerate
python football_mania.py
```

The web version keeps the original's rules and numbers: goal and keeper sizes, the three modes, zone scoring and three misses. It also fixes several issues from the original:
- The keeper's dive now moves its collision area with it (before, the dive had no effect).
- Ball speed no longer depends on the frame rate.
- Shots curve and dip instead of flying in a straight line.
- The crowd no longer jitters.
- The Time Reduction shot clock now follows its documented rules.
- Wall players stand shoulder to shoulder.
