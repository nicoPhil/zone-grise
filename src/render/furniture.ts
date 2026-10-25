import { overlaps, pick, rnd, type Pt, type Rect } from "../util";
import type { Building } from "../world/mapgen";
import type { Tile } from "./assets";
import type { Decor } from "./decor";

/** Furniture tile edge on the map; Kenney pieces have their back on the tile's top side. */
const U = 40;

/** A piece is one or more tiles laid side by side, drawn at `k` × U. */
interface Piece {
  t: Tile[];
  k?: number;
}
const p = (k: number, ...t: Tile[]): Piece => ({ t, k });

const SOFA = [p(1, [14, 16], [15, 16], [16, 16]), p(1, [14, 18], [15, 18], [17, 18])];
const ARMCHAIR = [p(1, [17, 16]), p(1, [18, 16]), p(1, [17, 17]), p(1, [18, 18])];
const TV = [p(1, [19, 19]), p(1, [18, 19])];
const BED = [p(2, [24, 19]), p(2, [24, 15])];
const KITCHEN = [p(1, [23, 10], [25, 10], [26, 10], [24, 10]), p(1, [23, 11], [25, 11], [26, 11], [24, 11])];
const BATH = [p(1, [23, 5], [24, 5])];
const DESK = [p(1, [20, 19], [22, 19]), p(1, [20, 19], [21, 19])];
const SHELF = [p(1, [20, 18], [21, 18], [22, 18], [23, 18])];
const CRATES = [p(1, [20, 4], [21, 4]), p(1, [20, 5]), p(1, [18, 11], [19, 11]), p(1, [20, 11])];
const SMALL = [p(1, [24, 16]), p(0.8, [25, 4]), p(0.7, [23, 4])];
const CHAIRS: Tile[] = [
  [14, 19],
  [15, 19],
  [16, 19],
  [17, 19],
];
const RUGS: Tile[][] = [
  [
    [18, 12],
    [19, 12],
    [20, 12],
    [18, 13],
    [19, 13],
    [20, 13],
    [18, 14],
    [19, 14],
    [20, 14],
  ],
  [
    [21, 12],
    [22, 12],
    [23, 12],
    [21, 13],
    [22, 13],
    [23, 13],
    [21, 14],
    [22, 14],
    [23, 14],
  ],
];

export type Fit = "house" | "industry" | "camp";

/** One room being furnished: where pieces land, and the dice for this room. */
interface Room {
  out: Decor[];
  under: Decor[];
  rm: Rect;
  doors: Rect[];
  mess: number;
  sides: number[];
  small: boolean;
  big: boolean;
}

/** Rooms by size: bathrooms and storerooms are small, living rooms large; `mess` knocks pieces askew and leaves some missing. */
export function furnish(bld: Building[], fit: Fit, mess: number): Decor[] {
  // rugs lie under everything and don't stop furniture from standing on them
  const out: Decor[] = [],
    under: Decor[] = [];
  for (const b of bld)
    for (const rm of b.rooms) {
      const sides = [0, 1, 2, 3].sort(() => Math.random() - 0.5),
        area = rm.w * rm.h;
      const room: Room = { out, under, rm, doors: b.doors, mess, sides, small: area < 170 * 170, big: area > 230 * 230 };
      FITS[fit](room);
      // a few plants, lamps and side tables wherever there is wall left
      for (const s of sides) if (Math.random() < 0.6) put(room, pick(SMALL), s);
    }
  return [...under, ...out];
}

/** Some pieces go missing in a messy place. */
function put(room: Room, pc: Piece, side: number) {
  if (Math.random() < room.mess * 0.4) return;
  against(room, pc, side);
}

const FITS: Record<Fit, (room: Room) => void> = {
  industry: (room) => {
    const { sides } = room;
    if (room.small || Math.random() < 0.5) for (const s of [...sides, ...sides]) put(room, pick(CRATES), s);
    else {
      put(room, pick(DESK), sides[0]);
      put(room, pick(SHELF), sides[1]);
      put(room, pick(DESK), sides[2]);
    }
  },
  // field infirmary: cots along the walls, supplies in the corners
  camp: (room) => {
    for (const s of room.sides.slice(0, room.small ? 1 : 3)) put(room, pick(BED), s);
    put(room, pick(CRATES), room.sides[3]);
  },
  house: (room) => {
    if (room.small) bathroom(room);
    else if (room.big) livingRoom(room);
    else if (Math.random() < 0.5) bedroom(room);
    else kitchen(room);
  },
};

function bathroom(room: Room) {
  put(room, Math.random() < 0.5 ? BATH[0] : pick(SMALL), room.sides[0]);
  put(room, pick(SMALL), room.sides[1]);
}

function livingRoom(room: Room) {
  const { sides } = room;
  if (Math.random() < 0.7) rug(room.under, room.rm, pick(RUGS), room.mess);
  put(room, pick(SOFA), sides[0]);
  put(room, pick(TV), opposite(sides[0]));
  put(room, pick(ARMCHAIR), sides[0]);
  put(room, pick(ARMCHAIR), sides[1] === opposite(sides[0]) ? sides[2] : sides[1]);
}

function bedroom(room: Room) {
  put(room, pick(BED), room.sides[0]);
  put(room, SMALL[0], room.sides[0]);
  put(room, pick(SMALL), room.sides[1]);
}

function kitchen(room: Room) {
  put(room, pick(KITCHEN), room.sides[0]);
  put(room, SHELF[0], room.sides[1]);
  table(room.out, room.rm, room.mess);
}

const opposite = (s: number) => [1, 0, 3, 2][s];

/** Lay a piece flat against one wall of the room (0 top, 1 bottom, 2 left, 3 right), its back to the wall, clear of the doors. */
function against(room: Room, pc: Piece, side: number) {
  const s = (pc.k ?? 1) * U,
    len = pc.t.length * s,
    along = side < 2 ? room.rm.w : room.rm.h;
  if (len > along - 20) return;
  for (let tries = 0; tries < 8; tries++) if (place(room, pc, side, { s, len, off: rnd(10 + len / 2, along - 10 - len / 2) })) return;
}

/** Centre of a piece of depth `s` set `off` along the wall `side`. */
function anchor(rm: Rect, side: number, s: number, off: number): Pt {
  if (side === 0) return { x: rm.x + off, y: rm.y + s / 2 + 2 };
  if (side === 1) return { x: rm.x + off, y: rm.y + rm.h - s / 2 - 2 };
  if (side === 2) return { x: rm.x + s / 2 + 2, y: rm.y + off };
  return { x: rm.x + rm.w - s / 2 - 2, y: rm.y + off };
}

function place({ out, rm, doors, mess }: Room, pc: Piece, side: number, { s, len, off }: { s: number; len: number; off: number }) {
  const { x: cx, y: cy } = anchor(rm, side, s, off);
  const box = side < 2 ? { x: cx - len / 2, y: cy - s / 2, w: len, h: s } : { x: cx - s / 2, y: cy - len / 2, w: s, h: len };
  if (doors.some((d) => overlaps(box, d, 14)) || out.some((o) => overlaps(box, { x: o.x - o.s / 2, y: o.y - o.s / 2, w: o.s, h: o.s }, -6)))
    return false;
  const rot = [0, Math.PI, -Math.PI / 2, Math.PI / 2][side] + rnd(-1, 1) * mess * 0.6;
  pc.t.forEach((t, i) => {
    const d = (i - (pc.t.length - 1) / 2) * s;
    out.push({ x: cx + Math.cos(rot) * d, y: cy + Math.sin(rot) * d, t, r: rot, s: s + 0.6 });
  });
  return true;
}

function rug(out: Decor[], rm: Rect, tiles: Tile[], mess: number) {
  const cx = rm.x + rm.w / 2,
    cy = rm.y + rm.h / 2,
    r = rnd(-1, 1) * mess * 0.3;
  tiles.forEach((t, i) => {
    const dx = ((i % 3) - 1) * U,
      dy = (Math.floor(i / 3) - 1) * U;
    out.push({ x: cx + dx * Math.cos(r) - dy * Math.sin(r), y: cy + dx * Math.sin(r) + dy * Math.cos(r), t, r, s: U + 0.6 });
  });
}

/** A round table in the middle with chairs around it, some knocked over when the place is a mess. */
function table(out: Decor[], rm: Rect, mess: number) {
  const cx = rm.x + rm.w / 2,
    cy = rm.y + rm.h / 2;
  out.push({ x: cx, y: cy, t: [19, 18], r: 0, s: U * 1.4 });
  for (let i = 0; i < 4; i++) {
    if (Math.random() < mess * 0.5) continue;
    const a = (i * Math.PI) / 2 + rnd(-0.2, 0.2) - Math.PI / 2;
    out.push({
      x: cx + Math.cos(a) * U * 1.1,
      y: cy + Math.sin(a) * U * 1.1,
      t: pick(CHAIRS),
      r: a + Math.PI / 2 + rnd(-1, 1) * mess,
      s: U * 0.85,
    });
  }
}
