// Drawing only: the world state and the current screen in, pixels out. A
// camera follows the player across the city; the world is painted in layers
// (ground, roads, buildings, cars, people, effects) and the HUD and screens
// are painted on top in screen space.

import { BEACH_Y, FONT, GRID, PALETTE, ROAD, SIDEWALK, WATER_Y, WORLD } from './config.js';
import { drawCar } from './vehicles.js';
import { drawPlayer } from './player.js';
import { drawPed } from './traffic.js';
import { drawOfficer } from './police.js';
import { drawBullets, drawEnemy } from './combat.js';
import { drawFloats, drawParticles, drawSkids, shakeOffset } from './effects.js';
import { drawHud } from './hud.js';
import { missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { width: 1280, height: 720, dpr: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    view.width = w;
    view.height = h;
    view.dpr = dpr;
  }
  window.addEventListener('resize', resize);
  resize();

  function drawGround(world, cam) {
    const { city } = world;
    // Grass base.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x - 40, cam.y - 40, view.width + 80, view.height + 80);
    // Mow stripes for texture.
    ctx.fillStyle = PALETTE.grassDark;
    for (let y = 0; y < WORLD.height; y += 160) {
      ctx.fillRect(cam.x - 40, y, view.width + 80, 80);
    }
    // Beach + water.
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(cam.x - 40, BEACH_Y, view.width + 80, WATER_Y - BEACH_Y);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(cam.x - 40, WATER_Y, view.width + 80, WORLD.height - WATER_Y);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 240) {
      ctx.fillRect(x + 40, WATER_Y + 30, 120, 6);
      ctx.fillRect(x + 120, WATER_Y + 60, 90, 6);
    }
    // Park.
    ctx.fillStyle = PALETTE.park;
    const px = 2 * GRID + ROAD / 2 + SIDEWALK;
    const py = 1 * GRID + ROAD / 2 + SIDEWALK;
    const ps = GRID - ROAD - SIDEWALK * 2;
    ctx.fillRect(px, py, ps, ps);
    ctx.fillStyle = '#7ec850';
    ctx.beginPath();
    ctx.ellipse(px + ps / 2, py + ps / 2, 70, 44, 0, 0, Math.PI * 2);
    ctx.fill();
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (let x = GRID / 2; x < WORLD.width; x += GRID) {
      ctx.fillRect(x - ROAD / 2, 0, ROAD, BEACH_Y);
    }
    for (let y = GRID / 2; y < BEACH_Y; y += GRID) {
      ctx.fillRect(0, y - ROAD / 2, WORLD.width, ROAD);
    }
    // Sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (let x = GRID / 2; x < WORLD.width; x += GRID) {
      ctx.fillRect(x - ROAD / 2 - SIDEWALK, 0, SIDEWALK, BEACH_Y);
      ctx.fillRect(x + ROAD / 2, 0, SIDEWALK, BEACH_Y);
    }
    for (let y = GRID / 2; y < BEACH_Y; y += GRID) {
      ctx.fillRect(0, y - ROAD / 2 - SIDEWALK, WORLD.width, SIDEWALK);
      ctx.fillRect(0, y + ROAD / 2, WORLD.width, SIDEWALK);
    }
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (let x = GRID / 2; x < WORLD.width; x += GRID) {
      for (let y = 30; y < BEACH_Y; y += 60) {
        if (isJunction(y)) continue;
        ctx.fillRect(x - 2, y, 4, 26);
      }
    }
    for (let y = GRID / 2; y < BEACH_Y; y += GRID) {
      for (let x = 30; x < WORLD.width; x += 60) {
        if (isJunction(x)) continue;
        ctx.fillRect(x, y - 2, 26, 4);
      }
    }
    // Crosswalks at junctions.
    ctx.fillStyle = PALETTE.crosswalk;
    for (let x = GRID / 2; x < WORLD.width; x += GRID) {
      for (let y = GRID / 2; y < BEACH_Y; y += GRID) {
        for (let i = 0; i < 5; i += 1) {
          ctx.fillRect(x - ROAD / 2 + 8 + i * 16, y - ROAD / 2 - 12, 8, 10);
          ctx.fillRect(x - ROAD / 2 + 8 + i * 16, y + ROAD / 2 + 2, 8, 10);
        }
      }
    }
    // Umbrellas on the beach.
    for (const u of city.umbrellas) {
      ctx.fillStyle = u.colour;
      ctx.beginPath();
      ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Trees.
    for (const t of city.trees) {
      ctx.fillStyle = '#2f7d32';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#43a047';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Buildings: shadow, roof, inset detail.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.colour;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      const inset = b.inset;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(b.x + b.w * inset, b.y + b.h * inset, b.w * (1 - inset * 2), b.h * (1 - inset * 2));
    }
    // Shipping containers.
    for (const c of city.containers) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(c.x + 4, c.y + 5, c.w, c.h);
      ctx.fillStyle = c.colour;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
  }

  function isJunction(v) {
    for (let c = GRID / 2; c < WORLD.width; c += GRID) {
      if (Math.abs(v - c) < ROAD / 2 + 20) return true;
    }
    return false;
  }

  function drawBeacon(world) {
    const marker = missionMarker(world.missions);
    if (!marker) return;
    const pulse = 0.6 + Math.sin(world.time * 3) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse * 0.35;
    ctx.fillStyle = PALETTE.marker;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = PALETTE.marker;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34, 0, Math.PI * 2);
    ctx.stroke();
    // A beam of light up from the marker.
    const grad = ctx.createLinearGradient(marker.x, marker.y - 160, marker.x, marker.y);
    grad.addColorStop(0, 'rgba(255,215,0,0)');
    grad.addColorStop(1, 'rgba(255,215,0,0.5)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(marker.x - 12, marker.y);
    ctx.lineTo(marker.x + 12, marker.y);
    ctx.lineTo(marker.x + 5, marker.y - 160);
    ctx.lineTo(marker.x - 5, marker.y - 160);
    ctx.closePath();
    ctx.fill();
    // Label.
    ctx.font = `700 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 4;
    ctx.strokeText(marker.label, marker.x, marker.y - 60);
    ctx.fillText(marker.label, marker.x, marker.y - 60);
    ctx.restore();
  }

  function drawWorld(world, cam) {
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const shake = shakeOffset(world.fx);
    ctx.translate(-cam.x + shake.x, -cam.y + shake.y);
    drawGround(world, cam);
    drawSkids(ctx, world.fx);
    drawBeacon(world);
    // Cars: traffic, police, then the player's.
    for (const car of world.traffic.cars) {
      if (!car.dead) drawCar(ctx, car, world.time);
    }
    for (const car of world.police.cars) {
      if (!car.dead) drawCar(ctx, car, world.time);
    }
    if (!world.player.onFoot && world.player.car) drawCar(ctx, world.player.car, world.time);
    // People.
    for (const ped of world.traffic.peds) drawPed(ctx, ped);
    for (const off of world.police.officers) drawOfficer(ctx, off, world.time);
    for (const e of world.combat.enemies) drawEnemy(ctx, e);
    drawPlayer(ctx, world.player, world.time);
    drawBullets(ctx, world.combat);
    drawParticles(ctx, world.fx);
    drawFloats(ctx, world.fx);
    ctx.restore();
  }

  function drawTitle(world, save) {
    // A slow pan over the city behind the title.
    const cam = world.titleCam;
    drawWorld(world, cam);
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = 'rgba(10,10,25,0.45)';
    ctx.fillRect(0, 0, view.width, view.height);
    const cx = view.width / 2;
    ctx.textAlign = 'center';
    ctx.font = `900 ${Math.min(96, view.width / 10)}px ${FONT}`;
    ctx.fillStyle = PALETTE.titleShadow;
    ctx.fillText('SUNSET KEYS', cx + 4, 190 + 4);
    ctx.fillStyle = PALETTE.title;
    ctx.fillText('SUNSET KEYS', cx, 190);
    ctx.font = `600 22px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('An open-world crime story in Palma Keys', cx, 235);
    ctx.font = `500 16px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText('Steal cars. Outrun the law. Finish Dario\'s jobs.', cx, 265);
    const hasSave = save && save.missionsDone > 0;
    const blink = Math.floor(world.time * 2) % 2 === 0;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillStyle = blink ? '#ffffff' : '#ffffff88';
    ctx.fillText(hasSave ? 'ENTER — Continue your story' : 'ENTER — Start the story', cx, view.height - 190);
    ctx.font = `500 15px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText('WASD move & drive · E enter/exit car · F shoot · Space punch · R reload · M mission · N mute · P pause', cx, view.height - 150);
    if (hasSave) {
      ctx.fillText(`Progress: ${save.missionsDone}/4 missions · $${save.money.toLocaleString('en-US')} earned`, cx, view.height - 120);
    }
    ctx.fillStyle = '#ffffff55';
    ctx.font = `500 12px ${FONT}`;
    ctx.fillText('A make.fun bounty entry · @surya-palo · All art, names and story are original', cx, view.height - 24);
    ctx.restore();
  }

  function drawOverlay(title, lines, prompt, colour) {
    ctx.save();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = 'rgba(5,5,15,0.6)';
    ctx.fillRect(0, 0, view.width, view.height);
    const cx = view.width / 2;
    const cy = view.height / 2;
    ctx.textAlign = 'center';
    ctx.font = `900 64px ${FONT}`;
    ctx.fillStyle = colour || '#ffffff';
    ctx.fillText(title, cx, cy - 40);
    ctx.font = `500 19px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    lines.forEach((line, i) => ctx.fillText(line, cx, cy + 10 + i * 30));
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = blink ? '#ffffff' : '#ffffff66';
    ctx.fillText(prompt, cx, cy + 30 + lines.length * 30);
    ctx.restore();
  }

  return {
    view,
    resize,
    /** Paint the world and the screen on top of it. */
    draw(world, screen, save) {
      if (screen === SCREEN_TITLE) {
        drawTitle(world, save);
        return;
      }
      const cam = world.camera;
      drawWorld(world, cam);
      if (screen === SCREEN_PLAY) {
        drawHud(ctx, world, view);
        return;
      }
      // Paused / busted / wasted / complete: HUD underneath, overlay on top.
      drawHud(ctx, world, view);
      if (screen === SCREEN_PAUSED) {
        drawOverlay('PAUSED', [
          'WASD move & drive · E enter/exit car · F shoot · Space punch',
          'R reload · M mission · N mute · P resume',
        ], 'Press P or ENTER to resume', '#ffffff');
      } else if (screen === SCREEN_BUSTED) {
        drawOverlay('BUSTED', [
          'The Palma Keys police caught you.',
          `Fine: $${world.bustFine} · Mission failed.`,
        ], 'Press ENTER to try again', '#448aff');
      } else if (screen === SCREEN_WASTED) {
        drawOverlay('WASTED', [
          'Mara is down. The hospital patched her up.',
          `Bill: $${world.bustFine} · Mission failed.`,
        ], 'Press ENTER to try again', '#ef4444');
      } else if (screen === SCREEN_COMPLETE) {
        drawOverlay('STORY COMPLETE', [
          'All four jobs done. Palma Keys is yours.',
          `Money earned: $${world.player.money.toLocaleString('en-US')}`,
        ], 'Press ENTER to keep playing', '#4ade80');
      }
    },
  };
}
