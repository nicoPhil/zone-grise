import { KEYS, def, mk, type Item } from "../items";
import { clamp, overlaps, pick, rnd, type Pt, type Rect } from "../util";
import { inWall } from "./geometry";

export const W = 2400, H = 2400, TH = 20, DOOR = 84;

export interface Building extends Rect {
  rooms: Rect[];
  floor: number;
}

/** 0 at the map edge, 1 at the centre: drives loot rarity and building density. */
export const depth = (x: number, y: number) => clamp(1 - Math.hypot(x - W / 2, y - H / 2) / (W * 0.62), 0, 1);

function cut(a: number, b: number, doors: number[]): [number, number][] {
  let s: [number, number][] = [[a, b]];
  for (const d of doors)
    s = s.flatMap(([u, v]): [number, number][] =>
      d - DOOR / 2 > u && d + DOOR / 2 < v ? [[u, d - DOOR / 2], [d + DOOR / 2, v]] : [[u, v]]);
  return s.filter(([u, v]) => v - u > 4);
}
const hWall = (walls: Rect[], a: number, b: number, y: number, doors: number[]) =>
  cut(a, b, doors).forEach(([u, v]) => walls.push({ x: u, y, w: v - u, h: TH }));
const vWall = (walls: Rect[], a: number, b: number, x: number, doors: number[]) =>
  cut(a, b, doors).forEach(([u, v]) => walls.push({ x, y: u, w: TH, h: v - u }));

// `doors` holds every gap already cut in this building: a new partition must leave each of them clear
function splitRooms(walls: Rect[], r: Rect, lvl: number, out: Rect[], doors: Rect[]) {
  if (lvl >= 2 || Math.max(r.w, r.h) < 280) return void out.push(r);
  for (let t = 0; t < 20; t++) {
    if (r.w >= r.h) {
      const sx = r.x + r.w * rnd(0.38, 0.62) - TH / 2;
      if (doors.some((d) => overlaps({ x: sx, y: r.y, w: TH, h: r.h }, d, 30))) continue;
      const dy = rnd(r.y + 50, r.y + r.h - 50);
      vWall(walls, r.y, r.y + r.h, sx, [dy]);
      doors.push({ x: sx, y: dy - DOOR / 2, w: TH, h: DOOR });
      splitRooms(walls, { x: r.x, y: r.y, w: sx - r.x, h: r.h }, lvl + 1, out, doors);
      splitRooms(walls, { x: sx + TH, y: r.y, w: r.x + r.w - sx - TH, h: r.h }, lvl + 1, out, doors);
      return;
    }
    const sy = r.y + r.h * rnd(0.38, 0.62) - TH / 2;
    if (doors.some((d) => overlaps({ x: r.x, y: sy, w: r.w, h: TH }, d, 30))) continue;
    const dx = rnd(r.x + 50, r.x + r.w - 50);
    hWall(walls, r.x, r.x + r.w, sy, [dx]);
    doors.push({ x: dx - DOOR / 2, y: sy, w: DOOR, h: TH });
    splitRooms(walls, { x: r.x, y: r.y, w: r.w, h: sy - r.y }, lvl + 1, out, doors);
    splitRooms(walls, { x: r.x, y: sy + TH, w: r.w, h: r.y + r.h - sy - TH }, lvl + 1, out, doors);
    return;
  }
  out.push(r);
}

function genBuildings(walls: Rect[]): Building[] {
  const bs: Building[] = [];
  for (let t = 0; t < 600 && bs.length < 12; t++) {
    const w = rnd(300, 560), h = rnd(260, 460), x = rnd(170, W - 170 - w), y = rnd(170, H - 170 - h);
    if (Math.random() > 0.25 + depth(x + w / 2, y + h / 2)) continue;
    if (bs.some((b) => overlaps({ x, y, w, h }, b, 150))) continue;
    const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 1 : 2);
    const doors: Rect[] = [];
    const door = (side: number, a: number, b: number) => {
      if (!sides.includes(side)) return [];
      const c = rnd(a + 70, b - 70);
      doors.push(side < 2
        ? { x: c - DOOR / 2, y: side ? y + h - TH : y, w: DOOR, h: TH }
        : { x: side === 2 ? x : x + w - TH, y: c - DOOR / 2, w: TH, h: DOOR });
      return [c];
    };
    hWall(walls, x, x + w, y, door(0, x, x + w));
    hWall(walls, x, x + w, y + h - TH, door(1, x, x + w));
    vWall(walls, y + TH, y + h - TH, x, door(2, y + TH, y + h - TH));
    vWall(walls, y + TH, y + h - TH, x + w - TH, door(3, y + TH, y + h - TH));
    const rooms: Rect[] = [];
    splitRooms(walls, { x: x + TH, y: y + TH, w: w - 2 * TH, h: h - 2 * TH }, 0, rooms, doors);
    bs.push({ x, y, w, h, rooms, floor: Math.floor(rnd(0, 3)) });
  }
  return bs;
}

export function genMap(): { walls: Rect[]; bld: Building[] } {
  const walls: Rect[] = [
    { x: -40, y: -40, w: W + 80, h: 40 }, { x: -40, y: H, w: W + 80, h: 40 },
    { x: -40, y: 0, w: 40, h: H }, { x: W, y: 0, w: 40, h: H },
  ];
  const bld = genBuildings(walls);
  for (let i = 0; i < 22; i++) {
    const x = rnd(100, W - 300), y = rnd(100, H - 300), k = Math.random();
    const w = k < 0.45 ? rnd(120, 260) : k < 0.9 ? 24 : rnd(60, 120);
    const h = k < 0.45 ? 24 : k < 0.9 ? rnd(120, 260) : rnd(60, 120);
    if (!bld.some((b) => overlaps({ x, y, w, h }, b, 70))) walls.push({ x, y, w, h });
  }
  return { walls, bld };
}

export const inBld = (bld: Building[], x: number, y: number, pad = 0) =>
  bld.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);

export function freePt(walls: Rect[], pad: number, ok: (x: number, y: number) => boolean = () => true): Pt {
  for (let i = 0; i < 800; i++) {
    const x = rnd(80, W - 80), y = rnd(80, H - 80);
    if (!inWall(walls, x, y, pad) && ok(x, y)) return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}

export function rollItem(d: number): Item {
  const x = Math.random();
  const r = x < 0.02 + 0.1 * d ? 3 : x < 0.1 + 0.28 * d ? 2 : x < 0.42 + 0.2 * d ? 1 : 0;
  const tr = Math.random(), t = tr < 0.62 ? "val" : tr < 0.76 ? "med" : tr < 0.9 ? "wpn" : "arm";
  if (t === "med") return mk("med");
  const ofType = KEYS.filter((k) => def(k).t === t && k !== "rusty");
  for (let k = r; k >= 0; k--) {
    const c = ofType.filter((id) => def(id).r === k);
    if (c.length) return mk(pick(c));
  }
  return mk(pick(ofType));
}
