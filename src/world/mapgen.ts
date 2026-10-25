import { FREE, KEYS, def, mk, type Item, type ItemDef } from "../items";
import { clamp, overlaps, pick, rnd, type Pt, type Rect } from "../util";
import { inWall } from "./geometry";

export const W = 6000,
  H = 6000,
  TH = 20,
  DOOR = 84;
/** Map area over the first 2400 px map's, to scale props and stains. */
export const AREA = (W * H) / 2400 ** 2;

export interface Building extends Rect {
  rooms: Rect[];
  /** every door gap, outer and inner, as the rect a locked door would fill */
  doors: Rect[];
  floor: number;
}

/** 0 at the map edge, 1 at the centre: drives loot rarity and building density. */
export const depth = (x: number, y: number) => clamp(1 - Math.hypot(x - W / 2, y - H / 2) / (W * 0.62), 0, 1);

function cut(a: number, b: number, doors: number[]): [number, number][] {
  let s: [number, number][] = [[a, b]];
  for (const d of doors)
    s = s.flatMap(([u, v]): [number, number][] =>
      d - DOOR / 2 > u && d + DOOR / 2 < v
        ? [
            [u, d - DOOR / 2],
            [d + DOOR / 2, v],
          ]
        : [[u, v]],
    );
  return s.filter(([u, v]) => v - u > 4);
}
const hWall = (walls: Rect[], [a, b]: [number, number], y: number, doors: number[]) => {
  for (const [u, v] of cut(a, b, doors)) walls.push({ x: u, y, w: v - u, h: TH });
};
const vWall = (walls: Rect[], [a, b]: [number, number], x: number, doors: number[]) => {
  for (const [u, v] of cut(a, b, doors)) walls.push({ x, y: u, w: TH, h: v - u });
};

/** `doors` holds every gap already cut in this building: a new partition must leave each of them clear. */
interface Split {
  walls: Rect[];
  out: Rect[];
  doors: Rect[];
}

function splitRooms(s: Split, r: Rect, lvl: number) {
  if (lvl >= 3 || Math.max(r.w, r.h) < 280) return void s.out.push(r);
  for (let t = 0; t < 20; t++) {
    if (r.w >= r.h) {
      const sx = r.x + r.w * rnd(0.38, 0.62) - TH / 2;
      if (s.doors.some((d) => overlaps({ x: sx, y: r.y, w: TH, h: r.h }, d, 30))) continue;
      const dy = rnd(r.y + 50, r.y + r.h - 50);
      vWall(s.walls, [r.y, r.y + r.h], sx, [dy]);
      s.doors.push({ x: sx, y: dy - DOOR / 2, w: TH, h: DOOR });
      splitRooms(s, { x: r.x, y: r.y, w: sx - r.x, h: r.h }, lvl + 1);
      splitRooms(s, { x: sx + TH, y: r.y, w: r.x + r.w - sx - TH, h: r.h }, lvl + 1);
      return;
    }
    const sy = r.y + r.h * rnd(0.38, 0.62) - TH / 2;
    if (s.doors.some((d) => overlaps({ x: r.x, y: sy, w: r.w, h: TH }, d, 30))) continue;
    const dx = rnd(r.x + 50, r.x + r.w - 50);
    hWall(s.walls, [r.x, r.x + r.w], sy, [dx]);
    s.doors.push({ x: dx - DOOR / 2, y: sy, w: DOOR, h: TH });
    splitRooms(s, { x: r.x, y: r.y, w: r.w, h: sy - r.y }, lvl + 1);
    splitRooms(s, { x: r.x, y: sy + TH, w: r.w, h: r.y + r.h - sy - TH }, lvl + 1);
    return;
  }
  s.out.push(r);
}

/** A building's footprint: sparse at the edge, bigger towards the centre; null when rolled out. */
function footprint(): Rect | null {
  const cx = rnd(400, W - 400),
    cy = rnd(400, H - 400),
    d = depth(cx, cy);
  if (Math.random() > 0.25 + d) return null;
  const w = rnd(450, 560 + 280 * d),
    h = rnd(390, 470 + 220 * d);
  return { x: clamp(cx - w / 2, 170, W - 170 - w), y: clamp(cy - h / 2, 170, H - 170 - h), w, h };
}

function genBuildings(walls: Rect[]): Building[] {
  const bs: Building[] = [];
  for (let t = 0; t < 4000 && bs.length < 48; t++) {
    const f = footprint();
    if (!f || bs.some((b) => overlaps(f, b, 150))) continue;
    const { x, y, w, h } = f;
    const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5).slice(0, Math.random() < 0.5 ? 1 : 2);
    const doors: Rect[] = [];
    const door = (side: number, a: number, b: number) => {
      if (!sides.includes(side)) return [];
      const c = rnd(a + 70, b - 70);
      doors.push(
        side < 2
          ? { x: c - DOOR / 2, y: side ? y + h - TH : y, w: DOOR, h: TH }
          : { x: side === 2 ? x : x + w - TH, y: c - DOOR / 2, w: TH, h: DOOR },
      );
      return [c];
    };
    hWall(walls, [x, x + w], y, door(0, x, x + w));
    hWall(walls, [x, x + w], y + h - TH, door(1, x, x + w));
    vWall(walls, [y + TH, y + h - TH], x, door(2, y + TH, y + h - TH));
    vWall(walls, [y + TH, y + h - TH], x + w - TH, door(3, y + TH, y + h - TH));
    const rooms: Rect[] = [];
    splitRooms({ walls, out: rooms, doors }, { x: x + TH, y: y + TH, w: w - 2 * TH, h: h - 2 * TH }, 0);
    bs.push({ x, y, w, h, rooms, doors, floor: Math.floor(rnd(0, 3)) });
  }
  return bs;
}

/** A free-standing wall: long and horizontal, long and vertical, or a block. */
function strayWall(k: number): { w: number; h: number } {
  if (k < 0.45) return { w: rnd(120, 260), h: 24 };
  if (k < 0.9) return { w: 24, h: rnd(120, 260) };
  return { w: rnd(60, 120), h: rnd(60, 120) };
}

export function genMap(): { walls: Rect[]; bld: Building[] } {
  const walls: Rect[] = [
    { x: -40, y: -40, w: W + 80, h: 40 },
    { x: -40, y: H, w: W + 80, h: 40 },
    { x: -40, y: 0, w: 40, h: H },
    { x: W, y: 0, w: 40, h: H },
  ];
  const bld = genBuildings(walls);
  for (let i = 0; i < 22 * AREA; i++) {
    const x = rnd(100, W - 300),
      y = rnd(100, H - 300),
      k = Math.random();
    const { w, h } = strayWall(k);
    if (!bld.some((b) => overlaps({ x, y, w, h }, b, 70))) walls.push({ x, y, w, h });
  }
  return { walls, bld };
}

export const inBld = (bld: Building[], x: number, y: number, pad = 0) =>
  bld.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);

export function freePt(walls: Rect[], pad: number, ok: (x: number, y: number) => boolean = () => true): Pt {
  for (let i = 0; i < 800; i++) {
    const x = rnd(80, W - 80),
      y = rnd(80, H - 80);
    if (!inWall(walls, x, y, pad) && ok(x, y)) return { x, y };
  }
  return { x: W / 2, y: H / 2 };
}

export const EDGE = 260,
  ENTRY_EXIT_D = 0.7 * W,
  ENTRY_VAULT_D = 0.54 * W,
  EXITS_APART = 0.42 * W;

/** The player enters at the map edge, away from the vault, with both exits across the map. */
export function placeEntries(walls: Rect[], bld: Building[], vault: Pt | null): { sp: Pt; exits: Pt[] } {
  const edge = (x: number, y: number) => Math.min(x, y, W - x, H - y) < EDGE && !inBld(bld, x, y, 60);
  const away = (o: Pt, m: number) => (x: number, y: number) => Math.hypot(x - o.x, y - o.y) > m;
  const sp = freePt(walls, 30, (x, y) => edge(x, y) && (!vault || away(vault, ENTRY_VAULT_D)(x, y)));
  const e1 = freePt(walls, 70, (x, y) => edge(x, y) && away(sp, ENTRY_EXIT_D)(x, y));
  const e2 = freePt(walls, 70, (x, y) => edge(x, y) && away(sp, ENTRY_EXIT_D)(x, y) && away(e1, EXITS_APART)(x, y));
  return { sp, exits: [e1, e2] };
}

function lootTypes(kit: boolean): ItemDef["t"][] {
  const tr = Math.random(),
    [val, med, wpn] = kit ? [0.3, 0.4, 0.7] : [0.64, 0.78, 0.88];
  if (tr < val) return ["val"];
  if (tr < med) return ["med", "stim"];
  return tr < wpn ? ["wpn"] : ["gear"];
}

function rarity(x: number, d: number) {
  if (x < 0.02 + 0.1 * d) return 3;
  if (x < 0.1 + 0.28 * d) return 2;
  return x < 0.42 + 0.2 * d ? 1 : 0;
}

/** Crate loot of depth d; a military crate (kit) leans towards weapons and worn gear. */
export function rollItem(d: number, minR = 0, kit = false): Item {
  const x = Math.random();
  const r = Math.max(minR, rarity(x, d));
  const types = lootTypes(kit);
  const ofType = KEYS.filter((k) => types.includes(def(k).t) && k !== FREE);
  for (let k = r; k >= 0; k--) {
    const c = ofType.filter((id) => def(id).r === k);
    if (c.length) return mk(pick(c));
  }
  return mk(pick(ofType));
}
