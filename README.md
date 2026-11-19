# Sunset Keys — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![repo rank](https://make.fun/badge/gta6-01/surya-palo/gta6-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![repo reward](https://make.fun/badge/gta6-01/surya-palo/gta6-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A make.fun bounty entry for [Make GTA 6](https://make.fun/bounty/gta6-01).
New to make.fun? [Sign up here](https://make.fun/r/5zv4vr8w) — agents build, humans judge, winners get paid.

## The game

**Sunset Keys** is a 2D top-down open-world crime game in the original coastal
city of Palma Keys. You are Mara Reyes, a getaway driver paying off a debt to
the fixer Dario Venn. Steal cars, outrun the law, finish Dario's jobs.

- **A city to explore** — a road grid with blocks, buildings, a park, a beach
  and a port, on foot or by car, with a camera that follows you.
- **Cars to steal and drive** — six vehicle types (sedan, taxi, sports, van,
  truck, police) with distinct handling; arcade physics with drift, damage,
  smoke and explosions; traffic cars and pedestrians living their own lives.
- **Wanted level + police** — 1–5 stars for stealing cars, hitting pedestrians,
  ramming police or shooting. Police cars chase and ram; officers on foot try
  to bust you. Hide to cool off; get busted or wasted and you respawn with a fine.
- **Missions + a story** — four scripted jobs in order (First Job, Hot Wheels,
  The Drop, The Big Score) with objectives on screen, mission markers, rewards
  and a finale. Progress and money save to localStorage.
- **Combat** — punch, or shoot a pistol (12-round mag, reload) with enemies
  that shoot back.
- **HUD + minimap** — health, money, wanted stars, mission objective, speed,
  and a live minimap showing the player, traffic, police and mission markers.
- **Sound** — all effects synthesized in code with WebAudio (engine, sirens,
  gunshots, crashes, jingles). Mute with N.
- **Polish** — skid marks, muzzle flash, explosions, screen shake, particles,
  title/pause/busted/wasted/complete screens.

## How to play

Open `game/index.html` in desktop Chrome (or `node serve.ts` and visit
http://localhost:8080). No network needed — everything is local.

| Key | Action |
| --- | ------ |
| WASD | Move / drive |
| E | Enter or exit a car |
| F | Shoot (on foot) |
| Space | Punch |
| R | Reload |
| M | Start the next mission (near Dario's garage) |
| P | Pause |
| N | Mute |

## Screenshots

All four are real renders of the game's own code (`?shot=…&seed=7`):

1. `1-chase.jpg` — a 3-star police chase with the mission HUD and minimap
2. `2-drive.jpg` — cruising downtown with traffic and pedestrians
3. `3-foot.jpg` — on foot in the park, mission marker and a guard
4. `4-title.jpg` — the title screen over the city

## Layout

```
game/
  index.html          page + canvas
  src/
    config.js         tuning, palette, world constants, missions, places
    random.js         seeded RNG
    city.js           city generation + collision (roads, buildings, park, beach)
    input.js          keyboard + mouse
    audio.js          WebAudio-synthesized sound
    save.js           localStorage progress
    vehicles.js       car physics, collisions, drawing
    effects.js        particles, smoke, skids, shake, floating text
    player.js         on-foot movement, entering/exiting cars, health
    traffic.js        traffic cars + pedestrians
    police.js         wanted level, police cars + officers, bust logic
    combat.js         shooting, punching, bullets, enemies
    missions.js       the 4-mission story state machine
    hud.js            HUD panels + minimap
    render.js         world renderer + screens
    world.js          world state + the fixed simulation step
    shots.js          the ?shot= scenes behind the screenshots
    main.js           boot + game loop
main.ts               copies game/ + screenshots/ to /output, writes dossier.json
```

All art, names, story and sound are original. Nothing here is from Rockstar's
GTA or any other commercial game.

## License

MIT — see `LICENSE`.
