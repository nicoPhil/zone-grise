import { clamp, type Pt, type Rect } from "../util";

/** Liang–Barsky: does segment (x1,y1)-(x2,y2) cross rectangle r? */
export function segHits(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  const p = [-dx, dx, -dy, dy], q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];
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

export const los = (walls: Rect[], a: Pt, b: Pt) => !walls.some((w) => segHits(a.x, a.y, b.x, b.y, w));
export const inWall = (walls: Rect[], x: number, y: number, pad = 0) =>
  walls.some((w) => x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad);

/** Pushes a circle of radius r out of every wall it overlaps. */
export function collide(walls: Rect[], o: Pt, r: number) {
  for (const w of walls) {
    const cx = clamp(o.x, w.x, w.x + w.w), cy = clamp(o.y, w.y, w.y + w.h);
    const dx = o.x - cx, dy = o.y - cy, d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    if (d2 === 0) {
      const l = o.x - w.x, rr = w.x + w.w - o.x, t = o.y - w.y, b = w.y + w.h - o.y, m = Math.min(l, rr, t, b);
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
