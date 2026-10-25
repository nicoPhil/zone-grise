import type { Rect } from "../util";

/** Side of a cell of the wall index, px. */
const CELL = 200;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Index {
  n: number;
  cells: Map<number, number[]>;
  stamp: Uint32Array;
  tick: number;
}

const cache = new WeakMap<Rect[], Index>();
const key = (i: number, j: number) => i * 4096 + j;

function forCells(b: Box, f: (k: number) => void) {
  for (let i = Math.floor(b.x0 / CELL); i <= Math.floor(b.x1 / CELL); i++)
    for (let j = Math.floor(b.y0 / CELL); j <= Math.floor(b.y1 / CELL); j++) f(key(i, j));
}

function build(walls: Rect[]): Index {
  const cells = new Map<number, number[]>();
  for (const [id, w] of walls.entries())
    forCells({ x0: w.x, y0: w.y, x1: w.x + w.w, y1: w.y + w.h }, (k) => {
      const c = cells.get(k);
      if (c) c.push(id);
      else cells.set(k, [id]);
    });
  return { n: walls.length, cells, stamp: new Uint32Array(walls.length), tick: 0 };
}

// wall lists only grow in place (map generation) or get replaced, so a length change is the only staleness to catch
function indexOf(walls: Rect[]) {
  let ix = cache.get(walls);
  if (!ix || ix.n !== walls.length) {
    ix = build(walls);
    cache.set(walls, ix);
  }
  return ix;
}

/** Walls that may meet the box, each once and in list order (pushes out of walls depend on it). */
export function wallsIn(walls: Rect[], b: Box): Rect[] {
  const ix = indexOf(walls),
    ids: number[] = [],
    tick = ++ix.tick;
  forCells(b, (k) => {
    for (const id of ix.cells.get(k) ?? [])
      if (ix.stamp[id] !== tick) {
        ix.stamp[id] = tick;
        ids.push(id);
      }
  });
  return ids.sort((a, b) => a - b).map((id) => walls[id]);
}

export const around = (x: number, y: number, pad: number): Box => ({ x0: x - pad, y0: y - pad, x1: x + pad, y1: y + pad });
export const spanOf = (ax: number, ay: number, bx: number, by: number): Box => ({
  x0: Math.min(ax, bx),
  y0: Math.min(ay, by),
  x1: Math.max(ax, bx),
  y1: Math.max(ay, by),
});
