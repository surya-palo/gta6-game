// The heads-up display: health and money, wanted stars, the mission
// objective, speed, messages — and the live minimap that shows the city,
// the player, cars, police and the mission marker at a glance.

import { FONT, GRID, PALETTE, PLACES, ROAD, WORLD } from './config.js';
import { missionMarker, missionObjective } from './missions.js';

const MM_W = 210;
const MM_H = 150;
const MM_PAD = 14;

function panel(ctx, x, y, w, h, radius) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

export function drawHud(ctx, world, view) {
  const { player, police, missions } = world;
  const W = view.width;
  const H = view.height;
  ctx.save();
  ctx.font = `600 15px ${FONT}`;
  ctx.textBaseline = 'middle';

  // Top-left: name + money on one line, health bar + status below.
  panel(ctx, 14, 12, 220, 60, 10);
  ctx.fillStyle = PALETTE.hudText;
  ctx.textAlign = 'left';
  ctx.fillText('MARA REYES', 26, 28);
  ctx.fillStyle = PALETTE.money;
  ctx.textAlign = 'right';
  ctx.fillText(`$${player.money.toLocaleString('en-US')}`, 222, 28);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#333';
  ctx.fillRect(26, 42, 120, 11);
  ctx.fillStyle = player.health > 30 ? PALETTE.health : PALETTE.healthLow;
  ctx.fillRect(26, 42, 120 * Math.max(0, player.health / 100), 11);
  ctx.strokeStyle = '#ffffff66';
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 42, 120, 11);
  ctx.fillStyle = PALETTE.hudMuted;
  ctx.font = `500 12px ${FONT}`;
  ctx.fillText(player.onFoot ? `${player.ammo} / 12 ammo` : 'DRIVING', 156, 48);
  ctx.font = `600 15px ${FONT}`;

  // Top-right: wanted stars.
  panel(ctx, W - 14 - 170, 12, 170, 44, 10);
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < police.wanted ? PALETTE.star : PALETTE.starEmpty;
    ctx.font = '22px sans-serif';
    ctx.fillText('★', W - 14 - 150 + i * 30, 35);
  }
  ctx.font = `600 15px ${FONT}`;

  // Bust meter (while an officer is closing in).
  if (police.bust > 0.05) {
    const bw = 180;
    panel(ctx, (W - bw) / 2, 12, bw, 34, 10);
    ctx.fillStyle = '#ef4444';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', W / 2, 22);
    ctx.fillStyle = '#333';
    ctx.fillRect((W - bw) / 2 + 12, 32, bw - 24, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect((W - bw) / 2 + 12, 32, (bw - 24) * police.bust, 6);
  }

  // Bottom-centre: mission objective.
  const objective = missionObjective(missions);
  ctx.font = `600 15px ${FONT}`;
  const ow = Math.min(W - 260, ctx.measureText(objective).width + 36);
  panel(ctx, (W - ow) / 2, H - 56, ow, 38, 10);
  ctx.fillStyle = PALETTE.marker;
  ctx.textAlign = 'center';
  ctx.fillText(objective, W / 2, H - 37);

  // Bottom-right: speed (driving) or a hint (on foot).
  if (!player.onFoot && player.car) {
    const mph = Math.round(Math.abs(player.car.speed) * 0.12);
    panel(ctx, W - 14 - 110, H - 56, 110, 38, 10);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`${mph} mph`, W - 14 - 55, H - 37);
  } else if (world.hint) {
    ctx.font = `500 13px ${FONT}`;
    const hw = ctx.measureText(world.hint).width + 28;
    panel(ctx, W - 14 - hw, H - 56, hw, 38, 10);
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.textAlign = 'center';
    ctx.fillText(world.hint, W - 14 - hw / 2, H - 37);
  }

  // Centre messages (mission updates, events), fading.
  if (world.msgText && world.msgTime > 0) {
    const alpha = Math.min(1, world.msgTime);
    ctx.globalAlpha = alpha;
    ctx.font = `700 19px ${FONT}`;
    const mw = Math.min(W - 120, ctx.measureText(world.msgText).width + 44);
    panel(ctx, (W - mw) / 2, 78, mw, 40, 10);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(world.msgText, W / 2, 99);
    ctx.globalAlpha = 1;
  }

  // Controls hint, early on (top-centre, clear of the minimap).
  if (world.time < 14) {
    ctx.globalAlpha = Math.max(0, 1 - (world.time - 10) / 4);
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.textAlign = 'center';
    ctx.fillText('WASD move/drive · E enter car · F shoot · Space punch · M mission · P pause', W / 2, 140);
    ctx.globalAlpha = 1;
  }

  drawMinimap(ctx, world, view);
  ctx.restore();
}

function drawMinimap(ctx, world, view) {
  const { player, police, missions, traffic, combat } = world;
  const H = view.height;
  const x0 = MM_PAD;
  const y0 = H - MM_PAD - MM_H;
  const sx = MM_W / WORLD.width;
  const sy = MM_H / WORLD.height;

  ctx.save();
  panel(ctx, x0 - 4, y0 - 4, MM_W + 8, MM_H + 8, 10);
  ctx.beginPath();
  ctx.roundRect(x0, y0, MM_W, MM_H, 6);
  ctx.clip();
  ctx.fillStyle = '#1d2b1a';
  ctx.fillRect(x0, y0, MM_W, MM_H);
  // Water + beach.
  ctx.fillStyle = '#2e9fd8';
  ctx.fillRect(x0, y0 + 2520 * sy, MM_W, MM_H - 2520 * sy);
  ctx.fillStyle = '#f2d492';
  ctx.fillRect(x0, y0 + 2420 * sy, MM_W, 100 * sy);
  // Roads.
  ctx.strokeStyle = '#55585e';
  ctx.lineWidth = 3;
  for (let x = GRID / 2; x < WORLD.width; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x0 + x * sx, y0);
    ctx.lineTo(x0 + x * sx, y0 + 2420 * sy);
    ctx.stroke();
  }
  for (let y = GRID / 2; y < 2420; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + y * sy);
    ctx.lineTo(x0 + MM_W, y0 + y * sy);
    ctx.stroke();
  }
  // Buildings as dots.
  ctx.fillStyle = '#8a8f96';
  for (const b of world.city.buildings) {
    ctx.fillRect(x0 + b.x * sx - 1, y0 + b.y * sy - 1, 2, 2);
  }
  // Places.
  ctx.fillStyle = '#ffffff88';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'left';
  for (const key of ['safehouse', 'garage']) {
    const p = PLACES[key];
    ctx.fillRect(x0 + p.x * sx - 2, y0 + p.y * sy - 2, 4, 4);
  }
  // Traffic cars.
  ctx.fillStyle = '#bbbbbb';
  for (const car of traffic.cars) {
    if (car.driver === 'player') continue;
    ctx.fillRect(x0 + car.x * sx - 1, y0 + car.y * sy - 1, 2, 2);
  }
  // Enemies.
  ctx.fillStyle = '#ff5252';
  for (const e of combat.enemies) {
    if (!e.dead) ctx.fillRect(x0 + e.x * sx - 2, y0 + e.y * sy - 2, 4, 4);
  }
  // Police: flashing dots.
  const flash = Math.floor(world.time * 4) % 2 === 0;
  ctx.fillStyle = flash ? '#ff5252' : '#448aff';
  for (const car of police.cars) {
    ctx.beginPath();
    ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const off of police.officers) {
    ctx.beginPath();
    ctx.arc(x0 + off.x * sx, y0 + off.y * sy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mission marker: a pulsing yellow diamond.
  const marker = missionMarker(missions);
  if (marker) {
    const pulse = 4 + Math.sin(world.time * 4) * 1.5;
    ctx.fillStyle = PALETTE.marker;
    ctx.save();
    ctx.translate(x0 + marker.x * sx, y0 + marker.y * sy);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
    ctx.restore();
  }
  // Player: a white arrow pointing where they face.
  ctx.save();
  ctx.translate(x0 + player.x * sx, y0 + player.y * sy);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#00000088';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}
