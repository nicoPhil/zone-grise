import { describe, expect, it } from "vitest";
import type { Rect } from "../src/util";
import { inWall, los, segHits } from "../src/world/geometry";
import { genMap, W } from "../src/world/mapgen";
import { wallsIn } from "../src/world/wallindex";

const MAPS = 20;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const meets = (w: Rect, b: { x0: number; y0: number; x1: number; y1: number }) =>
  w.x <= b.x1 && w.x + w.w >= b.x0 && w.y <= b.y1 && w.y + w.h >= b.y0;

describe("wall index", () => {
  it("returns every wall meeting a box, once and in list order", () => {
    for (let m = 0; m < MAPS; m++) {
      const { walls } = genMap();
      for (let q = 0; q < 200; q++) {
        const x0 = rnd(-100, W),
          y0 = rnd(-100, W),
          b = { x0, y0, x1: x0 + rnd(0, 700), y1: y0 + rnd(0, 700) };
        const got = wallsIn(walls, b);
        expect(got.filter((w) => meets(w, b))).toEqual(walls.filter((w) => meets(w, b)));
        expect(new Set(got).size).toBe(got.length);
      }
    }
  });

  it("answers line of sight and wall tests like a scan of every wall", () => {
    for (let m = 0; m < MAPS; m++) {
      const { walls } = genMap();
      for (let q = 0; q < 300; q++) {
        const a = { x: rnd(0, W), y: rnd(0, W) },
          t = rnd(0, 6.28),
          b = { x: a.x + 600 * Math.cos(t), y: a.y + 600 * Math.sin(t) };
        expect(los(walls, a, b)).toBe(!walls.some((w) => segHits(a, b, w)));
        const pad = rnd(0, 30);
        expect(inWall(walls, a.x, a.y, pad)).toBe(
          walls.some((w) => a.x > w.x - pad && a.x < w.x + w.w + pad && a.y > w.y - pad && a.y < w.y + w.h + pad),
        );
      }
    }
  });

  it("sees a wall pushed after the list was first queried", () => {
    const walls: Rect[] = [{ x: 0, y: 0, w: 10, h: 10 }];
    expect(inWall(walls, 500, 500)).toBe(false);
    walls.push({ x: 490, y: 490, w: 20, h: 20 });
    expect(inWall(walls, 500, 500)).toBe(true);
  });
});
