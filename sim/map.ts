import { pick, rnd, type Pt, type Rect } from "../src/util";
import { inWall } from "../src/world/geometry";
import { depth, freePt, genMap, inBld } from "../src/world/mapgen";
import { ringOf } from "../src/world/rings";

/** Where a crate stands: its ring, whether it is indoors, and its raw map depth before the zone remaps it. */
export interface CrateSpot {
  ring: number;
  inside: boolean;
  d: number;
}

// copied from populate() in src/raid/start.ts, without the distance to the entry point
const CRATES = 80,
  ROOM_CRATES = 52;

function randIn(walls: Rect[], rm: Rect, pad: number): Pt | null {
  for (let t = 0; t < 60; t++) {
    const x = rnd(rm.x + pad, rm.x + rm.w - pad),
      y = rnd(rm.y + pad, rm.y + rm.h - pad);
    if (!inWall(walls, x, y, pad)) return { x, y };
  }
  return null;
}

export function sampleMap(): CrateSpot[] {
  const { walls, bld } = genMap();
  const rooms = bld.flatMap((b) => b.rooms);
  const out: CrateSpot[] = [];
  for (let i = 0; i < CRATES; i++) {
    const room = i < ROOM_CRATES;
    const c = (room && rooms.length && randIn(walls, pick(rooms), 30)) || freePt(walls, 30, (x, y) => room || !inBld(bld, x, y, 10));
    out.push({ ring: ringOf(c.x, c.y), inside: inBld(bld, c.x, c.y), d: depth(c.x, c.y) });
  }
  return out;
}
