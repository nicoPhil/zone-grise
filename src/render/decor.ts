import { pick, rnd, type Pt, type Rect } from "../util";
import { inWall } from "../world/geometry";
import { H, W, depth, inBld, type Building } from "../world/mapgen";
import { T, type Tile } from "./assets";

export interface Decal {
  c: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
}
export interface Decor extends Pt {
  t: Tile;
  r: number;
  s: number;
}

export const GN = Math.ceil(W / T);
const DEBRIS: Tile[] = [[18, 9], [19, 9], [20, 9], [18, 10], [19, 10], [20, 10], [21, 10], [22, 10], [21, 9], [22, 9]];
const LOOSE: Tile[] = [[20, 8], [21, 8], [22, 8], [25, 5], [23, 7], [18, 8], [19, 8], [22, 11]];

/** Half-resolution layer under everything: dirt stains, then blood and casings stamped during the raid. */
export function makeDecal(): Decal {
  const c = document.createElement("canvas");
  c.width = W / 2;
  c.height = H / 2;
  const g = c.getContext("2d")!;
  g.scale(0.5, 0.5);
  for (let i = 0; i < 150; i++) {
    const x = rnd(0, W), y = rnd(0, H), r = rnd(30, 150), gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, Math.random() < 0.5 ? "rgba(52,44,30,.35)" : "rgba(0,0,0,.3)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  return { c, g };
}

/** Grass at the edge, dirt further in, concrete at the centre where the loot is best. */
export function makeGround(): Tile[] {
  const s1 = rnd(0, 9), s2 = rnd(0, 9), m: Tile[] = new Array(GN * GN);
  for (let j = 0; j < GN; j++)
    for (let i = 0; i < GN; i++) {
      const n = 0.12 * Math.sin(i * 0.45 + s1) * Math.cos(j * 0.38 + s2) + rnd(-0.04, 0.04);
      const d = depth((i + 0.5) * T, (j + 0.5) * T) + n;
      m[j * GN + i] = d > 0.56 ? [pick([6, 6, 7, 7, 8]), 0] : d > 0.3 ? [Math.random() < 0.8 ? 4 : 5, 0] : [Math.floor(rnd(0, 4)), 0];
    }
  return m;
}

export function makeDecor(walls: Rect[], bld: Building[]): Decor[] {
  const out: Decor[] = [];
  for (const w of walls.slice(4))
    for (let i = 0; i < (w.w + w.h) / 60; i++) {
      const x = rnd(w.x - 30, w.x + w.w + 30), y = rnd(w.y - 30, w.y + w.h + 30);
      if (!inWall(walls, x, y, 6)) out.push({ x, y, t: pick(DEBRIS), r: rnd(0, 6.28), s: rnd(30, 44) });
    }
  for (let i = 0; i < 170; i++) {
    const x = rnd(40, W - 40), y = rnd(40, H - 40);
    if (!inWall(walls, x, y, 10) && !inBld(bld, x, y, 10)) out.push({ x, y, t: pick(LOOSE), r: rnd(0, 6.28), s: rnd(26, 40) });
  }
  return out;
}

export function blood({ g }: Decal, x: number, y: number, n: number, big: boolean) {
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28), d = big ? rnd(0, 24) : rnd(4, 18), r = big ? rnd(3, 11) : rnd(1.5, 4);
    g.fillStyle = `rgba(${Math.round(rnd(85, 125))},12,16,${rnd(0.55, 0.85).toFixed(2)})`;
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, 6.28);
    g.fill();
  }
}

export function stampCasing({ g }: Decal, x: number, y: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.fillStyle = "#9c7a35";
  g.fillRect(-3, -1.2, 6, 2.4);
  g.restore();
}
