import { clamp, type Pt, type Rect } from "../util";
import { inWall } from "./geometry";
import { W } from "./mapgen";

export const G = 20,
  GW = W / G;

export interface Nav {
  blocked: Uint8Array;
  dist: Int16Array;
  queue: Int32Array;
}

export const cellOf = (x: number, y: number) => clamp(Math.floor(y / G), 0, GW - 1) * GW + clamp(Math.floor(x / G), 0, GW - 1);

export function makeNav(walls: Rect[]): Nav {
  const blocked = new Uint8Array(GW * GW);
  for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) blocked[j * GW + i] = inWall(walls, (i + 0.5) * G, (j + 0.5) * G, 13) ? 1 : 0;
  return { blocked, dist: new Int16Array(GW * GW).fill(-1), queue: new Int32Array(GW * GW) };
}

/** Breadth-first distance to (x,y) on the grid, so chasers walk around walls and through doors. */
export function updFlow(nav: Nav, x: number, y: number, d = nav.dist) {
  const { queue: q, blocked } = nav;
  d.fill(-1);
  let h = 0,
    t = 0;
  const s = cellOf(x, y);
  d[s] = 0;
  q[t++] = s;
  const go = (n: number, v: number) => {
    if (d[n] < 0 && !blocked[n]) {
      d[n] = v;
      q[t++] = n;
    }
  };
  while (h < t) {
    const c = q[h++],
      i = c % GW,
      v = d[c] + 1;
    if (i > 0) go(c - 1, v);
    if (i < GW - 1) go(c + 1, v);
    if (c >= GW) go(c - GW, v);
    if (c < GW * GW - GW) go(c + GW, v);
  }
}

/** Unit vector towards the neighbouring cell closest to the flow target; diagonals never cut a wall corner. */
export function flowDir(nav: Nav, x: number, y: number, dist = nav.dist): Pt | null {
  const { blocked } = nav,
    c = cellOf(x, y),
    i = c % GW,
    j = (c - i) / GW;
  let best = -1,
    bv = dist[c] < 0 ? 1e9 : dist[c];
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const ni = i + di,
        nj = j + dj;
      if ((!di && !dj) || ni < 0 || nj < 0 || ni >= GW || nj >= GW) continue;
      const n = nj * GW + ni;
      if (dist[n] < 0 || (di && dj && (blocked[j * GW + ni] || blocked[nj * GW + i]))) continue;
      if (dist[n] < bv) {
        bv = dist[n];
        best = n;
      }
    }
  if (best < 0) return null;
  const tx = ((best % GW) + 0.5) * G - x,
    ty = (Math.floor(best / GW) + 0.5) * G - y,
    l = Math.hypot(tx, ty) || 1;
  return { x: tx / l, y: ty / l };
}
