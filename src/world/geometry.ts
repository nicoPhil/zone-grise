import { clamp, type Pt, type Rect } from "../util";

/** Liang–Barsky: does segment (x1,y1)-(x2,y2) cross rectangle r? */
export function segHits(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  let t0 = 0,
    t1 = 1;
  const dx = x2 - x1,
    dy = y2 - y1;
  const p = [-dx, dx, -dy, dy],
    q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

/** Half-angle of a melee swing, radians. */
export const MELEE_ARC = 0.9;

/** Is (x,y) within `reach` of (px,py) and within ±half radians of direction `face`? */
export function inArc(px: number, py: number, face: number, x: number, y: number, reach: number, half: number) {
  if (Math.hypot(x - px, y - py) > reach) return false;
  const d = Math.atan2(y - py, x - px) - face;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) <= half;
}

export const los = (walls: Rect[], a: Pt, b: Pt) => !walls.some((w) => segHits(a.x, a.y, b.x, b.y, w));
export const inWall = (walls: Rect[], x: number, y: number, pad = 0) =>
  walls.some((w) => x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad);

/** Pushes a circle of radius r out of every wall it overlaps. */
export function collide(walls: Rect[], o: Pt, r: number) {
  for (const w of walls) {
    const cx = clamp(o.x, w.x, w.x + w.w),
      cy = clamp(o.y, w.y, w.y + w.h);
    const dx = o.x - cx,
      dy = o.y - cy,
      d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) {
      const l = o.x - w.x,
        rr = w.x + w.w - o.x,
        t = o.y - w.y,
        b = w.y + w.h - o.y,
        m = Math.min(l, rr, t, b);
      if (m === l) o.x = w.x - r;
      else if (m === rr) o.x = w.x + w.w + r;
      else if (m === t) o.y = w.y - r;
      else o.y = w.y + w.h + r;
    } else {
      const d = Math.sqrt(d2);
      o.x += (dx / d) * (r - d);
      o.y += (dy / d) * (r - d);
    }
  }
}

/** The closest unopened one within reach: crates open one at a time. */
export function nearestInReach<T extends Pt & { open: boolean }>(xs: T[], p: Pt, reach: number) {
  let best: T | undefined,
    bd = reach;
  for (const c of xs) {
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (!c.open && d < bd) [best, bd] = [c, d];
  }
  return best;
}

/** A shot travelling along (vx,vy) meets the front of something facing `face`, within 60° either side. */
export const frontHit = (face: number, vx: number, vy: number) =>
  (Math.cos(face) * vx + Math.sin(face) * vy) / (Math.hypot(vx, vy) || 1) < -0.5;

/** Distance along the ray (x,y)+t·(dx,dy) to the first wall, capped at max. */
export function rayLen(walls: Rect[], x: number, y: number, dx: number, dy: number, max: number) {
  let best = max;
  for (const w of walls) {
    let t0 = 0,
      t1 = best;
    if (Math.abs(dx) < 1e-9) {
      if (x < w.x || x > w.x + w.w) continue;
    } else {
      const a = (w.x - x) / dx,
        b = (w.x + w.w - x) / dx;
      [t0, t1] = [Math.max(t0, Math.min(a, b)), Math.min(t1, Math.max(a, b))];
    }
    if (Math.abs(dy) < 1e-9) {
      if (y < w.y || y > w.y + w.h) continue;
    } else {
      const a = (w.y - y) / dy,
        b = (w.y + w.h - y) / dy;
      [t0, t1] = [Math.max(t0, Math.min(a, b)), Math.min(t1, Math.max(a, b))];
    }
    if (t0 <= t1) best = t0;
  }
  return best;
}
