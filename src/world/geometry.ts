import { clamp, type Pt, type Rect } from "../util";

/** One Liang–Barsky edge: the narrowed [t0, t1], or null once the segment misses. */
function clipEdge(p: number, q: number, [t0, t1]: [number, number]): [number, number] | null {
  if (p === 0) return q < 0 ? null : [t0, t1];
  const t = q / p;
  if (p < 0) return t > t1 ? null : [Math.max(t0, t), t1];
  return t < t0 ? null : [t0, Math.min(t1, t)];
}

/** Liang–Barsky: does segment a-b cross rectangle r? */
export function segHits(a: Pt, b: Pt, r: Rect): boolean {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const edges: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.w - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.h - a.y],
  ];
  let span: [number, number] | null = [0, 1];
  for (const [p, q] of edges) {
    span = clipEdge(p, q, span);
    if (!span) return false;
  }
  return true;
}

/** Half-angle of a melee swing, radians. */
export const MELEE_ARC = 0.9;

/** Is t within `reach` of o and within ±half radians of direction `face`? */
export function inArc(o: Pt, face: number, t: Pt, arc: { reach: number; half: number }) {
  if (Math.hypot(t.x - o.x, t.y - o.y) > arc.reach) return false;
  const d = Math.atan2(t.y - o.y, t.x - o.x) - face;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) <= arc.half;
}

export const los = (walls: Rect[], a: Pt, b: Pt) => !walls.some((w) => segHits(a, b, w));
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
    if (d2 === 0) pushOutOfInside(w, o, r);
    else {
      const d = Math.sqrt(d2);
      o.x += (dx / d) * (r - d);
      o.y += (dy / d) * (r - d);
    }
  }
}

/** The centre is inside the wall: leave by the nearest side. */
function pushOutOfInside(w: Rect, o: Pt, r: number) {
  const l = o.x - w.x,
    rr = w.x + w.w - o.x,
    t = o.y - w.y,
    b = w.y + w.h - o.y,
    m = Math.min(l, rr, t, b);
  if (m === l) o.x = w.x - r;
  else if (m === rr) o.x = w.x + w.w + r;
  else if (m === t) o.y = w.y - r;
  else o.y = w.y + w.h + r;
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

/** Distance along the ray o+t·dir to the first wall, capped at max. */
export function rayLen(walls: Rect[], o: Pt, dir: Pt, max: number) {
  const { x, y } = o,
    { x: dx, y: dy } = dir;
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
