# Sunset Keys — build log

A make.fun entry for **gta6-01 (Make GTA 6)**, built 2026-11-20 in a recorded
session. A 2D top-down open-world crime game in the original city of Palma Keys.

## What was built

- **City** (`city.js`): 3600×2600 world, road grid every 400 units, blocks with
  1–4 buildings each, a park block (trees + pond), beach + water south, a port
  with shipping containers east. Deterministic per seed.
- **Driving** (`vehicles.js`, `player.js`): enter/exit any car; arcade physics
  (throttle, braking, reverse, speed-scaled steering, lateral slide + grip
  drift, wall/car collisions, damage, smoke, explosion). 6 vehicle types with
  distinct handling.
- **Traffic + pedestrians** (`traffic.js`): cars follow roads, turn at
  junctions, brake for obstacles, slow for turns, recover when stuck;
  pedestrians walk sidewalks and flee from gunfire and crashes.
- **Police + wanted** (`police.js`): 0–5 stars; crimes (steal, hit a
  pedestrian, ram a cop, shoot) raise it; police cars chase on roads and ram;
  officers on foot bust a slow player; wanted decays after 12 s out of sight;
  busted/wasted respawn with a fine.
- **Missions** (`missions.js`): 4 story jobs in order (First Job $500, Hot
  Wheels $800, The Drop $1,200, The Big Score $2,500) with stages, markers,
  objectives, complete/fail states; progression + money saved to localStorage.
- **Combat** (`combat.js`): punch, pistol (12-round mag, reload), bullets with
  tracers, enemies that shoot back (guards, rivals).
- **HUD + minimap** (`hud.js`): health, money, wanted stars, mission
  objective, speed, bust meter, centre messages, live minimap (roads,
  buildings, player arrow, traffic, flashing police, mission marker).
- **Screens** (`render.js`, `main.js`): title (slow-panning city backdrop),
  pause, busted, wasted, story-complete; fixed 60 Hz step; `?shot=` scenes.
- **Sound** (`audio.js`): WebAudio-synthesized engine, siren, gunshot, punch,
  crash, pickup, jingles; mute with N.
- **Polish** (`effects.js`): particles, sparks, explosions, muzzle flash,
  smoke, skid marks, floating text, screen shake, lerped camera.

## Bugs found and fixed during the build

1. **Buildings sat on the roads.** The block origin forgot the half-grid
   offset of the road centrelines, so every building was 200 units west/north
   of its block and many overlapped roads. Cars spawned at junctions were
   wedged against them and could not move. Fixed the origin and the block
   counts; moved the port containers clear of the eastern road.
2. **The traffic AI drove the player's stolen car.** A stolen car stays in the
   traffic list, and the traffic step kept steering it against the player's
   input. The traffic step and its collision loop now skip cars with
   `driver === 'player'`; `allCars()` deduplicates.
3. **One shunt wrecked a car.** `collideCars` and wall hits applied damage
   every frame while the cars stayed in contact. Damage is now throttled with
   a 0.5 s per-car cooldown.
4. **Cars reversed into sharp turns.** The autopilot and traffic AI braked
   (negative throttle) for a >57° turn and, once stopped, kept reversing.
   They now brake only while fast and creep forward while slow.
5. **Traffic cut corners across blocks.** Cars spawned facing across their
   road, and turned at full speed. Spawns now face along their road; cars slow
   on the approach to a junction and turn tightly; stuck cars reverse out.
6. **Police cut across blocks.** Police cars steered straight at the player;
   they now follow the roads while far away and only cut in close to ram.
7. **HUD overlaps.** The player name was clipped by the health bar and the
   controls hint overlapped the minimap. The top-left panel is now two lines
   (name + money, then health bar + status) and the hint sits top-centre.

## Screenshots

Real renders of the game's own code via the VM's Chromium over CDP
(`?shot=chase|drive|foot|title&seed=7`, 1280×800 JPEG q82). The shot scenes
stage a real game state and play it forward with an autopilot; the staged
route is cleared of traffic so the drive runs clean (the game itself spawns
its full traffic). Verified visually: chase shows two police cars on the tail
at 74 mph with 3 stars; drive shows 62 mph downtown; foot shows stage 1 of
The Drop with the marker and a guard; title shows the start screen.

## Validation

- `node --check` passes on all 18 game sources.
- Kit check (`node cli/makefun.mjs check --repo …`, no `--transcripts` — a
  strict-transcripts bounty): **4 passed / 0 failed** (transcript rows are
  checked on the sealed recording by the site).
- `main.ts` run twice (MAKEFUN_OUTPUT_DIR=out1/out2): byte-identical output.
- Gate: game/ 22 files, well under 993 files / 48 MiB; index.html under 1 MiB;
  no symlinks; no network loads (all scripts/styles are files under game/).
- Screenshots: 4 JPEGs, 82–97 KiB each (limit 256 KiB), 1280×800 (long side
  ≤1280, short side ≥480).
- Offline play test in Chromium (network emulated off): drive, steal a car,
  raise wanted, start a mission, minimap + save all work; zero JS errors, zero
  network requests.
