// The city of Palma Keys: a road grid, blocks with buildings, a park, a beach
// and a port. Generation is deterministic for a seed. This module also answers
// the collision questions the rest of the game asks: is this point on a road,
// inside a building, in the water, or on a sidewalk?

import { BEACH_Y, GRID, PALETTE, PARK, ROAD, SIDEWALK, WATER_Y, WORLD } from './config.js';

export function roadCentresX() {
  const list = [];
  for (let x = GRID / 2; x < WORLD.width; x += GRID) list.push(x);
  return list;
}

export function roadCentresY() {
  const list = [];
  for (let y = GRID / 2; y < BEACH_Y; y += GRID) list.push(y);
  return list;
}

/** True when the point is on a road (not counting sidewalks). */
export function isRoad(x, y) {
  if (y >= BEACH_Y) return false;
  const half = ROAD / 2;
  for (const cx of roadCentresX()) {
    if (Math.abs(x - cx) <= half && y < BEACH_Y) return true;
  }
  for (const cy of roadCentresY()) {
    if (Math.abs(y - cy) <= half) return true;
  }
  return false;
}

/** True when the point is on a sidewalk (the strip beside a road). */
export function isSidewalk(x, y) {
  if (y >= BEACH_Y) return y < BEACH_Y + SIDEWALK;
  const half = ROAD / 2 + SIDEWALK;
  const inner = ROAD / 2;
  for (const cx of roadCentresX()) {
    const d = Math.abs(x - cx);
    if (d > inner && d <= half && y < BEACH_Y) return true;
  }
  for (const cy of roadCentresY()) {
    const d = Math.abs(y - cy);
    if (d > inner && d <= half) return true;
  }
  return false;
}

/** The nearest point on a road centreline to (x, y), for spawning traffic. */
export function nearestRoadPoint(x, y, rng) {
  const xs = roadCentresX();
  const ys = roadCentresY();
  const cx = xs.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
  const cy = ys.reduce((a, b) => (Math.abs(b - y) < Math.abs(a - y) ? b : a));
  if (rng.chance(0.5)) return { x: cx, y: Math.min(Math.max(y, 100), BEACH_Y - 100) };
  return { x: Math.min(Math.max(x, 100), WORLD.width - 100), y: cy };
}

/** Build the city's fixed layout: buildings, trees, docks and the park. */
export function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const containers = [];
  // A block is the ground between two neighbouring roads: the gap (GRID -
  // ROAD) less a sidewalk on each side. Block (bx, by) sits east of the
  // road at GRID/2 + bx*GRID and south of the road at GRID/2 + by*GRID.
  const block = GRID - ROAD - SIDEWALK * 2;
  const cols = roadCentresX().length - 1;
  const rows = roadCentresY().length - 1;

  for (let bx = 0; bx < cols; bx += 1) {
    for (let by = 0; by < rows; by += 1) {
      const x0 = bx * GRID + GRID / 2 + ROAD / 2 + SIDEWALK;
      const y0 = by * GRID + GRID / 2 + ROAD / 2 + SIDEWALK;
      if (bx === PARK.bx && by === PARK.by) {
        // The park: trees and a pond, no buildings.
        for (let i = 0; i < 26; i += 1) {
          trees.push({ x: x0 + rng.range(20, block - 20), y: y0 + rng.range(20, block - 20), r: rng.range(10, 18) });
        }
        continue;
      }
      // One to four buildings per block, each inset from the block edge.
      const count = rng.int(1, 4);
      const slots = [
        { x: x0, y: y0, w: block, h: block },
        { x: x0, y: y0, w: block / 2 - 8, h: block / 2 - 8 },
        { x: x0 + block / 2 + 8, y: y0, w: block / 2 - 8, h: block / 2 - 8 },
        { x: x0, y: y0 + block / 2 + 8, w: block / 2 - 8, h: block / 2 - 8 },
        { x: x0 + block / 2 + 8, y: y0 + block / 2 + 8, w: block / 2 - 8, h: block / 2 - 8 },
      ];
      const chosen = count === 1 ? [slots[0]] : slots.slice(1, 1 + count);
      for (const s of chosen) {
        const w = s.w * rng.range(0.7, 0.95);
        const h = s.h * rng.range(0.7, 0.95);
        buildings.push({
          x: s.x + (s.w - w) / 2,
          y: s.y + (s.h - h) / 2,
          w,
          h,
          colour: rng.pick(PALETTE.buildingRoof),
          // A roof detail: a smaller inset rectangle, drawn lighter.
          inset: rng.range(0.14, 0.22),
        });
      }
      // A few street trees along the block's edges.
      for (let i = 0; i < 3; i += 1) {
        if (rng.chance(0.6)) trees.push({ x: x0 + rng.range(0, block), y: y0 - 8, r: rng.range(8, 12) });
      }
    }
  }

  // The port: shipping containers stacked along the east edge, clear of the
  // easternmost road (its edge is at WORLD.width - 152).
  for (let i = 0; i < 14; i += 1) {
    containers.push({
      x: WORLD.width - 130 + (i % 2) * 60,
      y: 300 + Math.floor(i / 2) * 260,
      w: 58,
      h: 30,
      colour: rng.pick(['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad']),
    });
  }

  // Beach umbrellas and palms along the boardwalk.
  const umbrellas = [];
  for (let x = 150; x < WORLD.width - 100; x += 260) {
    if (rng.chance(0.7)) umbrellas.push({ x: x + rng.range(-40, 40), y: BEACH_Y + rng.range(30, 70), colour: rng.pick(['#e74c3c', '#f1c40f', '#3498db', '#ecf0f1']) });
  }

  return { buildings, trees, containers, umbrellas };
}

/** The solid rectangles a body collides with: buildings and containers. */
export function solidRects(city) {
  return [...city.buildings, ...city.containers];
}

/**
 * Push a circle (x, y, radius) out of every solid rectangle and the world
 * edge. Returns the corrected position. Water is not solid for walking —
 * the player simply cannot enter it (see isWater).
 */
export function resolveCircle(x, y, radius, rects) {
  let px = Math.max(radius, Math.min(WORLD.width - radius, x));
  let py = Math.max(radius, Math.min(WORLD.height - radius, y));
  for (const r of rects) {
    const nx = Math.max(r.x, Math.min(px, r.x + r.w));
    const ny = Math.max(r.y, Math.min(py, r.y + r.h));
    const dx = px - nx;
    const dy = py - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 === 0) {
        // Centre inside the rectangle: push out along the smallest overlap.
        const left = px - r.x;
        const right = r.x + r.w - px;
        const top = py - r.y;
        const bottom = r.y + r.h - py;
        const m = Math.min(left, right, top, bottom);
        if (m === left) px = r.x - radius;
        else if (m === right) px = r.x + r.w + radius;
        else if (m === top) py = r.y - radius;
        else py = r.y + r.h + radius;
      } else {
        const d = Math.sqrt(d2);
        px = nx + (dx / d) * radius;
        py = ny + (dy / d) * radius;
      }
    }
  }
  return { x: px, y: py };
}

/** True when the point is in the sea (south of the water line). */
export function isWater(x, y) {
  return y >= WATER_Y;
}
