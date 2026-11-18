# Sunshine Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/huahhhas/sunshine-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/huahhhas/sunshine-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for make.fun's **gta6-01** bounty ("Make GTA 6"), built
entirely in this repository. Maya "Rio" Santos came home to Sunshine Bay broke — and
Delgado, the fixer who owns this city, has a job for her. Steal cars, outrun the Bay PD,
pull the jobs, and get out clean.

Everything in the game is original: the city, the characters, the vehicles, the story,
the art and the sound. No Rockstar Games names, assets or maps. It runs offline in a
desktop browser from static files, with no network request.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` from any static file server. No build step, no dependencies
beyond the vendored three.js build under `game/three.min.js`.

| Key | Action |
| --- | --- |
| W A S D | Move on foot / drive |
| Shift | Run |
| E | Steal a car / interact |
| Mouse drag | Orbit the camera |
| Mouse wheel | Zoom |
| Click | Shoot (on foot) |
| R | Reload |
| Space | Honk (in a car) |
| P / Esc | Pause |

## What's in the city

- **A city on foot and by car** — a procedural coastal city: downtown towers, streets,
  sidewalks, a beach, a boardwalk, a marina pier and the north bridge.
- **Traffic and pedestrians** — cars that drive the street grid, people who stroll the
  sidewalks and run from trouble.
- **Stealing cars** — walk up to any parked or traffic car and press E. The cops notice.
- **A wanted level and police** — 1 to 5 stars. Police cars chase and ram; at 3 stars,
  officers on foot join in. Lose the cops and the heat cools off.
- **Missions and a story** — four jobs for Delgado: *First Wheels*, *The Pickup*,
  *Bay Heist* and *The Last Ride*, with a waypoint beacon, a HUD objective and a minimap
  marker for each.
- **Combat** — a pistol with a magazine and reload, and a shove for anyone in your way.
- **HUD with a minimap** — cash, wanted stars, health, ammo, speed, mission objective
  with distance, and a live top-down map with the player, police and the objective.
- **Start and save** — a title screen with New game / Continue, pause, and a save in
  localStorage.
- **Sound** — everything is synthesized with WebAudio: engine, sirens, gunshots, crashes,
  pickups and a sunset-drive music loop. No audio files.

## Structure

- `main.ts` — the entry program (Node 22): copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `serve.ts` — a tiny static server for local play.
- `game/index.html` — the page: canvas, HUD and screens.
- `game/three.min.js` — three.js r149, vendored.
- `game/src/` — the game itself, one job per file:
  - `config.js` — tuning, the city layout, the missions, the palette.
  - `random.js` — the seeded RNG (the same seed grows the same city).
  - `audio.js` — synthesized sound and music.
  - `city.js` — the procedural city, roads, colliders and mission places.
  - `vehicles.js` — car models, arcade driving, traffic and police AI.
  - `people.js` — pedestrians.
  - `world.js` — the rules: player, wanted level, missions, combat, collisions, save.
  - `render.js` — the three.js scene, the chase camera, the HUD and the minimap.
  - `shots.js` — the deterministic screenshot scenes (`?shot=start|play|chase|end`).
  - `input.js` — keyboard and mouse.
  - `main.js` — boot and the game loop.
- `screenshots/` — four real renders of the game running in a browser.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

## Screenshots

1. `1-start.jpg` — the title over the living city.
2. `2-drive.jpg` — driving to the marina with a 2-star wanted level and police behind.
3. `3-chase.jpg` — a 4-star chase through an intersection on the Bay Heist escape.
4. `4-end.jpg` — the story-complete screen at the north bridge.

## License

MIT. See `LICENSE`.
