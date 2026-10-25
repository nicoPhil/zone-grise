import type { Crate, Player, Raid } from "../raid";
import { clamp, rnd, type Pt, type Rect } from "../util";
import { los } from "../world/geometry";
import { wallsIn } from "../world/wallindex";
import type { Pose } from "./assets";
import { ctx, view } from "./canvas";

const BASE_VR = 560;
export const GOLD = "#f0c040";
/** Tier colours: brown debris, grey crate, khaki military crate, gold vault. */
export const crateCol = (c: Crate) => (c.vault ? GOLD : ["#8a6a3e", "#b8b8b0", "#3f6a2a"][c.tier]);

/** What every layer of one frame shares: the camera's world rectangle, the line of sight and the clock. */
export interface Frame {
  r: Raid;
  p: Player;
  cx: number;
  cy: number;
  ww: number;
  wh: number;
  tt: number;
  /** view radius this frame: a headlamp or visor pushes it out */
  vr: number;
  poly: Pose[];
  near: Rect[];
  seen: (o: Pt) => boolean;
  inView: (x: number, y: number, m?: number) => boolean;
  world: (g: CanvasRenderingContext2D) => void;
}

export function frame(r: Raid): Frame {
  const { dpr, vw, vh, zoom } = view;
  const vr = BASE_VR * (1 + r.p.st.vis);
  const p = r.p,
    sx = r.shake > 0 ? rnd(-4, 4) : 0,
    sy = r.shake > 0 ? rnd(-4, 4) : 0;
  const cx = p.x - vw / 2 / zoom + sx,
    cy = p.y - vh / 2 / zoom + sy,
    k = dpr * zoom,
    ww = vw / zoom,
    wh = vh / zoom;
  return {
    r,
    p,
    cx,
    cy,
    ww,
    wh,
    vr,
    tt: performance.now() / 1000,
    poly: visPoly(r, p, vr),
    near: wallsIn(r.walls, { x0: cx - 20, y0: cy - 20, x1: cx + ww + 20, y1: cy + wh + 20 }).filter(
      (w) => w.x < cx + ww + 20 && w.x + w.w > cx - 20 && w.y < cy + wh + 20 && w.y + w.h > cy - 20,
    ),
    seen: (o) => Math.hypot(o.x - p.x, o.y - p.y) < vr && los(r.walls, p, o),
    inView: (x, y, m = 60) => x > cx - m && x < cx + ww + m && y > cy - m && y < cy + wh + m,
    world: (g) => g.setTransform(k, 0, 0, k, -cx * k, -cy * k),
  };
}

/** Edges and corners of the view square and of every wall inside it. */
function occluders(r: Raid, o: Pt, vr: number) {
  const x0 = o.x - vr,
    x1 = o.x + vr,
    y0 = o.y - vr,
    y1 = o.y + vr;
  const segs: number[][] = [
    [x0, y0, x1, y0],
    [x1, y0, x1, y1],
    [x1, y1, x0, y1],
    [x0, y1, x0, y0],
  ];
  const pts: number[][] = [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
  for (const w of wallsIn(r.walls, { x0, y0, x1, y1 })) {
    if (w.x > x1 || w.x + w.w < x0 || w.y > y1 || w.y + w.h < y0) continue;
    const a = w.x,
      b = w.y,
      c = w.x + w.w,
      d = w.y + w.h;
    segs.push([a, b, c, b], [c, b, c, d], [c, d, a, d], [a, d, a, b]);
    pts.push([a, b], [c, b], [c, d], [a, d]);
  }
  return { segs, pts };
}

/** Distance along (dx,dy) from o to the first segment hit, Infinity if none. */
function cast(segs: number[][], o: Pt, dx: number, dy: number) {
  let best = Infinity;
  for (const s of segs) {
    const sdx = s[2] - s[0],
      sdy = s[3] - s[1],
      den = dx * sdy - dy * sdx;
    if (Math.abs(den) < 1e-9) continue;
    const qx = s[0] - o.x,
      qy = s[1] - o.y,
      t = (qx * sdy - qy * sdx) / den,
      u = (qx * dy - qy * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}

/** Visibility polygon from o: rays cast at every wall corner (±ε) within the view square. */
function visPoly(r: Raid, o: Pt, vr: number): Pose[] {
  const { segs, pts } = occluders(r, o, vr);
  const out: Pose[] = [];
  for (const [px, py] of pts) {
    const a0 = Math.atan2(py - o.y, px - o.x);
    for (const a of [a0 - 0.0002, a0, a0 + 0.0002]) {
      const dx = Math.cos(a),
        dy = Math.sin(a),
        best = cast(segs, o, dx, dy);
      if (best < Infinity) out.push({ a, x: o.x + dx * best, y: o.y + dy * best });
    }
  }
  return out.sort((p, q) => p.a - q.a);
}

export function polyPath(g: CanvasRenderingContext2D, poly: Pt[]) {
  g.beginPath();
  poly.forEach((q, i) => {
    if (i) g.lineTo(q.x, q.y);
    else g.moveTo(q.x, q.y);
  });
  g.closePath();
}

export function glow({ x, y }: Pt, r: number, col: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.globalAlpha = 1;
}

export function ring({ x, y }: Pt, f: number, col: string) {
  ctx.strokeStyle = col;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 24, -1.57, -1.57 + 6.28 * f);
  ctx.stroke();
}

/** Sparks and debris; glowing ones are drawn later, in the light pass. */
export function particles(r: Raid, lit: boolean) {
  for (const q of r.parts)
    if (q.glow === lit) {
      ctx.globalAlpha = clamp(q.life * 3, 0, 1);
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x - 2, q.y - 2, 4, 4);
    }
  ctx.globalAlpha = 1;
}
